# Frame to Issue

A Chrome Manifest V3 extension that turns a dragged page region into an annotated GitHub issue. It captures the page URL, browser window dimensions, viewport dimensions, and capture time before the selection starts. The editor and issue form share one focused extension window.

## Set up GitHub OAuth

1. Create a [GitHub OAuth app](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app) in **Settings → Developer settings → OAuth apps**.
2. Enable **Device Flow** in that app. The OAuth callback URL is not used by device flow; GitHub's registration form still requires a URL, so use a homepage you control for the app registration.
3. Copy the app's **Client ID** into [`config.js`](config.js). Do not add the client secret.
4. Open `chrome://extensions`, turn on Developer mode, and choose **Load unpacked**. Select this repository folder. Reload the extension after changing `config.js`.

The first issue requires GitHub sign-in. The extension shows a one-time code and opens GitHub's verification page. GitHub's [device flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps) is used because the standard web code exchange requires a client secret that cannot be kept private in an extension.

## Use

1. On a webpage, click the extension icon or press **Ctrl+Shift+Y**.
2. Drag around the area to report. Press **Esc** to cancel. Chrome captures only the visible page area; browser chrome and other desktop windows are outside the capture.
3. In the editor window, draw arrows or freehand red marks. Undo or clear as needed.
4. Continue in the same window. Review the marked-up screenshot beside the issue form, along with the URL, dimensions, and timestamp. Sign in if needed, search or choose a repository, enter a title and optional description, then create the issue.

The repository picker includes public and private repositories where Issues are enabled and your GitHub account can attach the image. GitHub's [official CLI attachment feature](https://docs.github.com/en/github-cli/github-cli/attaching-files-with-github-cli) also requires write access to attach files. The extension requests the OAuth app's `repo` scope so private repositories can be listed and used. This scope is broad because OAuth apps do not provide an issues-only private-repository scope. GitHub organization policies may require an administrator to approve the OAuth app.

Repository search matches owner and repository names. Repositories you have selected or submitted issues to recently appear first, with interaction count breaking ties. Other repositories follow their latest GitHub update time. The recent ranking considers interactions within 90 days, stored locally by GitHub account.

The image is uploaded to GitHub before the issue is created. If upload fails, the form remains open and **no issue is created**. Uploaded media use GitHub attachment URLs, so review the capture for sensitive content before submitting, including when the destination repository is private. See [GitHub's media URL guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-anonymized-urls).

## Implementation notes

- The toolbar action injects an isolated region selector into the active tab. The selection overlay is removed before `chrome.tabs.captureVisibleTab` runs.
- The screenshot is cropped using the ratio of bitmap pixels to viewport CSS pixels, so browser zoom and display scale are handled.
- OAuth tokens and API calls remain in the extension background service worker. Page content scripts receive no token.
- The GitHub attachment upload follows the endpoint used by the [GitHub CLI implementation](https://github.com/cli/cli/blob/trunk/internal/attachments/client.go). It is not documented as a public REST endpoint and could change. An upload failure blocks issue creation.
- GitHub permits images up to [10 MB](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files). A smaller selection may be needed if the PNG exceeds that limit.

## Development

This project uses browser-native JavaScript and has no build step or runtime package dependencies. Run `node --check` on the JavaScript files for syntax validation. Load it unpacked in Chrome to test capture and sign-in. A real OAuth client ID and GitHub authorization are required for a live issue submission.
