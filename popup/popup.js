// ── Element refs ─────────────────────────────────────────────────────────────
const chatBox      = document.getElementById("chatBox");
const chatInput    = document.getElementById("chatInput");
const chatSendBtn  = document.getElementById("chatSendBtn");
const snipBtn      = document.getElementById("snip");

// ── Chat State ───────────────────────────────────────────────────────────────
let chatHistory = [];

function appendMessage(role, text) {
  const msgEl = document.createElement("div");
  msgEl.className = `chat-msg ${role}`;
  msgEl.textContent = text;
  chatBox.appendChild(msgEl);
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = "";
  chatSendBtn.disabled = true;

  // Render user message
  appendMessage("user", text);
  chatHistory.push({ role: "user", content: text });

  // Loading indicator for bot
  const loadingEl = document.createElement("div");
  loadingEl.className = "chat-msg bot loading";
  loadingEl.textContent = "...";
  chatBox.appendChild(loadingEl);
  chatBox.scrollTop = chatBox.scrollHeight;

  chrome.runtime.sendMessage(
    { type: "CHAT_MESSAGE", messages: chatHistory },
    (response) => {
      loadingEl.remove();
      chatSendBtn.disabled = false;
      chatInput.focus();

      if (chrome.runtime.lastError || !response?.success) {
        const errObj = chrome.runtime.lastError || response?.error || "Unknown error";
        const errMsg = typeof errObj === "string" ? errObj : errObj.message;
        appendMessage("bot", `Error: ${errMsg}`);
      } else {
        appendMessage("bot", response.reply);
        chatHistory.push({ role: "assistant", content: response.reply });
      }
    }
  );
}

// ── Event Listeners ──────────────────────────────────────────────────────────

if (chatSendBtn) {
  chatSendBtn.addEventListener("click", sendMessage);
}

if (chatInput) {
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  });
}

// Snip mode trigger
if (snipBtn) {
  snipBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.id) return;
      chrome.tabs.sendMessage(tab.id, { type: "START_SNIP" }, () => {
        if (chrome.runtime.lastError) {
          // If content script isn't loaded (e.g. chrome:// page)
          alert("Snip mode cannot be started on this page.");
        } else {
          window.close();
        }
      });
    });
  });
}
