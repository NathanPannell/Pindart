import test from "node:test";
import assert from "node:assert/strict";
import { listWritableIssueRepos, uploadImage, issueBody, createIssue } from "../github.js";

const originalFetch = globalThis.fetch;
test.after(() => { globalThis.fetch = originalFetch; });

test("repository picker includes writable public and private repos with Issues enabled", async () => {
  globalThis.fetch = async url => {
    assert.match(url, /\/user\/repos\?/);
    return Response.json([
      { id: 1, full_name: "team/private", private: true, updated_at: "2026-09-20T00:00:00Z", has_issues: true, archived: false, disabled: false, permissions: { push: true } },
      { id: 2, full_name: "team/public", private: false, updated_at: "2026-09-21T00:00:00Z", has_issues: true, archived: false, disabled: false, permissions: { push: true } },
      { id: 3, full_name: "team/read-only", private: false, has_issues: true, archived: false, disabled: false, permissions: { push: false } },
      { id: 4, full_name: "team/no-issues", private: false, has_issues: false, archived: false, disabled: false, permissions: { push: true } },
    ]);
  };
  assert.deepEqual(await listWritableIssueRepos("test-token"), [
    { id: 1, full_name: "team/private", private: true, updated_at: "2026-09-20T00:00:00Z" },
    { id: 2, full_name: "team/public", private: false, updated_at: "2026-09-21T00:00:00Z" },
  ]);
});

test("screenshot upload uses GitHub's attachment request and rejects a missing URL", async () => {
  let uploaded = false;
  globalThis.fetch = async (url, options) => {
    assert.match(url, /^https:\/\/uploads\.github\.com\/user-attachments\/assets\?/);
    assert.match(url, /repository_id=42/);
    assert.equal(options.headers.Authorization, "Bearer test-token");
    assert.equal(options.headers["Content-Type"], "application/octet-stream");
    assert.deepEqual(Array.from(options.body), [137, 80, 78, 71]);
    uploaded = true;
    return Response.json({ url: "https://github.com/user-attachments/assets/abc-123" });
  };
  assert.equal(await uploadImage("test-token", 42, "data:image/png;base64,iVBORw=="), "https://github.com/user-attachments/assets/abc-123");
  assert.equal(uploaded, true);
  globalThis.fetch = async () => Response.json({});
  await assert.rejects(uploadImage("test-token", 42, "data:image/png;base64,iVBORw=="), /valid screenshot attachment URL/);
  globalThis.fetch = async () => Response.json({ url: "https://private-user-images.githubusercontent.com/image.png?jwt=temporary" });
  await assert.rejects(uploadImage("test-token", 42, "data:image/png;base64,iVBORw=="), /valid screenshot attachment URL/);
});

test("issue body carries context and image, and create issue submits it", async () => {
  const body = issueBody({
    description: "The heading overlaps the menu.",
    pageUrl: "https://example.com/page",
    windowWidth: 1280, windowHeight: 900,
    viewportWidth: 1260, viewportHeight: 760,
    capturedAt: "2026-09-22T10:00:00.000Z",
    imageUrl: "https://github.com/user-attachments/assets/abc-123",
  });
  assert.match(body, /example\.com\/page/);
  assert.match(body, /1280 × 900 px/);
  assert.match(body, /1260 × 760 px/);
  assert.match(body, /2026-09-22T10:00:00.000Z/);
  assert.match(body, /!\[Annotated screenshot\]/);
  assert.match(body, /\[Open full-size screenshot\]\(https:\/\/github\.com\/user-attachments\/assets\/abc-123\)/);
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.github.com/repos/team/private/issues");
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), { title: "Broken heading", body });
    return Response.json({ number: 9, html_url: "https://github.com/team/private/issues/9" }, { status: 201 });
  };
  assert.equal((await createIssue("test-token", "team/private", "Broken heading", body)).number, 9);
});
