import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['puppeteer', 'puppeteer-core', '@puppeteer/browsers'],
  
  // Use Turbopack (default in Next.js 16)
  turbopack: {},
};

export default nextConfig;
