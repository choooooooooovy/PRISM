import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config, { dev }) => {
    // Avoid intermittent ENOENT rename failures in webpack pack cache on local dev.
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default nextConfig;
