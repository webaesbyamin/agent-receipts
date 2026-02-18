import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: [
    '@agentreceipts/schema',
    '@agentreceipts/crypto',
  ],
}

export default nextConfig
