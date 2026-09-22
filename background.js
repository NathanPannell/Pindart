import {
  beginDeviceFlow, pollDeviceFlow, getViewer, listWritableIssueRepos,
  uploadImage, issueBody, createIssue, findIssueByMarker, isConfigured,
} from "./github.js";

let submitting = false;

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
  const image = await chrome.tabs.captureVisibleTab(pendingCapture.windowId, { format: "png" });
  const draft = {
    id: crypto.randomUUID(), image, rect, viewport,
    url: pendingCapture.url,
    windowWidth: pendingCapture.windowWidth,
    windowHeight: pendingCapture.windowHeight,
    capturedAt: pendingCapture.capturedAt,
  };
  await chrome.storage.local.set({ draft });
  await chrome.storage.local.remove(["captureError", "uploadedAttachment", "submissionUncertain"]);
  await chrome.storage.session.remove("pendingCapture");
  await openEditor();
  return { ok: true };
}

async function authenticate(message) {
  if (message.type === "AUTH_BEGIN") {
    const flow = await beginDeviceFlow();
    await chrome.storage.session.set({ authFlow: {
      deviceCode: flow.device_code,
      expiresAt: Date.now() + flow.expires_in * 1000,
      interval: Math.max(5, flow.interval || 5),
      nextPollAt: Date.now() + Math.max(5, flow.interval || 5) * 1000,
    } });
    return { code: flow.user_code, uri: flow.verification_uri, interval: flow.interval, expiresIn: flow.expires_in };
  }
  if (message.type === "AUTH_POLL") {
    const { authFlow } = await chrome.storage.session.get("authFlow");
    if (!authFlow) throw new Error("Start GitHub sign-in again.");
    if (Date.now() >= authFlow.expiresAt) {
      await chrome.storage.session.remove("authFlow");
      throw new Error("Sign-in code expired. Start again.");
    }
    if (Date.now() < authFlow.nextPollAt) return { pending: true, interval: authFlow.interval };
    const result = await pollDeviceFlow(authFlow.deviceCode);
    if (result.access_token) {
      if (!result.scope?.split(",").includes("repo")) throw new Error("GitHub did not grant repository access.");
      const viewer = await getViewer(result.access_token);
      await chrome.storage.local.set({ githubToken: result.access_token, githubLogin: viewer.login });
      await chrome.storage.session.remove("authFlow");
      return { authenticated: true, login: viewer.login };
    }
    if (result.error === "slow_down") authFlow.interval += 5;
    else if (result.error && result.error !== "authorization_pending") {
      await chrome.storage.session.remove("authFlow");
      throw new Error(result.error_description || result.error);
    }
    authFlow.nextPollAt = Date.now() + authFlow.interval * 1000;
    await chrome.storage.session.set({ authFlow });
    return { pending: true, interval: authFlow.interval };
  }
  if (message.type === "AUTH_CANCEL") {
    await chrome.storage.session.remove("authFlow");
    return { ok: true };
  }
  if (message.type === "AUTH_SIGN_OUT") {
    await chrome.storage.local.remove(["githubToken", "githubLogin"]);
    await chrome.storage.session.remove("authFlow");
    return { ok: true };
  }
  const { githubToken, githubLogin } = await chrome.storage.local.get(["githubToken", "githubLogin"]);
  return { configured: isConfigured(), authenticated: Boolean(githubToken), login: githubLogin || null };
}

async function listRepositories() {
  const { githubToken } = await chrome.storage.local.get("githubToken");
  if (!githubToken) throw new Error("Sign in to GitHub first.");
  try { return await listWritableIssueRepos(githubToken); }
  catch (error) {
    if (error.status === 401) await chrome.storage.local.remove(["githubToken", "githubLogin"]);
    throw error;
  }
}

async function submitIssue(message) {
  if (submitting) throw new Error("An issue is already being submitted.");
  submitting = true;
  try {
    const { githubToken, draft } = await chrome.storage.local.get(["githubToken", "draft"]);
    if (!githubToken) throw new Error("Sign in to GitHub first.");
    if (!draft || draft.id !== message.draftId) throw new Error("The capture changed. Review the current screenshot.");
    const title = String(message.title || "").trim();
    const description = String(message.description || "").trim();
    if (!title || title.length > 256) throw new Error("Enter an issue title of 1 to 256 characters.");
    if (description.length > 30000) throw new Error("Shorten the issue description.");
    const repositories = await listWritableIssueRepos(githubToken);
    const repository = repositories.find(repo => repo.id === message.repositoryId && repo.full_name === message.repository);
    if (!repository) throw new Error("Choose a repository where you can attach screenshots.");
    const { submissionUncertain } = await chrome.storage.local.get("submissionUncertain");
    if (submissionUncertain?.draftId === draft.id) {
      const existing = await findIssueByMarker(githubToken, submissionUncertain.repository, submissionUncertain.marker);
      if (existing) {
        await chrome.storage.local.remove(["draft", "uploadedAttachment", "submissionUncertain"]);
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
      imageUrl = await uploadImage(githubToken, repository.id, message.png);
      await chrome.storage.local.set({ uploadedAttachment: { draftId: draft.id, repositoryId: repository.id, imageHash, url: imageUrl } });
    }
    const marker = `<!-- frame-to-issue:${draft.id} -->`;
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
    try { issue = await createIssue(githubToken, repository.full_name, title, body); }
    catch (error) {
      if (!error.status || error.status >= 500) {
        await chrome.storage.local.set({ submissionUncertain: { draftId: draft.id, repository: repository.full_name, marker } });
        try { issue = await findIssueByMarker(githubToken, repository.full_name, marker); }
        catch { /* Keep the uncertain marker for a later check. */ }
        if (!issue) throw new Error("GitHub did not confirm the issue creation. Check the repository's issues before trying again.");
      } else throw error;
    }
    await chrome.storage.local.remove(["draft", "uploadedAttachment", "submissionUncertain"]);
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
