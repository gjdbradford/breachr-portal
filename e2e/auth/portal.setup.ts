import { test as setup, expect } from '@playwright/test'
import * as path from 'path'

const STATE_FILE = path.join(__dirname, '.portal-state.json')

setup('portal auth setup', async ({ page }) => {
  const email    = process.env.PORTAL_TEST_EMAIL
  const password = process.env.PORTAL_TEST_PASSWORD

  if (!email || !password) {
    console.warn('⚠ PORTAL_TEST_EMAIL / PORTAL_TEST_PASSWORD not set — skipping portal auth setup')
    await page.context().storageState({ path: STATE_FILE })
    return
  }

  await page.goto('/login')
  await expect(page.getByLabel(/email/i)).toBeVisible()

  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/password/i).fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()

  await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 15_000 })

  await page.context().storageState({ path: STATE_FILE })
  console.log('✓ Portal auth state saved')
})
