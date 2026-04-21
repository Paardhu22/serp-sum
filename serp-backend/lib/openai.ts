const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function callOpenAI(messages: any[], temperature = 0.62, maxTokens = 650, model = 'gpt-4o-mini', allowFallback = true): Promise<string> {
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

export function normalizeImageSize(size: string): string {
  if (size === '1024x1024' || size === '1024x1536' || size === '1536x1024') {
    return size;
  }
  return '1024x1024';
}

export async function generateImage(prompt: string, size = '1024x1024'): Promise<{ imageDataUrl?: string; imageUrl?: string }> {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3', // Note: usually it's 'dall-e-3' or 'dall-e-2'. Using the default based on original server.js. Let's keep what they had, or correct it.
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
