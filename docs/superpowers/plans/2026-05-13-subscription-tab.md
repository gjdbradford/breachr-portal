# Subscription Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Subscription tab to Settings that shows the tenant's current package and a tier-appropriate sales CTA.

**Architecture:** Server-side data fetch in `settings/page.tsx` (using the admin client, since `tenant_packages` has no user-level RLS). Data passed as a prop to `SettingsTabs`, which renders a new `SubscriptionTab` component. Read-only display — no mutations.

**Tech Stack:** Next.js 15 server components, Supabase admin client, inline styles (matching existing settings tab pattern).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `components/settings/SubscriptionTab.tsx` | **Create** | Renders package card + billing contact + CTA |
| `components/settings/SettingsTabs.tsx` | **Modify** | Adds `subscription` tab + passes `SubscriptionData` prop |
| `app/dashboard/settings/page.tsx` | **Modify** | Fetches package + owner data, passes to SettingsTabs |

---

### Task 1: Create `SubscriptionTab` component

**Files:**
- Create: `components/settings/SubscriptionTab.tsx`

- [ ] **Step 1: Create the file with the full component**

```tsx
'use client'

export type SubscriptionData = {
  packageName:  string
  packageSlug:  string
  priceMonthly: number
  scansLimit:   number | null
  tokensLimit:  number | null
  targetsLimit: number | null
  ownerEmail:   string | null
  ownerName:    string | null
}

const SALES_EMAIL = 'sales@breachr.ai'

const UPGRADE_CTA: Record<string, { label: string; subject: string }> = {
  freemium:     { label: 'Upgrade Plan →',                           subject: 'Plan upgrade enquiry'    },
  starter:      { label: 'Upgrade Plan →',                           subject: 'Plan upgrade enquiry'    },
  professional: { label: 'Upgrade to Enterprise — Speak to Sales →', subject: 'Enterprise plan enquiry' },
  enterprise:   { label: 'Speak to Sales →',                         subject: 'Enterprise plan enquiry' },
}

function fmtLimit(n: number | null) {
  return n === null ? 'Unlimited' : n.toLocaleString()
}

function fmtPrice(slug: string, price: number) {
  if (slug === 'freemium') return 'Free'
  if (slug === 'enterprise') return 'Custom pricing'
  return `€${price.toLocaleString()}/month`
}

export default function SubscriptionTab({ data }: { data: SubscriptionData }) {
  const cta = UPGRADE_CTA[data.packageSlug] ?? UPGRADE_CTA.enterprise

  return (
    <div style={{ maxWidth: 520 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
        Current Plan
      </p>

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 4,
            background: 'rgba(59,130,246,0.1)', color: '#60a5fa',
            border: '1px solid rgba(59,130,246,0.2)', letterSpacing: '0.08em',
          }}>
            {data.packageName}
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>
            {fmtPrice(data.packageSlug, data.priceMonthly)}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {([
            ['Scans / month', fmtLimit(data.scansLimit)],
            ['Scan targets',  fmtLimit(data.targetsLimit)],
            ['AI tokens',     fmtLimit(data.tokensLimit)],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: '10px 12px' }}>
              <p style={{ margin: '0 0 4px', fontSize: 10, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#94a3b8' }}>{value}</p>
            </div>
          ))}
        </div>
      </div>

      {(data.ownerEmail || data.ownerName) && (
        <>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#64748b', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
            Billing Contact
          </p>
          <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 24 }}>
            {data.ownerName ? `${data.ownerName} · ` : ''}{data.ownerEmail}
          </p>
        </>
      )}

      <a
        href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent(cta.subject)}`}
        style={{
          display: 'inline-block', padding: '10px 22px',
          background: 'linear-gradient(135deg,#1565c0,#1976d2)',
          color: '#fff', fontSize: 13, fontWeight: 600,
          textDecoration: 'none', borderRadius: 8,
        }}
      >
        {cta.label}
      </a>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd /path/to/portal && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/settings/SubscriptionTab.tsx
git commit -m "feat(settings): add SubscriptionTab component"
```

---

### Task 2: Wire subscription tab into `SettingsTabs`

**Files:**
- Modify: `components/settings/SettingsTabs.tsx`

- [ ] **Step 1: Add import and extend the Tab type**

Add to the top of the file (after existing imports):

```tsx
import SubscriptionTab, { type SubscriptionData } from './SubscriptionTab'
```

Change line 9:
```tsx
// Before
type Tab = 'profile' | 'compliance' | 'team' | 'permissions'

// After
type Tab = 'profile' | 'compliance' | 'team' | 'permissions' | 'subscription'
```

- [ ] **Step 2: Add the label**

```tsx
// Before
const TAB_LABELS: Record<Tab, string> = {
  profile:     'Profile',
  compliance:  'Compliance',
  team:        'Team',
  permissions: 'Permissions',
}

// After
const TAB_LABELS: Record<Tab, string> = {
  profile:      'Profile',
  compliance:   'Compliance',
  team:         'Team',
  permissions:  'Permissions',
  subscription: 'Subscription',
}
```

- [ ] **Step 3: Add `subscription` prop to component signature**

```tsx
// Before
export default function SettingsTabs({
  tenant,
  user,
  tenantId,
  currentUserId,
  canInvite,
  showTeam = true,
}: {
  tenant: TenantProfile & { compliance_frameworks: string[] }
  user: UserProfile
  tenantId: string
  currentUserId: string
  canInvite?: boolean
  showTeam?: boolean
})

// After
export default function SettingsTabs({
  tenant,
  user,
  tenantId,
  currentUserId,
  canInvite,
  showTeam = true,
  subscription,
}: {
  tenant: TenantProfile & { compliance_frameworks: string[] }
  user: UserProfile
  tenantId: string
  currentUserId: string
  canInvite?: boolean
  showTeam?: boolean
  subscription: SubscriptionData
})
```

- [ ] **Step 4: Add subscription to both tab lists (owner and non-owner)**

```tsx
// Before
const tabs: Tab[] = isOwner
  ? ['profile', 'compliance', 'team', 'permissions']
  : (['profile', 'compliance', showTeam ? 'team' : null] as Array<Tab | null>).filter((t): t is Tab => t !== null)

// After
const tabs: Tab[] = isOwner
  ? ['profile', 'compliance', 'team', 'permissions', 'subscription']
  : (['profile', 'compliance', showTeam ? 'team' : null, 'subscription'] as Array<Tab | null>).filter((t): t is Tab => t !== null)
```

- [ ] **Step 5: Render the tab**

Add after the `permissions` render line:

```tsx
{activeTab === 'subscription' && <SubscriptionTab data={subscription} />}
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: error on `settings/page.tsx` — `subscription` prop missing. That's fine; fixed in Task 3.

- [ ] **Step 7: Commit**

```bash
git add components/settings/SettingsTabs.tsx
git commit -m "feat(settings): add subscription tab to SettingsTabs"
```

---

### Task 3: Fetch subscription data in `settings/page.tsx`

**Files:**
- Modify: `app/dashboard/settings/page.tsx`

- [ ] **Step 1: Add admin client import**

```tsx
// Add after existing imports (line 4)
import { createClient as adminClient } from '@supabase/supabase-js'
import type { SubscriptionData } from '@/components/settings/SubscriptionTab'
```

- [ ] **Step 2: Add subscription data fetch**

Add `plan` to the existing tenant select, and add the subscription queries. Replace the existing `const [{ data: tenant }, resolved]` block with:

```tsx
const admin = adminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const [{ data: tenant }, resolved, { data: tpRow }, { data: owner }] = await Promise.all([
  supabase
    .from('tenants')
    .select('name, industry, company_size, country, timezone, compliance_frameworks, plan')
    .eq('id', profile.tenant_id)
    .single(),
  resolvePermissions(user.id),
  admin
    .from('tenant_packages')
    .select('package:packages(name, slug, price_monthly, scans_limit, tokens_limit, targets_limit)')
    .eq('tenant_id', profile.tenant_id)
    .maybeSingle(),
  admin
    .from('users')
    .select('email, first_name, last_name')
    .eq('tenant_id', profile.tenant_id)
    .eq('role', 'account_owner')
    .maybeSingle(),
])
```

- [ ] **Step 3: Build the `SubscriptionData` object**

Add after the `Promise.all` block, before the `tenantData` line:

```tsx
const pkg = (tpRow as any)?.package ?? null

let subscription: SubscriptionData

if (pkg) {
  subscription = {
    packageName:  pkg.name,
    packageSlug:  pkg.slug,
    priceMonthly: pkg.price_monthly,
    scansLimit:   pkg.scans_limit,
    tokensLimit:  pkg.tokens_limit,
    targetsLimit: pkg.targets_limit,
    ownerEmail:   owner?.email ?? null,
    ownerName:    owner?.first_name && owner?.last_name
      ? `${owner.first_name} ${owner.last_name}`
      : owner?.first_name ?? null,
  }
} else {
  // No tenant_packages row — fall back to tenants.plan slug
  const planSlug = (tenant as any)?.plan ?? 'freemium'
  const { data: fallbackPkg } = await admin
    .from('packages')
    .select('name, slug, price_monthly, scans_limit, tokens_limit, targets_limit')
    .eq('slug', planSlug)
    .maybeSingle()

  subscription = {
    packageName:  fallbackPkg?.name ?? planSlug.toUpperCase(),
    packageSlug:  fallbackPkg?.slug ?? planSlug,
    priceMonthly: fallbackPkg?.price_monthly ?? 0,
    scansLimit:   fallbackPkg?.scans_limit ?? null,
    tokensLimit:  fallbackPkg?.tokens_limit ?? null,
    targetsLimit: fallbackPkg?.targets_limit ?? null,
    ownerEmail:   owner?.email ?? null,
    ownerName:    owner?.first_name && owner?.last_name
      ? `${owner.first_name} ${owner.last_name}`
      : owner?.first_name ?? null,
  }
}
```

- [ ] **Step 4: Pass `subscription` prop to `SettingsTabs`**

```tsx
// Before
<SettingsTabs
  tenant={tenantData}
  user={userData}
  tenantId={profile.tenant_id}
  currentUserId={user.id}
  canInvite={resolved['team.invite']}
  showTeam={resolved['team.read']}
/>

// After
<SettingsTabs
  tenant={tenantData}
  user={userData}
  tenantId={profile.tenant_id}
  currentUserId={user.id}
  canInvite={resolved['team.invite']}
  showTeam={resolved['team.read']}
  subscription={subscription}
/>
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit and push**

```bash
git add app/dashboard/settings/page.tsx
git commit -m "feat(settings): fetch and display subscription data in settings"
git push origin main
```

---

### Task 4: Verify on staging

- [ ] **Step 1: Wait for Vercel deploy (~1 min), then open `staging-portal.breachr.ai/dashboard/settings`**

- [ ] **Step 2: Click the Subscription tab — verify:**
  - Package name badge displayed (should show FREEMIUM for GB1 tenant)
  - Price shown as "Free"
  - Scans, targets, tokens limits shown (Unlimited if null)
  - Billing contact shows graham@breachr.ai
  - "Upgrade Plan →" CTA is shown and links to `mailto:sales@breachr.ai?subject=Plan%20upgrade%20enquiry`

- [ ] **Step 3: Verify tab is visible for both `graham@breachr.ai` (owner) and `test1@breachr.ai` (admin)**
