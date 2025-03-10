import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const TOKENS_FILE = path.join(process.cwd(), '.env.local');

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: 'No authorization code received' }, { status: 400 });
    }

    // Exchange the code for tokens
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Failed to exchange code for tokens:', data);
      return NextResponse.json({ error: 'Failed to exchange code for tokens' }, { status: 500 });
    }

    // Update .env.local with new tokens
    let envContent = fs.readFileSync(TOKENS_FILE, 'utf8');
    const lines = envContent.split('\n');
    const updatedLines = lines.map(line => {
      if (line.startsWith('STRAVA_ACCESS_TOKEN=')) {
        return `STRAVA_ACCESS_TOKEN=${data.access_token}`;
      }
      if (line.startsWith('STRAVA_REFRESH_TOKEN=')) {
        return `STRAVA_REFRESH_TOKEN=${data.refresh_token}`;
      }
      return line;
    });

    fs.writeFileSync(TOKENS_FILE, updatedLines.join('\n'));

    // Redirect back to the main page
    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    console.error('Error in callback:', error);
    return NextResponse.json({ error: 'Failed to process callback' }, { status: 500 });
  }
} 