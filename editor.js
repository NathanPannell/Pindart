import { arrangeRepositories, searchRepositories } from "./repositories.js";

const $ = id => document.getElementById(id);
const canvas = $("markupCanvas");
const ctx = canvas.getContext("2d");
const base = document.createElement("canvas");
const baseCtx = base.getContext("2d");

let draft;
let tool = "arrow";
let strokes = [];
let currentStroke = null;
let activePointerId = null;
let png = "";
let repositories = [];
let repositoryActivity = {};
let githubLogin = null;
let activityWrite = Promise.resolve();
let authOpen = false;
let submitBusy = false;
let pendingRepository = "";
let formSaveTimer;

async function closeEditorWindow() {
  try {
    const current = await chrome.windows.getCurrent();
    if (current.type === "popup") { await chrome.windows.remove(current.id); return; }
  } catch { /* Fall back to the window close below. */ }
  window.close();
}

async function request(type, extra = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...extra });
  if (!response?.ok) throw new Error(response?.error || "The extension did not respond.");
  return response.value;
}

function setStep(step) {
  for (const id of ["emptyState", "markupStep", "reportStep", "successStep"]) $(id).hidden = id !== step;
  $("stepLabel").textContent = ({ emptyState: "Capture", markupStep: "Mark up capture", reportStep: "Issue details", successStep: "Complete" })[step];
  const heading = $(step).querySelector("h1");
  if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
}

function showError(message) {
  $("formError").textContent = message;
  $("formError").hidden = false;
}

function clearError() { $("formError").hidden = true; }
function showAuthError(message) { $("authError").textContent = message; $("authError").hidden = false; }
function clearAuthError() { $("authError").hidden = true; }
function showRepoError(message) { $("repoError").textContent = message; $("repoError").hidden = false; }

async function resizeWindow(width, height) {
  try {
    const current = await chrome.windows.getCurrent();
    await chrome.windows.update(current.id, { width, height });
  } catch { /* Window managers can refuse a size change. */ }
}

async function loadDraft() {
  const { draft: loaded, captureError } = await request("GET_DRAFT");
  if (!loaded) {
    $("emptyMessage").textContent = captureError || "Open a webpage, click the extension icon, then drag around the area you want to report.";
    setStep("emptyState");
    return;
  }
  if (loaded.id !== draft?.id) {
    resetCaptureForm();
    const { formDraft } = await chrome.storage.local.get("formDraft");
    if (formDraft?.draftId === loaded.id) {
      $("issueTitle").value = formDraft.title || "";
      $("issueDescription").value = formDraft.description || "";
      $("repositorySearch").value = formDraft.search || "";
      pendingRepository = formDraft.repository || "";
      updateSubmitEnabled();
    } else if (formDraft) await chrome.storage.local.remove("formDraft");
  }
  draft = loaded;
  $("captureNotice").hidden = !captureError;
  if (captureError) $("captureNotice").textContent = `${captureError} Your previous capture is still open.`;
  const image = new Image();
  image.src = draft.image;
  await image.decode();
  const sx = image.naturalWidth / draft.viewport.width;
  const sy = image.naturalHeight / draft.viewport.height;
  const left = draft.cropApplied ? 0 : Math.max(0, Math.min(image.naturalWidth - 1, Math.round(draft.rect.x * sx)));
  const top = draft.cropApplied ? 0 : Math.max(0, Math.min(image.naturalHeight - 1, Math.round(draft.rect.y * sy)));
  const width = draft.cropApplied ? image.naturalWidth : Math.max(1, Math.min(image.naturalWidth - left, Math.round(draft.rect.width * sx)));
  const height = draft.cropApplied ? image.naturalHeight : Math.max(1, Math.min(image.naturalHeight - top, Math.round(draft.rect.height * sy)));
  base.width = canvas.width = width;
  base.height = canvas.height = height;
  baseCtx.drawImage(image, left, top, width, height, 0, 0, width, height);
  const saved = await chrome.storage.local.get("annotations");
  strokes = saved.annotations?.draftId === draft.id ? saved.annotations.strokes : [];
  $("captureSize").textContent = `${draft.rect.width} × ${draft.rect.height} px selection`;
  updateHistoryButtons();
  render();
  setStep("markupStep");
}

function updateHistoryButtons() {
  $("undoButton").disabled = strokes.length === 0;
  $("clearButton").disabled = strokes.length === 0;
}

function saveStrokes() {
  if (draft) chrome.storage.local.set({ annotations: { draftId: draft.id, strokes } });
}

function point(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(canvas.width, (event.clientX - rect.left) * canvas.width / rect.width)),
    y: Math.max(0, Math.min(canvas.height, (event.clientY - rect.top) * canvas.height / rect.height)),
  };
}

function renderStroke(stroke) {
  const size = Math.max(3, Math.min(8, canvas.width / 180));
  ctx.strokeStyle = "#d22f2c";
  ctx.fillStyle = "#d22f2c";
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const points = stroke.points;
  if (!points.length) return;
  if (stroke.type === "pen") {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    if (points.length === 1) ctx.lineTo(points[0].x + .01, points[0].y + .01);
    ctx.stroke();
  } else {
    const start = points[0], end = points[points.length - 1];
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length < 5) return;
    const head = Math.min(24, Math.max(12, length * .24));
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - head * Math.cos(angle - Math.PI / 6), end.y - head * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x - head * Math.cos(angle + Math.PI / 6), end.y - head * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(base, 0, 0);
  for (const stroke of strokes) renderStroke(stroke);
  if (currentStroke) renderStroke(currentStroke);
}

function chooseTool(next) {
  tool = next;
  for (const name of ["arrow", "pen"]) {
    const button = $(`${name}Tool`);
    const active = name === next;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
}

canvas.addEventListener("pointerdown", event => {
  if (event.button !== 0 || !draft || activePointerId !== null) return;
  event.preventDefault();
  activePointerId = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  currentStroke = { type: tool, points: [point(event)] };
  render();
});
canvas.addEventListener("pointermove", event => {
  if (!currentStroke || event.pointerId !== activePointerId) return;
  event.preventDefault();
  const next = point(event);
  if (tool === "arrow") currentStroke.points[1] = next;
  else currentStroke.points.push(next);
  render();
});
function finishStroke(event) {
  if (!currentStroke || event.pointerId !== activePointerId) return;
  event.preventDefault();
  const last = point(event);
  if (currentStroke.type === "arrow") currentStroke.points[1] = last;
  else currentStroke.points.push(last);
  strokes.push(currentStroke);
  currentStroke = null;
  activePointerId = null;
  updateHistoryButtons();
  saveStrokes();
  render();
}
canvas.addEventListener("pointerup", finishStroke);
canvas.addEventListener("pointercancel", event => {
  if (event.pointerId !== activePointerId) return;
  currentStroke = null; activePointerId = null; render();
});
$("arrowTool").addEventListener("click", () => chooseTool("arrow"));
$("penTool").addEventListener("click", () => chooseTool("pen"));
$("undoButton").addEventListener("click", () => { strokes.pop(); updateHistoryButtons(); saveStrokes(); render(); });
$("clearButton").addEventListener("click", () => { strokes = []; updateHistoryButtons(); saveStrokes(); render(); });
document.addEventListener("keydown", event => {
  if ($("markupStep").hidden) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault(); strokes.pop(); updateHistoryButtons(); saveStrokes(); render();
  } else if (!event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "a") chooseTool("arrow");
  else if (!event.ctrlKey && !event.metaKey && event.key.toLowerCase() === "p") chooseTool("pen");
});

async function showReport() {
  png = canvas.toDataURL("image/png");
  $("previewImage").src = png;
  $("selectionSize").textContent = `${canvas.width} × ${canvas.height} px`;
  $("pageUrl").textContent = draft.url;
  $("windowSize").textContent = `${draft.windowWidth} × ${draft.windowHeight} px`;
  $("viewportSize").textContent = `${draft.viewport.width} × ${draft.viewport.height} px`;
  $("captureTime").textContent = new Date(draft.capturedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "long" });
  setStep("reportStep");
  await resizeWindow(1000, 820);
  await refreshAuth();
}
$("continueButton").addEventListener("click", () => showReport().catch(error => showError(error.message)));
$("backButton").addEventListener("click", async () => { setStep("markupStep"); await resizeWindow(1120, 820); });

function updateSubmitEnabled() {
  $("submitButton").disabled = submitBusy || !repositories.length || !$("repository").value || !$("issueTitle").value.trim();
  const selected = repositories.find(item => item.full_name === $("repository").value);
  $("uploadNote").textContent = selected?.private
    ? "Screenshot uploads to the selected private repository."
    : "Screenshot uploads to GitHub before the issue is created.";
}
function recordRepositoryInteraction(repo, kind) {
  const login = githubLogin;
  if (!login || !repo) return Promise.resolve();
  activityWrite = activityWrite.catch(() => {}).then(async () => {
    const { repoActivityByLogin = {} } = await chrome.storage.local.get("repoActivityByLogin");
    const account = { ...(repoActivityByLogin[login] || {}) };
    const record = { ...(account[String(repo.id)] || {}) };
    if (kind === "submitted") {
      record.submissions = (record.submissions || 0) + 1;
      record.lastSubmittedAt = Date.now();
    } else {
      record.selections = (record.selections || 0) + 1;
      record.lastSelectedAt = Date.now();
    }
    account[String(repo.id)] = record;
    await chrome.storage.local.set({ repoActivityByLogin: { ...repoActivityByLogin, [login]: account } });
    if (githubLogin === login) repositoryActivity = account;
  });
  return activityWrite;
}

function resetCaptureForm() {
  clearTimeout(formSaveTimer);
  pendingRepository = "";
  $("issueForm").reset();
  $("repositorySearch").value = "";
  $("repository").value = "";
  $("previewImage").removeAttribute("src");
  $("repoError").hidden = true;
  $("formError").hidden = true;
  $("captureNotice").hidden = true;
  png = "";
  if (repositories.length) renderRepositoryOptions();
  updateSubmitEnabled();
}

function saveFormDraft() {
  clearTimeout(formSaveTimer);
  if (!draft) return;
  const draftId = draft.id;
  formSaveTimer = setTimeout(() => chrome.storage.local.set({ formDraft: {
    draftId,
    title: $("issueTitle").value,
    description: $("issueDescription").value,
    search: $("repositorySearch").value,
    repository: $("repository").value,
  } }), 150);
}

function renderRepositoryOptions() {
  const select = $("repository");
  const previous = select.value || pendingRepository;
  const ordered = arrangeRepositories(repositories, repositoryActivity);
  const query = $("repositorySearch").value;
  const recent = searchRepositories(ordered.recent, query);
  const updated = searchRepositories(ordered.updated, query);
  const visible = [...recent, ...updated];
  select.replaceChildren(new Option(visible.length ? "Choose a repository" : "No matching repositories", ""));
  for (const [label, group] of [["Your recent picks", recent], ["Recently updated on GitHub", updated]]) {
    if (!group.length) continue;
    const options = document.createElement("optgroup");
    options.label = label;
    for (const repo of group) {
      const option = new Option(`${repo.full_name}${repo.private ? " · private" : ""}`, repo.full_name);
      option.dataset.id = String(repo.id);
      options.append(option);
    }
    select.append(options);
  }
  select.value = visible.some(repo => repo.full_name === previous) ? previous : "";
  if (select.value) pendingRepository = "";
  select.disabled = visible.length === 0;
  $("repoSearchStatus").textContent = visible.length
    ? `${visible.length} ${visible.length === 1 ? "repository" : "repositories"} available. Recent picks appear first, then recently updated repositories.`
    : query.trim() ? `No repositories match “${query.trim()}”. Try another owner or name.`
    : "No repositories are available to search.";
  updateSubmitEnabled();
}

$("repositorySearch").addEventListener("input", () => { renderRepositoryOptions(); saveFormDraft(); });
$("repository").addEventListener("change", () => {
  updateSubmitEnabled();
  saveFormDraft();
  const repo = repositories.find(item => item.full_name === $("repository").value);
  if (repo) recordRepositoryInteraction(repo, "selected").catch(() => {});
});
$("issueTitle").addEventListener("input", () => { updateSubmitEnabled(); saveFormDraft(); });
$("issueDescription").addEventListener("input", saveFormDraft);

async function refreshAuth() {
  const status = await request("AUTH_STATUS");
  githubLogin = status.authenticated ? status.login : null;
  $("authPanel").classList.toggle("connected", status.authenticated);
  clearAuthError();
  $("signedIn").hidden = !status.authenticated;
  $("signedOut").hidden = status.authenticated || authOpen;
  $("authProgress").hidden = !authOpen;
  if (status.authenticated) {
    authOpen = false;
    $("authProgress").hidden = true;
    $("connectedAs").textContent = `@${status.login}`;
    try { clearAuthError(); await loadRepositories(); }
    catch (error) {
      const latest = await request("AUTH_STATUS");
      if (!latest.authenticated) {
        repositories = [];
        githubLogin = null;
        $("authPanel").classList.remove("connected");
        $("signedIn").hidden = true;
        $("signedOut").hidden = false;
        $("repositorySearch").disabled = true;
        $("repository").disabled = true;
        $("repository").replaceChildren(new Option("Sign in to choose a repository", ""));
        updateSubmitEnabled();
      }
      showAuthError(error.message);
    }
  } else {
    repositories = [];
    repositoryActivity = {};
    $("repoError").hidden = true;
    $("repositorySearch").disabled = true;
    $("repositorySearch").value = "";
    $("repoSearchStatus").textContent = "Sign in to search your repositories.";
    $("repository").disabled = true;
    $("repository").replaceChildren(new Option("Sign in to choose a repository", ""));
    updateSubmitEnabled();
    if (!status.configured) showAuthError("The sign-in service is not configured in this build.");
  }
}

async function loadRepositories() {
  $("repositorySearch").disabled = true;
  $("repoSearchStatus").textContent = "Loading repositories…";
  repositories = await request("LIST_REPOS");
  const { repoActivityByLogin = {} } = await chrome.storage.local.get("repoActivityByLogin");
  repositoryActivity = repoActivityByLogin[githubLogin] || {};
  $("repoError").hidden = true;
  $("repositorySearch").disabled = repositories.length === 0;
  renderRepositoryOptions();
  if (!repositories.length) showRepoError("No repositories with Issues enabled and screenshot attachment access were found.");
}

$("signInButton").addEventListener("click", async () => {
  if (authOpen) return;
  clearAuthError();
  authOpen = true;
  $("signInButton").disabled = true;
  $("signedOut").hidden = true;
  $("authProgress").textContent = "Continue in the GitHub window to connect your account…";
  $("authProgress").hidden = false;
  try {
    await request("AUTH_BEGIN");
    authOpen = false;
    await refreshAuth();
  } catch (error) {
    authOpen = false;
    $("authProgress").hidden = true;
    $("signedOut").hidden = false;
    showAuthError(error.message);
  } finally {
    $("signInButton").disabled = false;
  }
});
$("signOutButton").addEventListener("click", async () => { await request("AUTH_SIGN_OUT"); await refreshAuth(); });

$("issueForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (submitBusy) return;
  clearError();
  const repo = repositories.find(item => item.full_name === $("repository").value);
  if (!repo) { showError("Choose a repository."); return; }
  submitBusy = true;
  updateSubmitEnabled();
  $("submitButton").textContent = "Creating…";
  try {
    const result = await request("SUBMIT_ISSUE", {
      draftId: draft.id,
      repository: repo.full_name,
      repositoryId: repo.id,
      title: $("issueTitle").value,
      description: $("issueDescription").value,
      png,
    });
    await recordRepositoryInteraction(repo, "submitted").catch(() => {});
    clearTimeout(formSaveTimer);
    await chrome.storage.local.remove(["annotations", "formDraft"]);
    $("issueLink").href = result.issueUrl;
    $("successCopy").textContent = `${repo.full_name} #${result.number} includes your annotated capture and page details.`;
    setStep("successStep");
  } catch (error) {
    const uncertain = error.message.includes("did not confirm");
    showError(uncertain ? error.message : `${error.message} Your capture and form are still here. Try again.`);
  } finally {
    submitBusy = false;
    $("submitButton").textContent = "Create issue";
    updateSubmitEnabled();
  }
});

$("closeEmpty").addEventListener("click", closeEditorWindow);
$("doneButton").addEventListener("click", closeEditorWindow);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.draft?.newValue && changes.draft.newValue.id !== draft?.id) {
    strokes = []; loadDraft().catch(error => { $("emptyMessage").textContent = error.message; setStep("emptyState"); });
  }
  if (area === "local" && changes.captureError) {
    const error = changes.captureError.newValue;
    $("captureNotice").hidden = !error;
    if (error) $("captureNotice").textContent = `${error} Your previous capture is still open.`;
    if (!draft && error) { $("emptyMessage").textContent = error; setStep("emptyState"); }
  }
});
loadDraft().catch(error => { $("emptyMessage").textContent = error.message; setStep("emptyState"); });
