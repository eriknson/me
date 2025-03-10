import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Cache object to store Strava data
let stravaCache = {
  data: null,
  timestamp: 0,
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const TOKENS_FILE = path.join(process.cwd(), '.env.local');

const STRAVA_ACCESS_TOKEN = process.env.STRAVA_ACCESS_TOKEN;
const STRAVA_REFRESH_TOKEN = process.env.STRAVA_REFRESH_TOKEN;
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const STRAVA_ATHLETE_ID = '68781812';

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

async function refreshStravaToken() {
  try {
    console.log('Refreshing Strava token...');
    console.log('Using refresh token:', STRAVA_REFRESH_TOKEN?.substring(0, 10) + '...');
    console.log('Using client ID:', STRAVA_CLIENT_ID);
    console.log('Using client secret:', STRAVA_CLIENT_SECRET?.substring(0, 5) + '...');

    if (!STRAVA_REFRESH_TOKEN || !STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
      throw new Error('Missing required credentials for token refresh');
    }

    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        refresh_token: STRAVA_REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    });

    const responseData = await response.json();
    console.log('Strava token refresh response:', {
      status: response.status,
      ok: response.ok,
      data: {
        ...responseData,
        access_token: responseData.access_token?.substring(0, 10) + '...',
        refresh_token: responseData.refresh_token?.substring(0, 10) + '...'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${JSON.stringify(responseData)}`);
    }

    if (!responseData.access_token || !responseData.refresh_token) {
      throw new Error('Invalid token refresh response: missing tokens');
    }

    // Update .env.local with new tokens
    try {
      let envContent = fs.readFileSync(TOKENS_FILE, 'utf8');
      const lines = envContent.split('\n');
      const updatedLines = lines.map(line => {
        if (line.startsWith('STRAVA_ACCESS_TOKEN=')) {
          return `STRAVA_ACCESS_TOKEN=${responseData.access_token}`;
        }
        if (line.startsWith('STRAVA_REFRESH_TOKEN=')) {
          return `STRAVA_REFRESH_TOKEN=${responseData.refresh_token}`;
        }
        return line;
      });

      fs.writeFileSync(TOKENS_FILE, updatedLines.join('\n'));
      console.log('Updated .env.local with new tokens');
    } catch (fileError) {
      console.error('Error updating .env.local:', fileError);
      // Don't throw here, we can still use the new tokens in memory
    }

    return responseData.access_token;
  } catch (error) {
    console.error('Error refreshing Strava token:', error);
    throw error;
  }
}

async function fetchStravaData(accessToken: string) {
  try {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      console.log('Rate limited, returning cached data');
      return stravaCache.data;
    }
    lastRequestTime = now;

    console.log('Fetching Strava data...');
    console.log('Using access token:', accessToken.substring(0, 10) + '...');
    
    // Try to refresh the token first
    let currentToken = accessToken;
    try {
      const newToken = await refreshStravaToken();
      currentToken = newToken;
      console.log('Successfully refreshed token, using new token:', currentToken.substring(0, 10) + '...');
    } catch (refreshError) {
      console.error('Failed to refresh token:', refreshError);
      throw new Error('Failed to refresh Strava token. Please re-authenticate.');
    }

    // Now fetch activities with the new token
    const response = await fetch(
      'https://www.strava.com/api/v3/athlete/activities?per_page=5',
      {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      }
    );

    const responseData = await response.json();
    console.log('Strava API response:', {
      status: response.status,
      ok: response.ok,
      data: responseData,
      dataLength: Array.isArray(responseData) ? responseData.length : 'not an array',
      activities: Array.isArray(responseData) ? responseData.map(activity => ({
        id: activity.id,
        type: activity.type,
        name: activity.name,
        distance: activity.distance,
        moving_time: activity.moving_time,
        start_date: activity.start_date,
        location_city: activity.location_city,
        location_state: activity.location_state,
        location_country: activity.location_country,
        average_heartrate: activity.average_heartrate,
        max_heartrate: activity.max_heartrate,
        has_heartrate: activity.has_heartrate,
        trainer: activity.trainer,
        commute: activity.commute,
        manual: activity.manual,
        private: activity.private,
        visibility: activity.visibility,
        flagged: activity.flagged,
        gear_id: activity.gear_id,
        average_speed: activity.average_speed,
        max_speed: activity.max_speed,
        total_elevation_gain: activity.total_elevation_gain,
        achievement_count: activity.achievement_count,
        kudos_count: activity.kudos_count,
        comment_count: activity.comment_count,
        athlete_count: activity.athlete_count,
        photo_count: activity.photo_count,
        map: activity.map ? 'present' : 'absent',
        start_latlng: activity.start_latlng,
        end_latlng: activity.end_latlng,
        timezone: activity.timezone,
        utc_offset: activity.utc_offset,
        location: {
          city: activity.location_city,
          state: activity.location_state,
          country: activity.location_country,
          start_latlng: activity.start_latlng,
          end_latlng: activity.end_latlng
        }
      })) : 'not an array'
    });

    if (!response.ok) {
      if (response.status === 429) {
        // If rate limited and we have cached data, return it
        if (stravaCache.data && Date.now() - stravaCache.timestamp < CACHE_DURATION) {
          console.log('Rate limited, returning cached data');
          return stravaCache.data;
        }
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      if (response.status === 401) {
        console.error('Token still invalid after refresh:', responseData);
        throw new Error('Authentication failed. Please re-authenticate with Strava.');
      }
      throw new Error(`Failed to fetch Strava data: ${JSON.stringify(responseData)}`);
    }

    // Update cache
    stravaCache = {
      data: responseData,
      timestamp: Date.now(),
    };

    return responseData;
  } catch (error) {
    console.error('Error fetching Strava data:', error);
    throw error;
  }
}

export async function GET() {
  try {
    console.log('Checking environment variables...');
    console.log('Has access token:', !!STRAVA_ACCESS_TOKEN);
    console.log('Has refresh token:', !!STRAVA_REFRESH_TOKEN);
    console.log('Has client ID:', !!STRAVA_CLIENT_ID);
    console.log('Has client secret:', !!STRAVA_CLIENT_SECRET);

    if (!STRAVA_ACCESS_TOKEN || !STRAVA_REFRESH_TOKEN || !STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
      console.error('Missing environment variables:', {
        hasAccessToken: !!STRAVA_ACCESS_TOKEN,
        hasRefreshToken: !!STRAVA_REFRESH_TOKEN,
        hasClientId: !!STRAVA_CLIENT_ID,
        hasClientSecret: !!STRAVA_CLIENT_SECRET
      });
      return NextResponse.json(
        { error: 'Missing required environment variables' },
        { status: 500 }
      );
    }

    // Check if we have valid cached data
    if (stravaCache.data && Date.now() - stravaCache.timestamp < CACHE_DURATION) {
      return NextResponse.json(stravaCache.data);
    }

    const data = await fetchStravaData(STRAVA_ACCESS_TOKEN);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in GET handler:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Strava data' },
      { status: 500 }
    );
  }
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
} 