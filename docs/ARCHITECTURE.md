# Pindart architecture and maintainer notes

This page covers how Pindart works under the hood and how its sign-in service fits in. For an introduction and step-by-step setup, see the [README](../README.md).

Pindart is a Chrome Manifest V3 extension for turning a selected part of a webpage into an annotated GitHub issue. There is no hosted version: each person or team that uses Pindart runs their own sign-in service and GitHub OAuth app.

## Use the extension

1. Open the page you want to report and click the extension in the toolbar, or press **Ctrl+Shift+Y**.
2. Drag over the visible page region to capture. Press **Esc** to cancel. The capture does not include browser controls or other desktop windows.
3. Add red arrows or freehand marks in the editor, then choose **Continue**.
4. Review the capture and its page URL, browser window size, viewport size, and capture time. Sign in with GitHub if needed, choose a repository, enter a title and optional description, then create the issue.

The screenshot is uploaded to GitHub before the issue is created. If the upload or issue creation fails, the editor keeps the current capture and form so you can retry. GitHub states that private-repository attachments normally require repository access; a copied temporary media URL can still be shared while valid, so review sensitive content before submitting.

## Drafts and autosave

The current capture and its annotations are saved in extension storage. The issue title, description, repository search, and selected repository are autosaved locally as you edit and restored for the same capture. Starting a new capture clears the prior capture's issue form and annotations. A failed submission keeps the current form open.

The editor stays open until you close it, including after the issue is created.

## GitHub access

The extension requests the OAuth scope `repo` to list and create issues on public and private repositories the signed-in user can access. GitHub OAuth Apps do not provide an issue-only scope. The `repo` scope is broad and includes read and write access to public and private repositories and related repository data. Organization policies may require an organization owner to approve the OAuth app. See GitHub's [OAuth scope descriptions](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps) and [organization access restrictions](https://docs.github.com/en/organizations/managing-oauth-access-to-your-organizations-data/about-oauth-app-access-restrictions).

The extension also requests `offline_access`. GitHub access tokens expire after eight hours and refresh tokens after six months without use. The extension refreshes tokens through the sign-in service when needed, and replaces the refresh token each time because GitHub rotates it. If a refresh token expires or is revoked, sign in again. See GitHub's [expiring OAuth access token guidance](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#expiring-access-tokens).

The extension stores the GitHub access and refresh tokens locally in Chrome extension storage. Sign out clears the extension's local session. To revoke the app's authorization as well, remove it from [GitHub's authorized applications](https://github.com/settings/applications).

## Sign-in service configuration

The sign-in service in [`backend/`](../backend) holds the GitHub OAuth client secret so the extension never has to. Each deployment needs its own GitHub OAuth App whose authorization callback URL is:

`https://<service-url>/auth/github/callback`

The extension uses a second redirect after that callback so Chrome can finish the login window. Chrome derives it from the extension ID:

`https://<extension-id>.chromiumapp.org/github`

Set `EXTENSION_REDIRECT_URI` to the exact value returned by `chrome.identity.getRedirectURL("github")` for your copy of the extension. An unpacked extension's ID depends on its folder path, so keep the folder in one place or pin the ID with a manifest `key`. The service accepts exactly one redirect URL; do not loosen it to accept arbitrary IDs.

Never commit the OAuth client secret, database credentials, or encryption key.

| Variable | Value |
| --- | --- |
| `GITHUB_CLIENT_ID` | Your OAuth app's public client ID. |
| `GITHUB_CLIENT_SECRET` | Your OAuth app's private client secret. |
| `PUBLIC_BASE_URL` | `https://<service-url>` |
| `EXTENSION_REDIRECT_URI` | Exact extension redirect URL shown above. |
| `DATABASE_URL` | Pooled PostgreSQL connection string. |
| `TOKEN_ENCRYPTION_KEY` | Random 32-byte key, base64url encoded, for temporary encrypted OAuth tickets. |
| `DATABASE_URL_UNPOOLED` | Direct PostgreSQL connection string for running migrations only. |

The extension's `AUTH_API_BASE_URL` in [`config.js`](../config.js) and the matching host permission in [`manifest.json`](../manifest.json) must point at your service. The backend listens on the `$PORT` its host provides. Apply the database migration before the service is considered ready. See [`backend/README.md`](../backend/README.md) for backend setup, token handling, and migration commands.

## Implementation notes

- The region selector is injected into the active tab and removed before Chrome captures the visible tab. The selected region is cropped using the ratio of bitmap pixels to viewport CSS pixels, accounting for browser zoom and display scale.
- Page content scripts do not receive GitHub tokens. GitHub API calls run in the extension background service worker.
- The screenshot attachment upload follows the endpoint used by the [GitHub CLI](https://github.com/cli/cli/blob/trunk/internal/attachments/client.go). GitHub does not document it as a public REST endpoint, so it could change. An upload failure blocks issue creation.
- GitHub permits images up to [10 MB](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files). A smaller selected region may be needed if the PNG exceeds that limit.
- For private issues, GitHub may render the attachment through a temporary signed image URL. The issue body stores the permanent `github.com/user-attachments/assets/...` URL and includes an **Open full-size screenshot** link. Do not copy the temporary `private-user-images.githubusercontent.com` URL into another issue. See [GitHub's attachment guidance](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files).

## Development

The extension uses browser-native JavaScript and has no build step or runtime package dependencies. In `chrome://extensions`, enable Developer mode and choose **Load unpacked**, then select the repository root. Run extension syntax checks with `npm run check`, extension tests with `npm test`, and backend tests from `backend/` with `python -m pytest -q` after installing `requirements-dev.txt`.
