# Settings — Profile & Compliance Design Spec
**Date:** 2026-05-05
**Status:** Approved

## Overview

Add a `/dashboard/settings` page with two tabs: **Profile** and **Compliance**. Profile lets the account owner edit company details and trigger a password reset. Compliance lets them view and update their selected regulatory frameworks (DORA, NIS2, PCI-DSS) post-onboarding.

No new database columns are required — all fields already exist on `tenants` and `users`.

---

## 1. Navigation

Add a "Settings" link to `components/DashboardNav.tsx`, below the Audit Trail entry:

```typescript
{ href: '/dashboard/settings', label: 'Settings', icon: '⚙' }
```

---

## 2. Architecture

### Route
`/dashboard/settings`

### File map

| File | Action | Responsibility |
|------|--------|---------------|
| `app/dashboard/settings/page.tsx` | Create | Server component — fetches tenant + user data, renders `SettingsTabs` |
| `components/settings/SettingsTabs.tsx` | Create | Client component — tab switcher (Profile / Compliance) |
| `components/settings/ProfileTab.tsx` | Create | Client component — company form + personal section |
| `components/settings/ComplianceTab.tsx` | Create | Client component — framework checkboxes |
| `components/DashboardNav.tsx` | Modify | Add Settings nav link |

### Data flow

`page.tsx` (server) fetches:
- `tenants` row for the current user's `tenant_id`: `name`, `industry`, `company_size`, `country`, `compliance_frameworks`
- `users` row for the current user: `email`, `role`

Passes both as props to `SettingsTabs` (client). All mutations happen client-side via `createClient()` (browser Supabase client).

---

## 3. Profile Tab

### Company section

Fields (all editable):

| Field | Column | Input type |
|-------|--------|-----------|
| Company name | `tenants.name` | text input |
| Industry | `tenants.industry` | select: Banking, Insurance, Payments, HealthTech, Energy, Other |
| Company size | `tenants.company_size` | select: 1–10, 11–50, 51–200, 201–1,000, 1,000+ |
| Country | `tenants.country` | text input |

Single "Save changes" button — one `UPDATE tenants SET ... WHERE id = tenant_id` call covering all four fields.

Success: inline green confirmation "Changes saved". Error: inline red error message.

### Personal section

Displayed below company section, separated by a divider.

| Field | Source | Editable |
|-------|--------|---------|
| Email | `users.email` | No — displayed read-only |
| Role | `users.role` | No — displayed as badge (ADMIN / MEMBER) |

**Change password:** A "Send password reset email" button calls `supabase.auth.resetPasswordForEmail(email)`. On success, replace button text with "Reset email sent ✓" for 3 seconds, then restore. On error, show inline error.

---

## 4. Compliance Tab

Three checkbox cards — identical UI to onboarding Step 3.

Pre-checked from `tenants.compliance_frameworks` passed as prop from server.

| Framework | Full name | Description |
|-----------|-----------|-------------|
| DORA | EU Digital Operational Resilience Act | Mandatory for financial entities operating in the EU. |
| NIS2 | EU Network & Information Security Directive | Applies to essential and important sector entities. |
| PCI-DSS | Payment Card Industry Data Security Standard | Required if you process, store or transmit card data. |

User can select any combination (including none).

"Save changes" button → `UPDATE tenants SET compliance_frameworks = $1 WHERE id = tenant_id`.

Success: inline "Changes saved". Error: inline error.

Below the checkboxes, a static info note:
> Changes take effect on your next scan. Existing reports are not modified.

---

## 5. What's Not In Scope (v1)

- Billing tab (Stripe portal — deferred to Sub-project C)
- Team tab (invite / manage users — deferred to Sub-project D)
- Account / danger zone tab (GDPR erasure, account deletion — deferred)
- Email change (Supabase Auth handles via separate flow)
- Two-factor authentication
