# Build extension

## Scope

Create and verify a Chrome MV3 extension that captures a dragged page region, annotates it, signs in with GitHub OAuth, and creates a GitHub issue with the screenshot and page context.

## State

Complete. The extension, setup guide, UI assets, and tests are committed.

## Decisions

- Use GitHub OAuth device flow because a distributable extension cannot protect a client secret.
- Upload the screenshot with the same GitHub user-attachment endpoint used by the official GitHub CLI, then embed it in the issue. Require repository push permission for attachments. The endpoint is not documented as a public REST API, so upload errors must block submission.
- Use a dedicated Chrome popup window for both annotation and the issue form.

## Verification

- `npm run check` and `npm test` pass.
- An isolated Chrome for Testing profile verified drag capture, crop, arrow markup, editor-to-form navigation, device-code UI, repository selection, issue request composition, and the success screen. GitHub responses were mocked in this browser pass.
- A second screenshot pass verified the form and fixed submit action at a 746 px viewport.
- A separate reviewer confirmed the visual and accessibility fixes after the browser pass.

## Operator setup still required

- Register a GitHub OAuth app with Device Flow enabled and put its client ID in `config.js`.
- Live GitHub authorization and issue creation require that app registration and were not exercised with a user account.
