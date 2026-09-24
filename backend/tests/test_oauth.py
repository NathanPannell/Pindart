import secrets
from urllib.parse import parse_qs, urlparse

import httpx
from fastapi.testclient import TestClient

from app.config import Settings
from app.github import GithubOAuth, GithubOAuthError, parse_token_response
from app.main import create_app
from app.security import challenge


REDIRECT_URI = f"https://{'a' * 32}.chromiumapp.org/github"
PROOF = "b" * 43


class FakeStore:
    def __init__(self):
        self.attempts = {}
        self.tickets = {}

    def ready(self):
        return True

    def create_attempt(self, state_hash, verifier, proof_challenge):
        self.attempts[state_hash] = (verifier, proof_challenge)

    def take_attempt(self, state_hash):
        return self.attempts.pop(state_hash, None)

    def create_ticket(self, ticket_hash, ciphertext, proof_challenge):
        self.tickets[ticket_hash] = (ciphertext, proof_challenge)

    def take_ticket(self, ticket_hash, proof_challenge):
        item = self.tickets.get(ticket_hash)
        if item and secrets.compare_digest(item[1], proof_challenge):
            del self.tickets[ticket_hash]
            return item[0]
        return None


def app_client(github_handler=None):
    settings = Settings(
        database_url="postgresql://unused",
        github_client_id="test-client-id",
        github_client_secret="server-only-secret",
        public_base_url="https://oauth.example.test",
        extension_redirect_uri=REDIRECT_URI,
        token_encryption_key=b"x" * 32,
        git_sha="test-revision",
    )
    request_bodies = []

    def handler(request):
        request_bodies.append(request.content.decode())
        if github_handler:
            return github_handler(request)
        return httpx.Response(200, json={"access_token": "gho_private_token", "token_type": "bearer", "scope": "repo"})

    github = GithubOAuth("test-client-id", "server-only-secret", "https://oauth.example.test/auth/github/callback", httpx.Client(transport=httpx.MockTransport(handler)))
    return TestClient(create_app(settings, FakeStore(), github)), request_bodies


def start(client, verifier):
    response = client.post("/auth/github/start", json={"redirect_uri": REDIRECT_URI, "proof_challenge": challenge(verifier)})
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    authorize = urlparse(response.json()["authorization_url"])
    assert authorize.scheme == "https" and authorize.netloc == "github.com"
    params = parse_qs(authorize.query)
    assert params["scope"] == ["repo offline_access"]
    assert params["redirect_uri"] == ["https://oauth.example.test/auth/github/callback"]
    assert params["code_challenge_method"] == ["S256"]
    return params


def test_successful_login_needs_extension_proof_and_ticket_is_one_time():
    client, request_bodies = app_client()
    verifier = secrets.token_urlsafe(32)
    with client:
        params = start(client, verifier)
        assert "client_secret" not in params
        callback = client.get("/auth/github/callback", params={"state": params["state"][0], "code": "test-code"}, follow_redirects=False)
        assert callback.status_code == 302
        assert callback.headers["location"].startswith(REDIRECT_URI + "?ticket=")
        assert "gho_private_token" not in callback.headers["location"]
        ticket = parse_qs(urlparse(callback.headers["location"]).query)["ticket"][0]
        wrong = client.post("/auth/github/redeem", json={"ticket": ticket, "proof_verifier": secrets.token_urlsafe(32)})
        assert wrong.status_code == 400
        response = client.post("/auth/github/redeem", json={"ticket": ticket, "proof_verifier": verifier})
        assert response.status_code == 200
        assert response.json() == {"access_token": "gho_private_token", "token_type": "bearer"}
        assert response.headers["cache-control"] == "no-store"
        replay = client.post("/auth/github/redeem", json={"ticket": ticket, "proof_verifier": verifier})
        assert replay.status_code == 400
        assert client.get("/auth/github/callback", params={"state": params["state"][0], "code": "test-code"}).status_code == 400
    exchange_body = parse_qs(request_bodies[0])
    assert challenge(exchange_body["code_verifier"][0]) == params["code_challenge"][0]
    assert exchange_body["client_secret"] == ["server-only-secret"]


def test_denied_flow_returns_only_safe_error():
    client, _ = app_client()
    with client:
        params = start(client, secrets.token_urlsafe(32))
        response = client.get("/auth/github/callback", params={"state": params["state"][0], "error": "access_denied"}, follow_redirects=False)
        assert response.status_code == 302
        assert response.headers["location"] == REDIRECT_URI + "?error=access_denied"
        assert client.get("/auth/github/callback", params={"state": params["state"][0], "code": "late"}).status_code == 400


def test_invalid_redirect_origin_and_content_type_rejected():
    client, _ = app_client()
    with client:
        assert client.post("/auth/github/start", json={"redirect_uri": "https://evil.example/github", "proof_challenge": challenge(PROOF)}).status_code == 400
        assert client.post("/auth/github/start", content="{}", headers={"Content-Type": "text/plain"}).status_code == 415
        assert client.get("/auth/github/callback", params={"state": secrets.token_urlsafe(32), "code": "fake"}).status_code == 400
        assert client.post("/auth/github/redeem", json={"ticket": secrets.token_urlsafe(32), "proof_verifier": PROOF}, headers={"Origin": "https://evil.example"}).status_code == 403
        allowed_origin = f"chrome-extension://{'a' * 32}"
        preflight = client.options("/auth/github/redeem", headers={"Origin": allowed_origin, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
        assert preflight.status_code == 200
        assert preflight.headers["access-control-allow-origin"] == allowed_origin


def test_github_rejection_does_not_issue_ticket():
    def reject(_request):
        return httpx.Response(200, json={"error": "bad_verification_code"})

    client, _ = app_client(reject)
    with client:
        params = start(client, secrets.token_urlsafe(32))
        callback = client.get("/auth/github/callback", params={"state": params["state"][0], "code": "bad"}, follow_redirects=False)
        assert callback.headers["location"] == REDIRECT_URI + "?error=authorization_failed"


def test_expiring_grant_returns_refresh_pair_and_refresh_rotates_both_tokens():
    responses = [
        {"access_token": "gho_first_access_token", "refresh_token": "ghr_first_refresh_token", "expires_in": 28800, "refresh_token_expires_in": 15897600, "token_type": "bearer", "scope": "repo"},
        {"access_token": "gho_second_access_token", "refresh_token": "ghr_second_refresh_token", "expires_in": 28800, "refresh_token_expires_in": 15897600, "token_type": "bearer", "scope": "repo"},
    ]

    def rotated(_request):
        return httpx.Response(200, json=responses.pop(0))

    client, bodies = app_client(rotated)
    verifier = secrets.token_urlsafe(32)
    with client:
        params = start(client, verifier)
        callback = client.get("/auth/github/callback", params={"state": params["state"][0], "code": "code"}, follow_redirects=False)
        assert "ghr_first_refresh_token" not in callback.headers["location"]
        ticket = parse_qs(urlparse(callback.headers["location"]).query)["ticket"][0]
        first = client.post("/auth/github/redeem", json={"ticket": ticket, "proof_verifier": verifier})
        assert first.status_code == 200
        assert first.json() == {"access_token": "gho_first_access_token", "token_type": "bearer", "refresh_token": "ghr_first_refresh_token", "expires_in": 28800, "refresh_token_expires_in": 15897600}
        second = client.post("/auth/github/refresh", json={"refresh_token": first.json()["refresh_token"]})
        assert second.status_code == 200
        assert second.headers["cache-control"] == "no-store"
        assert second.json() == {"access_token": "gho_second_access_token", "token_type": "bearer", "refresh_token": "ghr_second_refresh_token", "expires_in": 28800, "refresh_token_expires_in": 15897600}
    refresh_body = parse_qs(bodies[1])
    assert refresh_body["grant_type"] == ["refresh_token"]
    assert refresh_body["refresh_token"] == ["ghr_first_refresh_token"]
    assert refresh_body["client_secret"] == ["server-only-secret"]


def test_invalid_refresh_token_and_expired_github_response():
    def expired(_request):
        return httpx.Response(400, json={"error": "bad_refresh_token"})

    client, _ = app_client(expired)
    with client:
        assert client.post("/auth/github/refresh", json={"refresh_token": "bad token with spaces"}).status_code == 422
        assert client.post("/auth/github/refresh", json={"refresh_token": "ghr_valid_refresh_token", "extra": 1}).status_code == 422
        assert client.post("/auth/github/refresh", content="{}", headers={"Content-Type": "text/plain"}).status_code == 415
        response = client.post("/auth/github/refresh", json={"refresh_token": "ghr_valid_refresh_token"})
        assert response.status_code == 401
        assert response.json()["detail"] == "GitHub session expired. Sign in again."


def test_temporary_github_refresh_failure_returns_retryable_status():
    def unavailable(_request):
        return httpx.Response(503, json={"message": "temporarily unavailable"})

    client, _ = app_client(unavailable)
    with client:
        response = client.post("/auth/github/refresh", json={"refresh_token": "ghr_valid_refresh_token"})
        assert response.status_code == 502
        assert response.headers["cache-control"] == "no-store"


def test_partial_token_pair_is_rejected():
    try:
        parse_token_response({"access_token": "gho_valid_access_token", "refresh_token": "ghr_valid_refresh_token", "token_type": "bearer", "scope": "repo"})
    except GithubOAuthError:
        pass
    else:
        raise AssertionError("Incomplete rotating token pair was accepted")


def test_health_and_readiness():
    client, _ = app_client()
    with client:
        assert client.get("/health").json() == {"status": "ok"}
        assert client.get("/ready").json() == {"status": "ready", "git_sha": "test-revision"}


def test_privacy_policy_is_public_and_hardened():
    client, _ = app_client()
    with client:
        response = client.get("/privacy")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/html")
        assert response.headers["content-security-policy"].startswith("default-src 'none'")
        assert response.headers["referrer-policy"] == "no-referrer"
        assert response.headers["x-content-type-options"] == "nosniff"
        assert "contact@nathanpannell.com" in response.text
        assert "does not receive your screenshots or issue content" in response.text
        assert "up to 10 minutes" in response.text
        assert "up to 60 seconds" in response.text
