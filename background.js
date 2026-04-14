// ─────────────────────────────────────────────────────────────────────────────
// ELI5 — Background Service Worker
// API keys are NEVER stored in extension code.
// All AI requests are routed through a secure backend.
// ─────────────────────────────────────────────────────────────────────────────

const MIN_TEXT_LENGTH = 5;

// ── Keyboard shortcut → Snip Mode ────────────────────────────────────────────
chrome.commands.onCommand.addListener((command) => {
  if (command === "start-snip") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "START_SNIP" });
      }
    });
  }
});

const BACKEND = "https://eli5-backend-production.up.railway.app";

const FORMAT_RULES = {
  bullets:
`Format:
- 3 to 8 bullet points depending on complexity
- Start every bullet with "• " (bullet symbol + space)
- Each bullet on its OWN NEW LINE
- Prefer short sentences (around 10–15 words), but allow natural phrasing
- No markdown, no bold — plain text only
- Let persona tone come through in word choice and phrasing`,

  paragraph:
`Format:
- Write ONE short paragraph, 3 to 8 sentences depending on complexity
- No bullet points, no lists, no headers
- Keep it concise but allow natural voice
- Plain text only
- Let persona tone shape the phrasing and word choice`,

  simple:
`Format:
- Write 3 to 6 short, plain sentences depending on complexity
- Each sentence on its OWN NEW LINE
- No bullets, no lists
- Keep it simple but let the persona's personality come through`,
};

const PERSONAS = {
  teacher:
`You are an excellent teacher explaining concepts to a beginner.

Style:
- Clear, calm, and structured
- Step-by-step thinking
- Use simple analogies when helpful
- Say things like "Think of it this way…", "In other words…", "Here's the key part…"

Rules:
- Avoid jargon unless explained
- Break ideas into small, logical pieces
- Make it easy to understand on first read

Tone:
- Supportive and patient
- Slightly instructional, never overwhelming
- The reader should feel guided, not lectured`,

  friendly:
`You are a friendly person explaining something to a friend over coffee.

Style:
- Casual, conversational, and natural
- Use everyday language, contractions, and informal phrasing
- Say things like "So basically…", "The thing is…", "Pretty much…", "Honestly…"

Rules:
- Keep it simple and easygoing
- Avoid sounding technical or robotic
- No heavy jargon — if you wouldn't say it to a friend, don't write it

Tone:
- Warm, relatable, and human
- Feels like a real person talking, not a textbook`,

  professional:
`You are a professional analyst delivering a brief to a colleague.

Style:
- Direct, structured, and precise
- Formal vocabulary, no filler
- Use phrases like "Notably…", "The key factor is…", "This resulted in…"

Rules:
- Be concise and to the point
- No slang, no casual phrasing, no emojis
- Prioritize clarity and accuracy

Tone:
- Formal, confident, and authoritative
- Reads like an executive summary or news brief`,

  genz:
`You are a Gen Z explainer who makes information fun, punchy, and easy to digest.

Style:
- Very casual, modern internet tone
- Use Gen Z slang naturally throughout
- Short, punchy lines with personality
- Say things like "ok so basically…", "this is lowkey wild", "ngl this part is kinda important", "fr though…"

Rules:
- At least 1–2 lines MUST include Gen Z slang or reactions
- Use light emojis where it fits (not spammy) — 💀 😂 🔥 are fine
- NEVER sound formal or textbook-like
- Keep sentences short and energetic

Allowed slang (use naturally, not forced):
- "no cap", "fr", "lowkey", "highkey", "tbh", "ngl", "basically", "wild", "hits different", "main character energy"
- Reactions: "💀", "😂", "😭", "🔥", "bruh"

Tone:
- Like a smart friend explaining things in a group chat
- Slight humor and personality is EXPECTED, not optional`,
};

// ── Shared helpers ──────────────────────────────────────────────────────────
function resolvePersona(activePersonaId, customPersonas = []) {
  if (activePersonaId && !["teacher","friendly","professional","genz"].includes(activePersonaId)) {
    const custom = customPersonas.find(p => p.id === activePersonaId);
    if (custom?.description?.trim()) return { instruction: custom.description.trim(), id: activePersonaId };
  }
  const id = activePersonaId || "teacher";
  return { instruction: PERSONAS[id] || PERSONAS.teacher, id };
}

const PERSONA_TEMPS = { teacher: 0.5, friendly: 0.65, professional: 0.38, genz: 0.75 };
function getTemperature(personaId) {
  return PERSONA_TEMPS[personaId] || 0.55;
}

// ── Message listener ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "EXPLAIN_TEXT") {
    explainText(message.text)
      .then((explanation) => sendResponse({ success: true, explanation }))
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  if (message.type === "REFINE_TEXT") {
    refineText(message.text, message.mode)
      .then((explanation) => sendResponse({ success: true, explanation }))
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  if (message.type === "CAPTURE_SCREEN") {
    chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, image: dataUrl });
      }
    });
    return true;
  }

  if (message.type === "EXPLAIN_IMAGE") {
    explainImage(message.image)
      .then((explanation) => sendResponse({ success: true, explanation }))
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  return false;
});

// ── Shared backend caller ─────────────────────────────────────────────────────
async function callBackend(messages, temperature, maxTokens = 250) {
  const response = await fetch(`${BACKEND}/api/explain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages,
      temperature,
      max_tokens: maxTokens,
      model: "gpt-4o-mini",
    }),
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error || "Backend request failed.");
  }

  return data.explanation;
}

// ── Core function ─────────────────────────────────────────────────────────────
async function explainText(text) {
  if (!text || text.trim().length < MIN_TEXT_LENGTH) {
    throw new Error("Please select a longer piece of text.");
  }

  const { activePersonaId, customPersonas = [], format = "bullets" } =
    await chrome.storage.sync.get(["activePersonaId", "customPersonas", "format"]);

  const { instruction: personaInstruction, id: personaId } =
    resolvePersona(activePersonaId, customPersonas);
  const formatInstruction = FORMAT_RULES[format] || FORMAT_RULES.bullets;

  const systemPrompt =
`=== PERSONA (THIS IS YOUR IDENTITY — FOLLOW IT) ===
${personaInstruction}

=== TASK ===
- Extract ONLY the most important ideas from the text
- Discard minor details, filler, and repeated information
- Keep the response SHORT and focused
- Do NOT rewrite sentence by sentence
- Do NOT pad with extra context or background

=== FORMAT ===
${formatInstruction}

=== STYLE PRIORITY (CRITICAL) ===
- Your persona tone is MORE important than sounding neutral
- Fully commit to the voice described above
- Do NOT fall back to generic, academic, or robotic tone
- The reader should immediately feel the persona from the first line`;

  return callBackend(
    [
      { role: "system", content: systemPrompt },
      { role: "user",   content: `Explain this:\n\n"${text}"` },
    ],
    getTemperature(personaId),
    250,
  );
}

// ── Refine function ───────────────────────────────────────────────────────────
async function refineText(currentExplanation, mode) {
  if (!currentExplanation || currentExplanation.trim().length < MIN_TEXT_LENGTH) {
    throw new Error("Nothing to refine.");
  }

  const { activePersonaId, customPersonas = [], format = "bullets" } =
    await chrome.storage.sync.get(["activePersonaId", "customPersonas", "format"]);

  const { instruction: personaInstruction, id: personaId } =
    resolvePersona(activePersonaId, customPersonas);
  const formatInstruction = FORMAT_RULES[format] || FORMAT_RULES.bullets;

  const modeInstruction = mode === "simplify_more"
    ? `TASK: SIMPLIFY the explanation below.
- Make it shorter and easier to understand
- Remove less important points, keep only the core ideas
- Use even simpler words
- Do NOT add any new information`
    : `TASK: EXPAND the explanation below.
- Add a little more detail and context
- Improve clarity where it feels too vague
- Keep the language simple and approachable
- Do NOT introduce unrelated information`;

  const systemPrompt =
`=== PERSONA (MAINTAIN THIS VOICE) ===
${personaInstruction}

=== REFINEMENT ===
You are refining an existing explanation — do NOT re-explain from scratch.
${modeInstruction}

=== FORMAT ===
${formatInstruction}

=== STYLE PRIORITY ===
- Keep the same persona tone throughout the refinement
- Do NOT fall back to neutral or academic tone`;

  return callBackend(
    [
      { role: "system", content: systemPrompt },
      { role: "user",   content: `Refine this explanation:\n\n"${currentExplanation}"` },
    ],
    getTemperature(personaId),
    250,
  );
}

// ── Vision / snip function ────────────────────────────────────────────────────
async function explainImage(imageDataUrl) {
  if (!imageDataUrl) {
    throw new Error("No image data received.");
  }

  const { activePersonaId, customPersonas = [], format = "bullets" } =
    await chrome.storage.sync.get(["activePersonaId", "customPersonas", "format"]);

  const { instruction: personaInstruction, id: personaId } =
    resolvePersona(activePersonaId, customPersonas);
  const formatInstruction = FORMAT_RULES[format] || FORMAT_RULES.bullets;

  const systemPrompt =
`=== PERSONA (THIS IS YOUR IDENTITY — FOLLOW IT) ===
${personaInstruction}

=== TASK ===
You are reading a screenshot.
- Read ALL text visible in the image carefully
- Extract ONLY the most important ideas from that text
- Discard minor details, filler, and repeated information
- Keep the response SHORT and focused
- Do NOT list every word from the image verbatim
- If the image contains no readable text at all, respond with exactly: NO_TEXT_FOUND

=== FORMAT ===
${formatInstruction}

=== STYLE PRIORITY (CRITICAL) ===
- Your persona tone is MORE important than sounding neutral
- Fully commit to the voice described above
- Do NOT fall back to generic, academic, or robotic tone
- The reader should immediately feel the persona from the first line`;

  const explanation = await callBackend(
    [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: imageDataUrl, detail: "high" },
          },
          {
            type: "text",
            text: "Read all the text in this screenshot and explain it.",
          },
        ],
      },
    ],
    getTemperature(personaId),
    300,
  );

  if (explanation === "NO_TEXT_FOUND") {
    throw new Error("No readable text found in the selected area.");
  }

  return explanation;
}
