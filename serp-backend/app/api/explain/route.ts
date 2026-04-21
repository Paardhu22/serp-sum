import { NextResponse } from 'next/server';
import { callOpenAI } from '@/lib/openai';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const { text, systemPrompt, temperature = 0.55, maxTokens = 420 } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400, headers: corsHeaders });
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Explain this selection:\n\n"${text}"` },
    ];

    const explanation = await callOpenAI(messages, temperature, maxTokens, 'gpt-4o-mini');
    return NextResponse.json({ success: true, explanation }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Explain error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}
