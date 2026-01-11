/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'localhost',
      // Add your Supabase storage domain here
      // e.g., 'your-project.supabase.co'
    ],
  },
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  // Enable SWC minification for faster builds
  swcMinify: true,
};

module.exports = nextConfig;


