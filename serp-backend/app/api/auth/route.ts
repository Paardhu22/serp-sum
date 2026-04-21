import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Enable CORS for your Chrome Extension
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // You can restrict this to your extension ID later
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'No token provided' }, { status: 400, headers: corsHeaders });
    }

    // 1. Fetch user info directly from Google using the Chrome extension's access token
    const googleResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!googleResponse.ok) {
      return NextResponse.json({ error: 'Invalid Google token' }, { status: 401, headers: corsHeaders });
    }

    const userData = await googleResponse.json();
    const { email, name, picture } = userData;

    // 2. Find the user in Neon DB, or create them if they are new!
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: name || null,
        image: picture || null,
      },
      create: {
        email,
        name: name || null,
        image: picture || null,
      },
    });

    // 3. Return the user data back to the extension
    return NextResponse.json({ success: true, user }, { headers: corsHeaders });

  } catch (error) {
    console.error('Auth Error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500, headers: corsHeaders });
  }
}
