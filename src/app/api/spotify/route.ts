import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SPOTIFY_ACCESS_TOKEN = process.env.SPOTIFY_ACCESS_TOKEN;
const SPOTIFY_REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

async function refreshSpotifyToken() {
  try {
    console.log('Attempting to refresh Spotify token...');
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: SPOTIFY_REFRESH_TOKEN!,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to refresh token. Status:', response.status);
      console.error('Response text:', errorText);
      throw new Error('Failed to refresh Spotify token');
    }

    const data = await response.json();
    console.log('Successfully refreshed Spotify token');

    // Update the .env.local file with the new access token
    const envPath = path.join(process.cwd(), '.env.local');
    let envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    const newLines = lines.map(line => {
      if (line.startsWith('SPOTIFY_ACCESS_TOKEN=')) {
        return `SPOTIFY_ACCESS_TOKEN=${data.access_token}`;
      }
      return line;
    });
    fs.writeFileSync(envPath, newLines.join('\n'));

    return data.access_token;
  } catch (error) {
    console.error('Error refreshing Spotify token:', error);
    throw error;
  }
}

async function fetchSpotifyData(accessToken: string) {
  console.log('Fetching Spotify data with token:', accessToken.substring(0, 10) + '...');
  const response = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=5', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  console.log('Response status:', response.status);
  console.log('Response headers:', Object.fromEntries(response.headers.entries()));

  if (!response.ok) {
    if (response.status === 401) {
      console.log('Token expired, refreshing...');
      const newAccessToken = await refreshSpotifyToken();
      return fetchSpotifyData(newAccessToken);
    }
    const errorText = await response.text();
    console.error('Failed to fetch Spotify data. Status:', response.status);
    console.error('Response text:', errorText);
    console.error('Access token used:', accessToken.substring(0, 10) + '...');
    throw new Error(`Failed to fetch Spotify data: ${response.status} ${response.statusText}`);
  }

  const responseText = await response.text();
  console.log('Raw response length:', responseText.length);
  
  if (!responseText) {
    console.log('Empty response from Spotify');
    return null;
  }

  try {
    const data = JSON.parse(responseText);
    console.log('Successfully parsed Spotify data');
    return data;
  } catch (error) {
    console.error('Failed to parse Spotify response:', error);
    console.error('Response text that failed to parse:', responseText);
    throw new Error('Invalid JSON response from Spotify');
  }
}

export async function GET() {
  try {
    console.log('Checking environment variables...');
    console.log('Has access token:', !!SPOTIFY_ACCESS_TOKEN);
    console.log('Has refresh token:', !!SPOTIFY_REFRESH_TOKEN);
    console.log('Has client ID:', !!SPOTIFY_CLIENT_ID);
    console.log('Has client secret:', !!SPOTIFY_CLIENT_SECRET);

    if (!SPOTIFY_ACCESS_TOKEN || !SPOTIFY_REFRESH_TOKEN || !SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
      return NextResponse.json(
        { error: 'Missing required Spotify environment variables' },
        { status: 500 }
      );
    }

    const data = await fetchSpotifyData(SPOTIFY_ACCESS_TOKEN);
    
    if (!data || !data.items || data.items.length === 0) {
      return NextResponse.json({
        isPlaying: false,
        message: 'No recently played tracks'
      });
    }

    return NextResponse.json({
      isPlaying: false,
      tracks: data.items.map((item: any) => ({
        song: item.track.name,
        artist: item.track.artists[0].name,
        album: item.track.album.name,
        playedAt: item.played_at
      }))
    });
  } catch (error) {
    console.error('Error in Spotify GET handler:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch Spotify data' },
      { status: 500 }
    );
  }
} 