'use client';

import { useState, useEffect, useCallback } from 'react';

const links = [
  { name: 'Twitter', href: 'https://twitter.com/0xago' },
  { name: 'LinkedIn', href: 'https://linkedin.com/in/eriknson' },
  { name: 'GitHub', href: 'https://github.com/eriknson' },
  { name: 'Mirror', href: 'https://mirror.xyz/eriko.eth' },
];

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks}w ago`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths}mo ago`;
  }

  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears}y ago`;
}

interface StravaActivity {
  distance?: string;
  duration: string;
  type: string;
  date: string;
  name?: string;
  total_elevation_gain?: number;
  reps?: number;
  sets?: number;
  weight?: number;
  location_city?: string;
  location_state?: string;
  location_country?: string;
  average_heartrate?: number;
  max_heartrate?: number;
  has_heartrate?: boolean;
  trainer?: boolean;
  manual?: boolean;
}

interface SpotifyData {
  isPlaying: boolean;
  tracks?: Array<{
    song: string;
    artist: string;
    album: string;
    playedAt: string;
  }>;
  message?: string;
}

interface Project {
  title: string;
  description: string;
  link: string;
}

const projects: Project[] = [
  {
    title: "Project 1",
    description: "Description of project 1",
    link: "https://github.com/x/project1"
  },
  {
    title: "Project 2",
    description: "Description of project 2",
    link: "https://github.com/x/project2"
  }
];

export default function Home() {
  const [stravaData, setStravaData] = useState<StravaActivity[] | null>(null);
  const [spotifyData, setSpotifyData] = useState<SpotifyData | null>(null);
  const [stravaError, setStravaError] = useState<string | null>(null);
  const [spotifyError, setSpotifyError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setShowContent(false);
      // Fetch Strava data
      const stravaResponse = await fetch('/api/strava');
      const stravaResult = await stravaResponse.json();
      
      if (!stravaResponse.ok) {
        console.error('Strava API error:', stravaResult);
        if (stravaResult.error?.includes('re-authenticate') || stravaResult.error?.includes('Authentication failed')) {
          setStravaError('Your Strava session has expired. Please visit https://www.strava.com/settings/api to re-authenticate.');
        } else {
          setStravaError(stravaResult.error || 'Failed to fetch Strava data. Please try again later.');
        }
        return;
      }

      if (!Array.isArray(stravaResult)) {
        console.error('Invalid Strava response format:', stravaResult);
        setStravaError('Invalid response format from Strava. Please try again later.');
        return;
      }

      if (stravaResult.length === 0) {
        console.log('No Strava activities found');
        setStravaData(null);
        return;
      }

      // Set current location based on the most recent activity with location
      const locationActivity = stravaResult.find(activity => 
        activity.location_city || activity.location_state || activity.location_country
      );
      if (locationActivity) {
        console.log('Found location activity:', {
          name: locationActivity.name,
          location: {
            city: locationActivity.location_city,
            state: locationActivity.location_state,
            country: locationActivity.location_country
          }
        });
        const locationParts = [
          locationActivity.location_city,
          locationActivity.location_state,
          locationActivity.location_country
        ].filter(Boolean);
        setCurrentLocation(locationParts.join(', '));
      }

      const activities = stravaResult.map(activity => {
        console.log('Processing activity:', {
          name: activity.name,
          type: activity.type,
          duration: activity.moving_time,
          heartrate: activity.average_heartrate,
          location: {
            city: activity.location_city,
            state: activity.location_state,
            country: activity.location_country,
            start_latlng: activity.start_latlng,
            end_latlng: activity.end_latlng
          }
        });

        const formattedActivity: StravaActivity = {
          duration: formatDuration(activity.moving_time),
          type: activity.type,
          date: activity.start_date,
          name: activity.name,
          location_city: activity.location_city,
          location_state: activity.location_state,
          location_country: activity.location_country,
          average_heartrate: activity.average_heartrate,
          max_heartrate: activity.max_heartrate,
          has_heartrate: activity.has_heartrate,
          trainer: activity.trainer,
          manual: activity.manual,
          distance: activity.distance ? (activity.distance / 1000).toFixed(1) : undefined
        };

        // Format based on activity type
        switch (activity.type.toLowerCase()) {
          case 'run':
          case 'ride':
          case 'swim':
            formattedActivity.distance = (activity.distance / 1000).toFixed(1);
            break;
          case 'strength':
            // For strength workouts, try to parse the name for sets/reps and weight
            const setsMatch = activity.name.match(/(\d+)\s*sets/i);
            const repsMatch = activity.name.match(/(\d+)\s*reps/i);
            const weightMatch = activity.name.match(/(\d+)\s*kg/i);
            
            if (setsMatch) formattedActivity.sets = parseInt(setsMatch[1]);
            if (repsMatch) formattedActivity.reps = parseInt(repsMatch[1]);
            if (weightMatch) formattedActivity.weight = parseInt(weightMatch[1]);
            break;
          case 'hike':
          case 'walk':
            formattedActivity.distance = (activity.distance / 1000).toFixed(1);
            formattedActivity.total_elevation_gain = activity.total_elevation_gain;
            break;
        }

        return formattedActivity;
      });

      setStravaData(activities);
    } catch (error) {
      setStravaError('Failed to fetch Strava data');
    } finally {
      // Ensure minimum loading time of 1 second
      setTimeout(() => {
        setIsLoading(false);
        setShowContent(true);
      }, 1000);
    }

    try {
      // Fetch Spotify data
      const spotifyResponse = await fetch('/api/spotify');
      const spotifyResult = await spotifyResponse.json();
      
      if (!spotifyResponse.ok) {
        setSpotifyError(spotifyResult.error || 'Failed to fetch Spotify data');
        return;
      }

      setSpotifyData(spotifyResult);
    } catch (error) {
      setSpotifyError('Failed to fetch Spotify data');
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedLink = links.find(link => link.name === event.target.value);
    if (selectedLink) {
      window.open(selectedLink.href, '_blank');
      event.target.value = '';
    }
  };

  const handleContact = () => {
    window.location.href = 'mailto:contact@eriks.design';
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl p-6 flex flex-col sm:h-auto sm:flex-none h-[calc(100vh-2rem)]">
        <div className="flex-1 sm:flex-none space-y-6">
          {/* Name Section */}
          <div>
            <p className="text-gray-900">
              <span className="font-medium">Hej, I'm Erik</span>
              <span className="text-gray-600">, a Swedish product designer based out of Lisbon, Portugal. I work together with ambitious teams to create world-class user experiences.</span>
            </p>
          </div>

          {/* Metrics Section */}
          <div className="space-y-4">
            <div className="flex items-center">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-600 mb-2 font-medium">Latest Activities</p>
                {isLoading ? (
                  <div className="h-6 w-full bg-gray-100 rounded animate-pulse"></div>
                ) : stravaError ? (
                  <span className="text-red-500">{stravaError}</span>
                ) : stravaData ? (
                  <div className="relative w-full">
                    <div className={`absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10 transition-opacity duration-700 ease-in-out ${showContent ? 'opacity-100' : 'opacity-0'}`}></div>
                    <div className={`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10 transition-opacity duration-700 ease-in-out ${showContent ? 'opacity-100' : 'opacity-0'}`}></div>
                    <div className={`overflow-hidden transition-opacity duration-700 ease-in-out ${showContent ? 'opacity-100' : 'opacity-0'}`}>
                      <div className="animate-scroll inline-flex whitespace-nowrap">
                        {stravaData.map((activity: StravaActivity, index: number) => (
                          <span key={index} className="inline-block mr-4 text-sm">
                            <span className="font-medium">{activity.name}</span>
                            <span className="text-gray-600"> • </span>
                            <span className="text-gray-600">
                              {activity.type === 'Run' && `${activity.distance}km in ${activity.duration}, ${getTimeAgo(activity.date)}`}
                              {activity.type === 'Ride' && `${activity.distance}km in ${activity.duration}, ${getTimeAgo(activity.date)}`}
                              {activity.type === 'Swim' && `${activity.distance}km in ${activity.duration}, ${getTimeAgo(activity.date)}`}
                              {(activity.type === 'Strength' || activity.type === 'WeightTraining') && 
                                `${activity.duration}${activity.average_heartrate ? `, ${Math.round(activity.average_heartrate)}bpm` : ''}, ${getTimeAgo(activity.date)}`}
                              {activity.type === 'Hike' && `${activity.distance}km, ${activity.total_elevation_gain}m gain in ${activity.duration}, ${getTimeAgo(activity.date)}`}
                              {activity.type === 'Walk' && `${activity.distance}km in ${activity.duration}, ${getTimeAgo(activity.date)}`}
                            </span>
                          </span>
                        ))}
                        {stravaData.map((activity: StravaActivity, index: number) => (
                          <span key={`duplicate-${index}`} className="inline-block mr-4 text-sm">
                            <span className="font-medium">{activity.name}</span>
                            <span className="text-gray-600"> • </span>
                            <span className="text-gray-600">
                              {activity.type === 'Run' && `${activity.distance}km in ${activity.duration}, ${getTimeAgo(activity.date)}`}
                              {activity.type === 'Ride' && `${activity.distance}km in ${activity.duration}, ${getTimeAgo(activity.date)}`}
                              {activity.type === 'Swim' && `${activity.distance}km in ${activity.duration}, ${getTimeAgo(activity.date)}`}
                              {(activity.type === 'Strength' || activity.type === 'WeightTraining') && 
                                `${activity.duration}${activity.average_heartrate ? `, ${Math.round(activity.average_heartrate)}bpm` : ''}, ${getTimeAgo(activity.date)}`}
                              {activity.type === 'Hike' && `${activity.distance}km, ${activity.total_elevation_gain}m gain in ${activity.duration}, ${getTimeAgo(activity.date)}`}
                              {activity.type === 'Walk' && `${activity.distance}km in ${activity.duration}, ${getTimeAgo(activity.date)}`}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  'No recent activities'
                )}
              </div>
            </div>
            <div className="flex items-center">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-600 mb-2 font-medium">Recently Played</p>
                {isLoading ? (
                  <div className="h-6 w-full bg-gray-100 rounded animate-pulse"></div>
                ) : spotifyError ? (
                  <span className="text-red-500">{spotifyError}</span>
                ) : spotifyData ? (
                  <div className="relative w-full">
                    <div className={`absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10 transition-opacity duration-700 ease-in-out ${showContent ? 'opacity-100' : 'opacity-0'}`}></div>
                    <div className={`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10 transition-opacity duration-700 ease-in-out ${showContent ? 'opacity-100' : 'opacity-0'}`}></div>
                    <div className={`overflow-hidden transition-opacity duration-700 ease-in-out ${showContent ? 'opacity-100' : 'opacity-0'}`}>
                      <div className="animate-scroll inline-flex whitespace-nowrap">
                        {spotifyData.tracks?.map((track, index) => (
                          <span key={index} className="inline-block mr-4 text-sm">
                            <span className="font-medium">{track.song}</span>
                            <span className="text-gray-600"> • </span>
                            <span className="text-gray-600">
                              {track.artist} • {getTimeAgo(track.playedAt)}
                            </span>
                          </span>
                        ))}
                        {spotifyData.tracks?.map((track, index) => (
                          <span key={`duplicate-${index}`} className="inline-block mr-4 text-sm">
                            <span className="font-medium">{track.song}</span>
                            <span className="text-gray-600"> • </span>
                            <span className="text-gray-600">
                              {track.artist} • {getTimeAgo(track.playedAt)}
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  'No recently played tracks'
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Buttons Section */}
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 mt-6">
          <button 
            onClick={handleContact}
            className="w-full sm:w-1/2 bg-gray-900 text-white py-2 px-4 rounded-lg hover:bg-gray-800 active:bg-gray-700 transition-colors border border-gray-900"
          >
            Contact
          </button>
          <div className="w-full sm:w-1/2">
            <select 
              onChange={handleSelect}
              className="w-full text-gray-900 py-2 px-4 rounded-lg hover:bg-gray-50 active:bg-gray-100 focus:bg-gray-50 focus:outline-none focus:ring-0 transition-colors border border-gray-900 appearance-none cursor-pointer text-center"
              defaultValue=""
            >
              <option value="" disabled>Online</option>
              {links.map((link) => (
                <option key={link.name} value={link.name}>
                  {link.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </main>
  );
} 