# Chrome Web Store privacy practices

These answers are written for the current extension behavior. Keep the dashboard declarations, public privacy policy, store listing, and product behavior consistent.

## Single purpose

Allow a user to select and annotate part of the current webpage, then create a GitHub issue in a repository the user chooses with the image and relevant page context attached.

## Permission justifications

### `activeTab`

Used only after the user clicks the extension or invokes its shortcut. It gives temporary access to the current tab so the extension can start the selection interface and capture the visible tab after the user chooses a region.

### `scripting`

Used to inject the region selection interface into the current tab after the user explicitly starts a capture. The injected interface is removed after selection or cancellation.

### `storage`

Used to keep the current screenshot draft, annotation strokes, issue form draft, repository ordering preferences, and GitHub OAuth session in extension-local storage. GitHub tokens are restricted to trusted extension contexts.

### `identity`

Used to open GitHub's OAuth authorization page and receive the redirect through Chrome's identity flow. This lets users sign in without creating or pasting a personal access token.

### `unlimitedStorage`

Used because a PNG capture on a large or high-density display, together with its local retry draft, can exceed Chrome storage's standard quota. The storage is limited to the current capture workflow and related local state.

### Host access: `https://api.github.com/*`

Used to identify the signed-in GitHub account, list repositories where the user can create issues, verify repository permissions, detect an issue after an uncertain network response, and create the issue the user submits.

### Host access: `https://uploads.github.com/*`

Used to upload the annotated PNG to the GitHub repository selected by the user before creating the issue.

### Host access: `https://api-production-2e11d.up.railway.app/*`

Used only for the product-owned GitHub OAuth start, token redemption, and token refresh endpoints. The service accepts requests only from the configured published extension origin.

## Data type declarations

Select the following data types in the Privacy practices tab:

### Personally identifiable information

**Declare: Yes.** The extension receives and stores the signed-in GitHub username and repository metadata associated with that account so it can show the connection and available destinations.

### Authentication information

**Declare: Yes.** GitHub OAuth access and refresh tokens are processed. Tokens are stored locally in Chrome extension storage. The sign-in service temporarily processes OAuth state, a one-time encrypted token ticket, and refresh requests.

### Personal communications

**Declare: Yes.** The issue title and optional description entered by the user are sent to the selected GitHub repository as issue content.

### Web history

**Declare: Yes.** The URL of the page the user explicitly captures is stored with the current draft and included in the GitHub issue. The extension does not collect background browsing history.

### User activity

**Declare: Yes.** The extension stores the user's region selection, annotation strokes, repository search text, and selected repository as part of the requested capture and issue workflow. It does not monitor activity outside an active capture or editor session.

### Website content

**Declare: Yes.** The selected region of the visible webpage is captured as an image, stored locally as the current draft, and uploaded to GitHub when the user submits the issue.

### Financial and payment information

**Declare: No.**

### Health information

**Declare: No.** The extension does not intentionally collect health information. A user could choose to capture sensitive page content, so the privacy policy must tell users to review a screenshot before submitting it.

### Location

**Declare: No.**

If the dashboard's wording or available categories changes, choose the closest current category and favor accurate over-disclosure. Do not declare that the extension collects no data merely because some data remains local. Chrome's policy treats local handling as data handling.

## Data usage certifications

Certify all of the following only while the product continues to satisfy them:

* User data is not sold to third parties.
* User data is not used or transferred for purposes unrelated to the extension's single purpose.
* User data is not used or transferred to determine creditworthiness or for lending purposes.
* User data is not used for personalized, retargeted, or interest-based advertising.
* Human access to user data is prohibited except with the user's specific consent for support, when necessary for security, when required by law, or in properly aggregated and anonymized internal operations.
* User data is transmitted over HTTPS.
* Use of user data complies with the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Data flow summary

| Data | Stored locally | Sent to sign-in service | Sent to GitHub |
| --- | --- | --- | --- |
| Selected screenshot and annotations | Yes, as the current draft | No | Yes, only on Create issue |
| Captured page URL and dimensions | Yes, as the current draft | No | Yes, in the issue body |
| Issue title and description | Yes, as a form draft | No | Yes, on Create issue |
| GitHub username and repository metadata | Yes | No | Retrieved from GitHub |
| OAuth access token | Yes | Temporarily returned through a one-time encrypted ticket | Used to call GitHub |
| OAuth refresh token | Yes | Yes, only during refresh | Sent by the sign-in service to GitHub |
| Repository selection history | Yes | No | No |

## Public privacy policy requirements

The public policy must describe:

* The data types listed above, including data that stays on the user's device.
* The purpose of each use and the user's explicit submit action.
* Sharing with GitHub, Railway, and Neon solely to provide authentication and issue creation.
* Local and service-side retention, deletion, security, and the support contact.
* The Limited Use certification in affirmative language.
* The fact that content submitted to GitHub is governed by the selected repository's access controls and GitHub's policies.

Publish the policy at a stable public HTTPS URL that does not require sign-in. Use `contact@nathanpannell.com` for privacy and support requests.

## Official policy references

* [Chrome Web Store User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
* [Chrome Web Store Limited Use policy](https://developer.chrome.com/docs/webstore/program-policies/limited-use)
* [Chrome Web Store disclosure requirements](https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements)
