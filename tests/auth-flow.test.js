import test from "node:test";
import assert from "node:assert/strict";
import { createProofVerifier, proofChallenge, parseAuthCallback, signInWithGithub, refreshGithubToken } from "../auth-flow.js";

const redirect = "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/github";

test("OAuth callback accepts only a ticket for this extension", () => {
  const ticket = "a".repeat(43);
  assert.equal(parseAuthCallback(`${redirect}?ticket=${ticket}`, redirect), ticket);
  assert.throws(() => parseAuthCallback(`https://evil.example/github?ticket=${ticket}`, redirect), /unexpected address/);
  assert.throws(() => parseAuthCallback(`${redirect}/other?ticket=${ticket}`, redirect), /unexpected address/);
  assert.throws(() => parseAuthCallback(`${redirect}?error=access_denied`, redirect), /declined/);
  assert.throws(() => parseAuthCallback(`${redirect}?ticket=short`, redirect), /valid ticket/);
});

test("GitHub sign-in proves ticket ownership before accepting a token", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const ticket = "t".repeat(43);
  const identity = {
    getRedirectURL: path => { assert.equal(path, "github"); return redirect; },
    launchWebAuthFlow: async ({ url, interactive }) => {
      assert.equal(interactive, true);
      assert.equal(new URL(url).origin, "https://github.com");
      return `${redirect}?ticket=${ticket}`;
    },
  };
  globalThis.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url: String(url), body });
    if (String(url).endsWith("/start")) {
      assert.equal(body.redirect_uri, redirect);
      assert.match(body.proof_challenge, /^[A-Za-z0-9_-]{43}$/);
      return Response.json({ authorization_url: "https://github.com/login/oauth/authorize?client_id=test" });
    }
    assert.equal(body.ticket, ticket);
    assert.equal(await proofChallenge(body.proof_verifier), calls[0].body.proof_challenge);
    return Response.json({ access_token: "github-test-token", token_type: "bearer", refresh_token: "refresh-test-token", expires_in: 28800 });
  };
  try {
    const session = await signInWithGithub(identity, "https://auth.example/");
    assert.equal(session.accessToken, "github-test-token");
    assert.equal(session.refreshToken, "refresh-test-token");
    assert.ok(session.expiresAt > Date.now() + 28_000_000);
    assert.equal(calls.length, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test("proof verifiers are random URL-safe strings", async () => {
  const first = createProofVerifier();
  const second = createProofVerifier();
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first, second);
  assert.match(await proofChallenge(first), /^[A-Za-z0-9_-]{43}$/);
});

test("refresh rotates the saved GitHub token pair", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), "https://auth.example/auth/github/refresh");
    assert.deepEqual(JSON.parse(options.body), { refresh_token: "old-refresh" });
    return Response.json({ access_token: "new-access", token_type: "bearer", refresh_token: "new-refresh", expires_in: 28800 });
  };
  try {
    const session = await refreshGithubToken("old-refresh", "https://auth.example/");
    assert.equal(session.accessToken, "new-access");
    assert.equal(session.refreshToken, "new-refresh");
  } finally { globalThis.fetch = originalFetch; }
});
