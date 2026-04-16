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

async function callOpenAI(messages, temperature = 0.62, maxTokens = 650) {
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
      model: 'gpt-4o-mini',
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || 'OpenAI API request failed');
  }

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('AI returned an empty response');
  }

  return content.trim();
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, temperature = 0.62, maxTokens = 650 } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Invalid messages array' });
    }

    const reply = await callOpenAI(messages, temperature, maxTokens);
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

    const explanation = await callOpenAI(messages, temperature, maxTokens);
    res.json({ success: true, explanation });
  } catch (error) {
    console.error('Explain error:', error);
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
  console.log(`   Health: GET http://localhost:${PORT}/api/health`);
});
