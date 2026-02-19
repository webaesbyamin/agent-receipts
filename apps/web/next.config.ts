import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: [
    '@agent-receipts/schema',
    '@agent-receipts/crypto',
  ],
}

export default nextConfig
