import { defineConfig, devices } from '@playwright/test'

// Browser checks for receipts.webaes.com. Locally and in CI they run against
// `next start` on the built site; set SITE_URL to check a deployment instead
// (for a protected Vercel preview, also VERCEL_OIDC_TOKEN, e.g. via `vercel env run`).
const remote = process.env.SITE_URL
const PORT = 3276

export default defineConfig({
  testDir: 'test/browser',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : [['list']],
  use: {
    baseURL: remote ?? `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: remote ? undefined : {
    command: `pnpm exec next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
