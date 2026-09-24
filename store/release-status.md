# Pindart public release status

Prepared September 23, 2026. Version `0.1.0`.

## Ready to upload

- ZIP: `C:\repo\screenshot-to-issue-workspace\release\pindart-v0.1.0.zip`
- SHA-256: `1244fb6c204a61fa1fa28ba534314132d0c1752262f6a17feef00417c44a6c43`
- Store screenshots: `C:\repo\screenshot-to-issue-workspace\release\store-assets\01-select-region.png` through `04-issue-created.png`, each 1280 x 800.
- Small promo tile: `C:\repo\screenshot-to-issue-workspace\release\store-assets\small-promo-440x280.png`, 440 x 280.
- Store icon: `icons/icon128.png`.
- Public privacy policy: https://api-production-2e11d.up.railway.app/privacy
- Listing text and reviewer instructions: `store/listing.md`.
- Privacy practices and permission explanations: `store/privacy-practices.md`.

The browser test used the packaged runtime in a temporary Chrome extension with mock GitHub responses and a local sample page. It verified region selection, storage of only the cropped image, markup, repository search and ordering, form reset on a new screenshot, image upload request, issue creation request, and responsive layouts at 320, 375, 414, 768, 1000, and 1280 px. The test extension temporarily requested local test-page access; the upload ZIP uses the narrower permissions in `manifest.json`.

Automated checks: 14 extension tests passed, 10 backend tests passed, `impeccable detect` returned no findings, and the deployed `/privacy` and `/ready` endpoints returned HTTP 200.

## Publisher actions required

1. Sign in to the Chrome Web Store Developer Dashboard with the Google account that should own Pindart. Register, accept the agreement, and pay the one-time fee if prompted. The isolated browser session reached Google's sign-in page, so no draft item was created.
2. Upload the ZIP as a new draft item. On the Package tab, choose **View public key**. Send the permanent extension ID and the public key to the developer before submitting it. Chrome documents that adding this public key to a local test manifest preserves the Store ID for unpacked testing. The OAuth bridge currently allows the earlier unpacked extension ID; the permanent ID must be set as Railway's `EXTENSION_REDIRECT_URI`, then sign-in must be retested with the Store ID.
3. In GitHub Developer Settings, rename the existing OAuth App to **Pindart** so the authorization screen matches the store listing. Keep its callback URL at `https://api-production-2e11d.up.railway.app/auth/github/callback`.
4. Review the listing and public privacy policy as the publisher, complete the dashboard's Store Listing, Privacy Practices, Distribution, and Test Instructions tabs using the prepared files, then submit for review. Publishing after approval is the publisher's final action.

## Remaining validation after the permanent ID is known

- Set `EXTENSION_REDIRECT_URI=https://<permanent-id>.chromiumapp.org/github` in Railway production and confirm its exact extension origin is accepted.
- Add the Store public key to a local unpacked test manifest, confirm it uses the permanent ID, and complete GitHub sign-in before review.
- Create one issue in a public repository and one in a private repository, then open both attachments with an authorized account. The screenshot upload endpoint works in prior user testing, but the new store-ID build has not yet completed this live check.

The upload package can be regenerated after any code change by running `scripts/package-extension.ps1`; the version in `manifest.json` must increase for each later Store update.
