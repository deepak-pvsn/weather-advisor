/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // This completely disables ESLint during the build process
    ignoreDuringBuilds: true,
  },
  reactStrictMode: true,
  images: {
    domains: ['www.weather.gov'], // Add domains for any external images
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, s-maxage=86400',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ];
  },
}

module.exports = nextConfig; 