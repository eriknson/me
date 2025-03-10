import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ error: 'No code provided' }, { status: 400 });
    }

    // Exchange code for tokens
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/spotify/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json();
      console.error('Failed to exchange code for tokens:', error);
      return NextResponse.json({ error: 'Failed to exchange code for tokens' }, { status: 500 });
    }

    const tokens = await tokenResponse.json();

    // Read current .env.local file
    const envPath = path.join(process.cwd(), '.env.local');
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Update or add Spotify tokens
    const lines = envContent.split('\n');
    const newLines = lines.map(line => {
      if (line.startsWith('SPOTIFY_ACCESS_TOKEN=')) {
        return `SPOTIFY_ACCESS_TOKEN=${tokens.access_token}`;
      }
      if (line.startsWith('SPOTIFY_REFRESH_TOKEN=')) {
        return `SPOTIFY_REFRESH_TOKEN=${tokens.refresh_token}`;
      }
      return line;
    });

    // Add new tokens if they don't exist
    if (!lines.some(line => line.startsWith('SPOTIFY_ACCESS_TOKEN='))) {
      newLines.push(`SPOTIFY_ACCESS_TOKEN=${tokens.access_token}`);
    }
    if (!lines.some(line => line.startsWith('SPOTIFY_REFRESH_TOKEN='))) {
      newLines.push(`SPOTIFY_REFRESH_TOKEN=${tokens.refresh_token}`);
    }

    // Write updated content back to .env.local
    fs.writeFileSync(envPath, newLines.join('\n'));

    // Redirect back to the main page
    return NextResponse.redirect(new URL('/', request.url));
  } catch (error) {
    console.error('Error in Spotify callback:', error);
    return NextResponse.json({ error: 'Failed to process Spotify callback' }, { status: 500 });
  }
} 