import { defineConfig, devices } from '@playwright/test'
import { localStack } from './e2e/local-stack.js'

// End-to-end tests (test plan §2): the built app in a real browser, against
// the LOCAL Supabase stack (npx supabase start) – never the real database.
// The local connection settings are handed to the build as environment
// variables, which win over any .env file.
const PORT = 4173
const stack = localStack()

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    // same time zone everywhere (laptop and CI), like the unit tests
    timezoneId: 'Europe/Zurich',
    locale: 'en-GB',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Android phone size (the owner's main device) and a laptop.
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'laptop', use: { ...devices['Desktop Chrome'] }, testMatch: /habits|a11y|today|shell/ },
  ],
  webServer: {
    command: `npx vite build && npx vite preview --port ${PORT} --strictPort --host 127.0.0.1`,
    env: {
      VITE_SUPABASE_URL: stack.url,
      VITE_SUPABASE_PUBLISHABLE_KEY: stack.publishable,
      VITE_VAPID_PUBLIC_KEY: stack.vapidPublicKey,
    },
    url: `http://127.0.0.1:${PORT}`,
    // always a fresh build, so an old build with other settings is never tested
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
