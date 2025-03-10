import { NextResponse } from 'next/server';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const REDIRECT_URI = `${process.env.NEXT_PUBLIC_BASE_URL}/api/spotify/callback`;

export async function GET() {
  const scope = 'user-read-currently-playing';
  const authUrl = new URL('https://accounts.spotify.com/authorize');
  
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('client_id', SPOTIFY_CLIENT_ID!);
  authUrl.searchParams.append('scope', scope);
  authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.append('show_dialog', 'true');

  return NextResponse.redirect(authUrl);
} 