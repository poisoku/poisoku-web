import type { NextConfig } from "next";

// Updated with 1,017 PointIncome campaigns via mobile infinite scroll - 2025-08-10
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
