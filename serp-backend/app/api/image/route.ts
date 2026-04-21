import { NextResponse } from 'next/server';
import { generateImage } from '@/lib/openai';
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
      prompt,
      style,
      size = '1024x1024',
      userId
    } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400, headers: corsHeaders });
    }

    const styleLine = typeof style === 'string' && style.trim()
      ? `\n\nVisual style requirement: ${style.trim()}.`
      : '';

    const finalPrompt = `${prompt.trim()}${styleLine}`;
    const imageResult = await generateImage(finalPrompt, size);

    if (userId) {
      await prisma.chat.create({
        data: {
          userId,
          title: "Image Generation",
          messages: {
            create: [
              { role: 'user', content: prompt.trim() },
              { role: 'assistant', content: imageResult.imageUrl || imageResult.imageDataUrl || 'Image Generated' }
            ]
          }
        }
      });
    }

    return NextResponse.json({ success: true, ...imageResult }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Image generation error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}
