# Chrome Web Store listing

## Product details

**Name**

Pindart: Visual feedback to GitHub

**Summary**

Point to what should change. Capture a page region, mark it up, and send it to GitHub with context.

**Category**

Developer Tools

**Language**

English (United States)

**Detailed description**

Pindart turns "change this" into a clear GitHub issue. Pinpoint what should change in your app and give your team a screenshot they can act on.

Click the extension, drag over the part of the page you want to report, and add red arrows or freehand marks. Review the annotated screenshot with its source URL, capture time, browser window size, and page viewport size. Then choose a GitHub repository, add an issue title and optional description, and create the issue.

Features:

* Capture only the page region you select.
* Mark up the capture with arrows and freehand drawing.
* Search repositories, with recent choices and recently updated repositories shown first.
* Create issues in public or private repositories that you authorize through GitHub.
* Include the screenshot, source URL, browser dimensions, viewport dimensions, and capture time in the issue.
* Keep an unfinished capture and form locally so a failed submission can be retried.

Pindart runs only when you click the extension or use its keyboard shortcut. The selected screenshot and page URL are shown for review before submission. The screenshot is uploaded to GitHub only after you choose Create issue. The extension does not contain advertising or analytics and does not sell user data.

GitHub sign-in grants the OAuth `repo` scope because GitHub OAuth Apps do not offer an issue-only scope for both public and private repositories. The extension uses that access to identify the signed-in account, list repositories where the user can create issues and attach files, upload the selected screenshot, and create the requested issue.

## Listing contact and links

* Public support email: `contact@nathanpannell.com`
* Privacy policy URL: `https://api-production-2e11d.up.railway.app/privacy`
* Homepage URL: optional. Add only a maintained public product page.
* Support URL: optional. Add only a maintained public support page. The public support email is sufficient for the initial release if the dashboard does not require a URL.
* Mature content: No.

## Suggested screenshot order and captions

Upload 1280 x 800 PNG or JPEG screenshots. The prepared examples in [`docs/images`](../images) use a local sample page and fictional GitHub data. Verify the screenshots still match the uploaded build.

1. **Select exactly what matters**: `01-select-region.png`.
2. **Point to the problem**: `02-markup.png`.
3. **Create the issue with context attached**: `03-create-issue.png`.
4. **Done in one flow**: `04-issue-created.png`.

Required promotional asset:

* Small promo tile: `small-promo-440x280.png`.

Optional promotional asset:

* Marquee promo tile: 1400 x 560 PNG or JPEG.

Do not use GitHub's logo as the extension's logo or imply that GitHub endorses the extension. It is fine to name GitHub factually as the service the extension connects to.

## Reviewer test instructions

Pindart requires the reviewer to sign in with a GitHub account and authorize the product OAuth App. No credentials are supplied by the publisher.

1. Open a normal HTTPS webpage. Chrome internal pages such as `chrome://extensions` cannot be captured.
2. Click Pindart in the toolbar or press Ctrl+Shift+Y.
3. Drag a rectangle at least 8 x 8 pixels over visible page content.
4. In the editor, add an arrow or freehand mark and select Continue.
5. Select Sign in with GitHub and authorize the requested access.
6. Search for and select a repository where the signed-in account has push permission and Issues enabled.
7. Enter an issue title and optional description, then select Create issue.
8. Confirm that GitHub opens the created issue with the annotated screenshot and capture context.

The GitHub OAuth callback is handled by the product sign-in service at `https://api-production-2e11d.up.railway.app`. The published extension ID must be allowlisted before review so the sign-in flow completes.
