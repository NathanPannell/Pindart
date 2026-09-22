(() => {
  const activeKey = Symbol.for("screenshot-to-issue.region-selector");

  // Re-injection starts a fresh selection without leaving an older overlay behind.
  const previous = globalThis[activeKey];
  if (previous && typeof previous.destroy === "function") previous.destroy();

  const host = document.createElement("div");
  host.setAttribute("aria-label", "Screenshot region selector");
  host.tabIndex = -1;
  host.style.setProperty("all", "initial", "important");
  host.style.setProperty("position", "fixed", "important");
  host.style.setProperty("inset", "0", "important");
  host.style.setProperty("display", "block", "important");
  host.style.setProperty("width", "100vw", "important");
  host.style.setProperty("height", "100vh", "important");
  host.style.setProperty("margin", "0", "important");
  host.style.setProperty("padding", "0", "important");
  host.style.setProperty("border", "0", "important");
  host.style.setProperty("z-index", "2147483647", "important");
  host.style.setProperty("pointer-events", "auto", "important");
  host.style.setProperty("contain", "strict", "important");

  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML = `
    <style>
      :host { all: initial; }
      * { box-sizing: border-box; }
      .overlay {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
        background: rgba(15, 23, 42, 0.24);
        color: #f8fafc;
        cursor: crosshair;
        font: 14px/1.4 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
      }
      .toolbar {
        position: absolute;
        top: 18px;
        left: 50%;
        display: flex;
        align-items: center;
        gap: 18px;
        max-width: calc(100vw - 32px);
        padding: 11px 12px 11px 16px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 14px;
        background: #111827;
        box-shadow: 0 12px 36px rgba(2, 6, 23, 0.28);
        transform: translateX(-50%);
        cursor: default;
      }
      .copy { min-width: 0; }
      .title { margin: 0; font-size: 13px; font-weight: 700; letter-spacing: 0.01em; }
      .hint { margin: 2px 0 0; color: #cbd5e1; font-size: 12px; white-space: nowrap; }
      .cancel {
        flex: 0 0 auto;
        min-height: 34px;
        padding: 0 12px;
        border: 1px solid #475569;
        border-radius: 9px;
        background: #1f2937;
        color: #f8fafc;
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      .cancel:hover { background: #334155; }
      .cancel:focus-visible { outline: 2px solid #93c5fd; outline-offset: 2px; }
      .selection {
        position: absolute;
        display: none;
        border: 2px solid #ef4444;
        background: rgba(239, 68, 68, 0.08);
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.9), 0 8px 28px rgba(2, 6, 23, 0.24);
        pointer-events: none;
      }
      .selection::after {
        position: absolute;
        right: -4px;
        bottom: -4px;
        width: 6px;
        height: 6px;
        border: 1px solid #fff;
        border-radius: 2px;
        background: #ef4444;
        content: "";
      }
      .measure {
        position: absolute;
        right: 0;
        bottom: calc(100% + 7px);
        padding: 3px 7px;
        border-radius: 5px;
        background: #b91c1c;
        color: #fff;
        font: 600 11px/1.4 ui-sans-serif, system-ui, sans-serif;
        white-space: nowrap;
      }
      .overlay[data-invalid="true"] .hint { color: #fecaca; }
      @media (max-width: 520px) {
        .toolbar { top: 12px; gap: 10px; padding-left: 12px; }
        .hint { white-space: normal; }
      }
    </style>
    <div class="overlay" role="application" aria-label="Select an area of the page to capture">
      <div class="toolbar">
        <div class="copy" aria-live="polite">
          <p class="title">Select an area to report</p>
          <p class="hint">Click and drag to capture · Esc to cancel</p>
        </div>
        <button class="cancel" type="button">Cancel</button>
      </div>
      <div class="selection" aria-hidden="true"><span class="measure"></span></div>
    </div>
  `;

  const overlay = shadow.querySelector(".overlay");
  const hint = shadow.querySelector(".hint");
  const selection = shadow.querySelector(".selection");
  const measure = shadow.querySelector(".measure");
  const cancelButton = shadow.querySelector(".cancel");
  let cleaned = false;
  let pointerId = null;
  let start = null;
  let current = null;

  const controller = { destroy: cleanup };
  globalThis[activeKey] = controller;

  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("wheel", preventPageScroll, true);
    document.removeEventListener("touchmove", preventPageScroll, true);
    window.removeEventListener("pagehide", cleanup, true);
    overlay.removeEventListener("pointerdown", onPointerDown);
    overlay.removeEventListener("pointermove", onPointerMove);
    overlay.removeEventListener("pointerup", onPointerUp);
    overlay.removeEventListener("pointercancel", onPointerCancel);
    overlay.removeEventListener("contextmenu", preventContextMenu);
    cancelButton.removeEventListener("click", onCancelClick);
    host.remove();
    if (globalThis[activeKey] === controller) delete globalThis[activeKey];
  }

  function preventPageScroll(event) {
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
  }

  function preventContextMenu(event) {
    event.preventDefault();
    event.stopPropagation();
  }

  function onKeyDown(event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    cleanup();
    chrome.runtime.sendMessage({ type: "CANCEL_SELECTION" }).catch(() => {});
  }

  function onCancelClick(event) {
    event.preventDefault();
    event.stopPropagation();
    cleanup();
    chrome.runtime.sendMessage({ type: "CANCEL_SELECTION" }).catch(() => {});
  }

  function coordinates(event) {
    return {
      x: Math.max(0, Math.min(window.innerWidth, event.clientX)),
      y: Math.max(0, Math.min(window.innerHeight, event.clientY)),
    };
  }

  function renderSelection() {
    if (!start || !current) return;
    const left = Math.min(start.x, current.x);
    const top = Math.min(start.y, current.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);
    selection.style.display = "block";
    selection.style.left = `${left}px`;
    selection.style.top = `${top}px`;
    selection.style.width = `${width}px`;
    selection.style.height = `${height}px`;
    measure.textContent = `${Math.round(width)} × ${Math.round(height)} px`;
  }

  function resetDrag(message) {
    pointerId = null;
    start = null;
    current = null;
    selection.style.display = "none";
    overlay.removeAttribute("data-invalid");
    if (message) hint.textContent = message;
  }

  function onPointerDown(event) {
    if (event.button !== 0 || pointerId !== null) return;
    if (event.target && event.target.closest && event.target.closest(".toolbar")) return;
    event.preventDefault();
    event.stopPropagation();
    pointerId = event.pointerId;
    start = coordinates(event);
    current = start;
    overlay.removeAttribute("data-invalid");
    hint.textContent = "Release to capture this area · Esc to cancel";
    renderSelection();
    try {
      overlay.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture can fail if the browser has already canceled the pointer.
    }
  }

  function onPointerMove(event) {
    if (event.pointerId !== pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    current = coordinates(event);
    renderSelection();
  }

  function onPointerUp(event) {
    if (event.pointerId !== pointerId || !start) return;
    event.preventDefault();
    event.stopPropagation();
    current = coordinates(event);

    const left = Math.floor(Math.min(start.x, current.x));
    const top = Math.floor(Math.min(start.y, current.y));
    const right = Math.ceil(Math.max(start.x, current.x));
    const bottom = Math.ceil(Math.max(start.y, current.y));
    const width = right - left;
    const height = bottom - top;

    if (width < 16 || height < 16) {
      resetDrag("That area is too small. Drag a region at least 16 × 16 px.");
      overlay.setAttribute("data-invalid", "true");
      return;
    }

    const message = {
      type: "CAPTURE_REGION",
      rect: { x: left, y: top, width, height },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
      },
      url: location.href,
      capturedAt: new Date().toISOString(),
    };

    cleanup();
    try {
      chrome.runtime.sendMessage(message).catch(() => {});
    } catch {
      // The extension may have been reloaded while the selection was active.
    }
  }

  function onPointerCancel(event) {
    if (event.pointerId !== pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    resetDrag("Drag canceled. Start again, or press Esc to leave.");
  }

  overlay.addEventListener("pointerdown", onPointerDown);
  overlay.addEventListener("pointermove", onPointerMove);
  overlay.addEventListener("pointerup", onPointerUp);
  overlay.addEventListener("pointercancel", onPointerCancel);
  overlay.addEventListener("contextmenu", preventContextMenu);
  cancelButton.addEventListener("click", onCancelClick);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("wheel", preventPageScroll, { capture: true, passive: false });
  document.addEventListener("touchmove", preventPageScroll, { capture: true, passive: false });
  window.addEventListener("pagehide", cleanup, true);

  (document.documentElement || document.body).appendChild(host);
  host.focus({ preventScroll: true });
})();
