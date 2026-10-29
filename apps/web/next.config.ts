import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: [
    '@agent-receipts/schema',
    '@agent-receipts/crypto',
    '@agent-receipts/mcp-server',
    '@agent-receipts/sdk',
  ],
  serverExternalPackages: ['better-sqlite3'],
  // No next/image in the app. Keeps Next from ever loading sharp, which the
  // npm dashboard package strips (its binaries are platform-specific).
  images: { unoptimized: true },
  env: {
    PORT: '3274',
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      if (!Array.isArray(config.externals)) {
        config.externals = [config.externals]
      }
      config.externals.push('better-sqlite3')
    }
    return config
  },
}

export default nextConfig
