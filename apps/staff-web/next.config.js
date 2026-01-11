/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'localhost',
      // Add your Supabase storage domain here
    ],
  },
  reactStrictMode: true,
  swcMinify: true,
  // Important: transpile workspace packages
  transpilePackages: [
    '@cafe-idare/api-client',
    '@cafe-idare/core',
    '@cafe-idare/database',
    '@cafe-idare/ui',
  ],
};

module.exports = nextConfig;


