import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 静的エクスポートではなく、サーバーレス関数を使用してAPI routesを有効化
  // output: 'export', // 一時的に無効化
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
  // Vercel環境での最適化
  experimental: {
    serverComponentsExternalPackages: ['fs']
  }
};

export default nextConfig;
