import { NextResponse } from 'next/server';
import { callOpenAI } from '@/lib/openai';
import { prisma } from '@/lib/prisma';

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
    const {
      text,
      targetLanguage = 'English',
      sourceLanguage = 'auto',
      model = 'gpt-4o-mini',
      userId
    } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400, headers: corsHeaders });
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

    if (userId) {
      await prisma.chat.create({
        data: {
          userId,
          title: "Translation",
          messages: {
            create: [
              { role: 'user', content: text },
              { role: 'assistant', content: translatedText }
            ]
          }
        }
      });
    }

    return NextResponse.json({
      success: true,
      translatedText,
      detectedLanguage: sourceLanguage,
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Translate error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}
