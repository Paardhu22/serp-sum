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
    const { messages, temperature = 0.62, maxTokens = 650, model = 'gpt-4o-mini', userId, chatId: providedChatId } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Invalid messages array' }, { status: 400, headers: corsHeaders });
    }

    let activeChatId = providedChatId;

    if (userId) {
      if (!activeChatId) {
        const newChat = await prisma.chat.create({
          data: {
            userId,
            title: 'New Chat',
          },
        });
        activeChatId = newChat.id;
      }

      const lastMessage = messages[messages.length - 1];
      if (lastMessage && activeChatId) {
        await prisma.message.create({
          data: {
            chatId: activeChatId,
            role: 'user',
            content: lastMessage.content || '',
          },
        });
      }
    }

    const reply = await callOpenAI(messages, temperature, maxTokens, model);

    if (userId && activeChatId) {
      await prisma.message.create({
        data: {
          chatId: activeChatId,
          role: 'assistant',
          content: reply,
        },
      });
    }

    return NextResponse.json({ success: true, reply, chatId: activeChatId }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Chat error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: userId missing' }, { status: 401, headers: corsHeaders });
    }

    const chats = await prisma.chat.findMany({
      where: { userId },
      include: { 
        messages: {
          orderBy: { createdAt: 'asc' }
        } 
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ success: true, chats }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Fetch chats error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}

