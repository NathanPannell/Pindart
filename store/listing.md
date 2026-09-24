# Chrome Web Store listing

## Product details

**Name**

Frame to Issue

**Summary**

Capture a page region, mark it up, and create a GitHub issue with the page context attached.

**Category**

Developer Tools

**Language**

English (United States)

**Detailed description**

Frame to Issue turns visual feedback on a webpage into a ready-to-use GitHub issue.

Click the extension, drag over the part of the page you want to report, and add red arrows or freehand marks. Review the annotated screenshot with its source URL, capture time, browser window size, and page viewport size. Then choose a GitHub repository, add an issue title and optional description, and create the issue.

Features:

* Capture only the page region you select.
* Mark up the capture with arrows and freehand drawing.
* Search repositories, with recent choices and recently updated repositories shown first.
* Create issues in public or private repositories that you authorize through GitHub.
* Include the screenshot, source URL, browser dimensions, viewport dimensions, and capture time in the issue.
* Keep an unfinished capture and form locally so a failed submission can be retried.

Frame to Issue runs only when you click the extension or use its keyboard shortcut. The selected screenshot and page URL are shown for review before submission. The screenshot is uploaded to GitHub only after you choose Create issue. The extension does not contain advertising or analytics and does not sell user data.

GitHub sign-in grants the OAuth `repo` scope because GitHub OAuth Apps do not offer an issue-only scope for both public and private repositories. The extension uses that access to identify the signed-in account, list repositories where the user can create issues and attach files, upload the selected screenshot, and create the requested issue.

## Listing contact and links

* Public support email: `contact@nathanpannell.com`
* Privacy policy URL: enter the final public HTTPS URL after the policy is deployed.
* Homepage URL: optional. Add only a maintained public product page.
* Support URL: optional. Add only a maintained public support page. The public support email is sufficient for the initial release if the dashboard does not require a URL.
* Mature content: No.

## Suggested screenshot order and captions

Upload 1280 x 800 PNG or JPEG screenshots. Use the real extension interface and real product behavior. Remove private repository names, URLs, account names, tokens, and issue content before capture.

1. **Select exactly what matters**: Show the drag-to-select overlay on a sample webpage.
2. **Point to the problem**: Show the selected screenshot in the editor with an arrow and freehand markup.
3. **Create the issue with context attached**: Show the issue form with the marked-up image, repository picker, title, and page context.
4. **Choose the right repository quickly**: Show repository search and the recent-first ordering.
5. **Done in one flow**: Show the successful issue state with a safe demo issue URL.

Required promotional asset:

* Small promo tile: 440 x 280 PNG or JPEG.

Optional promotional asset:

* Marquee promo tile: 1400 x 560 PNG or JPEG.

Do not use GitHub's logo as the extension's logo or imply that GitHub endorses the extension. It is fine to name GitHub factually as the service the extension connects to.

## Reviewer test instructions

Frame to Issue requires the reviewer to sign in with a GitHub account and authorize the product OAuth App. No credentials are supplied by the publisher.

1. Open a normal HTTPS webpage. Chrome internal pages such as `chrome://extensions` cannot be captured.
2. Click Frame to Issue in the toolbar or press Ctrl+Shift+Y.
3. Drag a rectangle at least 8 x 8 pixels over visible page content.
4. In the editor, add an arrow or freehand mark and select Continue to issue.
5. Select Sign in with GitHub and authorize the requested access.
6. Search for and select a repository where the signed-in account has push permission and Issues enabled.
7. Enter an issue title and optional description, then select Create issue.
8. Confirm that GitHub opens the created issue with the annotated screenshot and capture context.

The GitHub OAuth callback is handled by the product sign-in service at `https://api-production-2e11d.up.railway.app`. The published extension ID must be allowlisted before review so the sign-in flow completes.
