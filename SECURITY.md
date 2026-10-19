# Security policy

Pindart handles GitHub access tokens, so security reports matter a lot.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Instead, use GitHub's private reporting:
go to the **Security** tab of this repository and choose **Report a vulnerability**.

Include what you found, how to reproduce it, and what an attacker could do with it. You should get a reply within a few days.

## Scope

- The Chrome extension in the repository root.
- The GitHub sign-in service in [`backend/`](backend).

## How tokens are handled

- The GitHub OAuth client secret lives only on the sign-in server, never in the extension.
- Sign-in uses a one-time ticket plus a proof (PKCE-style) check, so tokens never appear in a redirect URL.
- Tokens are stored in Chrome's local extension storage and are never handed to web pages.
- The server holds a new token only briefly, encrypted, until the extension redeems its one-time ticket (60 seconds at most). It keeps no tokens after that.

See [`backend/README.md`](backend/README.md) for the full flow.
