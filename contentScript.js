let selectedText = "";
let suppressNextMouseup = false;
let isRequestInFlight = false;
let selectionDebounceTimer = null;

(function injectStyles() {
  if (document.getElementById("eli5-styles")) return;
  const style = document.createElement("style");
  style.id = "eli5-styles";
  style.textContent = `
    @keyframes eli5FadeIn {
      from { opacity: 0; transform: translateY(6px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0)   scale(1);    }
    }
    @keyframes eli5DotBounce {
      0%, 80%, 100% { transform: translateY(0);    opacity: 0.3; }
      40%           { transform: translateY(-4px); opacity: 1;   }
    }
    .eli5-dot {
      width: 4px; height: 4px;
      border-radius: 50%;
      background: rgba(255,255,255,0.6);
      display: inline-block;
      animation: eli5DotBounce 1.2s ease-in-out infinite;
    }
    .eli5-dot:nth-child(2) { animation-delay: 0.18s; }
    .eli5-dot:nth-child(3) { animation-delay: 0.36s; }
    @keyframes eli5GlowPulse {
      0%, 100% { box-shadow: 0 0 0px 0px rgba(255,255,255,0.0),  0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07); }
      50%       { box-shadow: 0 0 10px 1px rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.07); }
    }
    #eli5-popup {
      display: flex;
      flex-direction: column;
      cursor: default;
      user-select: none;
      box-sizing: border-box;
      border: 1px solid rgba(255,255,255,0.22) !important;
      box-shadow: 0 0 0 1px rgba(255,255,255,0.04),
                  0 0 12px 1px rgba(255,255,255,0.06),
                  0 8px 32px rgba(0,0,0,0.5),
                  inset 0 1px 0 rgba(255,255,255,0.1) !important;
      animation: eli5FadeIn 0.18s ease, eli5GlowPulse 3.5s ease-in-out 0.2s infinite !important;
    }
    #eli5-popup-drag-handle { cursor: grab; flex-shrink: 0; }
    #eli5-popup-drag-handle:active { cursor: grabbing; }
    #eli5-close-btn:hover {
      background: rgba(255,255,255,0.12) !important;
      color: rgba(255,255,255,0.9) !important;
    }
    #eli5-popup-content {
      overflow-y: auto;
      flex: 1;
      min-height: 0;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.15) transparent;
    }
    /* ── Meta line (persona + format) ── */
    #eli5-meta {
      font-size: 9.5px;
      font-weight: 500;
      letter-spacing: 0.4px;
      color: rgba(255,255,255,0.28);
      margin-top: 3px;
      flex-shrink: 0;
    }

    /* ── Copy button ── */
    #eli5-copy-btn {
      background: transparent;
      border: none;
      color: rgba(255,255,255,0.3);
      font-size: 13px;
      line-height: 1;
      cursor: pointer;
      padding: 2px 5px;
      border-radius: 5px;
      transition: background 0.15s ease, color 0.15s ease;
      font-family: inherit;
      flex-shrink: 0;
    }
    #eli5-copy-btn:hover { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.8); }
    #eli5-copy-btn.copied { color: rgba(120,220,120,0.85) !important; }

    /* ── Refine bar ── */
    #eli5-refine-bar {
      display: flex;
      gap: 6px;
      margin-top: 11px;
      flex-shrink: 0;
      padding-top: 10px;
      border-top: 1px solid rgba(255,255,255,0.07);
    }
    .eli5-refine-btn {
      flex: 1;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.11);
      border-radius: 8px;
      padding: 5px 8px;
      color: rgba(255,255,255,0.55);
      font-size: 11px;
      font-weight: 500;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      cursor: pointer;
      letter-spacing: 0.2px;
      transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.12s;
      user-select: none;
    }
    .eli5-refine-btn:hover {
      background: rgba(255,255,255,0.10);
      border-color: rgba(255,255,255,0.25);
      color: rgba(255,255,255,0.88);
      transform: translateY(-1px);
    }
    .eli5-refine-btn:active { transform: scale(0.96); }
    .eli5-refine-btn:disabled {
      opacity: 0.35;
      cursor: default;
      transform: none;
    }

    /* ── Error state ── */
    .eli5-error-msg {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      color: rgba(255,160,130,0.85);
      font-size: 12.5px;
      line-height: 1.55;
    }
    .eli5-error-icon { font-size: 14px; flex-shrink: 0; margin-top: 1px; }
    #eli5-popup-content::-webkit-scrollbar { width: 4px; }
    #eli5-popup-content::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.15);
      border-radius: 4px;
    }

    /* ── Snip mode ── */
    #eli5-snip-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483646;
      cursor: crosshair;
      user-select: none;
      -webkit-user-select: none;
      background: transparent;
      transition: background 0.2s ease;
    }
    #eli5-snip-overlay.eli5-snip-active {
      background: rgba(0, 0, 0, 0.42);
    }
    #eli5-snip-hint {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(15, 15, 20, 0.78);
      border: 1px solid rgba(255,255,255,0.18);
      border-radius: 12px;
      padding: 12px 20px;
      color: rgba(255,255,255,0.75);
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0.2px;
      backdrop-filter: blur(12px);
      pointer-events: none;
      transition: opacity 0.15s ease;
      white-space: nowrap;
    }
    #eli5-snip-box {
      position: fixed;
      border: 1.5px solid rgba(255,255,255,0.9);
      background: rgba(255,255,255,0.07);
      box-shadow: 0 0 0 1px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.06);
      pointer-events: none;
      box-sizing: border-box;
    }
    #eli5-snip-dims {
      position: fixed;
      background: rgba(15,15,20,0.8);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 6px;
      padding: 3px 8px;
      font-size: 10.5px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: rgba(255,255,255,0.7);
      pointer-events: none;
      letter-spacing: 0.3px;
      backdrop-filter: blur(8px);
    }
    #eli5-snip-esc {
      position: fixed;
      top: 16px;
      right: 20px;
      background: rgba(15,15,20,0.75);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 8px;
      padding: 5px 12px;
      color: rgba(255,255,255,0.5);
      font-size: 11px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      letter-spacing: 0.3px;
      backdrop-filter: blur(8px);
      pointer-events: none;
    }

    /* Resize handles */
    [data-eli5-resize] { position: absolute; z-index: 2; }
    [data-eli5-resize="n"]  { top: -4px;    left: 12px;  right: 12px; height: 8px;  cursor: n-resize; }
    [data-eli5-resize="s"]  { bottom: -4px; left: 12px;  right: 12px; height: 8px;  cursor: s-resize; }
    [data-eli5-resize="e"]  { right: -4px;  top: 12px; bottom: 12px;  width: 8px;   cursor: e-resize; }
    [data-eli5-resize="w"]  { left: -4px;   top: 12px; bottom: 12px;  width: 8px;   cursor: w-resize; }
    [data-eli5-resize="ne"] { top: -4px;    right: -4px; width: 14px; height: 14px; cursor: ne-resize; }
    [data-eli5-resize="nw"] { top: -4px;    left: -4px;  width: 14px; height: 14px; cursor: nw-resize; }
    [data-eli5-resize="se"] { bottom: -4px; right: -4px; width: 14px; height: 14px; cursor: se-resize; }
    [data-eli5-resize="sw"] { bottom: -4px; left: -4px;  width: 14px; height: 14px; cursor: sw-resize; }

    @keyframes eli5FadeOut {
      from { opacity: 1; transform: scale(1); }
      to   { opacity: 0; transform: scale(0.96) translateY(4px); }
    }
    #eli5-popup.eli5-closing {
      animation: eli5FadeOut 0.15s ease forwards !important;
      pointer-events: none !important;
    }
    .eli5-section-label {
      font-size: 9px;
      font-weight: 600;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: rgba(255,255,255,0.25);
      margin-bottom: 8px;
    }
    #eli5-btn:active {
      transform: scale(0.94) !important;
    }
  `;
  document.head.appendChild(style);
})();

document.addEventListener("mouseup", () => {
  if (suppressNextMouseup) {
    suppressNextMouseup = false;
    return;
  }
  clearTimeout(selectionDebounceTimer);
  selectionDebounceTimer = setTimeout(() => {
    const selection = window.getSelection().toString().trim();
    if (selection.length > 0) {
      selectedText = selection;
      showExplainButton();
    } else {
      const btn = document.getElementById("eli5-btn");
      if (btn) btn.remove();
    }
  }, 180);
});

document.addEventListener("click", (e) => {
  const btn = document.getElementById("eli5-btn");
  if (!btn || btn.contains(e.target)) return;
  const selection = window.getSelection().toString().trim();
  if (selection.length === 0) btn.remove();
});

// Returns {top, left} to place a fixed element near the current text selection.
// Prefers below-right of the selection; flips if too close to viewport edges.
function getSelectionAnchor(elWidth, elHeight) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return { top: 120, left: window.innerWidth - elWidth - 24 };
  const r   = sel.getRangeAt(0).getBoundingClientRect();
  const vw  = window.innerWidth;
  const vh  = window.innerHeight;
  const GAP = 10;

  // Prefer just below the end of the selection, aligned to its right edge
  let top  = r.bottom + GAP;
  let left = r.right  + GAP;

  // Flip above if too close to bottom
  if (top + elHeight > vh - 12) top = r.top - elHeight - GAP;
  // Flip left if too close to right edge
  if (left + elWidth > vw - 12) left = r.left - elWidth - GAP;

  // Final clamp so it never escapes the viewport
  top  = Math.max(4, Math.min(top,  vh - elHeight - 4));
  left = Math.max(4, Math.min(left, vw - elWidth  - 4));

  return { top, left };
}

function showExplainButton() {
  const oldBtn = document.getElementById("eli5-btn");
  if (oldBtn) oldBtn.remove();

  const button = document.createElement("button");
  button.id = "eli5-btn";
  button.innerText = "Elify";

  button.style.position   = "fixed";
  button.style.zIndex     = "2147483647";
  button.style.visibility = "hidden"; // hide while off-screen so we can measure it
  button.style.padding    = "7px 14px";
  button.style.background = "rgba(15, 15, 20, 0.72)";
  button.style.color      = "rgba(255, 255, 255, 0.92)";
  button.style.border     = "1px solid rgba(255,255,255,0.28)";
  button.style.borderRadius = "999px";
  button.style.cursor     = "pointer";
  button.style.fontSize   = "12.5px";
  button.style.fontWeight = "500";
  button.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  button.style.letterSpacing = "0.3px";
  button.style.backdropFilter = "blur(12px) saturate(180%)";
  button.style.webkitBackdropFilter = "blur(12px) saturate(180%)";
  button.style.boxShadow  = "0 0 0 1px rgba(255,255,255,0.04), 0 0 8px 1px rgba(255,255,255,0.07), 0 4px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)";
  button.style.transition = "background 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, transform 0.15s ease";
  button.style.userSelect = "none";

  button.addEventListener("mouseenter", () => {
    button.style.background   = "rgba(30, 30, 40, 0.88)";
    button.style.border       = "1px solid rgba(255,255,255,0.55)";
    button.style.boxShadow    = "0 0 0 1px rgba(255,255,255,0.06), 0 0 14px 2px rgba(255,255,255,0.13), 0 6px 24px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.16)";
    button.style.transform    = "translateY(-1px)";
  });
  button.addEventListener("mouseleave", () => {
    button.style.background   = "rgba(15, 15, 20, 0.72)";
    button.style.border       = "1px solid rgba(255,255,255,0.28)";
    button.style.boxShadow    = "0 0 0 1px rgba(255,255,255,0.04), 0 0 8px 1px rgba(255,255,255,0.07), 0 4px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)";
    button.style.transform    = "translateY(0)";
  });

  button.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isRequestInFlight) return;
    if (!selectedText || selectedText.trim().length < 5) return;
    suppressNextMouseup = true;
    button.remove();
    isRequestInFlight = true;

    showPopup(null, null, "Understanding text…");

    const timeoutId = setTimeout(() => {
      isRequestInFlight = false;
      updatePopupContent("Request timed out. Check your connection and try again.", true);
    }, 20000);

    chrome.runtime.sendMessage(
      { type: "EXPLAIN_TEXT", text: selectedText },
      (response) => {
        clearTimeout(timeoutId);
        isRequestInFlight = false;
        if (chrome.runtime.lastError || !response?.success) {
          const reason = chrome.runtime.lastError?.message || response?.error || "Unknown error";
          updatePopupContent(reason, true);
        } else {
          updatePopupContent(response.explanation, false);
        }
      }
    );
  });

  // Append first (off-screen/invisible) so we can measure its rendered size
  document.body.appendChild(button);
  const { top, left } = getSelectionAnchor(button.offsetWidth, button.offsetHeight);
  button.style.top        = top  + "px";
  button.style.left       = left + "px";
  button.style.visibility = "visible";
}

function closePopup() {
  const popup = document.getElementById("eli5-popup");
  if (!popup || popup.classList.contains("eli5-closing")) return;
  popup.classList.add("eli5-closing");
  popup.addEventListener("animationend", () => popup.remove(), { once: true });
  setTimeout(() => { if (popup.parentNode) popup.remove(); }, 200);
}

function showPopup(text, overrideAnchor = null, loadingText = "Explaining…") {
  const oldPopup = document.getElementById("eli5-popup");
  if (oldPopup) oldPopup.remove();

  const popup = document.createElement("div");
  popup.id = "eli5-popup";

  popup.innerHTML = `
    <div id="eli5-popup-drag-handle" style="
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 12px;
      flex-shrink: 0;
    ">
      <div>
        <span style="
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.42);
          display: block;
        ">Explain Like I'm 5</span>
        <span id="eli5-meta">Loading…</span>
      </div>
      <div style="display:flex;align-items:center;gap:2px;margin-top:-1px;">
        <button id="eli5-copy-btn" title="Copy explanation">⎘</button>
        <button id="eli5-close-btn" style="
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.35);
          font-size: 14px;
          line-height: 1;
          cursor: pointer;
          padding: 2px 5px;
          border-radius: 5px;
          transition: background 0.15s ease, color 0.15s ease;
          font-family: inherit;
        ">✕</button>
      </div>
    </div>
    <div id="eli5-popup-content" style="
      font-size: 13.5px;
      line-height: 1.7;
      color: rgba(255,255,255,0.88);
      font-weight: 400;
      user-select: text;
      cursor: text;
      padding-right: 2px;
      transition: opacity 0.18s ease;
    ">${text !== null ? text : `<span style="
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: rgba(255,255,255,0.38);
        font-size: 12.5px;
        letter-spacing: 0.2px;
      ">
        <span style="display:inline-flex;gap:4px;">
          <span class="eli5-dot"></span>
          <span class="eli5-dot"></span>
          <span class="eli5-dot"></span>
        </span>
        ${loadingText}
      </span>`
    }</div>
  `;

  popup.style.position   = "fixed";
  popup.style.visibility = "hidden"; // hidden until measured and positioned
  popup.style.zIndex     = "2147483647";
  popup.style.background = "rgba(13, 13, 18, 0.78)";
  popup.style.color      = "rgba(255,255,255,0.88)";
  popup.style.padding    = "16px 18px";
  popup.style.borderRadius = "14px";
  popup.style.width      = "300px";
  popup.style.border     = "none"; // controlled by injected CSS (glow border)
  popup.style.backdropFilter = "blur(16px) saturate(180%)";
  popup.style.webkitBackdropFilter = "blur(16px) saturate(180%)";
  popup.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  popup.style.animation  = "eli5FadeIn 0.18s ease";
  popup.style.overflow   = "hidden";

  // Add resize handles for all 8 directions
  ["n","ne","e","se","s","sw","w","nw"].forEach(dir => {
    const h = document.createElement("div");
    h.setAttribute("data-eli5-resize", dir);
    popup.appendChild(h);
  });

  document.body.appendChild(popup);

  // Measure rendered size, position near selection, then reveal
  const naturalW = popup.offsetWidth;
  const naturalH = popup.offsetHeight;
  const anchor   = overrideAnchor || getSelectionAnchor(naturalW, naturalH);
  popup.style.left       = anchor.left + "px";
  popup.style.top        = anchor.top  + "px";
  popup.style.visibility = "visible";

  const MIN_W = Math.max(180, Math.round(naturalW * 0.6));
  const MAX_W = Math.min(620, Math.round(naturalW * 2.2));
  const MIN_H = Math.max(80,  Math.round(naturalH * 0.5));
  const MAX_H = Math.min(Math.round(window.innerHeight * 0.8), Math.round(naturalH * 3));

  // ── Meta line: persona + format ────────────────────────────────────────────
  const PERSONA_LABELS = { teacher:"Teacher", friendly:"Friendly", professional:"Professional", genz:"Gen Z" };
  const FORMAT_LABELS  = { bullets:"Bullets", paragraph:"Paragraph", simple:"Simple" };

  chrome.storage.sync.get(["activePersonaId","customPersonas","format"], (data) => {
    const pid    = data.activePersonaId || "teacher";
    const fmt    = data.format          || "bullets";
    const customs = data.customPersonas || [];
    let personaLabel = PERSONA_LABELS[pid];
    if (!personaLabel) {
      const cp = customs.find(p => p.id === pid);
      personaLabel = cp ? cp.name : "Teacher";
    }
    const metaEl = document.getElementById("eli5-meta");
    if (metaEl) metaEl.textContent = `${personaLabel}  ·  ${FORMAT_LABELS[fmt] || "Bullets"}`;
  });

  // ── Copy button ─────────────────────────────────────────────────────────────
  document.getElementById("eli5-copy-btn").addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!latestExplanation) return;
    const btn = document.getElementById("eli5-copy-btn");

    // Plain-text version: strip bullet symbols for clean clipboard output
    const plain = latestExplanation
      .split("\n")
      .map(l => l.replace(/^[•\-\*]\s*/, "").trim())
      .filter(l => l.length > 0)
      .join("\n");

    navigator.clipboard.writeText(plain).then(() => {
      if (!btn) return;
      btn.classList.add("copied");
      btn.title = "Copied!";
      setTimeout(() => { btn.classList.remove("copied"); btn.title = "Copy explanation"; }, 1800);
    }).catch(() => {
      // Fallback for contexts where clipboard API is restricted
      const ta = document.createElement("textarea");
      ta.value = plain;
      ta.style.cssText = "position:fixed;opacity:0;pointer-events:none;";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      if (btn) { btn.classList.add("copied"); setTimeout(() => btn.classList.remove("copied"), 1800); }
    });
  });

  // ── Close ──────────────────────────────────────────────────────────────────
  document.getElementById("eli5-close-btn").addEventListener("mousedown", (e) => {
    e.stopPropagation();
    closePopup();
  });

  // ── Drag ───────────────────────────────────────────────────────────────────
  const handle = document.getElementById("eli5-popup-drag-handle");
  let dragging = false;
  let dragStartX, dragStartY, dragOrigLeft, dragOrigTop;

  function onDragStart(e) {
    if (e.target.id === "eli5-close-btn") return;
    e.preventDefault();
    dragging = true;
    const rect = popup.getBoundingClientRect();
    popup.style.right = "auto";
    popup.style.left = rect.left + "px";
    popup.style.top  = rect.top  + "px";
    dragStartX = e.clientX;  dragStartY = e.clientY;
    dragOrigLeft = rect.left; dragOrigTop  = rect.top;
  }

  function onDragMove(e) {
    if (!dragging) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const pw = popup.offsetWidth,  ph = popup.offsetHeight;
    const rawL = dragOrigLeft + (e.clientX - dragStartX);
    const rawT = dragOrigTop  + (e.clientY - dragStartY);
    popup.style.left = Math.min(Math.max(rawL, 0), vw - pw) + "px";
    popup.style.top  = Math.min(Math.max(rawT, 0), vh - ph) + "px";
  }

  function onDragEnd() { dragging = false; }

  handle.addEventListener("mousedown", onDragStart);

  // ── Resize ─────────────────────────────────────────────────────────────────
  let resizing = false;
  let resizeDir = null;
  let rsStartX, rsStartY, rsOrigW, rsOrigH, rsOrigLeft, rsOrigTop;

  function onResizeStart(e) {
    const dir = e.target.getAttribute("data-eli5-resize");
    if (!dir) return;
    e.preventDefault();
    e.stopPropagation();
    resizing  = true;
    resizeDir = dir;

    const rect = popup.getBoundingClientRect();
    // Lock to explicit dimensions so resize math is stable
    popup.style.right  = "auto";
    popup.style.left   = rect.left   + "px";
    popup.style.top    = rect.top    + "px";
    popup.style.width  = rect.width  + "px";
    popup.style.height = rect.height + "px";

    rsStartX   = e.clientX; rsStartY   = e.clientY;
    rsOrigW    = rect.width;  rsOrigH    = rect.height;
    rsOrigLeft = rect.left;   rsOrigTop  = rect.top;
  }

  function onResizeMove(e) {
    if (!resizing) return;
    const dx = e.clientX - rsStartX;
    const dy = e.clientY - rsStartY;

    let newW = rsOrigW, newH = rsOrigH;
    let newLeft = rsOrigLeft, newTop = rsOrigTop;

    if (resizeDir.includes("e")) newW = rsOrigW + dx;
    if (resizeDir.includes("w")) { newW = rsOrigW - dx; newLeft = rsOrigLeft + dx; }
    if (resizeDir.includes("s")) newH = rsOrigH + dy;
    if (resizeDir.includes("n")) { newH = rsOrigH - dy; newTop  = rsOrigTop  + dy; }

    // Clamp width
    if (newW < MIN_W) {
      if (resizeDir.includes("w")) newLeft = rsOrigLeft + (rsOrigW - MIN_W);
      newW = MIN_W;
    }
    if (newW > MAX_W) {
      if (resizeDir.includes("w")) newLeft = rsOrigLeft + (rsOrigW - MAX_W);
      newW = MAX_W;
    }

    // Clamp height
    if (newH < MIN_H) {
      if (resizeDir.includes("n")) newTop = rsOrigTop + (rsOrigH - MIN_H);
      newH = MIN_H;
    }
    if (newH > MAX_H) {
      if (resizeDir.includes("n")) newTop = rsOrigTop + (rsOrigH - MAX_H);
      newH = MAX_H;
    }

    // Keep inside viewport
    newLeft = Math.max(0, Math.min(newLeft, window.innerWidth  - newW));
    newTop  = Math.max(0, Math.min(newTop,  window.innerHeight - newH));

    popup.style.width  = newW    + "px";
    popup.style.height = newH    + "px";
    popup.style.left   = newLeft + "px";
    popup.style.top    = newTop  + "px";
  }

  function onResizeEnd() { resizing = false; resizeDir = null; }

  popup.addEventListener("mousedown", onResizeStart);

  // ── Shared move / up listeners ─────────────────────────────────────────────
  function onMove(e) { onDragMove(e); onResizeMove(e); }
  function onUp()    { onDragEnd();   onResizeEnd();   }

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup",   onUp);

  // ── ESC to close ──────────────────────────────────────────────────────────
  function onPopupKeyDown(e) {
    if (e.key === "Escape" && document.getElementById("eli5-popup")) {
      e.preventDefault();
      closePopup();
    }
  }
  document.addEventListener("keydown", onPopupKeyDown);

  // ── Click outside to close ──────────────────────────────────────────────
  function onClickOutside(e) {
    const p = document.getElementById("eli5-popup");
    if (p && !p.contains(e.target)) closePopup();
  }
  setTimeout(() => document.addEventListener("mousedown", onClickOutside), 150);

  // Clean up all document listeners when popup is removed
  const observer = new MutationObserver(() => {
    if (!document.getElementById("eli5-popup")) {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup",   onUp);
      document.removeEventListener("keydown", onPopupKeyDown);
      document.removeEventListener("mousedown", onClickOutside);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true });
}

// Updates the content area of an open popup.
// Pass isError=true to render in a muted error colour.
// Stores the latest plain-text explanation so refine buttons can re-use it
let latestExplanation = "";

function normalizeText(text) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")   // trailing spaces on lines
    .replace(/\n{3,}/g, "\n\n")   // collapse 3+ blank lines to 1
    .replace(/^[-–—]\s+/gm, "• ") // normalize dash bullets → •
    .replace(/^\*\s+/gm, "• ")    // normalize * bullets → •
    .trim();
}

function renderExplanationHTML(text) {
  const normalized = normalizeText(text);
  const lines = normalized.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const isBulleted = lines.some(l => /^•/.test(l));

  let label, body;
  if (isBulleted) {
    label = "Key Points";
    const items = lines
      .map(l => l.replace(/^[•\-\*]\s*/, "").trim())
      .filter(l => l.length > 0)
      .map(l => `<li style="margin-bottom:9px;">${l}</li>`)
      .join("");
    body = `<ul style="margin:0;padding-left:18px;list-style:disc;line-height:1.72;">${items}</ul>`;
  } else if (lines.length <= 4) {
    label = "Summary";
    body = lines.map(l => `<p style="margin:0 0 9px 0;line-height:1.72;">${l}</p>`).join("");
  } else {
    label = "Summary";
    body = `<p style="margin:0;line-height:1.72;">${lines.join(" ")}</p>`;
  }

  return `<div class="eli5-section-label">${label}</div>${body}`;
}

function friendlyError(raw) {
  const lower = raw.toLowerCase();
  if (lower.includes("timeout") || lower.includes("timed out"))
    return "Request timed out. Check your connection and try again.";
  if (lower.includes("rate limit") || lower.includes("429"))
    return "AI service is busy right now. Try again in a moment.";
  if (lower.includes("empty response"))
    return "Didn't get a clear response. Try selecting different text.";
  if (lower.includes("no readable text"))
    return "No readable text found in the selected area. Try a clearer section.";
  if (lower.includes("network") || lower.includes("failed to fetch") || lower.includes("err_"))
    return "Connection issue. Check your internet and try again.";
  if (lower.includes("api key") || lower.includes("unauthorized") || lower.includes("401"))
    return "API key issue. Check the server configuration.";
  if (raw.length > 120) return "Something went wrong. Try again.";
  return raw;
}

function updatePopupContent(text, isError = false) {
  const content = document.getElementById("eli5-popup-content");
  if (!content) return;

  content.style.transition = "opacity 0.2s ease";
  content.style.opacity    = "0";

  setTimeout(() => {
    content.style.cursor = isError ? "default" : "text";
    content.style.color  = isError ? "rgba(255,120,120,0.75)" : "rgba(255,255,255,0.88)";

    if (isError) {
      const msg = friendlyError(text);
      content.innerHTML = `
        <div class="eli5-error-msg">
          <span class="eli5-error-icon">⚠️</span>
          <span>Couldn't complete this. ${msg}</span>
        </div>`;
      removeRefineBar();
    } else {
      latestExplanation = normalizeText(text);
      content.innerHTML = renderExplanationHTML(latestExplanation);
      content.scrollTop = 0;
      content.style.opacity = "1";
      injectRefineBar();
      return;
    }

    content.style.opacity = "1";
  }, 200);
}

// ── Refine bar ────────────────────────────────────────────────────────────────
function removeRefineBar() {
  const bar = document.getElementById("eli5-refine-bar");
  if (bar) bar.remove();
}

function injectRefineBar() {
  removeRefineBar();
  const popup = document.getElementById("eli5-popup");
  if (!popup) return;

  const bar = document.createElement("div");
  bar.id = "eli5-refine-bar";
  bar.innerHTML = `
    <button class="eli5-refine-btn" id="eli5-simplify-btn">🔽 Simplify More</button>
    <button class="eli5-refine-btn" id="eli5-explain-btn">📖 Explain More</button>
  `;
  popup.appendChild(bar);

  bar.querySelector("#eli5-simplify-btn").addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    sendRefineRequest("simplify_more");
  });

  bar.querySelector("#eli5-explain-btn").addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    sendRefineRequest("explain_more");
  });
}

function sendRefineRequest(mode) {
  if (isRequestInFlight) return;
  isRequestInFlight = true;

  const bar = document.getElementById("eli5-refine-bar");
  if (bar) bar.querySelectorAll(".eli5-refine-btn").forEach(b => b.disabled = true);

  const content = document.getElementById("eli5-popup-content");
  if (content) {
    content.style.transition = "opacity 0.15s ease";
    content.style.opacity    = "0";
    setTimeout(() => {
      content.innerHTML = `<span style="
        display:inline-flex;align-items:center;gap:7px;
        color:rgba(255,255,255,0.4);font-size:12.5px;">
        <span style="display:inline-flex;gap:4px;">
          <span class="eli5-dot"></span>
          <span class="eli5-dot"></span>
          <span class="eli5-dot"></span>
        </span>
        ${mode === "simplify_more" ? "Simplifying…" : "Expanding…"}
      </span>`;
      content.style.opacity = "1";
    }, 150);
  }

  const timeoutId = setTimeout(() => {
    isRequestInFlight = false;
    updatePopupContent("Request timed out. Check your connection and try again.", true);
  }, 20000);

  chrome.runtime.sendMessage(
    { type: "REFINE_TEXT", mode, text: latestExplanation },
    (response) => {
      clearTimeout(timeoutId);
      isRequestInFlight = false;
      if (chrome.runtime.lastError || !response?.success) {
        const reason = chrome.runtime.lastError?.message || response?.error || "Unknown error";
        updatePopupContent(reason, true);
      } else {
        updatePopupContent(response.explanation, false);
      }
    }
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SNIP MODE
// ══════════════════════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "START_SNIP") startSnipMode();
});

function startSnipMode() {
  // Don't stack overlays
  if (document.getElementById("eli5-snip-overlay")) return;

  // ── Build overlay elements ─────────────────────────────────────────────────
  const overlay = document.createElement("div");
  overlay.id = "eli5-snip-overlay";

  const hint = document.createElement("div");
  hint.id = "eli5-snip-hint";
  hint.textContent = "✂️  Drag to select area — Esc to cancel";

  const escBadge = document.createElement("div");
  escBadge.id = "eli5-snip-esc";
  escBadge.textContent = "Esc to cancel";

  const selBox  = document.createElement("div");
  selBox.id = "eli5-snip-box";
  selBox.style.display = "none";

  const dimsBadge = document.createElement("div");
  dimsBadge.id = "eli5-snip-dims";
  dimsBadge.style.display = "none";

  document.body.appendChild(overlay);
  document.body.appendChild(hint);
  document.body.appendChild(escBadge);
  document.body.appendChild(selBox);
  document.body.appendChild(dimsBadge);

  // Fade in overlay
  requestAnimationFrame(() => overlay.classList.add("eli5-snip-active"));

  // ── State ──────────────────────────────────────────────────────────────────
  let startX = 0, startY = 0;
  let isDragging = false;

  // ── Helpers ────────────────────────────────────────────────────────────────
  function getRect(x1, y1, x2, y2) {
    return {
      x:      Math.min(x1, x2),
      y:      Math.min(y1, y2),
      width:  Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    };
  }

  function cleanup() {
    overlay.remove();
    hint.remove();
    escBadge.remove();
    selBox.remove();
    dimsBadge.remove();
    document.removeEventListener("mousedown", onMouseDown, { capture: true });
    document.removeEventListener("mousemove", onMouseMove, { capture: true });
    document.removeEventListener("mouseup",   onMouseUp,   { capture: true });
    document.removeEventListener("keydown",   onKeyDown,   { capture: true });
  }

  // ── Mouse events ───────────────────────────────────────────────────────────
  function onMouseDown(e) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;

    // Hide hint once user starts drawing
    hint.style.opacity = "0";

    selBox.style.display  = "block";
    selBox.style.left     = startX + "px";
    selBox.style.top      = startY + "px";
    selBox.style.width    = "0px";
    selBox.style.height   = "0px";

    dimsBadge.style.display = "block";
  }

  function onMouseMove(e) {
    if (!isDragging) return;
    e.preventDefault();

    const rect = getRect(startX, startY, e.clientX, e.clientY);

    selBox.style.left   = rect.x + "px";
    selBox.style.top    = rect.y + "px";
    selBox.style.width  = rect.width  + "px";
    selBox.style.height = rect.height + "px";

    // Dimensions badge — keep it just outside bottom-right of box
    const badgeOffX = 8;
    const badgeOffY = 6;
    let bx = rect.x + rect.width  + badgeOffX;
    let by = rect.y + rect.height + badgeOffY;
    // Flip if it would overflow viewport
    if (bx + 90 > window.innerWidth)  bx = rect.x - 90;
    if (by + 24 > window.innerHeight) by = rect.y + rect.height - 28;
    dimsBadge.style.left = Math.max(4, bx) + "px";
    dimsBadge.style.top  = Math.max(4, by) + "px";
    dimsBadge.textContent = `${rect.width} × ${rect.height}`;
  }

  function onMouseUp(e) {
    if (!isDragging) return;
    e.preventDefault();
    e.stopPropagation();
    isDragging = false;

    const rect = getRect(startX, startY, e.clientX, e.clientY);

    if (rect.width < 8 || rect.height < 8) {
      cleanup();
      return;
    }

    // Remove overlay synchronously so it doesn't appear in the screenshot
    cleanup();

    requestAnimationFrame(() => requestAnimationFrame(() => {
      isRequestInFlight = true;
      chrome.runtime.sendMessage({ type: "CAPTURE_SCREEN" }, (captureResponse) => {
        const anchor = computeSnipPopupAnchor(rect);
        showPopup(null, anchor, "Reading screenshot…");

        const timeoutId = setTimeout(() => {
          isRequestInFlight = false;
          updatePopupContent("Request timed out. Check your connection and try again.", true);
        }, 30000);

        if (chrome.runtime.lastError || !captureResponse?.success) {
          clearTimeout(timeoutId);
          isRequestInFlight = false;
          const reason = chrome.runtime.lastError?.message || captureResponse?.error || "Screenshot failed.";
          updatePopupContent(reason, true);
          return;
        }

        processSnipImage(captureResponse.image, rect, (croppedDataUrl) => {
          chrome.runtime.sendMessage(
            { type: "EXPLAIN_IMAGE", image: croppedDataUrl },
            (response) => {
              clearTimeout(timeoutId);
              isRequestInFlight = false;
              if (chrome.runtime.lastError || !response?.success) {
                const reason = chrome.runtime.lastError?.message || response?.error || "Unknown error";
                updatePopupContent(reason, true);
              } else {
                updatePopupContent(response.explanation, false);
              }
            }
          );
        });
      });
    }));
  }

  function onKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      cleanup();
    }
  }

  // All listeners on document (not overlay) so they fire even if overlay
  // doesn't receive the event in all browsers
  document.addEventListener("mousedown", onMouseDown, { capture: true });
  document.addEventListener("mousemove", onMouseMove, { capture: true });
  document.addEventListener("mouseup",   onMouseUp,   { capture: true });
  document.addEventListener("keydown",   onKeyDown,   { capture: true });
}

// ── Snip helpers ──────────────────────────────────────────────────────────────

// Crops the full-tab screenshot to the snip selection rect (DPR-aware)
// and returns a JPEG data URL via callback.
function processSnipImage(screenshotDataUrl, rect, callback) {
  const img = new Image();
  img.onload = () => {
    const dpr    = window.devicePixelRatio || 1;
    const canvas = document.createElement("canvas");
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      img,
      rect.x * dpr,      rect.y * dpr,
      rect.width  * dpr, rect.height * dpr,
      0, 0, canvas.width, canvas.height
    );

    callback(canvas.toDataURL("image/jpeg", 0.92));
  };
  img.onerror = () => callback(null);
  img.src = screenshotDataUrl;
}

// Positions the explanation popup beside the snip rect without overlapping it.
function computeSnipPopupAnchor(snipRect) {
  const POPUP_W = 300;
  const POPUP_H = 120; // estimated min height
  const GAP     = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Prefer to the right of the snip box
  let left = snipRect.x + snipRect.width + GAP;
  let top  = snipRect.y;

  // Fall back to left of the snip box if right edge is too close
  if (left + POPUP_W > vw - 8) {
    left = snipRect.x - POPUP_W - GAP;
  }

  // If neither side fits (very wide snip), place below the box
  if (left < 8) {
    left = Math.max(8, snipRect.x);
    top  = snipRect.y + snipRect.height + GAP;
  }

  top  = Math.max(4, Math.min(top,  vh - POPUP_H - 4));
  left = Math.max(4, Math.min(left, vw - POPUP_W - 4));

  return { top, left };
}
