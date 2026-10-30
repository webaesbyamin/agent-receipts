import type { NextConfig } from 'next'

// Pages are prerendered to static HTML at build time. The one server route is
// /api/waitlist (the early-access stub), so this is no longer a static export.
// Nothing here is shared with the dashboard build.
const nextConfig: NextConfig = {
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
}

export default nextConfig
