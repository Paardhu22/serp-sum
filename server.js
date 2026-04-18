import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 3000;

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not found in .env file');
  process.exit(1);
}

console.log('✅ OpenAI API key loaded from .env');

async function callOpenAI(messages, temperature = 0.62, maxTokens = 650, model = 'gpt-4o-mini', allowFallback = true) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      messages,
      temperature,
      max_completion_tokens: maxTokens,
      model,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    if (allowFallback && model !== 'gpt-4o-mini' && (response.status === 400 || response.status === 404)) {
      console.warn(`[Backend] Falling back from ${model} to gpt-4o-mini.`);
      return callOpenAI(messages, temperature, maxTokens, 'gpt-4o-mini', false);
    }

    throw new Error(data?.error?.message || 'OpenAI API request failed');
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('AI returned an empty response');
  }

  return content.trim();
}

function normalizeImageSize(size) {
  if (size === '1024x1024' || size === '1024x1536' || size === '1536x1024') {
    return size;
  }

  return '1024x1024';
}

async function generateImage(prompt, size = '1024x1024') {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size: normalizeImageSize(size),
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || 'Image generation failed');
  }

  const firstImage = data?.data?.[0];
  if (!firstImage) {
    throw new Error('Image generation returned no output');
  }

  if (typeof firstImage.b64_json === 'string') {
    return { imageDataUrl: `data:image/png;base64,${firstImage.b64_json}` };
  }

  if (typeof firstImage.url === 'string') {
    return { imageUrl: firstImage.url };
  }

  throw new Error('Unsupported image payload from OpenAI');
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, temperature = 0.62, maxTokens = 650, model = 'gpt-4o-mini' } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Invalid messages array' });
    }

    const reply = await callOpenAI(messages, temperature, maxTokens, model);
    res.json({ success: true, reply });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Explain text endpoint
app.post('/api/explain', async (req, res) => {
  try {
    const { text, systemPrompt, temperature = 0.55, maxTokens = 420 } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Explain this selection:\n\n"${text}"` },
    ];

    const explanation = await callOpenAI(messages, temperature, maxTokens, 'gpt-4o-mini');
    res.json({ success: true, explanation });
  } catch (error) {
    console.error('Explain error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/translate', async (req, res) => {
  try {
    const {
      text,
      targetLanguage = 'English',
      sourceLanguage = 'auto',
      model = 'gpt-4o-mini',
    } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    const systemPrompt = [
      'You are a professional translator.',
      'Preserve the original meaning, nuance, and tone.',
      'Return only the translated text with no markdown and no explanation.',
    ].join('\n');

    const userPrompt = [
      `Source language: ${sourceLanguage}`,
      `Target language: ${targetLanguage}`,
      '',
      'Text to translate:',
      text,
    ].join('\n');

    const translatedText = await callOpenAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], 0.2, 1200, model);

    res.json({
      success: true,
      translatedText,
      detectedLanguage: sourceLanguage,
    });
  } catch (error) {
    console.error('Translate error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/image', async (req, res) => {
  try {
    const {
      prompt,
      style,
      size = '1024x1024',
    } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const styleLine = typeof style === 'string' && style.trim()
      ? `\n\nVisual style requirement: ${style.trim()}.`
      : '';

    const finalPrompt = `${prompt.trim()}${styleLine}`;
    const imageResult = await generateImage(finalPrompt, size);

    res.json({ success: true, ...imageResult });
  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 serp-sum backend server running at http://localhost:${PORT}`);
  console.log(`   Chat: POST http://localhost:${PORT}/api/chat`);
  console.log(`   Explain: POST http://localhost:${PORT}/api/explain`);
  console.log(`   Translate: POST http://localhost:${PORT}/api/translate`);
  console.log(`   Image: POST http://localhost:${PORT}/api/image`);
  console.log(`   Health: GET http://localhost:${PORT}/api/health`);
});
