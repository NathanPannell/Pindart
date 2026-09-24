import {
  getViewer, listWritableIssueRepos, uploadImage, issueBody, createIssue, findIssueByMarker,
} from "./github.js";
import { isAuthConfigured, signInWithGithub, refreshGithubToken } from "./auth-flow.js";

let submitting = false;
let signingIn = false;
let authEpoch = 0;
let tokenRefreshJob = null;
let authWriteQueue = Promise.resolve();

chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });

function writeAuth(operation) {
  const job = authWriteQueue.catch(() => {}).then(operation);
  authWriteQueue = job.catch(() => {});
  return job;
}

async function getGithubToken(forceRefresh = false) {
  const epoch = authEpoch;
  const { githubToken, githubRefreshToken, githubExpiresAt } = await chrome.storage.local.get([
    "githubToken", "githubRefreshToken", "githubExpiresAt",
  ]);
  if (epoch !== authEpoch) return getGithubToken(forceRefresh);
  if (!githubToken) throw new Error("Sign in to GitHub first.");
  if (!forceRefresh && (!githubExpiresAt || Date.now() < githubExpiresAt - 60_000)) return githubToken;
  if (!githubRefreshToken) {
    await writeAuth(async () => {
      if (epoch !== authEpoch) return;
      const current = await chrome.storage.local.get("githubToken");
      if (current.githubToken === githubToken) await chrome.storage.local.remove(["githubToken", "githubLogin", "githubExpiresAt"]);
    });
    throw new Error("Your GitHub session expired. Sign in again.");
  }
  if (!tokenRefreshJob || tokenRefreshJob.epoch !== epoch || tokenRefreshJob.refreshToken !== githubRefreshToken) {
    const promise = (async () => {
      try {
        const session = await refreshGithubToken(githubRefreshToken);
        if (epoch !== authEpoch) throw new Error("GitHub sign-in was canceled.");
        await writeAuth(async () => {
          if (epoch !== authEpoch) throw new Error("GitHub sign-in was canceled.");
          await chrome.storage.local.set({
            githubToken: session.accessToken,
            githubRefreshToken: session.refreshToken,
            githubExpiresAt: session.expiresAt,
          });
        });
        return session.accessToken;
      } catch (error) {
        if (error.status === 400 || error.status === 401) {
          const current = await chrome.storage.local.get("githubRefreshToken");
          if (epoch === authEpoch && current.githubRefreshToken !== githubRefreshToken) return getGithubToken();
          await writeAuth(async () => {
            if (epoch !== authEpoch) return;
            const latest = await chrome.storage.local.get("githubRefreshToken");
            if (latest.githubRefreshToken === githubRefreshToken) {
              await chrome.storage.local.remove(["githubToken", "githubLogin", "githubRefreshToken", "githubExpiresAt"]);
            }
          });
          throw new Error("Your GitHub session expired. Sign in again.");
        }
        throw error;
      }
    })();
    tokenRefreshJob = { epoch, refreshToken: githubRefreshToken, promise };
    promise.finally(() => {
      if (tokenRefreshJob?.promise === promise) tokenRefreshJob = null;
    }).catch(() => {});
  }
  return tokenRefreshJob.promise;
}

chrome.action.onClicked.addListener(async tab => {
  if (!tab.id || !tab.windowId) return;
  try {
    const windowInfo = await chrome.windows.get(tab.windowId);
    await chrome.storage.session.set({ pendingCapture: {
      tabId: tab.id,
      windowId: tab.windowId,
      url: tab.url || "",
      windowWidth: windowInfo.width,
      windowHeight: windowInfo.height,
      capturedAt: new Date().toISOString(),
    } });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["select.js"] });
  } catch (error) {
    await chrome.storage.local.set({ captureError: `This page cannot be captured: ${error.message}` });
    await openEditor();
  }
});

async function openEditor() {
  const current = await chrome.storage.session.get("editorWindowId");
  if (current.editorWindowId) {
    try {
      await chrome.windows.update(current.editorWindowId, { focused: true });
      return;
    } catch { /* Window was closed. */ }
  }
  const windowInfo = await chrome.windows.create({
    url: chrome.runtime.getURL("editor.html"),
    type: "popup",
    width: 1120,
    height: 820,
    focused: true,
  });
  await chrome.storage.session.set({ editorWindowId: windowInfo.id });
}

async function cropCapturedImage(dataUrl, rect, viewport) {
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  try {
    const sx = bitmap.width / viewport.width;
    const sy = bitmap.height / viewport.height;
    const left = Math.max(0, Math.min(bitmap.width - 1, Math.round(rect.x * sx)));
    const top = Math.max(0, Math.min(bitmap.height - 1, Math.round(rect.y * sy)));
    const width = Math.max(1, Math.min(bitmap.width - left, Math.round(rect.width * sx)));
    const height = Math.max(1, Math.min(bitmap.height - top, Math.round(rect.height * sy)));
    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext("2d").drawImage(bitmap, left, top, width, height, 0, 0, width, height);
    const blob = await canvas.convertToBlob({ type: "image/png" });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let index = 0; index < bytes.length; index += 32768) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
    }
    return `data:image/png;base64,${btoa(binary)}`;
  } finally { bitmap.close(); }
}

chrome.windows.onRemoved.addListener(async windowId => {
  const { editorWindowId } = await chrome.storage.session.get("editorWindowId");
  if (windowId === editorWindowId) await chrome.storage.session.remove("editorWindowId");
});

async function captureRegion(message, sender) {
  const { pendingCapture } = await chrome.storage.session.get("pendingCapture");
  if (!pendingCapture || sender.tab?.id !== pendingCapture.tabId || sender.tab?.windowId !== pendingCapture.windowId) {
    throw new Error("Capture came from a different tab.");
  }
  const active = await chrome.tabs.query({ active: true, windowId: pendingCapture.windowId });
  if (active[0]?.id !== pendingCapture.tabId) throw new Error("Return to the original tab and try again.");
  const { rect, viewport } = message;
  if (!rect || !viewport || !Number.isFinite(rect.x) || !Number.isFinite(rect.y) ||
      rect.width < 8 || rect.height < 8 || viewport.width <= 0 || viewport.height <= 0) {
    throw new Error("Select a larger area.");
  }
  // Allow the injected overlay to be removed and the tab to repaint.
  await new Promise(resolve => setTimeout(resolve, 100));
  const fullTabImage = await chrome.tabs.captureVisibleTab(pendingCapture.windowId, { format: "png" });
  const image = await cropCapturedImage(fullTabImage, rect, viewport);
  const draft = {
    id: crypto.randomUUID(), image, cropApplied: true, rect, viewport,
    url: pendingCapture.url,
    windowWidth: pendingCapture.windowWidth,
    windowHeight: pendingCapture.windowHeight,
    capturedAt: pendingCapture.capturedAt,
  };
  await chrome.storage.local.remove(["captureError", "uploadedAttachment", "submissionUncertain", "annotations", "formDraft"]);
  await chrome.storage.local.set({ draft });
  await chrome.storage.session.remove("pendingCapture");
  await openEditor();
  return { ok: true };
}

async function authenticate(message) {
  if (message.type === "AUTH_BEGIN") {
    if (signingIn) throw new Error("GitHub sign-in is already open.");
    signingIn = true;
    authEpoch += 1;
    tokenRefreshJob = null;
    const epoch = authEpoch;
    try {
      const session = await signInWithGithub();
      if (epoch !== authEpoch) throw new Error("GitHub sign-in was canceled.");
      const viewer = await getViewer(session.accessToken);
      if (epoch !== authEpoch) throw new Error("GitHub sign-in was canceled.");
      await writeAuth(async () => {
        if (epoch !== authEpoch) throw new Error("GitHub sign-in was canceled.");
        await chrome.storage.local.set({
          githubToken: session.accessToken,
          githubLogin: viewer.login,
          githubRefreshToken: session.refreshToken,
          githubExpiresAt: session.expiresAt,
        });
      });
      return { authenticated: true, login: viewer.login };
    } finally { signingIn = false; }
  }
  if (message.type === "AUTH_SIGN_OUT") {
    authEpoch += 1;
    tokenRefreshJob = null;
    await writeAuth(() => chrome.storage.local.remove(["githubToken", "githubLogin", "githubRefreshToken", "githubExpiresAt"]));
    return { ok: true };
  }
  const { githubToken, githubLogin } = await chrome.storage.local.get(["githubToken", "githubLogin"]);
  return { configured: isAuthConfigured(), authenticated: Boolean(githubToken), login: githubLogin || null };
}

async function listRepositories() {
  const token = await getGithubToken();
  try { return await listWritableIssueRepos(token); }
  catch (error) {
    if (error.status === 401) {
      const renewed = await getGithubToken(true);
      const epoch = authEpoch;
      try { return await listWritableIssueRepos(renewed); }
      catch (retriedError) {
        if (retriedError.status === 401) await writeAuth(async () => {
          if (epoch !== authEpoch) return;
          const current = await chrome.storage.local.get("githubToken");
          if (current.githubToken === renewed) await chrome.storage.local.remove(["githubToken", "githubLogin", "githubRefreshToken", "githubExpiresAt"]);
        });
        throw retriedError;
      }
    }
    throw error;
  }
}

async function submitIssue(message) {
  if (submitting) throw new Error("An issue is already being submitted.");
  submitting = true;
  try {
    const { draft } = await chrome.storage.local.get("draft");
    let githubToken = await getGithubToken();
    if (!draft || draft.id !== message.draftId) throw new Error("The capture changed. Review the current screenshot.");
    const title = String(message.title || "").trim();
    const description = String(message.description || "").trim();
    if (!title || title.length > 256) throw new Error("Enter an issue title of 1 to 256 characters.");
    if (description.length > 30000) throw new Error("Shorten the issue description.");
    const repositories = await listRepositories();
    const repository = repositories.find(repo => repo.id === message.repositoryId && repo.full_name === message.repository);
    if (!repository) throw new Error("Choose a repository where you can attach screenshots.");
    const { submissionUncertain } = await chrome.storage.local.get("submissionUncertain");
    if (submissionUncertain?.draftId === draft.id) {
      githubToken = await getGithubToken();
      const existing = await findIssueByMarker(githubToken, submissionUncertain.repository, submissionUncertain.marker);
      if (existing) {
        await chrome.storage.local.remove(["draft", "formDraft", "uploadedAttachment", "submissionUncertain"]);
        return { issueUrl: existing.html_url, number: existing.number };
      }
      throw new Error("GitHub did not confirm whether the previous issue was created. Check the repository's issues before starting a new capture.");
    }
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message.png));
    const imageHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    const { uploadedAttachment } = await chrome.storage.local.get("uploadedAttachment");
    let imageUrl = uploadedAttachment?.draftId === draft.id && uploadedAttachment?.repositoryId === repository.id && uploadedAttachment?.imageHash === imageHash
      ? uploadedAttachment.url : null;
    if (!imageUrl) {
      githubToken = await getGithubToken();
      imageUrl = await uploadImage(githubToken, repository.id, message.png);
      await chrome.storage.local.set({ uploadedAttachment: { draftId: draft.id, repositoryId: repository.id, imageHash, url: imageUrl } });
    }
    const marker = `<!-- pindart:${draft.id} -->`;
    const body = issueBody({
      description,
      pageUrl: draft.url,
      windowWidth: draft.windowWidth,
      windowHeight: draft.windowHeight,
      viewportWidth: draft.viewport.width,
      viewportHeight: draft.viewport.height,
      capturedAt: draft.capturedAt,
      imageUrl,
    }) + `\n\n${marker}`;
    let issue;
    try {
      githubToken = await getGithubToken();
      issue = await createIssue(githubToken, repository.full_name, title, body);
    }
    catch (error) {
      if (!error.status || error.status >= 500) {
        await chrome.storage.local.set({ submissionUncertain: { draftId: draft.id, repository: repository.full_name, marker } });
        try { issue = await findIssueByMarker(githubToken, repository.full_name, marker); }
        catch { /* Keep the uncertain marker for a later check. */ }
        if (!issue) throw new Error("GitHub did not confirm the issue creation. Check the repository's issues before trying again.");
      } else throw error;
    }
    await chrome.storage.local.remove(["draft", "formDraft", "uploadedAttachment", "submissionUncertain"]);
    return { issueUrl: issue.html_url, number: issue.number };
  } finally { submitting = false; }
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  (async () => {
    if (message?.type === "CAPTURE_REGION") {
      try { return await captureRegion(message, sender); }
      catch (error) {
        await chrome.storage.local.set({ captureError: `Capture failed: ${error.message}` });
        await openEditor();
        throw error;
      }
    }
    if (message?.type === "CANCEL_SELECTION") {
      const { pendingCapture } = await chrome.storage.session.get("pendingCapture");
      if (pendingCapture?.tabId === sender.tab?.id) await chrome.storage.session.remove("pendingCapture");
      return { ok: true };
    }
    if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL(""))) {
      throw new Error("Unrecognized sender.");
    }
    if (message?.type?.startsWith("AUTH_")) return authenticate(message);
    if (message?.type === "GET_DRAFT") return chrome.storage.local.get(["draft", "captureError"]);
    if (message?.type === "LIST_REPOS") return listRepositories();
    if (message?.type === "SUBMIT_ISSUE") return submitIssue(message);
    throw new Error("Unknown request.");
  })().then(value => respond({ ok: true, value }), error => respond({ ok: false, error: error.message }));
  return true;
});
