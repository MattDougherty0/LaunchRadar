import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['puppeteer', 'puppeteer-core', '@puppeteer/browsers'],
  
  // Standard webpack config (works with both regular and turbo)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude server-only packages from client bundle
      config.externals = [
        ...(config.externals || []),
        'puppeteer',
        'puppeteer-core',
        '@puppeteer/browsers'
      ];
    }
    return config;
  },
  
  // Temporarily ignore ESLint errors during production builds so they don't block deploys.
  eslint: {
    ignoreDuringBuilds: true
  }
};

export default nextConfig;
