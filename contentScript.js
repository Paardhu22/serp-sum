let selectedText = "";
let suppressNextMouseup = false;
let isRequestInFlight = false;
let selectionDebounceTimer = null;
let latestExplanation = "";
let popupChatHistory = [];

(function injectStyles() {
  if (document.getElementById("eli5-styles")) return;
  const style = document.createElement("style");
  style.id = "eli5-styles";
  style.textContent = `
    @keyframes eli5FadeIn {
      from { opacity: 0; transform: translateY(8px) scale(0.96); }
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

    #eli5-popup {
      display: flex;
      flex-direction: column;
      cursor: default;
      user-select: none;
      box-sizing: border-box;
      background: rgba(15, 15, 20, 0.72) !important;
      backdrop-filter: blur(20px) saturate(180%) !important;
      -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
      border: 1px solid rgba(255, 255, 255, 0.12) !important;
      border-radius: 20px !important;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08) !important;
      animation: eli5FadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
      min-width: 320px;
      max-width: 440px;
      transition: width 0.3s ease, height 0.3s ease;
    }

    #eli5-popup-drag-handle { cursor: grab; padding-bottom: 8px; flex-shrink: 0; }
    #eli5-popup-drag-handle:active { cursor: grabbing; }

    #eli5-popup-content {
      overflow-y: auto;
      flex: 1;
      padding-right: 4px;
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
      display: flex;
      flex-direction: column;
    }

    .eli5-chat-msg {
      margin-bottom: 12px;
      padding: 10px 14px;
      border-radius: 16px;
      font-size: 13.5px;
      line-height: 1.55;
      word-wrap: break-word;
      animation: eli5FadeIn 0.4s ease;
    }
    .eli5-chat-msg.bot {
      background: rgba(255, 255, 255, 0.06);
      color: rgba(255, 255, 255, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-bottom-left-radius: 4px;
      align-self: flex-start;
      margin-right: 32px;
    }
    .eli5-chat-msg.user {
      background: rgba(255, 255, 255, 0.16);
      color: #fff;
      border-bottom-right-radius: 4px;
      align-self: flex-end;
      margin-left: 32px;
    }

    #eli5-input-container {
      margin-top: 12px;
      display: flex;
      gap: 10px;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      flex-shrink: 0;
    }
    #eli5-chat-input {
      flex: 1;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 99px;
      padding: 9px 16px;
      color: #fff;
      font-size: 13px;
      outline: none;
      font-family: inherit;
      transition: all 0.2s ease;
    }
    #eli5-chat-input:focus { background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.25); }

    #eli5-chat-send {
      background: rgba(255, 255, 255, 0.9);
      color: #10101a;
      border: none;
      border-radius: 50%;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      flex-shrink: 0;
    }
    #eli5-chat-send:hover { background: #fff; transform: scale(1.05); }
    #eli5-chat-send:active { transform: scale(0.95); }

    #eli5-copy-btn {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.6);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      padding: 4px 12px;
      border-radius: 8px;
    }
    #eli5-copy-btn:hover { background: rgba(255, 255, 255, 0.12); color: #fff; }
    #eli5-copy-btn.copied { color: #8f8; background: rgba(100, 255, 100, 0.1); }

    #eli5-close-btn {
      background: transparent; border: none; color: rgba(255, 255, 255, 0.35);
      font-size: 18px; cursor: pointer; width: 28px; height: 28px;
      display: flex; align-items: center; justify-content: center; border-radius: 50%;
    }
    #eli5-close-btn:hover { background: rgba(255, 50, 50, 0.2); color: #f88; }

    #eli5-popup-content::-webkit-scrollbar { width: 4px; }
    #eli5-popup-content::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.12); border-radius: 10px; }

    #eli5-snip-overlay {
      position: fixed; inset: 0; z-index: 2147483646; cursor: crosshair;
      background: transparent; transition: background 0.2s ease;
    }
    #eli5-snip-overlay.eli5-snip-active { background: rgba(0, 0, 0, 0.4); }

    #eli5-snip-hint {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      background: rgba(15, 15, 20, 0.7); backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 12px;
      padding: 12px 24px; color: #fff; font-size: 13px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4); pointer-events: none;
    }
    
    #eli5-snip-box { position: fixed; border: 1.5px solid #fff; background: rgba(255, 255, 255, 0.1); pointer-events: none; }
    #eli5-snip-dims {
      position: fixed; background: rgba(15, 15, 20, 0.7); backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 6px;
      padding: 3px 8px; font-size: 10px; color: #fff; pointer-events: none;
    }
    #eli5-snip-esc { position: fixed; top: 20px; right: 20px; background: rgba(15,15,20,0.7); border-radius: 8px; padding: 6px 12px; color: #fff; font-size: 11px; }

    [data-eli5-resize] { position: absolute; z-index: 2; }
    [data-eli5-resize="n"]  { top: -4px; left: 12px; right: 12px; height: 8px; cursor: n-resize; }
    [data-eli5-resize="s"]  { bottom: -4px; left: 12px; right: 12px; height: 8px; cursor: s-resize; }
    [data-eli5-resize="e"]  { right: -4px; top: 12px; bottom: 12px; width: 8px; cursor: e-resize; }
    [data-eli5-resize="w"]  { left: -4px; top: 12px; bottom: 12px; width: 8px; cursor: w-resize; }
    [data-eli5-resize="se"] { bottom: -4px; right: -4px; width: 14px; height: 14px; cursor: se-resize; }
  `;
  document.head.appendChild(style);
})();

// ── Selection Logic ──────────────────────────────────────────────────────────
document.addEventListener("mouseup", () => {
  if (suppressNextMouseup) { suppressNextMouseup = false; return; }
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

function getSelectionAnchor(elWidth, elHeight) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return { top: 120, left: window.innerWidth - elWidth - 24 };
  const r = sel.getRangeAt(0).getBoundingClientRect();
  const GAP = 12;
  let top = r.bottom + GAP, left = r.right + GAP;
  if (top + elHeight > window.innerHeight - 12) top = r.top - elHeight - GAP;
  if (left + elWidth > window.innerWidth - 12) left = r.left - elWidth - GAP;
  return { top: Math.max(4, Math.min(top, window.innerHeight - elHeight - 4)), left: Math.max(4, Math.min(left, window.innerWidth - elWidth - 4)) };
}

function showExplainButton() {
  const oldBtn = document.getElementById("eli5-btn");
  if (oldBtn) oldBtn.remove();
  const button = document.createElement("button");
  button.id = "eli5-btn";
  button.innerText = "Summarize";
  button.style.cssText = `position:fixed; z-index:2147483647; padding:8px 18px; background:rgba(15,15,20,0.7); backdrop-filter:blur(12px) saturate(180%); border:1px solid rgba(255,255,255,0.15); border-radius:999px; color:#fff; font-size:12.5px; font-weight:600; cursor:pointer; box-shadow:0 4px 12px rgba(0,0,0,0.3); visibility:hidden;`;
  
  document.body.appendChild(button);
  const { top, left } = getSelectionAnchor(button.offsetWidth, button.offsetHeight);
  button.style.top = top + "px"; button.style.left = left + "px"; button.style.visibility = "visible";

  button.addEventListener("mousedown", (e) => {
    e.preventDefault(); e.stopPropagation();
    if (isRequestInFlight) return;
    suppressNextMouseup = true; button.remove();
    isRequestInFlight = true;
    showPopup(null, null, "Summarizing text...");
    chrome.runtime.sendMessage({ type: "EXPLAIN_TEXT", text: selectedText }, (res) => {
      isRequestInFlight = false;
      if (chrome.runtime.lastError || !res?.success) updatePopupContent(res?.error || "Request failed", true);
      else updatePopupContent(res.explanation, false);
    });
  });
}

// ── Popup Logic ─────────────────────────────────────────────────────────────
function showPopup(text, overrideAnchor = null, loadingText = "Understanding...") {
  const oldPopup = document.getElementById("eli5-popup");
  if (oldPopup) return; // allow only one

  const popup = document.createElement("div");
  popup.id = "eli5-popup";
  popup.innerHTML = `
    <div id="eli5-popup-drag-handle" style="display:flex; align-items:center; justify-content:space-between;">
      <div style="display:flex; flex-direction:column;">
        <span style="font-size:9px; font-weight:700; color:rgba(255,255,255,0.3); text-transform:uppercase;">serp-sum</span>
        <span id="eli5-meta" style="font-size:9px; color:rgba(255,255,255,0.4);">Loading...</span>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <button id="eli5-copy-btn">Copy</button>
        <button id="eli5-close-btn">✕</button>
      </div>
    </div>
    <div id="eli5-popup-content">
      ${text ? `<div class="eli5-chat-msg bot">${text}</div>` : `<div class="eli5-chat-msg bot" id="eli5-initial-loading"><span style="display:flex; gap:4px;"><span class="eli5-dot"></span><span class="eli5-dot"></span><span class="eli5-dot"></span></span></div>`}
    </div>
    <div id="eli5-input-container">
      <input type="text" id="eli5-chat-input" placeholder="Ask follow-up..." autocomplete="off">
      <button id="eli5-chat-send"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg></button>
    </div>
  `;

  popup.style.cssText = `position:fixed; z-index:2147483647; padding:20px; width:320px; height:auto; max-height:500px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; visibility:hidden;`;
  
  const resizeH = document.createElement("div"); resizeH.setAttribute("data-eli5-resize", "se"); popup.appendChild(resizeH);
  document.body.appendChild(popup);

  const anchor = overrideAnchor || getSelectionAnchor(popup.offsetWidth, 400);
  popup.style.left = anchor.left + "px"; popup.style.top = anchor.top + "px"; popup.style.visibility = "visible";

  if (text) { latestExplanation = text; popupChatHistory = [{ role: "assistant", content: text }]; }
  else { popupChatHistory = []; }

  // Persona labels
  chrome.storage.sync.get(["activePersonaId","customPersonas","format"], (data) => {
    const metaEl = document.getElementById("eli5-meta");
    if (!metaEl) return;
    const PERSONA_LABELS = { teacher:"Teacher", friendly:"Friendly", professional:"Professional", genz:"Gen Z" };
    const pid = data.activePersonaId || "teacher";
    const label = PERSONA_LABELS[pid] || (data.customPersonas || []).find(p => p.id === pid)?.name || "Teacher";
    metaEl.textContent = `${label} · ${data.format || "Bullets"}`;
  });

  const input = document.getElementById("eli5-chat-input");
  const sendBtn = document.getElementById("eli5-chat-send");
  const content = document.getElementById("eli5-popup-content");

  async function handleSend() {
    const val = input.value.trim(); if (!val || isRequestInFlight) return;
    input.value = ""; isRequestInFlight = true;
    const userMsg = document.createElement("div"); userMsg.className = "eli5-chat-msg user"; userMsg.textContent = val;
    content.appendChild(userMsg); popupChatHistory.push({ role: "user", content: val });
    content.scrollTop = content.scrollHeight;

    const loader = document.createElement("div"); loader.className = "eli5-chat-msg bot"; loader.id = "eli5-chat-loading";
    loader.innerHTML = `<span style="display:flex; gap:4px;"><span class="eli5-dot"></span><span class="eli5-dot"></span><span class="eli5-dot"></span></span>`;
    content.appendChild(loader); content.scrollTop = content.scrollHeight;

    chrome.runtime.sendMessage({ type: "CHAT_MESSAGE", messages: popupChatHistory }, (res) => {
      isRequestInFlight = false; loader.remove();
      const botMsg = document.createElement("div"); botMsg.className = "eli5-chat-msg bot";
      if (!res?.success) { botMsg.style.color = "#f88"; botMsg.textContent = "Error: " + (res?.error || "Failed"); }
      else { botMsg.textContent = res.reply; popupChatHistory.push({ role: "assistant", content: res.reply }); latestExplanation = res.reply; }
      content.appendChild(botMsg); content.scrollTop = content.scrollHeight;
    });
  }

  sendBtn.addEventListener("click", handleSend);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); handleSend(); } e.stopPropagation(); });
  document.getElementById("eli5-copy-btn").addEventListener("click", (e) => {
    if (!latestExplanation) return;
    navigator.clipboard.writeText(latestExplanation).then(() => {
      const b = e.target; b.textContent = "Copied!"; b.classList.add("copied");
      setTimeout(() => { b.textContent = "Copy"; b.classList.remove("copied"); }, 2000);
    });
  });
  document.getElementById("eli5-close-btn").addEventListener("click", closePopup);

  // Drag & Resize
  const dragHandle = document.getElementById("eli5-popup-drag-handle");
  let dragging = false, resizing = false;
  let startX, startY, origL, origT, origW, origH;

  dragHandle.onmousedown = (e) => { dragging = true; startX = e.clientX; startY = e.clientY; origL = popup.offsetLeft; origT = popup.offsetTop; e.preventDefault(); };
  resizeH.onmousedown = (e) => { resizing = true; startX = e.clientX; startY = e.clientY; origW = popup.offsetWidth; origH = popup.offsetHeight; e.preventDefault(); e.stopPropagation(); };

  document.onmousemove = (e) => {
    if (dragging) { popup.style.left = (origL + e.clientX - startX) + "px"; popup.style.top = (origT + e.clientY - startY) + "px"; }
    if (resizing) { popup.style.width = (origW + e.clientX - startX) + "px"; popup.style.height = (origH + e.clientY - startY) + "px"; }
  };
  document.onmouseup = () => { dragging = false; resizing = false; };
}

function updatePopupContent(text, isError = false) {
  const content = document.getElementById("eli5-popup-content");
  if (!content) return;
  const loader = document.getElementById("eli5-initial-loading"); if (loader) loader.remove();
  const div = document.createElement("div"); div.className = "eli5-chat-msg bot";
  if (isError) { div.style.color = "#f88"; div.textContent = "Error: " + text; }
  else { div.textContent = text; latestExplanation = text; popupChatHistory = [{ role: "assistant", content: text }]; }
  content.appendChild(div);
  const input = document.getElementById("eli5-chat-input"); if (input) input.focus();
}

function closePopup() {
  const p = document.getElementById("eli5-popup"); if (!p) return;
  p.classList.add("eli5-closing");
  setTimeout(() => p.remove(), 200);
}

// ── Snip Logic ───────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "START_SNIP") startSnipMode();
});

function startSnipMode() {
  if (document.getElementById("eli5-snip-overlay")) return;
  const overlay = document.createElement("div"); overlay.id = "eli5-snip-overlay";
  const hint = document.createElement("div"); hint.id = "eli5-snip-hint"; hint.textContent = "Drag to select area — Esc to cancel";
  const selBox = document.createElement("div"); selBox.id = "eli5-snip-box"; selBox.style.display = "none";
  document.body.append(overlay, hint, selBox);
  requestAnimationFrame(() => overlay.classList.add("eli5-snip-active"));

  let isX = false, sX, sY;
  document.onkeydown = (e) => { if (e.key === "Escape") cleanup(); };
  overlay.onmousedown = (e) => { isX = true; sX = e.clientX; sY = e.clientY; hint.style.opacity = "0"; selBox.style.display = "block"; };
  overlay.onmousemove = (e) => {
    if (!isX) return;
    const x = Math.min(sX, e.clientX), y = Math.min(sY, e.clientY), w = Math.abs(e.clientX - sX), h = Math.abs(e.clientY - sY);
    selBox.style.left = x + "px"; selBox.style.top = y + "px"; selBox.style.width = w + "px"; selBox.style.height = h + "px";
  };
  overlay.onmouseup = (e) => {
    if (!isX) return; isX = false;
    const rect = { x: Math.min(sX, e.clientX), y: Math.min(sY, e.clientY), width: Math.abs(e.clientX - sX), height: Math.abs(e.clientY - sY) };
    cleanup();
    if (rect.width < 10) return;
    showPopup(null, { top: rect.y + rect.height + 10, left: rect.x }, "Reading image...");
    chrome.runtime.sendMessage({ type: "CAPTURE_SCREEN" }, (res) => {
      const img = new Image(); img.src = res.image;
      img.onload = () => {
        const canvas = document.createElement("canvas"); const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr; canvas.height = rect.height * dpr;
        canvas.getContext("2d").drawImage(img, rect.x * dpr, rect.y * dpr, rect.width * dpr, rect.height * dpr, 0, 0, canvas.width, canvas.height);
        chrome.runtime.sendMessage({ type: "EXPLAIN_IMAGE", image: canvas.toDataURL("image/jpeg") }, (res2) => {
          updatePopupContent(res2?.explanation || "Failed to process image.");
        });
      };
    });
  };
  function cleanup() { overlay.remove(); hint.remove(); selBox.remove(); document.onkeydown = null; }
}
