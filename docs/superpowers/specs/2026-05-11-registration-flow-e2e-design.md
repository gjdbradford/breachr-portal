# Registration & Onboarding E2E Flow — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** A single critical-path Playwright `@flow` test that drives a real browser through the complete new-user lifecycle — website signup → portal login → onboarding wizard → admin invite → admin first login → portal verification → teardown.

**Architecture:** One test file, no stored auth state, 180s timeout. Two staging-only portal API endpoints for the two steps that have no UI equivalent (generating the invite link, cleaning up the created tenant). Everything else is real browser interaction.

**Tech Stack:** Playwright 1.52, Next.js App Router, Supabase auth admin API, existing `webhook_events` / Resend infrastructure.

---

## Scope

Covers exactly one user journey end-to-end. Does not test permissions edge cases, billing, or scan launch — those belong in separate flow tests.

---

## New Files

| Path | Purpose |
|---|---|
| `e2e/portal/flows/registration.spec.ts` | The test |
| `app/api/test/generate-invite-link/route.ts` | Staging-only: generate Supabase invite URL without sending email |
| `app/api/test/cleanup-tenant/route.ts` | Staging-only: delete tenant + users + auth records |

## Modified Files

| Path | Change |
|---|---|
| `e2e/playwright.config.ts` | Add `registration-flow` project — no storageState, 180s timeout, reads `WEBSITE_URL` |
| `e2e/.env.test` | Add `WEBSITE_URL=<staging website URL>` (to be confirmed) |

---

## API Endpoints

### `GET /api/test/generate-invite-link`

Blocked on `VERCEL_ENV === 'production'` (returns 404). No session auth required — uses service role key directly.

Query params:
- `email` — the invited admin's email address

Implementation:
1. Return 404 if `VERCEL_ENV === 'production'`
2. Validate `email` param present
3. Call `supabase.auth.admin.generateLink({ type: 'invite', email, options: { redirectTo: '${origin}/invite/confirm' } })`
4. Return `{ action_link: string }`

The `generateLink` call generates a new OTP token for the already-invited user (created by `inviteUserByEmail` during the onboarding step). Existing `user_metadata` (including `invited_tenant_id` and `role`) is preserved.

### `DELETE /api/test/cleanup-tenant`

Blocked on `VERCEL_ENV === 'production'` (returns 404). No session auth required — uses service role key directly.

Body: `{ ownerEmail: string }`

Implementation (order matters for FK constraints):
1. Return 404 if `VERCEL_ENV === 'production'`
2. Look up tenant by owner email: `users` where `email = ownerEmail AND role = 'account_owner'`
3. Get all `users` rows for that `tenant_id` — collect `supabase_uid` values
4. Delete `audit_logs` where `tenant_id = ...`
5. Delete `invitations` where `tenant_id = ...`
6. Delete `users` where `tenant_id = ...`
7. Delete `tenants` where `id = ...`
8. For each `supabase_uid`: `supabase.auth.admin.deleteUser(uid)`
9. Return `{ ok: true }`

If owner email not found (already cleaned up), return `{ ok: true }` — idempotent.

---

## Playwright Config Changes

New project in `playwright.config.ts`:

```typescript
{
  name: 'registration-flow',
  testMatch: 'portal/flows/registration.spec.ts',
  use: {
    baseURL: PORTAL_URL,
    ...devices['Desktop Chrome'],
    storageState: { cookies: [], origins: [] }, // no pre-auth
  },
  timeout: 180_000,
}
```

`WEBSITE_URL` added to the config's env resolution (same pattern as `PORTAL_URL`).

---

## Test Flow

File: `e2e/portal/flows/registration.spec.ts`

```
test('account owner registers → onboards → invites admin → admin first login @flow')
```

Tagged `@flow`. Single `try/finally` block with cleanup in `finally`.

### Step 1 — Website registration

```
page.goto(WEBSITE_URL + '/#register')
fill: firstName="E2E", lastName="Owner"
fill: email=ownerEmail, password=password
fill: company="E2E Test Co {runId}", companySize="1-10", industry="other"
click: "Start Free — No Card Required →"
expect: "Account created" text visible
```

The website `/api/register` route creates the Supabase auth user with `email_confirm: true` (no email verification step required), creates the tenant row, creates the `users` row with `role: 'account_owner'`.

### Step 2 — Portal login

```
page.goto(PORTAL_URL + '/login')
fill email + password
click: Sign In
expect: URL → /onboarding  (onboarding_complete=false redirects here)
```

### Step 3 — Onboarding step 1 (country + mobile)

```
click country dropdown
type "Ireland" in search → select Ireland
fill mobile: "87 123 4567"
click: Continue →
expect: step 2 form visible (target URLs heading)
```

### Step 4 — Onboarding step 2 (targets)

```
click: Skip for now
```

### Step 5 — Onboarding step 3 (compliance frameworks)

```
click: DORA tile (toggles selection)
click: Save 1 framework →
```

### Step 6 — Onboarding step 4 (invite admin)

```
fill: admin email input with adminEmail
click: Send Invite →
expect: "Invite sent to {adminEmail}" confirmation visible
```

This calls `POST /api/team/invite` which:
- Creates the Supabase auth user for the admin via `inviteUserByEmail`
- Writes the `invitations` row to DB
- Sets `user_metadata.invited_tenant_id` and `user_metadata.role = 'admin'`

### Step 7 — Finish onboarding

```
click: Go to Dashboard →
expect: URL → /dashboard
```

### Step 8 — Generate invite link (API)

```
GET ${PORTAL_URL}/api/test/generate-invite-link?email={adminEmail}
expect: 200
capture: action_link
```

No UI equivalent exists for this step — Supabase sends the invite link via its own email delivery, not Resend. The test endpoint generates a fresh token without sending email.

### Step 9 — Admin accepts invite

```
page.goto(action_link)
```

`/invite/confirm` calls `supabase.auth.signOut({ scope: 'global' })` then exchanges the token → sets admin session → redirects to `/invite/accept`.

```
expect: URL → /invite/accept  (timeout 20s)
fill: First name = "E2E"
fill: Last name = "Admin"
fill: Set password = password
fill: Confirm password = password
check: ToS checkbox
click: Complete Setup →
expect: URL → /dashboard  (timeout 15s)
```

`/api/team/accept-invite` creates the `users` row for the admin in the tenant and marks the invitation accepted.

### Step 10 — Verify admin portal access

```
page.waitForLoadState('load')
expect: page.url() does not match /login
expect: body text matches /admin/i  (role badge in header)

page.goto('/dashboard/findings')
expect: URL does not match /login

page.goto('/dashboard/audit')
expect: URL does not match /login
```

### Cleanup (finally)

```
DELETE ${PORTAL_URL}/api/test/cleanup-tenant
body: { ownerEmail }
```

Called regardless of test outcome. Idempotent — safe to call even if the test failed partway through (endpoint handles missing tenant gracefully).

---

## Unique Email Strategy

```typescript
const runId    = Date.now()
const ownerEmail = `e2e-owner-${runId}@breachr.ai`
const adminEmail = `e2e-admin-${runId}@breachr.ai`
const password   = 'E2eBreachr@1!'
```

Timestamp-based emails avoid collisions between parallel CI runs. Cleanup removes them immediately after. No inbox needed — owner welcome email and admin invite email are both fire-and-forget (Resend / Supabase SMTP); neither is asserted in this test.

---

## CI Integration

The existing `export-flow.yml` GitHub Actions workflow triggers on `feat/**` pushes. The registration flow test will be added to the same workflow as a second job (or extended step) so both critical-path flows run on every push.

Timeout for the registration job: 10 minutes.

---

## What This Does NOT Test

- Email delivery of welcome / invite emails (covered by export flow's Resend assertions)
- Permission boundaries for the admin role (separate permissions test)
- Scan launch, findings, or billing flows (separate flow tests)
- Error states: wrong password, duplicate email, expired invite link
