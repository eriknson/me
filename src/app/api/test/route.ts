import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasAccessToken: !!process.env.STRAVA_ACCESS_TOKEN,
    hasRefreshToken: !!process.env.STRAVA_REFRESH_TOKEN,
    hasClientId: !!process.env.STRAVA_CLIENT_ID,
    hasClientSecret: !!process.env.STRAVA_CLIENT_SECRET,
    accessTokenLength: process.env.STRAVA_ACCESS_TOKEN?.length,
    refreshTokenLength: process.env.STRAVA_REFRESH_TOKEN?.length,
    clientId: process.env.STRAVA_CLIENT_ID,
    clientSecretLength: process.env.STRAVA_CLIENT_SECRET?.length,
  });
} 