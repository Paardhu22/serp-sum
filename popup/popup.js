// ── Element refs ─────────────────────────────────────────────────────────────
const presetChips  = document.querySelectorAll(".chip");
const fmtChips     = document.querySelectorAll(".fmt-chip");
const customList   = document.getElementById("customPersonaList");
const emptyState   = document.getElementById("emptyState");
const newNameInput = document.getElementById("newPersonaName");
const newDescInput = document.getElementById("newPersonaDesc");
const addBtn       = document.getElementById("addPersonaBtn");
const saveBtn      = document.getElementById("save");
const snipBtn      = document.getElementById("snip");
const toast        = document.getElementById("toast");

// ── State ─────────────────────────────────────────────────────────────────────
let activePersonaId = "teacher";
let selectedFormat  = "bullets";
let customPersonas  = []; // [{id, name, description}]

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function isPreset(id) {
  return ["teacher", "friendly", "professional", "genz"].includes(id);
}

function escHtml(str) {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Persist to storage (called on every meaningful change) ────────────────────
function saveToStorage(silent = true) {
  chrome.storage.sync.set({
    activePersonaId,
    customPersonas,
    format: selectedFormat,
  }, () => {
    if (!silent) showToast("Saved ✓");
  });
}

// ── Render saved custom personas list ────────────────────────────────────────
function renderCustomList() {
  [...customList.querySelectorAll(".custom-persona-row")].forEach(el => el.remove());
  emptyState.style.display = customPersonas.length === 0 ? "block" : "none";

  customPersonas.forEach(p => {
    const row = document.createElement("div");
    row.className = "custom-persona-row" + (activePersonaId === p.id ? " active" : "");
    row.dataset.id = p.id;
    row.innerHTML = `
      <div class="custom-persona-info">
        <div class="custom-persona-name">${escHtml(p.name)}</div>
        <div class="custom-persona-desc">${escHtml(p.description)}</div>
      </div>
      <button class="custom-persona-delete" title="Delete" data-id="${p.id}">✕</button>
    `;

    row.addEventListener("click", (e) => {
      if (e.target.closest(".custom-persona-delete")) return;
      setActivePersona(p.id);
      saveToStorage(); // auto-save immediately
    });

    row.querySelector(".custom-persona-delete").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteCustomPersona(p.id);
    });

    customList.appendChild(row);
  });
}

// ── Persona selection ─────────────────────────────────────────────────────────
function setActivePersona(id) {
  activePersonaId = id;
  presetChips.forEach(c => c.classList.toggle("active", c.dataset.persona === id));
  [...customList.querySelectorAll(".custom-persona-row")]
    .forEach(row => row.classList.toggle("active", row.dataset.id === id));
}

presetChips.forEach(chip => {
  chip.addEventListener("click", () => {
    setActivePersona(chip.dataset.persona);
    saveToStorage(); // auto-save immediately
  });
});

// ── Format selection ──────────────────────────────────────────────────────────
function setActiveFormat(fmt) {
  selectedFormat = fmt;
  fmtChips.forEach(c => c.classList.toggle("active", c.dataset.format === fmt));
}

fmtChips.forEach(chip => {
  chip.addEventListener("click", () => {
    setActiveFormat(chip.dataset.format);
    saveToStorage(); // auto-save immediately
  });
});

// ── Add custom persona ────────────────────────────────────────────────────────
addBtn.addEventListener("click", () => {
  const name        = newNameInput.value.trim();
  const description = newDescInput.value.trim();
  if (!name || !description) {
    showToast("Fill in name and description", true);
    return;
  }
  const persona = { id: uid(), name, description };
  customPersonas.push(persona);
  newNameInput.value = "";
  newDescInput.value = "";
  renderCustomList();
  setActivePersona(persona.id);
  saveToStorage(); // auto-save with new persona active
  showToast("Persona added ✓");
});

// ── Delete custom persona ─────────────────────────────────────────────────────
function deleteCustomPersona(id) {
  customPersonas = customPersonas.filter(p => p.id !== id);
  if (activePersonaId === id) setActivePersona("teacher");
  renderCustomList();
  saveToStorage();
}

// ── Load from storage ─────────────────────────────────────────────────────────
chrome.storage.sync.get(["activePersonaId", "customPersonas", "format"], (data) => {
  customPersonas = data.customPersonas || [];
  selectedFormat  = data.format || "bullets";
  renderCustomList();
  setActiveFormat(selectedFormat);

  const savedId = data.activePersonaId || "teacher";
  const validId = isPreset(savedId) || customPersonas.some(p => p.id === savedId)
    ? savedId : "teacher";
  setActivePersona(validId);
});

// ── Manual save button (still useful as explicit confirmation) ────────────────
saveBtn.addEventListener("click", () => saveToStorage(false));

// ── Snip button ───────────────────────────────────────────────────────────────
snipBtn.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, { type: "START_SNIP" });
    window.close();
  });
});

// ── Change shortcut → open Chrome's extension shortcuts page ─────────────────
document.getElementById("changeShortcut").addEventListener("click", () => {
  chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  window.close();
});

// ── Toast ─────────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, isError = false) {
  toast.textContent = msg;
  toast.style.color = isError ? "rgba(255,120,100,0.85)" : "rgba(255,255,255,0.6)";
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
}
