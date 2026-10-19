# Contributing to Pindart

Thanks for helping. Bug reports, ideas, and pull requests are all welcome.

## Quick start

Pindart is plain JavaScript with no build step.

```bash
git clone https://github.com/NathanPannell/Pindart.git
cd Pindart
npm run check   # syntax check every extension script
npm test        # extension unit tests (Node 20+)
```

The sign-in service is a small Python app:

```bash
cd backend
pip install -r requirements-dev.txt
python -m pytest -q
```

To try your changes in Chrome, open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**, and pick the repository folder. Click the reload icon on the extension card after each change.

GitHub sign-in needs a sign-in service that accepts your unpacked extension's ID. See the [setup section of the README](README.md#setup-instructions-for-agents) to run your own.

## Guidelines

- Keep the extension dependency-free. No bundlers, frameworks, or runtime packages.
- Keep permissions minimal. Any new Chrome permission needs a clear reason in the pull request.
- Never send GitHub tokens to page content scripts. GitHub calls belong in the background service worker.
- Add or update tests for behavior changes.
- Never commit secrets: OAuth client secrets, database URLs, or encryption keys.

## Pull requests

1. Fork the repo and create a branch from `main`.
2. Make your change and run the checks above.
3. Open a pull request describing what changed and how you tested it.
