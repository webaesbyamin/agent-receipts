import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: [
    '@agent-receipts/schema',
    '@agent-receipts/crypto',
    '@agent-receipts/mcp-server',
    '@agent-receipts/sdk',
  ],
  env: {
    PORT: '3274',
  },
}

export default nextConfig
