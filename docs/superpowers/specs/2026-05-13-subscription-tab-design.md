# Subscription Tab — Design Spec

**Date:** 2026-05-13  
**Status:** Approved

---

## Overview

Add a **Subscription** tab to the Settings page that shows the current tenant's package and surfaces the right upgrade CTA based on that package. All users (account owner, admin, member) see the same information — the package belongs to the tenant and is paid for by the account owner.

---

## Data Model

Package data is stored across two tables:

- `tenant_packages (tenant_id, package_id, assigned_at)` — links a tenant to a package
- `packages (id, name, slug, price_monthly, scans_limit, tokens_limit, targets_limit, status)` — the package definition

**Fallback:** If no `tenant_packages` row exists, fall back to the `plan` field on the `tenants` table (e.g. `freemium`). Match this slug to the packages table by `slug = tenants.plan`.

**Account owner lookup:** Query `public.users` for the row in the same tenant with `role = 'account_owner'` to display as the billing contact.

Active packages (4): `freemium`, `starter`, `professional`, `enterprise`.

---

## Data Fetching

Fetched server-side in `app/dashboard/settings/page.tsx`, passed as a prop to `SettingsTabs`.

```
1. Join tenant_packages → packages for the current tenant_id
2. If no row: fall back to SELECT from packages WHERE slug = tenants.plan
3. SELECT email, first_name, last_name FROM public.users WHERE tenant_id = ? AND role = 'account_owner' LIMIT 1
```

Prop shape passed into `SettingsTabs` and down to `SubscriptionTab`:

```ts
type SubscriptionData = {
  packageName:    string        // e.g. "PROFESSIONAL"
  packageSlug:    string        // e.g. "professional"
  priceMonthly:   number        // cents/EUR — 0 for freemium/enterprise
  scansLimit:     number | null
  tokensLimit:    number | null
  targetsLimit:   number | null
  assignedAt:     string | null // ISO date, null if fallback
  ownerEmail:     string
  ownerName:      string | null
}
```

---

## UI — SubscriptionTab Component

New file: `components/settings/SubscriptionTab.tsx`

### Layout

```
┌─────────────────────────────────────────────────┐
│  CURRENT PLAN                                   │
│  ┌──────────────────────────────────────────┐   │
│  │  [PROFESSIONAL]  €457/month              │   │
│  │                                          │   │
│  │  Scans/month    100                      │   │
│  │  Scan targets   50                       │   │
│  │  AI tokens      500,000                  │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  BILLING CONTACT                                │
│  Graham Bradford · graham@breachr.ai            │
│                                                 │
│  [CTA button — see table below]                 │
└─────────────────────────────────────────────────┘
```

**Price display:** Show `€{price}/month` for paid tiers. Show `Free` for freemium. Show `Custom pricing` for enterprise.

**Limits display:** Show numeric value if set; show `Unlimited` if null.

### Upgrade CTAs by Package Slug

| Slug | CTA label | Action |
|---|---|---|
| `freemium` | Upgrade Plan → | `mailto:sales@breachr.ai?subject=Plan upgrade enquiry` |
| `starter` | Upgrade Plan → | `mailto:sales@breachr.ai?subject=Plan upgrade enquiry` |
| `professional` | Upgrade to Enterprise — Speak to Sales → | `mailto:sales@breachr.ai?subject=Enterprise plan enquiry` |
| `enterprise` | Speak to Sales → | `mailto:sales@breachr.ai?subject=Enterprise plan enquiry` |

CTA rendered as a styled anchor (`<a href="mailto:...">`) matching the existing button style in `UpgradePlanCards.tsx`.

---

## Settings Tab Integration

### `SettingsTabs.tsx`

- Add `'subscription'` to the `Tab` union type
- Add label `'Subscription'` to `TAB_LABELS`
- Show tab for **all roles** (owner, admin, member)
- Render `<SubscriptionTab data={subscription} />` when active

### `settings/page.tsx`

- Add server-side fetch for subscription data (tenant_packages → packages + owner lookup)
- Pass as `subscription` prop to `SettingsTabs`

---

## Error / Empty States

- If package lookup returns nothing and `tenants.plan` is also unset: show "No plan assigned — contact support."
- If owner lookup returns no row: omit the billing contact section rather than erroring.

---

## Out of Scope

- Stripe integration or self-serve checkout
- Upgrade flow within the portal
- Plan comparison table
- Billing history or invoices
