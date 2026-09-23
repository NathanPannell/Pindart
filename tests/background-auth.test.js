import test from "node:test";
import assert from "node:assert/strict";

const values = {};
let onMessage;
let accessLevel;
let webAuthCallback = "";
const redirect = "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/github";
const ticket = "t".repeat(43);

function pick(keys) {
  const names = Array.isArray(keys) ? keys : typeof keys === "string" ? [keys] : Object.keys(keys || {});
  return Object.fromEntries(names.filter(name => name in values).map(name => [name, values[name]]));
}

const local = {
  get: async keys => pick(keys),
  set: async entries => { Object.assign(values, entries); },
  remove: async keys => { for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key]; },
  setAccessLevel: async ({ accessLevel: level }) => { accessLevel = level; },
};

globalThis.chrome = {
  runtime: {
    id: "test-extension",
    getURL: path => `chrome-extension://test-extension/${path}`,
    onMessage: { addListener: callback => { onMessage = callback; } },
  },
  identity: {
    getRedirectURL: path => { assert.equal(path, "github"); return redirect; },
    launchWebAuthFlow: async ({ interactive }) => {
      assert.equal(interactive, true);
      return webAuthCallback;
    },
  },
  storage: { local, session: { get: async () => ({}), set: async () => {}, remove: async () => {} } },
  action: { onClicked: { addListener: () => {} } },
  windows: { onRemoved: { addListener: () => {} } },
};

await import("../background.js");

async function send(type) {
  const reply = await new Promise(resolve => onMessage(
    { type },
    { id: chrome.runtime.id, url: chrome.runtime.getURL("editor.html") },
    resolve,
  ));
  if (!reply.ok) throw new Error(reply.error);
  return reply.value;
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test("one-click OAuth stores a user session and loads repositories", async () => {
  assert.equal(accessLevel, "TRUSTED_CONTEXTS");
  const originalFetch = globalThis.fetch;
  webAuthCallback = `${redirect}?ticket=${ticket}`;
  globalThis.fetch = async url => {
    const path = String(url);
    if (path.endsWith("/auth/github/start")) return Response.json({ authorization_url: "https://github.com/login/oauth/authorize?client_id=test" });
    if (path.endsWith("/auth/github/redeem")) return Response.json({
      access_token: "oauth-access-token", refresh_token: "oauth-refresh-token", expires_in: 28800, token_type: "bearer",
    });
    if (path.endsWith("/user")) return Response.json({ login: "reporter" });
    if (path.includes("/user/repos?")) return Response.json([
      { id: 42, full_name: "reporter/private", private: true, updated_at: "2026-09-23T00:00:00Z", has_issues: true, archived: false, disabled: false, permissions: { push: true } },
    ]);
    throw new Error(`Unexpected fetch: ${path}`);
  };
  try {
    assert.deepEqual(await send("AUTH_BEGIN"), { authenticated: true, login: "reporter" });
    assert.equal(values.githubToken, "oauth-access-token");
    assert.equal(values.githubRefreshToken, "oauth-refresh-token");
    assert.equal((await send("LIST_REPOS"))[0].full_name, "reporter/private");
    assert.equal((await send("AUTH_STATUS")).login, "reporter");
  } finally { globalThis.fetch = originalFetch; }
});

test("sign-out cannot be undone by a delayed token refresh", async () => {
  const originalFetch = globalThis.fetch;
  values.githubToken = "expired-access-token";
  values.githubRefreshToken = "old-refresh-token";
  values.githubExpiresAt = Date.now() - 1;
  const refreshStarted = deferred();
  const refreshResponse = deferred();
  globalThis.fetch = async url => {
    if (String(url).endsWith("/auth/github/refresh")) {
      refreshStarted.resolve();
      return refreshResponse.promise;
    }
    throw new Error(`Unexpected fetch: ${url}`);
  };
  try {
    const loading = send("LIST_REPOS").catch(error => error);
    await refreshStarted.promise;
    await send("AUTH_SIGN_OUT");
    refreshResponse.resolve(Response.json({ access_token: "late-access-token", refresh_token: "late-refresh-token", expires_in: 28800, token_type: "bearer" }));
    assert.match((await loading).message, /canceled/);
    assert.equal(values.githubToken, undefined);
    assert.equal(values.githubRefreshToken, undefined);
  } finally { globalThis.fetch = originalFetch; }
});

test("a stale refresh response cannot erase a rotated session", async () => {
  const originalFetch = globalThis.fetch;
  const originalGet = local.get;
  values.githubToken = "expired-access-token";
  values.githubRefreshToken = "old-refresh-token";
  values.githubExpiresAt = Date.now() - 1;
  const staleSnapshot = pick(["githubToken", "githubRefreshToken", "githubExpiresAt"]);
  const secondReadStarted = deferred();
  const releaseSecondRead = deferred();
  let tokenReads = 0;
  let refreshes = 0;
  local.get = async keys => {
    if (Array.isArray(keys) && keys.includes("githubToken") && keys.includes("githubRefreshToken")) {
      tokenReads += 1;
      if (tokenReads === 2) {
        secondReadStarted.resolve();
        await releaseSecondRead.promise;
        return staleSnapshot;
      }
    }
    return originalGet(keys);
  };
  globalThis.fetch = async url => {
    const path = String(url);
    if (path.endsWith("/auth/github/refresh")) {
      refreshes += 1;
      if (refreshes === 1) return Response.json({ access_token: "new-access-token", refresh_token: "new-refresh-token", expires_in: 28800, token_type: "bearer" });
      return Response.json({ detail: "Session expired" }, { status: 401 });
    }
    if (path.includes("/user/repos?")) return Response.json([]);
    throw new Error(`Unexpected fetch: ${path}`);
  };
  try {
    const first = send("LIST_REPOS");
    const second = send("LIST_REPOS");
    await secondReadStarted.promise;
    assert.deepEqual(await first, []);
    releaseSecondRead.resolve();
    assert.deepEqual(await second, []);
    assert.equal(refreshes, 2);
    assert.equal(values.githubToken, "new-access-token");
    assert.equal(values.githubRefreshToken, "new-refresh-token");
  } finally {
    local.get = originalGet;
    globalThis.fetch = originalFetch;
  }
});
