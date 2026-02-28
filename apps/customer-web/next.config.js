/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
  },
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  // Enable SWC minification for faster builds
  swcMinify: true,
  // Important: transpile workspace packages
  transpilePackages: [
    '@cafe-idare/api-client',
    '@cafe-idare/core',
    '@cafe-idare/database',
    '@cafe-idare/i18n',
    '@cafe-idare/ui',
  ],
};

module.exports = nextConfig;
