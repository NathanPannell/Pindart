from dataclasses import dataclass
import re
from urllib.parse import urlencode

import httpx


class GithubOAuthError(Exception):
    def __init__(self, message: str, expired: bool = False):
        super().__init__(message)
        self.expired = expired


TOKEN_PATTERN = re.compile(r"[A-Za-z0-9_-]{16,4096}\Z")


@dataclass(frozen=True)
class TokenSet:
    access_token: str
    refresh_token: str | None = None
    expires_in: int | None = None
    refresh_token_expires_in: int | None = None

    def as_response(self) -> dict:
        result = {"access_token": self.access_token, "token_type": "bearer"}
        if self.refresh_token is not None:
            result.update({
                "refresh_token": self.refresh_token,
                "expires_in": self.expires_in,
                "refresh_token_expires_in": self.refresh_token_expires_in,
            })
        return result


def parse_token_response(payload: dict) -> TokenSet:
    if payload.get("error"):
        raise GithubOAuthError("GitHub rejected the token request", expired=payload["error"] == "bad_refresh_token")
    access_token = payload.get("access_token")
    token_type = payload.get("token_type")
    if not isinstance(token_type, str) or token_type.lower() != "bearer" or not isinstance(access_token, str) or not TOKEN_PATTERN.fullmatch(access_token):
        raise GithubOAuthError("GitHub did not return a usable access token")
    scopes = payload.get("scope")
    if not isinstance(scopes, str) or "repo" not in {scope.strip() for scope in scopes.split(",")}:
        raise GithubOAuthError("GitHub did not grant repository access")
    refresh_token = payload.get("refresh_token")
    expires_in = payload.get("expires_in")
    refresh_expires_in = payload.get("refresh_token_expires_in")
    if refresh_token is None and expires_in is None and refresh_expires_in is None:
        return TokenSet(access_token)
    if not isinstance(refresh_token, str) or not TOKEN_PATTERN.fullmatch(refresh_token):
        raise GithubOAuthError("GitHub returned an incomplete token pair")
    if type(expires_in) is not int or not 0 < expires_in <= 31_536_000:
        raise GithubOAuthError("GitHub returned an invalid access token expiry")
    if type(refresh_expires_in) is not int or not 0 < refresh_expires_in <= 31_536_000:
        raise GithubOAuthError("GitHub returned an invalid refresh token expiry")
    return TokenSet(access_token, refresh_token, expires_in, refresh_expires_in)


class GithubOAuth:
    def __init__(self, client_id: str, client_secret: str, callback_uri: str, client: httpx.Client | None = None):
        self.client_id = client_id
        self.client_secret = client_secret
        self.callback_uri = callback_uri
        self.client = client or httpx.Client(timeout=10)

    def authorization_url(self, state: str, code_challenge: str) -> str:
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.callback_uri,
            "scope": "repo offline_access",
            "state": state,
            "code_challenge": code_challenge,
            "code_challenge_method": "S256",
        }
        return "https://github.com/login/oauth/authorize?" + urlencode(params)

    def _request_token(self, data: dict) -> TokenSet:
        try:
            response = self.client.post(
                "https://github.com/login/oauth/access_token",
                headers={"Accept": "application/json"},
                data={"client_id": self.client_id, "client_secret": self.client_secret, **data},
            )
            payload = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise GithubOAuthError("GitHub token exchange failed") from exc
        if not isinstance(payload, dict):
            raise GithubOAuthError("GitHub returned an invalid token response")
        if payload.get("error"):
            raise GithubOAuthError("GitHub rejected the token request", expired=payload["error"] == "bad_refresh_token")
        try:
            response.raise_for_status()
        except httpx.HTTPError as exc:
            raise GithubOAuthError("GitHub token exchange failed") from exc
        return parse_token_response(payload)

    def exchange(self, code: str, code_verifier: str) -> TokenSet:
        return self._request_token({"code": code, "redirect_uri": self.callback_uri, "code_verifier": code_verifier})

    def refresh(self, refresh_token: str) -> TokenSet:
        result = self._request_token({"grant_type": "refresh_token", "refresh_token": refresh_token})
        if result.refresh_token is None:
            raise GithubOAuthError("GitHub did not rotate the refresh token")
        return result
