'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';

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
      if (!isLoading) {
        // Only show loading state on initial load
        setShowContent(false);
      }
      
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
      if (isLoading) {
        // Only delay showing content on initial load
        setTimeout(() => {
          setIsLoading(false);
          setShowContent(true);
        }, 1000);
      } else {
        setShowContent(true);
      }
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
      setSpotifyError(null);
    } catch (error) {
      setSpotifyError('Failed to fetch Spotify data');
    }
  }, [isLoading]);

  useEffect(() => {
    fetchData();
    // Set up polling every minute
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedLink = links.find(link => link.name === event.target.value);
    if (selectedLink) {
      window.open(selectedLink.href, '_blank', 'noopener,noreferrer');
    }
  };

  const handleContact = () => {
    window.location.href = 'mailto:contact@eriks.design';
  };

  return (
    <main className="min-h-[100dvh] flex items-center justify-center p-4 bg-[#F2F2F7]">
      <div className="w-full max-w-md bg-white rounded-[20px] overflow-hidden shadow-sm">
        <div className="px-6 pt-5 pb-6">
          {/* Name Section */}
          <div className="mb-8">
            <p className="text-[#1C1C1E] leading-relaxed">
              <span className="font-medium">Hej, I'm Erik</span>
              <span className="text-[#3A3A3C]">, a Swedish product designer based out of Lisbon, Portugal. I work together with ambitious teams to create world-class user experiences.</span>
            </p>
          </div>

          {/* Metrics Section */}
          <div className="space-y-8">
            {/* Recent Activities */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 13.3756 17.1777" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#8E8E93]">
                  <path d="M8.12334 3.39844C9.07061 3.39844 9.82256 2.63672 9.82256 1.69922C9.82256 0.751953 9.07061 0 8.12334 0C7.18584 0 6.42413 0.751953 6.42413 1.69922C6.42413 2.63672 7.18584 3.39844 8.12334 3.39844ZM5.46709 10.1562L8.42608 11.8262L6.51202 13.457C6.09209 13.8281 6.12139 14.2871 6.36553 14.5605C6.61944 14.8438 7.07842 14.9316 7.51788 14.5508L10.1937 12.2656C10.5648 11.9629 10.5062 11.2793 10.0569 10.9863L7.15655 9.08203L7.72295 7.08008C7.80108 6.79688 8.13311 6.75781 8.29913 7.00195L9.14873 8.25195C9.35381 8.54492 9.72491 8.66211 10.0569 8.50586L12.5179 7.41211C12.9671 7.2168 13.1331 6.82617 12.9378 6.42578C12.7425 6.03516 12.3616 5.91797 11.9319 6.11328L9.97881 6.97266L8.64092 5.11719C7.9378 4.16016 7.07842 3.75977 5.64288 3.86719L2.9085 4.0625C2.46905 4.0918 2.17608 4.38477 2.11748 4.82422L1.74639 7.59766C1.67803 8.07617 1.92217 8.41797 2.35186 8.4668C2.79131 8.50586 3.07452 8.25195 3.14288 7.77344L3.47491 5.51758L4.55889 5.43945C4.79327 5.41992 5.02764 5.57617 4.93975 5.87891L4.31475 8.10547C3.93389 9.42383 4.79327 9.77539 5.46709 10.1562ZM0.262016 16.8652C0.554985 17.1094 0.994438 17.1582 1.40459 16.7578L3.91436 14.2676C4.1292 14.0527 4.17803 14.0039 4.30498 13.6816L5.34991 10.9766L5.08623 10.8301C4.51006 10.5078 4.09014 10.1953 3.80694 9.84375L2.88897 13.0762L0.281547 15.6738C-0.138374 16.084-0.0407182 16.5918 0.262016 16.8652Z" fill="currentColor" fillOpacity="0.85"/>
                </svg>
                <h2 className="text-sm font-medium text-[#8E8E93]">Latest Activities</h2>
              </div>
              <div className="flex items-center">
                <div className="flex-1 min-w-0">
                  {isLoading ? (
                    <div className="h-6 w-full bg-[#F2F2F7] rounded-[10px] animate-pulse"></div>
                  ) : stravaError ? (
                    <span className="text-[#FF3B30]">{stravaError}</span>
                  ) : stravaData ? (
                    <div className="relative w-full">
                      <div className={`absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10 transition-opacity duration-700 ease-in-out ${showContent ? 'opacity-100' : 'opacity-0'}`}></div>
                      <div className={`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10 transition-opacity duration-700 ease-in-out ${showContent ? 'opacity-100' : 'opacity-0'}`}></div>
                      <div className={`overflow-hidden transition-opacity duration-700 ease-in-out ${showContent ? 'opacity-100' : 'opacity-0'}`}>
                        <div className="animate-scroll inline-flex whitespace-nowrap">
                          {stravaData.map((activity: StravaActivity, index: number) => (
                            <span key={index} className="inline-block mr-4 text-sm">
                              <span className="font-medium text-[#1C1C1E]">{activity.name}</span>
                              <span className="text-[#8E8E93]"> • </span>
                              <span className="text-[#3A3A3C]">
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
                              <span className="font-medium text-[#1C1C1E]">{activity.name}</span>
                              <span className="text-[#8E8E93]"> • </span>
                              <span className="text-[#3A3A3C]">
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
                    <span className="text-[#8E8E93]">No recent activities</span>
                  )}
                </div>
              </div>
            </div>

            {/* Recently Played */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 9.90234 15.9277" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-[#8E8E93]">
                  <path d="M9.54102 3.88672L9.54102 0.966797C9.54102 0.546875 9.19922 0.263672 8.7793 0.351562L4.75586 1.23047C4.22852 1.34766 3.94531 1.62109 3.94531 2.08008L3.94531 10.6738C3.99414 11.0254 3.82812 11.25 3.51562 11.3086L2.29492 11.5625C0.732422 11.8945 0 12.6953 0 13.8867C0 15.0879 0.927734 15.9277 2.22656 15.9277C3.36914 15.9277 5.08789 15.0781 5.08789 12.8125L5.08789 5.74219C5.08789 5.35156 5.15625 5.29297 5.49805 5.22461L9.10156 4.42383C9.36523 4.36523 9.54102 4.16016 9.54102 3.88672Z" fill="currentColor" fillOpacity="0.85"/>
                </svg>
                <h2 className="text-sm font-medium text-[#8E8E93]">Recently Played</h2>
              </div>
              <div className="flex items-center">
                <div className="flex-1 min-w-0">
                  {isLoading ? (
                    <div className="h-6 w-full bg-[#F2F2F7] rounded-[10px] animate-pulse"></div>
                  ) : spotifyError ? (
                    <span className="text-[#FF3B30]">{spotifyError}</span>
                  ) : spotifyData ? (
                    <div className="relative w-full">
                      <div className={`absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10 transition-opacity duration-700 ease-in-out ${showContent ? 'opacity-100' : 'opacity-0'}`}></div>
                      <div className={`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10 transition-opacity duration-700 ease-in-out ${showContent ? 'opacity-100' : 'opacity-0'}`}></div>
                      <div className={`overflow-hidden transition-opacity duration-700 ease-in-out ${showContent ? 'opacity-100' : 'opacity-0'}`}>
                        <div className="animate-scroll inline-flex whitespace-nowrap">
                          {spotifyData.tracks?.map((track, index) => (
                            <span key={index} className="inline-block mr-4 text-sm">
                              <span className="font-medium text-[#1C1C1E]">{track.song}</span>
                              <span className="text-[#8E8E93]"> • </span>
                              <span className="text-[#3A3A3C]">
                                {track.artist} • {getTimeAgo(track.playedAt)}
                              </span>
                            </span>
                          ))}
                          {spotifyData.tracks?.map((track, index) => (
                            <span key={`duplicate-${index}`} className="inline-block mr-4 text-sm">
                              <span className="font-medium text-[#1C1C1E]">{track.song}</span>
                              <span className="text-[#8E8E93]"> • </span>
                              <span className="text-[#3A3A3C]">
                                {track.artist} • {getTimeAgo(track.playedAt)}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-[#8E8E93]">No recently played tracks</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Buttons Section - Separated with different background */}
        <div className="px-6 py-4 bg-[#F2F2F7]/50 mt-2 border-t border-[#C6C6C8]">
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
            <button 
              onClick={handleContact}
              className="w-full sm:w-1/2 bg-[#007AFF] text-white py-2.5 px-4 rounded-[14px] hover:bg-[#0063CC] active:bg-[#0040CC] transition-colors font-medium text-[15px]"
            >
              Contact
            </button>
            <div className="w-full sm:w-1/2 relative">
              <select 
                onChange={handleSelect}
                className="w-full text-[#007AFF] py-2.5 px-4 rounded-[14px] hover:bg-[#F2F2F7] active:bg-[#E5E5EA] focus:bg-[#F2F2F7] focus:outline-none focus:ring-0 transition-colors border border-[#007AFF] appearance-none cursor-pointer text-center font-medium text-[15px]"
                defaultValue=""
              >
                <option value="" disabled>Online</option>
                {links.map((link) => (
                  <option key={link.name} value={link.name} className="text-[#1C1C1E]">
                    {link.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
} 