// Stands in for @vercel/analytics/next in every build that isn't the hosted
// demo (see next.config.ts), so the npm dashboard contains no analytics code.
export function Analytics(): null {
  return null
}
