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

  // Wait for either a successful redirect or an error message
  await Promise.race([
    page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 20_000 }),
    page.getByText(/invalid|incorrect|not found|error/i).waitFor({ timeout: 20_000 }),
  ]).catch(async () => {
    const url = page.url()
    const bodyText = await page.locator('body').innerText().catch(() => '(could not read body)')
    throw new Error(`Login timed out. URL: ${url}\nPage content: ${bodyText.slice(0, 500)}`)
  })

  // If we're still on login page, the credentials were rejected
  if (page.url().includes('/login')) {
    const errorText = await page.locator('p:has-text("Invalid"), p:has-text("incorrect"), [style*="ef4444"]').innerText().catch(() => 'unknown error')
    throw new Error(`Login failed: ${errorText}`)
  }

  await page.context().storageState({ path: STATE_FILE })
  console.log('✓ Portal auth state saved')
})
