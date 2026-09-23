# Frame to Issue

Frame to Issue is a Chrome Manifest V3 extension for turning a selected part of a webpage into an annotated GitHub issue. The published experience uses one product-owned GitHub OAuth app and a Railway sign-in service. Users do not create or configure their own OAuth apps.

## Use the extension

1. Open the page you want to report and click the extension in the toolbar, or press **Ctrl+Shift+Y**.
2. Drag over the visible page region to capture. Press **Esc** to cancel. The capture does not include browser controls or other desktop windows.
3. Add red arrows or freehand marks in the editor, then choose **Continue to issue**.
4. Review the capture and its page URL, browser window size, viewport size, and capture time. Sign in with GitHub if needed, choose a repository, enter a title and optional description, then create the issue.

The screenshot is uploaded to GitHub before the issue is created. If the upload or issue creation fails, the editor keeps the current capture and form so you can retry. Private repository screenshots are viewable by people with access to that repository.

## Drafts and autosave

The current capture and its annotations are saved in extension storage. The issue title, description, repository search, and selected repository are autosaved locally as you edit and restored for the same capture. Starting a new capture clears the prior capture's issue form and annotations. A failed submission keeps the current form open.

The editor stays open until you close it, including after the issue is created.

## GitHub access

The extension requests the OAuth scope `repo` to list and create issues on public and private repositories the signed-in user can access. GitHub OAuth Apps do not provide an issue-only scope. The `repo` scope is broad and includes read and write access to public and private repositories and related repository data. Organization policies may require an organization owner to approve the OAuth app. See GitHub's [OAuth scope descriptions](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps) and [organization access restrictions](https://docs.github.com/en/organizations/managing-oauth-access-to-your-organizations-data/about-oauth-app-access-restrictions).

The extension also requests `offline_access`. GitHub access tokens expire after eight hours and refresh tokens after six months without use. The extension refreshes tokens through Railway when needed, and replaces the refresh token each time because GitHub rotates it. If a refresh token expires or is revoked, sign in again. See GitHub's [expiring OAuth access token guidance](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#expiring-access-tokens).

The extension stores the GitHub access and refresh tokens locally in Chrome extension storage. Sign out clears the extension's local session. To revoke the app's authorization as well, remove it from [GitHub's authorized applications](https://github.com/settings/applications).

## Service configuration for maintainers

The production sign-in API is `https://api-production-2e11d.up.railway.app/`. The GitHub OAuth App's authorization callback URL is:

`https://api-production-2e11d.up.railway.app/auth/github/callback`

The extension uses a second redirect after the Railway callback so Chrome can finish the login window. Chrome derives it from the extension ID:

`https://<published-extension-id>.chromiumapp.org/github`

Set Railway's `EXTENSION_REDIRECT_URI` to the exact value returned by `chrome.identity.getRedirectURL("github")` for the published extension. Keep the published extension ID stable. The ID is not present in this repository, so the owner must set this value after the Chrome Web Store listing has its final ID. For local OAuth testing, use the unpacked extension's ID in a separate development service configuration. Do not change the production redirect allowlist to accept arbitrary IDs.

The service owner configures the product OAuth app and these Railway variables. Never commit the OAuth client secret, database credentials, or encryption key.

| Railway variable | Value |
| --- | --- |
| `GITHUB_CLIENT_ID` | Product OAuth app's public client ID. |
| `GITHUB_CLIENT_SECRET` | Product OAuth app's private client secret. |
| `PUBLIC_BASE_URL` | `https://api-production-2e11d.up.railway.app` |
| `EXTENSION_REDIRECT_URI` | Exact published extension URL shown above. |
| `DATABASE_URL` | Pooled Neon PostgreSQL connection string. |
| `TOKEN_ENCRYPTION_KEY` | Random 32-byte key, base64url encoded, for temporary encrypted OAuth tickets. |
| `DATABASE_URL_UNPOOLED` | Direct Neon connection string for running migrations only. |

The extension's `AUTH_API_BASE_URL` in [`config.js`](config.js) and Railway host permission in [`manifest.json`](manifest.json) must match the production API host. The backend listens on Railway's injected `$PORT`. Apply the database migration before the service is considered ready. See [`backend/README.md`](backend/README.md) for backend setup, token handling, and migration commands.

## Implementation notes

- The region selector is injected into the active tab and removed before Chrome captures the visible tab. The selected region is cropped using the ratio of bitmap pixels to viewport CSS pixels, accounting for browser zoom and display scale.
- Page content scripts do not receive GitHub tokens. GitHub API calls run in the extension background service worker.
- The screenshot attachment upload follows the endpoint used by the [GitHub CLI](https://github.com/cli/cli/blob/trunk/internal/attachments/client.go). GitHub does not document it as a public REST endpoint, so it could change. An upload failure blocks issue creation.
- GitHub permits images up to [10 MB](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files). A smaller selected region may be needed if the PNG exceeds that limit.
- For private issues, GitHub may render the attachment through a temporary signed image URL. The issue body stores the permanent `github.com/user-attachments/assets/...` URL and includes an **Open full-size screenshot** link. Do not copy the temporary `private-user-images.githubusercontent.com` URL into another issue. See [GitHub's attachment guidance](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files).

## Development

The extension uses browser-native JavaScript and has no build step or runtime package dependencies. In `chrome://extensions`, enable Developer mode and choose **Load unpacked**, then select this repository folder. An unpacked extension usually has a different ID from the published extension. For prepublication testing, set Railway's exact `EXTENSION_REDIRECT_URI` to the unpacked ID's `chrome.identity` redirect, then replace it with the final published ID before release. A separate development Railway environment is preferable when both versions need to work at once. Run extension syntax checks with `node --check` and backend tests from `backend/` with `python -m pytest -q` after installing `requirements-dev.txt`.
