import { GITHUB_CLIENT_ID } from "./config.js";

const API = "https://api.github.com";
const HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

export function isConfigured() {
  return /^[A-Za-z0-9_]{8,}$/.test(GITHUB_CLIENT_ID) && !GITHUB_CLIENT_ID.startsWith("PASTE_");
}

async function jsonResponse(response) {
  let data;
  try { data = await response.json(); } catch { data = {}; }
  if (!response.ok) {
    const message = data.message || data.error_description || data.error || `GitHub returned ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

async function api(token, path, options = {}) {
  return jsonResponse(await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...HEADERS,
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  }));
}

export async function beginDeviceFlow() {
  if (!isConfigured()) throw new Error("Add your GitHub OAuth client ID to config.js, then reload the extension.");
  return jsonResponse(await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: GITHUB_CLIENT_ID, scope: "repo" }),
  }));
}

export async function pollDeviceFlow(deviceCode) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }),
  });
  return jsonResponse(response);
}

export async function getViewer(token) {
  return api(token, "/user");
}

export async function listWritableIssueRepos(token) {
  const repositories = [];
  for (let page = 1; ; page += 1) {
    const batch = await api(token, `/user/repos?affiliation=owner,collaborator,organization_member&sort=updated&direction=desc&per_page=100&page=${page}`);
    repositories.push(...batch.filter(repo => repo.has_issues && !repo.archived && !repo.disabled && repo.permissions?.push));
    if (batch.length < 100) break;
  }
  return repositories.map(repo => ({
    id: repo.id,
    full_name: repo.full_name,
    private: repo.private,
    updated_at: repo.updated_at,
  }));
}

export async function uploadImage(token, repositoryId, pngDataUrl) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(pngDataUrl);
  if (!match) throw new Error("The annotated screenshot is not a PNG image.");
  const binary = atob(match[1]);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  if (bytes.byteLength > 10 * 1024 * 1024) throw new Error("The screenshot exceeds GitHub’s 10 MB image limit. Capture a smaller region.");
  const query = new URLSearchParams({
    name: `frame-to-issue-${Date.now()}.png`,
    content_type: "image/png",
    repository_id: String(repositoryId),
  });
  const result = await jsonResponse(await fetch(`https://uploads.github.com/user-attachments/assets?${query}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/octet-stream",
    },
    body: bytes,
  }));
  if (!/^https:\/\/github\.com\/user-attachments\/assets\/[A-Za-z0-9-]+$/.test(result.url || "")) {
    throw new Error("GitHub did not return a valid screenshot attachment URL.");
  }
  return result.url;
}

export function issueBody({ description, pageUrl, windowWidth, windowHeight, viewportWidth, viewportHeight, capturedAt, imageUrl }) {
  return [
    description.trim(),
    "",
    "### Capture context",
    `- Page: ${pageUrl}`,
    `- Browser window: ${windowWidth} × ${windowHeight} px`,
    `- Page viewport: ${viewportWidth} × ${viewportHeight} px`,
    `- Captured: ${capturedAt}`,
    "",
    `![Annotated screenshot](${imageUrl})`,
  ].join("\n");
}

export async function createIssue(token, fullName, title, body) {
  const [owner, repo] = fullName.split("/");
  if (!owner || !repo) throw new Error("Choose a repository.");
  return api(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`, {
    method: "POST",
    body: JSON.stringify({ title, body }),
  });
}

export async function findIssueByMarker(token, fullName, marker) {
  const [owner, repo] = fullName.split("/");
  const issues = await api(token, `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=all&sort=created&direction=desc&per_page=100`);
  return issues.find(issue => !issue.pull_request && issue.body?.includes(marker)) || null;
}
