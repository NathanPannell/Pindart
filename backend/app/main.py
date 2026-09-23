import json
from contextlib import asynccontextmanager
from urllib.parse import urlencode, urlparse

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, ConfigDict, Field

from .config import Settings
from .github import GithubOAuth, GithubOAuthError
from .security import CHALLENGE_PATTERN, TICKET_PATTERN, VERIFIER_PATTERN, challenge, decrypt_token, digest, encrypt_token, random_urlsafe
from .store import OAuthStore


class StartRequest(BaseModel):
    redirect_uri: str
    proof_challenge: str


class RedeemRequest(BaseModel):
    ticket: str
    proof_verifier: str


class RefreshRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    refresh_token: str = Field(min_length=16, max_length=4096, pattern=r"^[A-Za-z0-9_-]+$")


def create_app(settings: Settings | None = None, store: OAuthStore | None = None, github: GithubOAuth | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.settings = settings or Settings.from_env()
        app.state.store = store or OAuthStore(app.state.settings.database_url)
        app.state.github = github or GithubOAuth(
            app.state.settings.github_client_id,
            app.state.settings.github_client_secret,
            f"{app.state.settings.public_base_url}/auth/github/callback",
        )
        if store is None:
            app.state.store.open()
        try:
            yield
        finally:
            if store is None:
                app.state.store.close()
            if github is None:
                app.state.github.client.close()

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

    @app.middleware("http")
    async def strict_json_and_no_store(request: Request, call_next):
        if request.url.path in ("/auth/github/start", "/auth/github/redeem", "/auth/github/refresh") and request.method == "POST":
            if request.headers.get("content-type", "").split(";", 1)[0].strip().lower() != "application/json":
                return JSONResponse({"detail": "Content-Type must be application/json"}, status_code=415, headers={"Cache-Control": "no-store"})
        response = await call_next(request)
        if request.url.path.startswith("/auth/"):
            response.headers["Cache-Control"] = "no-store"
            response.headers["Referrer-Policy"] = "no-referrer"
        return response

    @app.middleware("http")
    async def exact_extension_cors(request: Request, call_next):
        origin = request.headers.get("origin")
        configured = settings or getattr(request.app.state, "settings", None)
        allowed_origin = f"chrome-extension://{urlparse(configured.extension_redirect_uri).hostname.split('.')[0]}" if configured else None
        if request.method == "OPTIONS" and request.headers.get("access-control-request-method"):
            if origin != allowed_origin:
                return JSONResponse({"detail": "Origin not allowed"}, status_code=403)
            return JSONResponse({}, headers={
                "Access-Control-Allow-Origin": allowed_origin,
                "Access-Control-Allow-Methods": "POST",
                "Access-Control-Allow-Headers": "content-type",
                "Access-Control-Max-Age": "600",
                "Vary": "Origin",
            })
        if origin and origin != allowed_origin and request.url.path.startswith("/auth/"):
            return JSONResponse({"detail": "Origin not allowed"}, status_code=403)
        response = await call_next(request)
        if origin == allowed_origin:
            response.headers["Access-Control-Allow-Origin"] = allowed_origin
            response.headers["Vary"] = "Origin"
        return response

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.get("/ready")
    def ready(request: Request):
        try:
            request.app.state.store.ready()
        except Exception:
            raise HTTPException(503, "Database migration is not ready")
        return {"status": "ready", "git_sha": request.app.state.settings.git_sha}

    @app.post("/auth/github/start")
    def start(payload: StartRequest, request: Request):
        config = request.app.state.settings
        if payload.redirect_uri != config.extension_redirect_uri:
            raise HTTPException(400, "Redirect URI is not allowed")
        if not CHALLENGE_PATTERN.fullmatch(payload.proof_challenge):
            raise HTTPException(400, "Invalid proof challenge")
        state = random_urlsafe()
        pkce_verifier = random_urlsafe()
        request.app.state.store.create_attempt(digest(state), pkce_verifier, payload.proof_challenge)
        return {"authorization_url": request.app.state.github.authorization_url(state, challenge(pkce_verifier))}

    @app.get("/auth/github/callback")
    def callback(request: Request, state: str = "", code: str = "", error: str = ""):
        if not TICKET_PATTERN.fullmatch(state):
            raise HTTPException(400, "Invalid authorization state")
        attempt = request.app.state.store.take_attempt(digest(state))
        if attempt is None:
            raise HTTPException(400, "Authorization state expired or was already used")
        pkce_verifier, proof_challenge = attempt
        redirect_uri = request.app.state.settings.extension_redirect_uri
        if error or not code:
            return RedirectResponse(f"{redirect_uri}?{urlencode({'error': 'access_denied' if error == 'access_denied' else 'authorization_failed'})}", status_code=302)
        try:
            token = request.app.state.github.exchange(code, pkce_verifier)
        except GithubOAuthError:
            return RedirectResponse(f"{redirect_uri}?error=authorization_failed", status_code=302)
        ticket = random_urlsafe()
        ticket_hash = digest(ticket)
        encrypted = encrypt_token(request.app.state.settings.token_encryption_key, ticket_hash, json.dumps(token.as_response()))
        request.app.state.store.create_ticket(ticket_hash, encrypted, proof_challenge)
        return RedirectResponse(f"{redirect_uri}?{urlencode({'ticket': ticket})}", status_code=302)

    @app.post("/auth/github/redeem")
    def redeem(payload: RedeemRequest, request: Request):
        if not TICKET_PATTERN.fullmatch(payload.ticket) or not VERIFIER_PATTERN.fullmatch(payload.proof_verifier):
            raise HTTPException(400, "Invalid ticket or proof")
        ticket_hash = digest(payload.ticket)
        ciphertext = request.app.state.store.take_ticket(ticket_hash, challenge(payload.proof_verifier))
        if ciphertext is None:
            raise HTTPException(400, "Ticket expired, already used, or proof is incorrect")
        token_response = decrypt_token(request.app.state.settings.token_encryption_key, ticket_hash, ciphertext)
        return json.loads(token_response)

    @app.post("/auth/github/refresh")
    def refresh(payload: RefreshRequest, request: Request):
        try:
            tokens = request.app.state.github.refresh(payload.refresh_token)
        except GithubOAuthError as exc:
            if exc.expired:
                raise HTTPException(401, "GitHub session expired. Sign in again.") from exc
            raise HTTPException(502, "GitHub could not refresh this session. Try again.") from exc
        return tokens.as_response()

    return app


app = create_app()
