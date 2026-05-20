# Registration & Onboarding E2E Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single `@flow` Playwright test that drives a real browser through the complete new-user lifecycle — website signup form → portal onboarding wizard → admin invite → admin first login → portal verification → tenant teardown.

**Architecture:** Three new files: two staging-only portal API endpoints (no auth required, blocked on production via `VERCEL_ENV`) and one Playwright spec. The playwright config gains a `registration-flow` project with empty storageState and 180s timeout. CI workflow gains a second job.

**Tech Stack:** Playwright 1.52, Next.js App Router, Supabase JS admin client, existing `e2e/` test infrastructure.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `app/api/test/generate-invite-link/route.ts` | Return Supabase invite action URL for an email without sending email |
| Create | `app/api/test/cleanup-tenant/route.ts` | Delete tenant + users + auth records by owner email |
| Create | `e2e/portal/flows/registration.spec.ts` | The end-to-end flow test |
| Modify | `e2e/playwright.config.ts` | Add `registration-flow` project + `WEBSITE_URL` |
| Modify | `e2e/.env.test` | Add `WEBSITE_URL` |
| Modify | `.github/workflows/export-flow.yml` | Add `registration-flow` CI job |

**Reference files** (read but do not modify):
- `app/api/test/last-email/route.ts` — pattern for staging-only endpoints
- `e2e/portal/flows/export.spec.ts` — pattern for `@flow` tests
- `app/onboarding/page.tsx` — UI element names / button text for onboarding selectors
- `app/invite/accept/page.tsx` — placeholder text for invite form selectors

---

## Task 1: `generate-invite-link` endpoint

**Files:**
- Create: `app/api/test/generate-invite-link/route.ts`

This endpoint is called by the test after the invite has been sent through the UI. It uses `supabase.auth.admin.generateLink` to produce a fresh invite URL for the already-created admin user, without triggering another email.

- [ ] **Step 1: Create the route file**

```typescript
// app/api/test/generate-invite-link/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  if (process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')
  if (!email) return NextResponse.json({ error: 'Missing email param' }, { status: 400 })

  const origin = `${req.nextUrl.protocol}//${req.nextUrl.host}`

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: {
      redirectTo: `${origin}/invite/confirm`,
    },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ action_link: data.properties.action_link })
}
```

- [ ] **Step 2: Smoke-test the endpoint manually against staging**

```bash
curl "https://staging-portal.breachr.ai/api/test/generate-invite-link?email=test1%40breachr.ai"
```

Expected on staging: `{"action_link":"https://hvdwvzgtfhgntdcnwheu.supabase.co/auth/v1/verify?..."}`
Expected on production: `{"error":"Not found"}` with HTTP 404

- [ ] **Step 3: Commit**

```bash
git add app/api/test/generate-invite-link/route.ts
git commit -m "feat(test): add generate-invite-link staging endpoint"
```

---

## Task 2: `cleanup-tenant` endpoint

**Files:**
- Create: `app/api/test/cleanup-tenant/route.ts`

Deletes all DB rows and Supabase auth records for a tenant identified by the owner's email. Called in the test's `finally` block. Idempotent — returns `{ ok: true }` if the tenant is already gone.

FK deletion order: `audit_logs` → `invitations` → `attack_surfaces` → `data_exports` → `users` → `tenants` → Supabase auth records.

- [ ] **Step 1: Create the route file**

```typescript
// app/api/test/cleanup-tenant/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function DELETE(req: NextRequest) {
  if (process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const { ownerEmail } = body as { ownerEmail?: string }
  if (!ownerEmail) return NextResponse.json({ error: 'Missing ownerEmail' }, { status: 400 })

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Find the tenant via the owner's users row
  const { data: ownerRow } = await admin
    .from('users')
    .select('tenant_id, supabase_uid')
    .eq('email', ownerEmail)
    .eq('role', 'account_owner')
    .maybeSingle()

  if (!ownerRow) return NextResponse.json({ ok: true }) // already cleaned up

  const tenantId = ownerRow.tenant_id

  // Collect all supabase_uid values before deleting users rows
  const { data: tenantUsers } = await admin
    .from('users')
    .select('supabase_uid')
    .eq('tenant_id', tenantId)

  const uids = (tenantUsers ?? []).map(u => u.supabase_uid as string).filter(Boolean)

  // Delete in FK-safe order
  await admin.from('audit_logs').delete().eq('tenant_id', tenantId)
  await admin.from('invitations').delete().eq('tenant_id', tenantId)
  await admin.from('attack_surfaces').delete().eq('tenant_id', tenantId)
  await admin.from('data_exports').delete().eq('tenant_id', tenantId)
  await admin.from('users').delete().eq('tenant_id', tenantId)
  await admin.from('tenants').delete().eq('id', tenantId)

  // Remove Supabase auth records last
  for (const uid of uids) {
    await admin.auth.admin.deleteUser(uid)
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Smoke-test the endpoint manually against staging**

```bash
# Should return 404 on production, { ok: true } on staging (idempotent even for unknown emails)
curl -X DELETE "https://staging-portal.breachr.ai/api/test/cleanup-tenant" \
  -H "Content-Type: application/json" \
  -d '{"ownerEmail":"nonexistent@example.com"}'
```

Expected: `{"ok":true}`

- [ ] **Step 3: Commit**

```bash
git add app/api/test/cleanup-tenant/route.ts
git commit -m "feat(test): add cleanup-tenant staging endpoint"
```

---

## Task 3: Playwright config + env

**Files:**
- Modify: `e2e/playwright.config.ts`
- Modify: `e2e/.env.test`

Add `WEBSITE_URL` env var and a new `registration-flow` Playwright project that starts with no auth cookies and a 180s per-test timeout.

- [ ] **Step 1: Add `WEBSITE_URL` to `.env.test`**

Open `e2e/.env.test` and add this line (ask the team for the correct staging website URL if unknown):

```
WEBSITE_URL="https://staging.breachr.ai"
```

- [ ] **Step 2: Update `e2e/playwright.config.ts`**

The current file defines `PORTAL_URL` and two projects (`portal-setup`, `portal`). Add `WEBSITE_URL` and the new project:

```typescript
// e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.join(__dirname, '.env.test') })

const PORTAL_URL  = process.env.PORTAL_URL  || 'https://staging.portal.breachr.ai'
const WEBSITE_URL = process.env.WEBSITE_URL || 'https://staging.breachr.ai'

export { WEBSITE_URL }

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
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
    {
      name: 'registration-flow',
      testMatch: 'portal/flows/registration.spec.ts',
      use: {
        baseURL: PORTAL_URL,
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] },
      },
    },
  ],
})
```

Note: The per-test timeout of 180s is set inside the test file with `test.setTimeout(180_000)`, not in the config. The config-level `timeout: 120_000` applies to all other tests only.

- [ ] **Step 3: Verify config parses correctly**

```bash
cd e2e && npx playwright --version
```

Expected: version string printed without errors.

- [ ] **Step 4: Commit**

```bash
git add e2e/playwright.config.ts e2e/.env.test
git commit -m "test(config): add registration-flow Playwright project and WEBSITE_URL"
```

---

## Task 4: Registration flow test

**Files:**
- Create: `e2e/portal/flows/registration.spec.ts`

This is the main test. It uses real browser interactions for every step except generating the invite link (which has no UI) and teardown.

Key selectors reference:
- Website form fields: use `#firstName`, `#lastName`, `#email`, `#password`, `#company` (id attributes on inputs in `RegistrationForm.tsx`)
- Onboarding country dropdown: custom `<button>` — opens a search input with placeholder `"Search country or dial code…"`
- Onboarding mobile: `<input type="tel" placeholder="30 000 0000">`
- Onboarding skip: `<button>Skip for now</button>`
- Onboarding DORA tile: `<button>` containing the text "DORA"
- Onboarding invite email: `<input type="email" placeholder="security@yourcompany.com">`
- Invite accept form: uses placeholder text — `"Jane"`, `"Smith"`, `"At least 8 characters"`, `"Repeat your password"` (no `htmlFor` on labels)

- [ ] **Step 1: Create the test file**

```typescript
// e2e/portal/flows/registration.spec.ts
import { test, expect } from '@playwright/test'

const WEBSITE_URL = process.env.WEBSITE_URL || 'https://staging.breachr.ai'
const PORTAL_URL  = process.env.PORTAL_URL  || 'https://staging.portal.breachr.ai'
const PASSWORD    = 'E2eBreachr@1!'

test('account owner registers → onboards → invites admin → admin first login @flow', async ({ page, request }) => {
  test.setTimeout(180_000)

  const runId      = Date.now()
  const ownerEmail = `e2e-owner-${runId}@breachr.ai`
  const adminEmail = `e2e-admin-${runId}@breachr.ai`

  try {

    // ── 1. Website registration form ────────────────────────────────────
    await page.goto(WEBSITE_URL + '/#register')
    await page.waitForLoadState('load')

    await page.locator('#firstName').fill('E2E')
    await page.locator('#lastName').fill('Owner')
    await page.locator('#email').fill(ownerEmail)
    await page.locator('#password').fill(PASSWORD)
    await page.locator('#company').fill(`E2E Test Co ${runId}`)
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

    // Dashboard page redirects to /onboarding when onboarding_complete=false
    await expect(page, 'New account should land on onboarding').toHaveURL(
      /\/onboarding/,
      { timeout: 15_000 },
    )

    // ── 3. Onboarding step 1 — country + mobile ──────────────────────────
    // Open country dropdown and select Ireland
    await page.getByRole('button', { name: /select your country/i }).click()
    await page.getByPlaceholder('Search country or dial code…').fill('Ireland')
    await page.getByRole('button', { name: /Ireland/i }).first().click()

    // Fill mobile number (dial code is auto-set from country)
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
    // The DORA tile is a <button> containing the text "DORA"
    await page.getByRole('button', { name: /^DORA$/i }).click()
    await page.getByRole('button', { name: /save 1 framework/i }).click()

    await expect(
      page.getByText('INVITE YOUR SECURITY OFFICER'),
      'Should advance to step 4',
    ).toBeVisible({ timeout: 5_000 })

    // ── 6. Onboarding step 4 — invite admin ──────────────────────────────
    await page.getByRole('textbox', { name: /admin email/i })
      .or(page.getByPlaceholder('security@yourcompany.com'))
      .fill(adminEmail)

    await page.getByRole('button', { name: /send invite/i }).click()

    await expect(
      page.getByText(/invite sent to/i),
      'Invite sent confirmation should appear',
    ).toBeVisible({ timeout: 15_000 })

    // ── 7. Finish onboarding ─────────────────────────────────────────────
    await page.getByRole('button', { name: /go to dashboard/i }).click()

    await expect(page, 'Should land on dashboard after onboarding').toHaveURL(
      /\/dashboard/,
      { timeout: 15_000 },
    )

    // ── 8. Generate invite link (no UI equivalent) ───────────────────────
    const inviteRes = await request.get(
      `/api/test/generate-invite-link?email=${encodeURIComponent(adminEmail)}`,
    )
    expect(inviteRes.status(), 'generate-invite-link should return 200').toBe(200)

    const { action_link } = await inviteRes.json() as { action_link: string }
    expect(action_link, 'action_link should be a non-empty string').toBeTruthy()

    // ── 9. Admin accepts invite ──────────────────────────────────────────
    // Navigating to the Supabase action_link:
    //   - Supabase processes the token and redirects to /invite/confirm
    //   - /invite/confirm signs out the current session (global scope), exchanges token
    //   - Then redirects to /invite/accept
    await page.goto(action_link)

    await expect(page, 'Should reach invite accept page').toHaveURL(
      /\/invite\/accept/,
      { timeout: 20_000 },
    )

    // Fill name + password (labels use inline styles without htmlFor — use placeholders)
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

    // Not bounced to login
    await expect(page).not.toHaveURL(/\/login/)

    // Role badge shows "Admin" in the header
    await expect(
      page.getByText(/admin/i).first(),
      'Admin role should be visible in portal header',
    ).toBeVisible()

    // Findings page accessible to admin
    await page.goto('/dashboard/findings')
    await page.waitForLoadState('load')
    await expect(page, 'Admin should access findings').not.toHaveURL(/\/login/)

    // Audit trail accessible to admin
    await page.goto('/dashboard/audit')
    await page.waitForLoadState('load')
    await expect(page, 'Admin should access audit trail').not.toHaveURL(/\/login/)

  } finally {
    // ── Cleanup — runs even on failure ──────────────────────────────────
    // At this point the page may be authenticated as the admin (owner session
    // was signed out globally during /invite/confirm). The cleanup endpoint
    // uses the service role key and requires no auth cookie.
    await request.delete('/api/test/cleanup-tenant', {
      data: { ownerEmail },
    }).catch(err => console.warn('⚠ Cleanup failed:', err))
  }
})
```

- [ ] **Step 2: Run the test dry against staging**

```bash
cd e2e && npx playwright test portal/flows/registration.spec.ts \
  --project=registration-flow --reporter=line
```

Expected first run: likely fails at step 8 (`generate-invite-link` not yet deployed) or step 9 (invite/confirm redirect). Use `--headed` to watch the browser.

- [ ] **Step 3: Iterate until green**

Common failure points and fixes:
- "Account created" not visible → check `WEBSITE_URL` is the correct staging URL
- `toHaveURL(/\/onboarding/)` fails → new account may have `onboarding_complete=true` from a previous run with same email (shouldn't happen with timestamp emails, but verify cleanup ran)
- `generate-invite-link` returns 500 → deploy Task 1 first
- `/invite/accept` redirect times out → Supabase may be rate-limiting invite links; wait a moment and retry

- [ ] **Step 4: Commit once green**

```bash
git add e2e/portal/flows/registration.spec.ts
git commit -m "test(e2e): add registration → onboarding → invite flow test"
```

---

## Task 5: CI workflow

**Files:**
- Modify: `.github/workflows/export-flow.yml`

Add a second job that runs the registration flow test. It needs `PORTAL_URL`, `WEBSITE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` (the test endpoints use service role internally, so no extra secret needed by the test runner).

`WEBSITE_URL` must be added as a GitHub Actions secret (`STAGING_WEBSITE_URL`).

- [ ] **Step 1: Update `.github/workflows/export-flow.yml`**

Add this job after the existing `export-flow` job:

```yaml
  registration-flow:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: e2e/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: e2e

      - name: Install Playwright browsers
        run: npx playwright install chromium --with-deps
        working-directory: e2e

      - name: Run registration flow test
        run: npx playwright test portal/flows/registration.spec.ts --project=registration-flow --reporter=list
        working-directory: e2e
        env:
          PORTAL_URL:   ${{ secrets.STAGING_PORTAL_URL }}
          WEBSITE_URL:  ${{ secrets.STAGING_WEBSITE_URL }}

      - name: Upload report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: registration-flow-report
          path: |
            e2e/playwright-report/
            e2e/test-results/
          retention-days: 7
```

- [ ] **Step 2: Add `STAGING_WEBSITE_URL` secret in GitHub**

Go to: `https://github.com/gjdbradford/breachr-portal/settings/secrets/actions`

Add secret: `STAGING_WEBSITE_URL` = the staging website URL (same value as `WEBSITE_URL` in `.env.test`)

- [ ] **Step 3: Push and verify CI**

```bash
git add .github/workflows/export-flow.yml
git commit -m "ci: add registration-flow job to export-flow workflow"
git push
```

Watch the Actions run. Both jobs (`export-flow` and `registration-flow`) should pass.

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Website registration form → Task 4 step 1
- ✅ Portal login → Task 4 step 2
- ✅ Onboarding step 1 (country + mobile) → Task 4 step 3
- ✅ Onboarding step 2 skip → Task 4 step 4
- ✅ Onboarding step 3 (DORA) → Task 4 step 5
- ✅ Onboarding step 4 (invite admin) → Task 4 step 6
- ✅ Finish onboarding → Task 4 step 7
- ✅ Generate invite link endpoint → Task 1 + Task 4 step 8
- ✅ Admin accepts invite → Task 4 step 9
- ✅ Admin portal verification → Task 4 step 10
- ✅ Cleanup endpoint → Task 2 + Task 4 finally
- ✅ CI integration → Task 5
- ✅ Playwright config → Task 3

**Notes for the implementer:**
- The `registration-flow` project does NOT depend on `portal-setup`. It creates its own account and signs in from scratch.
- The `request` fixture in the test has no cookies (empty storageState). The two API calls it makes (`generate-invite-link`, `cleanup-tenant`) are designed to work without auth.
- After step 9 (`/invite/confirm` does a global signout), the owner's session is gone. The `request` fixture is unaffected because it never had auth cookies to begin with.
- The `WEBSITE_URL` must point to a deployment that has the `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars set (the website's `/api/register` route uses them). Confirm this with the Vercel dashboard.
