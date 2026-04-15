// ─────────────────────────────────────────────────────────────────────────────
// serp-sum OS Background Worker
// ─────────────────────────────────────────────────────────────────────────────

console.log('Background Service Worker initialized.');

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: unknown) => console.error(error));

const MIN_TEXT_LENGTH = 5;

// Shared rules across requests
const FORMAT_RULES = {
  bullets: `Format: \n- 3 to 8 bullet points depending on complexity\n- Start every bullet with "• "\n- Each bullet on its OWN NEW LINE\n- Plain text only`,
  paragraph: `Format: \n- Write ONE short paragraph, 3 to 8 sentences\n- No bullets or headers\n- Plain text only`,
  simple: `Format: \n- Write 3 to 6 short, plain sentences\n- Each sentence on its OWN NEW LINE\n- Plain text only`,
};

const PERSONAS: Record<string, string> = {
  teacher: `You are an excellent teacher explaining concepts to a beginner. Clear, calm, structured. Avoid jargon.`,
  friendly: `You are a friendly person explaining something to a friend over coffee. Casual, conversational.`,
  professional: `You are a professional analyst delivering a brief. Direct, structured, formal vocabulary.`,
  genz: `You are a Gen Z explainer. Very casual, use slang like "no cap", "fr", "lowkey". Short punchy lines.`,
};

const PERSONA_TEMPS: Record<string, number> = { teacher: 0.5, friendly: 0.65, professional: 0.38, genz: 0.75 };

async function resolvePersona(activePersonaId?: string, customPersonas: any[] = []) {
  if (activePersonaId && !['teacher', 'friendly', 'professional', 'genz'].includes(activePersonaId)) {
    const custom = customPersonas.find((p) => p.id === activePersonaId);
    if (custom?.description?.trim()) return { instruction: custom.description.trim(), id: activePersonaId };
  }
  const id = activePersonaId || 'teacher';
  return { instruction: PERSONAS[id] || PERSONAS.teacher, id };
}

// ── Shared backend caller (Using the provided key from V1) ───────────────────
async function callBackend(messages: any[], temperature: number, maxTokens = 250) {
  const { openaiKey } = await chrome.storage.local.get("openaiKey");
  if (!openaiKey) throw new Error("OpenAI API Key not found. Please add it in the settings.");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiKey}`
    },
    body: JSON.stringify({
      messages,
      temperature,
      max_completion_tokens: maxTokens,
      model: "gpt-4o-mini", // Upgraded to standard mini model for v2 stability
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || "API request failed.");
  return data.choices[0].message.content;
}

// ── Message Listener ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "EXPLAIN_TEXT") {
    handleExplainText(message.text)
      .then((explanation) => sendResponse({ success: true, explanation }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open
  }

  if (message.type === "CHAT_MESSAGE") {
    handleChatMessage(message.messages)
      .then((reply) => sendResponse({ success: true, reply }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }

  return false;
});

async function handleExplainText(text: string) {
  if (!text || text.trim().length < MIN_TEXT_LENGTH) throw new Error("Please select a longer piece of text.");
  
  const { activePersonaId, customPersonas = [], format = "bullets" } = await chrome.storage.local.get(["activePersonaId", "customPersonas", "format"]);
  const { instruction: personaInstruction, id: personaId } = await resolvePersona(activePersonaId as string | undefined, customPersonas as any[]);
  // @ts-ignore
  const formatInstruction = FORMAT_RULES[format] || FORMAT_RULES.bullets;

  const systemPrompt = `=== PERSONA ===\n${personaInstruction}\n\n=== TASK ===\nExtract ONLY the most important ideas from the text. Keep it SHORT.\n\n=== FORMAT ===\n${formatInstruction}`;

  return callBackend([
    { role: "system", content: systemPrompt },
    { role: "user", content: `Explain this:\n\n"${text}"` }
  ], PERSONA_TEMPS[personaId] || 0.55, 250);
}

async function handleChatMessage(messagesArray: any[]) {
  const systemPrompt = `You are a helpful AI assistant. Be concise and direct.`;
  return callBackend([{ role: "system", content: systemPrompt }, ...messagesArray], 0.7, 500);
}
