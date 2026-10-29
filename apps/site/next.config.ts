import type { NextConfig } from 'next'

// A static site: `next build` writes plain HTML/CSS to out/. No server, no
// Node APIs at request time, and nothing shared with the dashboard build.
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
}

export default nextConfig
