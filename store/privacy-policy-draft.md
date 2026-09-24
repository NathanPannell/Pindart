# Frame to Issue Privacy Policy

**Effective date:** [ENTER PUBLICATION DATE]

Frame to Issue helps you capture and annotate part of a webpage and create a GitHub issue with that image and page context. This policy explains the data the Chrome extension and its sign-in service handle.

## Data handled by Frame to Issue

When you start a capture, the extension handles the selected screenshot, annotation strokes, the current page URL, browser window and page viewport dimensions, and capture time. In the issue form, it also handles the repository you choose, repository search text, issue title, and optional description.

When you sign in, the extension receives your GitHub username, repository metadata, and GitHub OAuth access and refresh tokens. The extension does not collect your GitHub password.

Frame to Issue does not run a background browsing-history collector. It handles a page URL and page image only when you explicitly start a capture.

## How the data is used

The extension uses this data only to provide the capture-to-issue workflow: create and restore the current draft, show your GitHub connection and available repositories, upload the annotated screenshot, and create the issue you request.

The extension stores the current capture, annotations, form draft, repository ordering preferences, GitHub username, and OAuth tokens in Chrome extension-local storage. The current screenshot and issue details are shown to you before submission. The screenshot, page URL, dimensions, capture time, title, and description are sent to GitHub only when you select Create issue.

## Sign-in service

Frame to Issue uses a product-owned service hosted on Railway to complete GitHub OAuth sign-in and token refresh. During sign-in, the service stores an authorization attempt for up to 10 minutes and a one-time encrypted token ticket for up to 60 seconds. A redeemed authorization attempt or ticket is deleted immediately. Expired records become unusable and are deleted during later authentication housekeeping.

During token refresh, the service processes the refresh token in memory and forwards it to GitHub. It does not persist the refresh token as an account record. Neon provides the database used for the short-lived authorization records. Railway and Neon may process operational data such as IP addresses, request timing, and service logs under their own policies and retention settings.

## Sharing

Frame to Issue transfers data only as needed to provide its stated purpose:

* GitHub receives OAuth requests, repository requests, the annotated screenshot, and the issue content you submit.
* Railway hosts the OAuth service.
* Neon stores short-lived OAuth attempt and encrypted ticket records.

The developer does not sell user data and does not use it for advertising, credit decisions, or unrelated purposes. Human access to user data is prohibited except with your specific consent for support, when necessary for security, when required by law, or for properly aggregated and anonymized internal operations.

Data sent to GitHub is governed by GitHub's terms, privacy policy, and the access settings of the repository you choose. Review the screenshot and issue content before submitting, especially when the page contains sensitive information.

## Retention and deletion

The current draft and form remain in local extension storage so you can retry a failed submission. Starting a new capture replaces the screenshot and clears the previous form and annotations. A successful issue creation clears the current capture and related form data. Signing out removes the locally stored GitHub session. Removing the extension clears its local extension storage.

The issue and uploaded screenshot remain in GitHub according to the selected repository's settings and GitHub's retention rules. Delete or edit the GitHub issue through GitHub if you want to remove that submitted content.

The sign-in service records described above are short-lived and cannot be used after they expire. The service does not maintain a separate Frame to Issue user account.

## Security

Frame to Issue transmits data over HTTPS. GitHub tokens are stored in extension-local storage restricted to trusted extension contexts. One-time OAuth token tickets are encrypted at rest and bound to the requesting extension flow.

No method of storage or transmission is completely secure. Report a suspected security or privacy issue to the contact below.

## Chrome Web Store Limited Use disclosure

Frame to Issue's use of information received through Chrome APIs complies with the Chrome Web Store User Data Policy, including the Limited Use requirements. The data is used only to provide or improve the extension's single purpose, transferred only when necessary to provide that purpose or as otherwise permitted by the policy, never used for personalized advertising, and not made available for humans to read except in the limited circumstances permitted by the policy.

## Changes

If this policy changes, the effective date above will be updated. Material changes to data practices will also be disclosed in the extension interface and Chrome Web Store listing as required.

## Contact

For privacy questions, deletion requests, or support, contact `contact@nathanpannell.com`.
