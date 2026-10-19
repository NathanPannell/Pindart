# GitHub sign-in service

This FastAPI service is the confidential part of Pindart's GitHub OAuth flow. The extension contains only public configuration. The GitHub client secret stays on the server. GitHub tokens are returned to the extension only after its one-time login proof is verified.

## OAuth app registration

Create one GitHub OAuth app for your deployment. Set its authorization callback URL to `https://<service-url>/auth/github/callback`. The service requests `repo offline_access`: `repo` supports the extension's private-repository and attachment features, while `offline_access` opts a sign-in into [GitHub's expiring-token flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#expiring-access-tokens). Device flow is unnecessary for this service.

The extension's `chrome.identity.getRedirectURL("github")` result must exactly match `EXTENSION_REDIRECT_URI`. That URL has the form `https://<32-character-extension-id>.chromiumapp.org/github`. Keep the extension ID stable: an unpacked extension's ID depends on its folder path unless you pin it with a manifest `key`.

## Environment

| Variable | Use |
| --- | --- |
| `DATABASE_URL` | Pooled Neon Postgres connection for the API. |
| `DATABASE_URL_UNPOOLED` | Direct Neon connection for the migration command only. |
| `GITHUB_CLIENT_ID` | Public OAuth app client ID. |
| `GITHUB_CLIENT_SECRET` | Private OAuth app client secret. |
| `PUBLIC_BASE_URL` | Exact HTTPS Railway service origin, with no path or trailing slash. |
| `EXTENSION_REDIRECT_URI` | Exact Chrome identity redirect URL ending in `/github`. |
| `TOKEN_ENCRYPTION_KEY` | Random 32-byte key, base64url encoded. Protects temporary tokens in Neon. |
| `RAILWAY_GIT_COMMIT_SHA` | Optional revision reported by `/ready`. |

Generate `TOKEN_ENCRYPTION_KEY` with `python -c "import base64,secrets; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip('='))"` and store it in Railway's private environment. Do not commit the generated value. A fresh key invalidates outstanding login tickets only; they expire after 60 seconds.

## Run

From `backend/`, install `requirements.txt`, run `python -m app.migrate` with `DATABASE_URL_UNPOOLED`, then start `uvicorn app.main:app --host 0.0.0.0 --port <port>`. On Railway, use `$PORT` for the port. The migration is repeat-safe and must run before the service is considered ready. `GET /health` reports process liveness; `GET /ready` verifies both tables and reports the deployed revision.

## Extension contract

1. Generate a random PKCE-style `proof_verifier` in the extension and retain it only for that login attempt. Send its base64url SHA-256 digest as `proof_challenge` to `POST /auth/github/start` with the exact `redirect_uri`. The response is `{ "authorization_url": "..." }`.
2. Open the URL with `chrome.identity.launchWebAuthFlow`. GitHub returns to this service. The service exchanges the code using its client secret and server-side PKCE verifier, then redirects to the Chrome identity URL with a one-time `ticket` query parameter. The token never appears in that URL.
3. Send `{ "ticket": "...", "proof_verifier": "..." }` to `POST /auth/github/redeem`. The response includes `access_token` and `token_type: "bearer"`. When GitHub issues an expiring token, it also includes `refresh_token`, `expires_in`, and `refresh_token_expires_in`, all copied from GitHub's response. The ticket is valid for 60 seconds and can be redeemed once. A wrong proof does not consume it.
4. Before the access token expires, send `{ "refresh_token": "..." }` to `POST /auth/github/refresh`. The response has the same token-pair shape as `/redeem`, with a new access token and a **new refresh token**. Replace both stored tokens together. GitHub invalidates the previous pair when a refresh token is used. Serialize refresh attempts in the extension so concurrent requests do not reuse an already-rotated refresh token. An expired or revoked refresh token returns HTTP 401; send the user through sign-in again. Temporary GitHub failures return HTTP 502 so the extension can retry without discarding the current pair.

All three POST routes require `Content-Type: application/json`. Cross-origin requests allow only the configured extension origin. The callback returns `?error=access_denied` when the user declines and `?error=authorization_failed` on other authorization failures. OAuth state expires after 10 minutes and is consumed on the first callback. All auth responses use `Cache-Control: no-store`.

Run route tests with `python -m pytest -q` after installing `requirements-dev.txt`.
