import path from 'node:path'
import type { NextConfig } from 'next'

// Web Analytics and the search/sharing metadata are only for the hosted demo
// (demo.receipts.webaes.com). Any other build, including the npm dashboard
// (build:standalone sets NEXT_PUBLIC_DEMO_MODE=false), gets stubs instead.
const isDemoBuild = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: [
    '@agent-receipts/schema',
    '@agent-receipts/crypto',
    '@agent-receipts/mcp-server',
    '@agent-receipts/sdk',
  ],
  serverExternalPackages: ['better-sqlite3'],
  // Output tracing copies some src/lib files next to the server; the demo-only
  // module must never ship in the npm dashboard
  outputFileTracingExcludes: { '*': ['./src/lib/demo-seo.ts'] },
  // No next/image in the app. Keeps Next from ever loading sharp, which the
  // npm dashboard package strips (its binaries are platform-specific).
  images: { unoptimized: true },
  env: {
    PORT: '3274',
  },
  webpack: (config, { isServer, webpack }) => {
    if (!isDemoBuild) {
      config.resolve.alias = { ...config.resolve.alias, '@vercel/analytics/next': path.resolve(__dirname, 'src/lib/no-analytics.tsx') }
      // '@/…' imports are resolved by Next's tsconfig-paths plugin before
      // resolve.alias applies, so swap this one by its import text instead
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^@\/lib\/demo-seo$/, path.resolve(__dirname, 'src/lib/no-demo-seo.ts')))
    }
    // Webpack's cache doesn't see the alias change, so demo and non-demo builds
    // keep separate caches and never reuse each other's modules.
    if (config.cache && typeof config.cache === 'object' && 'name' in config.cache) {
      config.cache = { ...config.cache, name: `${config.cache.name}-${isDemoBuild ? 'demo' : 'local'}` }
    }
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
