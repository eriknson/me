/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/spotify/callback',
        destination: '/api/spotify/callback',
      },
    ];
  },
  experimental: {
    serverActions: true,
  },
}

module.exports = nextConfig 