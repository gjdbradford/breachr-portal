import { defineConfig, devices } from '@playwright/test'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '.env.test') })

const PORTAL_URL = process.env.PORTAL_URL || 'https://staging.portal.breachr.ai'

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'portal-setup',
      testMatch: 'auth/portal.setup.ts',
      use: { baseURL: PORTAL_URL, ...devices['Desktop Chrome'] },
    },
    {
      name: 'portal',
      testMatch: 'portal/**/*.spec.ts',
      dependencies: ['portal-setup'],
      use: {
        baseURL: PORTAL_URL,
        ...devices['Desktop Chrome'],
        storageState: 'auth/.portal-state.json',
      },
    },
  ],
})
