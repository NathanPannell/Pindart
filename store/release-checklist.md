# Chrome Web Store release checklist

Items marked **Owner action** require the publisher's account, payment, legal acceptance, domain control, or final approval.

## 1. Product readiness

- [ ] Run `npm run check` and `npm test` from the repository root.
- [ ] Run the backend test suite.
- [ ] Load the release candidate unpacked in Chrome and test capture, markup, GitHub sign-in, repository search, issue creation, retry behavior, and sign-out.
- [ ] Create one issue in a public repository and one in a private repository. Confirm each screenshot opens for an authorized user after a refresh.
- [ ] Confirm the production sign-in service is healthy and its privacy policy URL is public over HTTPS without a sign-in wall.
- [ ] Review the permissions in `manifest.json` against [Chrome's minimum permission policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq#minimum-permission). Remove any permission that is no longer used before packaging.
- [ ] Confirm the manifest name, description, icons, and version are final. Each uploaded update must use a version greater than the previous upload.

## 2. Build the upload package

- [ ] Run `powershell -ExecutionPolicy Bypass -File .\scripts\package-extension.ps1`.
- [ ] Find the ZIP and SHA-256 file in `C:\repo\screenshot-to-issue-workspace\release`.
- [ ] Open the ZIP and confirm `manifest.json` is at the archive root.
- [ ] Confirm the ZIP contains only extension runtime files. The packaging script intentionally excludes source documentation, tests, backend code, store materials, and development metadata.
- [ ] Keep the ZIP and checksum together for the release record.

Chrome's packaging guidance: [Prepare your extension](https://developer.chrome.com/docs/webstore/prepare).

## 3. Set up the publisher account

- [ ] **Owner action:** Sign in to the intended Google publisher account, register for the Chrome Web Store Developer Dashboard, accept the Developer Agreement, and pay the one-time registration fee.
- [ ] **Owner action:** Enable two-step verification on the publisher Google account if the dashboard requires it.
- [ ] **Owner action:** Set the publisher display name and public contact email to `contact@nathanpannell.com`.
- [ ] **Owner action:** Optionally verify a product or publisher website through Google Search Console. Only select an official URL the publisher controls.

## 4. Create the draft item and bind production OAuth

- [ ] **Owner action:** In the Developer Dashboard, choose Add new item and upload the release ZIP. Do not submit it for review yet.
- [ ] Copy the final Chrome Web Store extension ID shown for the draft item.
- [ ] Set Railway `EXTENSION_REDIRECT_URI` to `https://<published-extension-id>.chromiumapp.org/github` exactly.
- [ ] Keep the GitHub OAuth App callback URL set to `https://api-production-2e11d.up.railway.app/auth/github/callback`.
- [ ] Deploy the backend configuration and confirm `/ready` returns success.
- [ ] Install or load the exact-ID release candidate and repeat GitHub sign-in. A working unpacked extension ID does not prove that the published ID is allowlisted.

Uploading the draft first is necessary because the final extension ID is required by the OAuth redirect allowlist.

## 5. Complete the Store Listing tab

- [ ] Paste the name, summary, detailed description, category, and language from `store/listing.md`.
- [ ] Upload the 128 x 128 store icon from the release package.
- [ ] Upload at least one 1280 x 800 screenshot. Up to five may be supplied.
- [ ] Upload the required 440 x 280 small promo tile.
- [ ] Optionally upload a 1400 x 560 marquee promo tile and a YouTube demo video.
- [ ] Set Mature content to No.
- [ ] Add only real, maintained homepage or support URLs.

Chrome's current asset and listing guidance: [Complete your listing information](https://developer.chrome.com/docs/webstore/cws-dashboard-listing) and [Creating a great listing page](https://developer.chrome.com/docs/webstore/best-listing).

## 6. Complete the Privacy practices tab

- [ ] Paste the single-purpose statement from `store/privacy-practices.md`.
- [ ] Paste each permission justification.
- [ ] Declare the listed data types: personally identifiable information, authentication information, personal communications, web history, user activity, and website content.
- [ ] Do not declare financial information, health information, or location for the current product behavior.
- [ ] Complete the Limited Use certifications exactly as described in `store/privacy-practices.md`.
- [ ] Enter the final public HTTPS privacy policy URL.
- [ ] Check that the public policy, dashboard declarations, listing copy, and actual behavior agree before submission.

## 7. Distribution and reviewer access

- [ ] Set visibility to Public.
- [ ] Select the intended countries and regions. The default all-regions setting is appropriate unless there is a legal or support reason to limit distribution.
- [ ] Choose Free for the initial listing unless Chrome's current dashboard and the product's billing system support the intended paid plan.
- [ ] Paste the reviewer instructions from `store/listing.md` into the Test instructions tab.
- [ ] Confirm the reviewer can use a normal GitHub account and does not need publisher-supplied credentials.

## 8. Final submission

- [ ] **Owner action:** Review the dashboard preview, privacy declarations, distribution, and package version.
- [ ] **Owner action:** Select Submit for review. Deferred publishing is recommended for the first release so approval does not immediately make the item public.
- [ ] Watch the publisher email for questions or a rejection notice and answer promptly.
- [ ] After approval, complete a final production OAuth test with the store-installed extension.
- [ ] **Owner action:** Publish the approved staged item within 30 days. Chrome returns an un-published staged submission to draft after that window.

Chrome's submission flow and deferred publishing guidance: [Publish in the Chrome Web Store](https://developer.chrome.com/docs/webstore/publish).

## 9. Future updates

- [ ] Increase `version` in `manifest.json`. Chrome rejects a ZIP whose version is not greater than the currently uploaded version.
- [ ] Run tests and generate a new ZIP with the packaging script.
- [ ] Upload the ZIP on the existing item's Package tab.
- [ ] Update listing text, screenshots, privacy declarations, test instructions, and the public privacy policy when behavior changes.
- [ ] Review any newly requested permission carefully. Permission increases can produce a new user warning or disable the extension until users accept the update.
- [ ] Submit the update for review and use deferred publishing when rollout timing matters.

## Owner-only inputs still required

* The Google account that will own the publisher record.
* Acceptance of the Chrome Web Store Developer Agreement and payment of the registration fee.
* The final extension ID generated by the first dashboard upload.
* Any verified homepage or support website URL the owner wants displayed.
* The final legal review and publication date for the privacy policy.
* The final Submit for review and Publish actions.
