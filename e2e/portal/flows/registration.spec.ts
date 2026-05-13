import { test, expect } from '@playwright/test'

const WEBSITE_URL     = process.env.WEBSITE_URL     || 'https://breachr-website.vercel.app'
const PORTAL_URL      = process.env.PORTAL_URL      || 'https://staging.portal.breachr.ai'
const PASSWORD        = 'E2eBreachr@1!'
const E2E_TEST_SECRET = process.env.E2E_TEST_SECRET || ''

test('account owner registers → onboards → invites admin → admin first login @flow', async ({ page, request }) => {
  test.setTimeout(180_000)

  const runId      = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const ownerEmail = `e2e-owner-${runId}@breachr.ai`
  const adminEmail = `e2e-admin-${runId}@breachr.ai`

  try {

    // ── 1. Website registration form ────────────────────────────────────
    await page.goto(WEBSITE_URL + '/register')
    await page.waitForLoadState('load')

    await page.locator('#firstName').fill('E2E')
    await page.locator('#lastName').fill('Owner')
    await page.locator('#email').fill(ownerEmail)
    await page.locator('#password').fill(PASSWORD)
    await page.locator('#company').fill(`E2E Test Co ${runId}`)
    await page.locator('#role').selectOption('CISO')
    await page.locator('#companySize').selectOption('1-10')
    await page.locator('#industry').selectOption('other')
    await page.getByRole('button', { name: /start free/i }).click()

    await expect(
      page.getByText('Account created'),
      'Registration success message should appear',
    ).toBeVisible({ timeout: 15_000 })

    // ── 2. Portal login ──────────────────────────────────────────────────
    await page.goto(PORTAL_URL + '/login')
    await page.getByLabel(/email/i).fill(ownerEmail)
    await page.getByLabel(/password/i).fill(PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()

    await expect(page, 'New account should land on onboarding').toHaveURL(
      /\/onboarding/,
      { timeout: 15_000 },
    )

    // ── 3. Onboarding step 1 — country + mobile ──────────────────────────
    await page.getByRole('button', { name: /select your country/i }).click()
    await page.getByPlaceholder('Search country or dial code…').fill('Ireland')
    await page.getByRole('button', { name: /Ireland/i }).first().click()

    await page.getByPlaceholder('30 000 0000').fill('871234567')

    await page.getByRole('button', { name: /continue/i }).click()

    await expect(
      page.getByText('ADD TARGET URLS'),
      'Should advance to step 2',
    ).toBeVisible({ timeout: 10_000 })

    // ── 4. Onboarding step 2 — skip targets ─────────────────────────────
    await page.getByRole('button', { name: /skip for now/i }).click()

    await expect(
      page.getByText('COMPLIANCE OBLIGATIONS'),
      'Should advance to step 3',
    ).toBeVisible({ timeout: 5_000 })

    // ── 5. Onboarding step 3 — select DORA framework ─────────────────────
    // Each framework button contains a label <span> with the short name + a badge <span>.
    // Filter by a span with exactly "DORA" to avoid matching the badge text.
    await page.locator('button').filter({ has: page.locator('span', { hasText: /^DORA$/ }) }).click()
    await page.getByRole('button', { name: /save 1 framework/i }).click()

    await expect(
      page.getByText('INVITE YOUR SECURITY OFFICER'),
      'Should advance to step 4',
    ).toBeVisible({ timeout: 5_000 })

    // ── 6. Onboarding step 4 — skip invite (admin invited via API in step 8) ─
    // Sending an invite here triggers inviteUserByEmail which hits Supabase's
    // email-send rate limit in CI. Skip it; generate-invite-link creates the
    // auth user + invitation record without sending email.
    await page.getByRole('button', { name: /i'll do this later/i }).click()

    // ── 7. Should be on dashboard ────────────────────────────────────────
    await expect(page, 'Should land on dashboard after onboarding').toHaveURL(
      /\/dashboard/,
      { timeout: 15_000 },
    )

    // ── 8. Generate invite link (no UI equivalent) ───────────────────────
    const inviteRes = await request.get(
      `/api/test/generate-invite-link?email=${encodeURIComponent(adminEmail)}&ownerEmail=${encodeURIComponent(ownerEmail)}`,
      { headers: { 'x-test-secret': E2E_TEST_SECRET } },
    )
    const inviteBody = await inviteRes.json()
    expect(inviteRes.status(), `generate-invite-link failed (${inviteRes.status()}): ${JSON.stringify(inviteBody)}`).toBe(200)

    const { action_link } = inviteBody as { action_link: string }
    expect(action_link, 'action_link should be a non-empty string').toBeTruthy()

    // ── 9. Admin accepts invite ──────────────────────────────────────────
    // Playwright's Chromium can't resolve *.supabase.co directly (DNS restriction).
    // Use a staging-only proxy that server-side fetches the Supabase auth URL,
    // patches the redirect domain to the staging portal, and issues a normal redirect.
    const proxyUrl = `${PORTAL_URL}/api/test/proxy-invite-link?secret=${E2E_TEST_SECRET}&url=${encodeURIComponent(action_link)}`
    const acceptPagePromise = page.waitForURL(/\/invite\/accept/, { timeout: 20_000 })
    await page.goto(proxyUrl)
    await acceptPagePromise
    await page.waitForLoadState('load')

    await page.getByPlaceholder('Jane').fill('E2E')
    await page.getByPlaceholder('Smith').fill('Admin')
    await page.getByPlaceholder('At least 8 characters').fill(PASSWORD)
    await page.getByPlaceholder('Repeat your password').fill(PASSWORD)
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: /complete setup/i }).click()

    await expect(page, 'Admin should land on dashboard after setup').toHaveURL(
      /\/dashboard/,
      { timeout: 15_000 },
    )

    // ── 10. Verify admin portal access ───────────────────────────────────
    await page.waitForLoadState('load')

    await expect(page).not.toHaveURL(/\/login/)

    // UserAvatarMenu renders the role label ("Admin") in a small div inside the
    // header avatar button — always visible, no dropdown interaction needed.
    await expect(
      page.locator('header').getByText('Admin', { exact: true }),
      'Admin role label should be visible in portal header avatar button',
    ).toBeVisible()

    await page.goto('/dashboard/findings')
    await page.waitForLoadState('load')
    await expect(page, 'Admin should access findings').not.toHaveURL(/\/login/)

    await page.goto('/dashboard/audit')
    await page.waitForLoadState('load')
    await expect(page, 'Admin should access audit trail').not.toHaveURL(/\/login/)

  } finally {
    await request.delete('/api/test/cleanup-tenant', {
      data: { ownerEmail },
      headers: { 'x-test-secret': E2E_TEST_SECRET },
    }).catch(err => console.warn('⚠ Cleanup failed:', err))
  }
})
