// ─────────────────────────────────────────────────────────────────────────────
// serp-sum OS Background Worker
// ─────────────────────────────────────────────────────────────────────────────

import type { ChatMessage, KnowledgeItem, KnowledgeSource } from '../shared/types';

console.log('Background Service Worker initialized.');

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: unknown) => console.error(error));

const MIN_TEXT_LENGTH = 5;
const KNOWLEDGE_STORAGE_KEY = 'knowledgeItems';
const MAX_KNOWLEDGE_ITEMS = 220;

type FormatPreference = 'bullets' | 'paragraph' | 'simple';

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CustomPersona {
  id: string;
  description?: string;
}

interface ExplainTextMessage {
  type: 'EXPLAIN_TEXT';
  text: string;
  context?: Partial<KnowledgeSource>;
}

interface ChatRequestMessage {
  type: 'CHAT_MESSAGE';
  messages: ChatMessage[];
  context?: Partial<KnowledgeSource>;
}

interface GetKnowledgeMessage {
  type: 'GET_KNOWLEDGE';
}

interface ClearKnowledgeMessage {
  type: 'CLEAR_KNOWLEDGE';
}

type RuntimeMessage = ExplainTextMessage | ChatRequestMessage | GetKnowledgeMessage | ClearKnowledgeMessage;

// Shared rules across requests
const FORMAT_RULES: Record<FormatPreference, string> = {
  bullets: `Output structure:\n- Start with heading: Overview\n- Then add 3 to 7 bullet points using '- '\n- End with heading: Bottom line and one sentence\n- Keep wording concrete and specific`,
  paragraph: `Output structure:\n- Heading: Overview\n- One concise paragraph of 4 to 8 sentences\n- Heading: Bottom line\n- One final sentence`,
  simple: `Output structure:\n- Heading: In simple terms\n- 3 to 6 short sentences, each on its own line\n- Avoid jargon and define any unavoidable terms`,
};

const PERSONAS: Record<string, string> = {
  teacher: `You are an excellent teacher explaining concepts to a beginner. Clear, calm, structured. Avoid jargon.`,
  friendly: `You are a friendly person explaining something to a friend over coffee. Casual, conversational.`,
  professional: `You are a professional analyst delivering a brief. Direct, structured, formal vocabulary.`,
  genz: `You are a Gen Z explainer. Very casual, use slang like "no cap", "fr", "lowkey". Short punchy lines.`,
};

const PERSONA_TEMPS: Record<string, number> = { teacher: 0.5, friendly: 0.65, professional: 0.38, genz: 0.75 };

const CHAT_SYSTEM_PROMPT = [
  'You are serp-sum OS, an expert assistant for explaining web and technical topics.',
  '',
  'Response rules:',
  '- Answers must be useful, specific, and well-structured.',
  '- Use markdown headings, bullets, and short sections for readability.',
  '- For comparisons, complexity analysis, trade-offs, pros/cons, or option breakdowns, prefer markdown tables.',
  '- Do not use markdown bold syntax based on double-asterisk markers.',
  '- If code helps, include a fenced code block with a language tag.',
  '- For coding questions, provide a clean minimal example that can run as-is.',
  '- Mention important caveats or edge cases when relevant.',
  '- Avoid filler and avoid repeating the same point.',
].join('\n');

function isFormatPreference(value: unknown): value is FormatPreference {
  return value === 'bullets' || value === 'paragraph' || value === 'simple';
}

function normalizeSource(context: Partial<KnowledgeSource> | undefined, fallbackOrigin: KnowledgeSource['origin']): KnowledgeSource {
  return {
    origin: context?.origin === 'content-popup' || context?.origin === 'side-panel' ? context.origin : fallbackOrigin,
    pageTitle: context?.pageTitle?.trim() || undefined,
    pageUrl: context?.pageUrl?.trim() || undefined,
  };
}

function normalizeIncomingMessages(messagesArray: unknown): ChatMessage[] {
  if (!Array.isArray(messagesArray)) {
    return [];
  }

  return messagesArray
    .filter((msg): msg is ChatMessage => {
      if (!msg || typeof msg !== 'object') return false;
      const candidate = msg as ChatMessage;
      return (candidate.role === 'user' || candidate.role === 'assistant') && typeof candidate.content === 'string';
    })
    .map((msg) => ({ role: msg.role, content: msg.content.trim() }))
    .filter((msg) => msg.content.length > 0);
}

function normalizeCustomPersonas(value: unknown): CustomPersona[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is CustomPersona => {
      if (!item || typeof item !== 'object') return false;
      const candidate = item as CustomPersona;
      return typeof candidate.id === 'string' && (candidate.description === undefined || typeof candidate.description === 'string');
    });
}

function flattenText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function buildKnowledgeTitle(kind: KnowledgeItem['kind'], prompt: string): string {
  const clean = flattenText(prompt).replace(/^['"]+|['"]+$/g, '');

  if (!clean) {
    return kind === 'summary' ? 'Page summary' : 'Chat answer';
  }

  const base = clean.length > 66 ? `${clean.slice(0, 66)}...` : clean;
  return kind === 'summary' ? `Summary: ${base}` : base;
}

function fallbackKnowledgeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getLastUserPrompt(messages: ChatMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const msg = messages[index];
    if (msg.role === 'user' && msg.content.trim()) {
      return msg.content;
    }
  }

  return 'Chat response';
}

async function getKnowledgeItems(): Promise<KnowledgeItem[]> {
  const data = await chrome.storage.local.get(KNOWLEDGE_STORAGE_KEY);
  const rawItems = data?.[KNOWLEDGE_STORAGE_KEY];

  if (!Array.isArray(rawItems)) {
    return [];
  }

  return rawItems
    .filter((item): item is KnowledgeItem => {
      if (!item || typeof item !== 'object') return false;
      const candidate = item as KnowledgeItem;
      return typeof candidate.id === 'string'
        && typeof candidate.createdAt === 'string'
        && (candidate.kind === 'chat' || candidate.kind === 'summary')
        && typeof candidate.title === 'string'
        && typeof candidate.prompt === 'string'
        && typeof candidate.response === 'string'
        && candidate.source
        && (candidate.source.origin === 'side-panel' || candidate.source.origin === 'content-popup');
    });
}

async function saveKnowledgeItem(input: Omit<KnowledgeItem, 'id' | 'createdAt'>): Promise<void> {
  try {
    const existing = await getKnowledgeItems();
    console.log('[BG] Existing knowledge items:', existing.length);

    const newItem: KnowledgeItem = {
      ...input,
      id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : fallbackKnowledgeId(),
      createdAt: new Date().toISOString(),
    };

    const merged = [newItem, ...existing].slice(0, MAX_KNOWLEDGE_ITEMS);
    console.log('[BG] Saving knowledge item:', newItem.title, '| Total after:', merged.length);
    
    await chrome.storage.local.set({ [KNOWLEDGE_STORAGE_KEY]: merged });
    console.log('[BG] Knowledge item saved successfully');
  } catch (err) {
    console.error('[BG] Error saving knowledge:', err);
    throw err;
  }
}

async function resolvePersona(activePersonaId?: string, customPersonas: CustomPersona[] = []) {
  if (activePersonaId && !['teacher', 'friendly', 'professional', 'genz'].includes(activePersonaId)) {
    const custom = customPersonas.find((p) => p.id === activePersonaId);
    if (custom?.description?.trim()) return { instruction: custom.description.trim(), id: activePersonaId };
  }
  const id = activePersonaId || 'teacher';
  return { instruction: PERSONAS[id] || PERSONAS.teacher, id };
}

// ── Shared backend caller (Local server with API key in .env) ─────────────────
async function callBackend(messages: OpenAIMessage[], temperature: number, maxTokens = 250): Promise<string> {
  const BACKEND_URL = 'http://localhost:3000/api/chat';

  try {
    console.log('[BG] Calling backend:', BACKEND_URL);
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        temperature,
        maxTokens,
      }),
    });

    const data = await response.json();
    console.log('[BG] Backend response status:', response.ok, 'Status code:', response.status);
    
    if (!response.ok) {
      throw new Error(data?.error || 'Backend request failed.');
    }

    if (!data?.success || typeof data.reply !== 'string') {
      throw new Error(data?.error || 'No response from backend.');
    }

    console.log('[BG] Backend reply received, length:', data.reply.length);
    return data.reply.trim();
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Connection error';
    console.error('[BG] Backend error:', msg);
    throw new Error(`Backend error: ${msg}. Is the server running on localhost:3000?`);
  }
}

// ── Message Listener ─────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  const safeError = (err: unknown) => {
    if (err instanceof Error) return { success: false, error: err.message };
    return { success: false, error: String(err) };
  };

  try {
    if (message.type === "EXPLAIN_TEXT") {
      handleExplainText(message.text, message.context)
        .then((explanation) => sendResponse({ success: true, explanation }))
        .catch((err) => sendResponse(safeError(err)));
      return true;
    }

    if (message.type === "CHAT_MESSAGE") {
      handleChatMessage(message.messages, message.context)
        .then((reply) => sendResponse({ success: true, reply }))
        .catch((err) => sendResponse(safeError(err)));
      return true;
    }

    if (message.type === 'GET_KNOWLEDGE') {
      getKnowledgeItems()
        .then((items) => {
          console.log('[BG] Returning', items.length, 'knowledge items');
          sendResponse({ success: true, items });
        })
        .catch((err) => {
          console.error('[BG] GET_KNOWLEDGE error:', err);
          sendResponse(safeError(err));
        });
      return true;
    }

    if (message.type === 'CLEAR_KNOWLEDGE') {
      chrome.storage.local.set({ [KNOWLEDGE_STORAGE_KEY]: [] })
        .then(() => {
          console.log('[BG] Knowledge cleared');
          sendResponse({ success: true });
        })
        .catch((err) => {
          console.error('[BG] CLEAR_KNOWLEDGE error:', err);
          sendResponse(safeError(err));
        });
      return true;
    }

    const unknownType = (message as { type?: string }).type;
    console.warn('[BG] Unknown message type:', unknownType);
    sendResponse({ success: false, error: 'Unknown message type' });
  } catch (err) {
    console.error('[BG] Message handler error:', err);
    sendResponse(safeError(err));
  }

  return false;
});

async function handleExplainText(text: string, context?: Partial<KnowledgeSource>) {
  console.log('[BG] handleExplainText called, text length:', text?.length);
  
  if (!text || text.trim().length < MIN_TEXT_LENGTH) throw new Error("Please select a longer piece of text.");
  
  const { activePersonaId, customPersonas = [], format = 'bullets' } = await chrome.storage.local.get(['activePersonaId', 'customPersonas', 'format']);
  const personaKey = typeof activePersonaId === 'string' ? activePersonaId : undefined;
  const typedCustomPersonas = normalizeCustomPersonas(customPersonas);
  const { instruction: personaInstruction, id: personaId } = await resolvePersona(personaKey, typedCustomPersonas);
  const formatInstruction = isFormatPreference(format) ? FORMAT_RULES[format] : FORMAT_RULES.bullets;

  const systemPrompt = [
    '=== PERSONA ===',
    personaInstruction,
    '',
    '=== TASK ===',
    'Extract the key ideas from the selected text and explain them clearly.',
    'Keep the response useful and precise, with examples when helpful.',
    '',
    '=== STYLE ===',
    '- Use markdown with readable section headings.',
    '- Do not use markdown bold syntax based on double-asterisk markers.',
    '- Keep wording natural and avoid robotic phrasing.',
    '',
    '=== FORMAT ===',
    formatInstruction,
  ].join('\n');

  console.log('[BG] Calling backend for explanation...');
  const explanation = await callBackend([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Explain this selection:\n\n"${text}"` },
  ], PERSONA_TEMPS[personaId] || 0.55, 420);

  console.log('[BG] Got explanation, now saving...');
  const source = normalizeSource(context, 'content-popup');
  await saveKnowledgeItem({
    kind: 'summary',
    title: buildKnowledgeTitle('summary', text),
    prompt: text,
    response: explanation,
    source,
  });

  console.log('[BG] Explanation saved, returning...');
  return explanation;
}

async function handleChatMessage(messagesArray: ChatMessage[], context?: Partial<KnowledgeSource>) {
  console.log('[BG] handleChatMessage called, messages count:', messagesArray?.length);
  
  const normalizedMessages = normalizeIncomingMessages(messagesArray);
  console.log('[BG] Calling backend for chat...');
  const reply = await callBackend([{ role: 'system', content: CHAT_SYSTEM_PROMPT }, ...normalizedMessages], 0.62, 650);

  console.log('[BG] Got reply, now saving...');
  const prompt = getLastUserPrompt(normalizedMessages);
  const source = normalizeSource(context, 'side-panel');

  await saveKnowledgeItem({
    kind: 'chat',
    title: buildKnowledgeTitle('chat', prompt),
    prompt,
    response: reply,
    source,
  });

  console.log('[BG] Chat saved, returning...');
  return reply;
}
