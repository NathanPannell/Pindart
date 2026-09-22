import test from "node:test";
import assert from "node:assert/strict";
import { arrangeRepositories, searchRepositories } from "../repositories.js";

const now = Date.parse("2026-09-22T12:00:00Z");
const repos = [
  { id: 1, full_name: "acme/old-favorite", updated_at: "2025-01-01T00:00:00Z", private: true },
  { id: 2, full_name: "acme/new-dashboard", updated_at: "2026-09-22T00:00:00Z", private: false },
  { id: 3, full_name: "another/dashboard", updated_at: "2026-09-20T00:00:00Z", private: true },
];

test("recent extension interactions lead, then GitHub update time", () => {
  const activity = {
    1: { selections: 2, submissions: 1, lastSubmittedAt: now - 2_000 },
    3: { selections: 1, lastSelectedAt: now - 2_000 },
  };
  const ordered = arrangeRepositories(repos, activity, now);
  assert.deepEqual(ordered.recent.map(repo => repo.id), [1, 3]);
  assert.deepEqual(ordered.updated.map(repo => repo.id), [2]);
});

test("fresh activity beats a large older interaction count", () => {
  const ordered = arrangeRepositories(repos, {
    1: { selections: 100, lastSelectedAt: now - 30 * 24 * 60 * 60 * 1000 },
    3: { submissions: 1, lastSubmittedAt: now - 1_000 },
  }, now);
  assert.deepEqual(ordered.recent.map(repo => repo.id), [3, 1]);
});

test("old interactions expire and missing update dates have stable names", () => {
  const old = now - 91 * 24 * 60 * 60 * 1000;
  const ordered = arrangeRepositories([
    { id: 4, full_name: "zeta/missing" },
    { id: 5, full_name: "alpha/missing" },
    ...repos,
  ], { 1: { selections: 10, lastSelectedAt: old } }, now);
  assert.deepEqual(ordered.recent, []);
  assert.deepEqual(ordered.updated.map(repo => repo.id), [2, 3, 1, 5, 4]);
});

test("search matches owner and repository regardless of case or spacing", () => {
  assert.deepEqual(searchRepositories(repos, " ACME   DASH ").map(repo => repo.id), [2]);
  assert.deepEqual(searchRepositories(repos, "dashboard").map(repo => repo.id), [2, 3]);
  assert.deepEqual(searchRepositories(repos, "no-such-repository"), []);
});
