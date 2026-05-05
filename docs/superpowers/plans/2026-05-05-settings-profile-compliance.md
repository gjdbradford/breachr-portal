# Settings — Profile & Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/dashboard/settings` with two tabs — Profile (company + personal details, password reset) and Compliance (DORA/NIS2/PCI-DSS selection) — plus a standalone `/auth/reset-password` page.

**Architecture:** Server component at `app/dashboard/settings/page.tsx` fetches tenant+user data and passes it to a client `SettingsTabs` component that handles tab switching. Each tab is its own focused client component. Password reset is a separate auth page outside the dashboard layout, matching the existing `/auth/confirm` pattern.

**Tech Stack:** Next.js 15 App Router, Supabase (browser + server clients), TypeScript

---

## Codebase context (read before implementing)

- Server components import `createClient` from `@/lib/supabase/server` and call `await createClient()`
- Client components import `createClient` from `@/lib/supabase/client` and call `createClient()` (no await)
- `app/dashboard/layout.tsx` wraps all dashboard pages — auth and nav are handled there; settings page just renders its content
- CSS classes in use: `portal-content`, `portal-header`, `gs au1` (card), `form-label`, `form-input`, `btn-p`, `btn-s`
- `app/auth/confirm/page.tsx` is the reference pattern for standalone auth pages (reads hash, calls `setSession`)
- `DashboardNav` uses a top-level `links` const array — just append to it

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `components/DashboardNav.tsx` | Modify | Add Settings nav link |
| `app/dashboard/settings/page.tsx` | Create | Server component — fetches tenant + user, renders SettingsTabs |
| `components/settings/SettingsTabs.tsx` | Create | Client — tab switcher (Profile / Compliance) |
| `components/settings/ProfileTab.tsx` | Create | Client — company form + personal section + password reset trigger |
| `components/settings/ComplianceTab.tsx` | Create | Client — framework checkboxes + save |
| `app/auth/reset-password/page.tsx` | Create | Client — reads hash, sets session, shows new password form |

---

## Task 1: Add Settings link to sidebar nav

**Files:**
- Modify: `components/DashboardNav.tsx`

- [ ] **Step 1: Add the link**

In `components/DashboardNav.tsx`, find the `links` array (lines 9–15). Add one entry at the end:

```typescript
const links = [
  { href: '/dashboard',          label: 'Overview',    icon: '◈' },
  { href: '/dashboard/targets',  label: 'Targets',     icon: '◎' },
  { href: '/dashboard/scans',    label: 'Scans',       icon: '⟳' },
  { href: '/dashboard/findings', label: 'Findings',    icon: '⚠' },
  { href: '/dashboard/reports',  label: 'Reports',     icon: '▤' },
  { href: '/dashboard/audit',    label: 'Audit Trail', icon: '⛓' },
  { href: '/dashboard/settings', label: 'Settings',    icon: '⚙' },
]
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal
npx tsc --noEmit 2>&1 | grep "DashboardNav"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/DashboardNav.tsx
git commit -m "feat: add Settings link to dashboard nav"
```

---

## Task 2: Create the ComplianceTab component

**Files:**
- Create: `components/settings/ComplianceTab.tsx`

Build this first — it has no dependencies on other new components.

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p /Users/grahamjohn/Documents/GitHub/breachr/portal/components/settings
```

Create `components/settings/ComplianceTab.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const ALL_FRAMEWORKS = ['DORA', 'NIS2', 'PCI-DSS'] as const
type Framework = typeof ALL_FRAMEWORKS[number]

const FRAMEWORK_LABELS: Record<Framework, { name: string; description: string }> = {
  'DORA':    { name: 'DORA',    description: 'EU Digital Operational Resilience Act — mandatory for financial entities operating in the EU.' },
  'NIS2':    { name: 'NIS2',    description: 'EU Network & Information Security Directive — applies to essential and important sector entities.' },
  'PCI-DSS': { name: 'PCI-DSS', description: 'Payment Card Industry Data Security Standard — required if you process, store or transmit card data.' },
}

export default function ComplianceTab({
  frameworks,
  tenantId,
}: {
  frameworks: string[]
  tenantId: string
}) {
  const [selected, setSelected] = useState<Framework[]>(
    (frameworks ?? []).filter((f): f is Framework => (ALL_FRAMEWORKS as readonly string[]).includes(f))
  )
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  function toggle(fw: Framework) {
    setSelected(prev => prev.includes(fw) ? prev.filter(f => f !== fw) : [...prev, fw])
  }

  async function handleSave() {
    setSaving(true)
    setSaveMsg('')
    const supabase = createClient()
    const { error } = await supabase
      .from('tenants')
      .update({ compliance_frameworks: selected })
      .eq('id', tenantId)
    setSaving(false)
    if (error) {
      setSaveMsg(`Error: ${error.message}`)
    } else {
      setSaveMsg('Changes saved')
      setTimeout(() => setSaveMsg(''), 3000)
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="gs au1" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 8, letterSpacing: '0.04em' }}>COMPLIANCE FRAMEWORKS</h2>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Select the regulatory frameworks applicable to your organisation.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {ALL_FRAMEWORKS.map(fw => {
            const isSelected = selected.includes(fw)
            return (
              <button
                key={fw}
                type="button"
                onClick={() => toggle(fw)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16,
                  background: isSelected ? 'rgba(25,118,210,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isSelected ? 'rgba(25,118,210,0.5)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 8, cursor: 'pointer', textAlign: 'left', width: '100%',
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 2,
                  background: isSelected ? '#1976d2' : 'transparent',
                  border: `2px solid ${isSelected ? '#1976d2' : '#475569'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isSelected && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{FRAMEWORK_LABELS[fw].name}</p>
                  <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{FRAMEWORK_LABELS[fw].description}</p>
                </div>
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button onClick={handleSave} className="btn-p" style={{ fontSize: 13, padding: '8px 20px' }} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {saveMsg && (
            <span style={{ fontSize: 13, color: saveMsg.startsWith('Error') ? '#ef4444' : '#22c55e' }}>{saveMsg}</span>
          )}
        </div>

        <p style={{ fontSize: 12, color: '#475569', fontStyle: 'italic' }}>
          Changes take effect on your next scan. Existing reports are not modified.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal
npx tsc --noEmit 2>&1 | grep "ComplianceTab"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/settings/ComplianceTab.tsx
git commit -m "feat: ComplianceTab — framework selection with save"
```

---

## Task 3: Create the ProfileTab component

**Files:**
- Create: `components/settings/ProfileTab.tsx`

- [ ] **Step 1: Create the file**

Create `components/settings/ProfileTab.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const INDUSTRIES = ['banking', 'insurance', 'payments', 'healthtech', 'energy', 'other']
const SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+']

export type TenantProfile = {
  name: string
  industry: string
  company_size: string
  country: string | null
}

export type UserProfile = {
  email: string
  role: string
}

export default function ProfileTab({
  tenant,
  user,
  tenantId,
}: {
  tenant: TenantProfile
  user: UserProfile
  tenantId: string
}) {
  const [name, setName]               = useState(tenant.name ?? '')
  const [industry, setIndustry]       = useState(tenant.industry ?? '')
  const [companySize, setCompanySize] = useState(tenant.company_size ?? '')
  const [country, setCountry]         = useState(tenant.country ?? '')
  const [saving, setSaving]           = useState(false)
  const [saveMsg, setSaveMsg]         = useState('')
  const [resetting, setResetting]     = useState(false)
  const [resetMsg, setResetMsg]       = useState('')
  const [passwordUpdated, setPasswordUpdated] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('passwordUpdated') === '1') {
      setPasswordUpdated(true)
      // Remove the query param so it doesn't persist on refresh
      window.history.replaceState({}, '', '/dashboard/settings')
      setTimeout(() => setPasswordUpdated(false), 5000)
    }
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg('')
    const supabase = createClient()
    const { error } = await supabase
      .from('tenants')
      .update({ name, industry, company_size: companySize, country: country || null })
      .eq('id', tenantId)
    setSaving(false)
    if (error) {
      setSaveMsg(`Error: ${error.message}`)
    } else {
      setSaveMsg('Changes saved')
      setTimeout(() => setSaveMsg(''), 3000)
    }
  }

  async function handlePasswordReset() {
    setResetting(true)
    setResetMsg('')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    setResetting(false)
    if (error) {
      setResetMsg(`Error: ${error.message}`)
    } else {
      setResetMsg('Reset email sent ✓')
      setTimeout(() => setResetMsg(''), 3000)
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      {passwordUpdated && (
        <div style={{ padding: '10px 16px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, marginBottom: 24, fontSize: 13, color: '#22c55e' }}>
          Password updated successfully
        </div>
      )}

      {/* Company section */}
      <div className="gs au1" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 20, letterSpacing: '0.04em' }}>COMPANY</h2>
        <form onSubmit={handleSave}>
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Company Name</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Acme Financial" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Industry</label>
            <select className="form-input" value={industry} onChange={e => setIndustry(e.target.value)}>
              <option value="">Select industry</option>
              {INDUSTRIES.map(i => (
                <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Company Size</label>
            <select className="form-input" value={companySize} onChange={e => setCompanySize(e.target.value)}>
              <option value="">Select size</option>
              {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label className="form-label">Country</label>
            <input className="form-input" value={country} onChange={e => setCountry(e.target.value)} placeholder="United Kingdom" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="submit" className="btn-p" style={{ fontSize: 13, padding: '8px 20px' }} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {saveMsg && (
              <span style={{ fontSize: 13, color: saveMsg.startsWith('Error') ? '#ef4444' : '#22c55e' }}>{saveMsg}</span>
            )}
          </div>
        </form>
      </div>

      {/* Personal section */}
      <div className="gs au1" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 20, letterSpacing: '0.04em' }}>PERSONAL</h2>
        <div style={{ marginBottom: 16 }}>
          <label className="form-label">Email</label>
          <div style={{ padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, fontSize: 13, color: '#64748b' }}>
            {user.email}
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label className="form-label">Role</label>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', padding: '3px 10px', borderRadius: 4, background: 'rgba(66,165,245,0.1)', color: '#42a5f5', border: '1px solid rgba(66,165,245,0.2)' }}>
              {(user.role ?? 'admin').toUpperCase()}
            </span>
          </div>
        </div>
        <div>
          <button
            type="button"
            onClick={handlePasswordReset}
            className="btn-s"
            style={{ fontSize: 13 }}
            disabled={resetting}
          >
            {resetting ? 'Sending…' : (resetMsg && !resetMsg.startsWith('Error')) ? resetMsg : 'Send password reset email'}
          </button>
          {resetMsg && resetMsg.startsWith('Error') && (
            <p style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>{resetMsg}</p>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal
npx tsc --noEmit 2>&1 | grep "ProfileTab"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/settings/ProfileTab.tsx
git commit -m "feat: ProfileTab — company form + personal section + password reset trigger"
```

---

## Task 4: Create the SettingsTabs component

**Files:**
- Create: `components/settings/SettingsTabs.tsx`

- [ ] **Step 1: Create the file**

Create `components/settings/SettingsTabs.tsx`:

```typescript
'use client'

import { useState } from 'react'
import ProfileTab, { type TenantProfile, type UserProfile } from './ProfileTab'
import ComplianceTab from './ComplianceTab'

type Tab = 'profile' | 'compliance'

const TAB_LABELS: Record<Tab, string> = {
  profile:    'Profile',
  compliance: 'Compliance',
}

export default function SettingsTabs({
  tenant,
  user,
  tenantId,
}: {
  tenant: TenantProfile & { compliance_frameworks: string[] }
  user: UserProfile
  tenantId: string
}) {
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  return (
    <div style={{ padding: 24 }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {(['profile', 'compliance'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 20px', fontSize: 13, fontWeight: 600,
              color: activeTab === tab ? '#42a5f5' : '#64748b',
              borderBottom: `2px solid ${activeTab === tab ? '#42a5f5' : 'transparent'}`,
              marginBottom: -1, letterSpacing: '0.03em',
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {activeTab === 'profile'    && <ProfileTab tenant={tenant} user={user} tenantId={tenantId} />}
      {activeTab === 'compliance' && <ComplianceTab frameworks={tenant.compliance_frameworks} tenantId={tenantId} />}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal
npx tsc --noEmit 2>&1 | grep -E "SettingsTabs|ProfileTab|ComplianceTab"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/settings/SettingsTabs.tsx
git commit -m "feat: SettingsTabs — tabbed wrapper for Profile and Compliance"
```

---

## Task 5: Create the settings server page

**Files:**
- Create: `app/dashboard/settings/page.tsx`

- [ ] **Step 1: Create the file**

```bash
mkdir -p /Users/grahamjohn/Documents/GitHub/breachr/portal/app/dashboard/settings
```

Create `app/dashboard/settings/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SettingsTabs from '@/components/settings/SettingsTabs'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, email, role')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/login')

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, industry, company_size, country, compliance_frameworks')
    .eq('id', profile.tenant_id)
    .single()

  const tenantData = tenant ?? { name: '', industry: '', company_size: '', country: null, compliance_frameworks: [] }
  const userData   = { email: profile.email ?? user.email ?? '', role: profile.role ?? 'admin' }

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>SETTINGS</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Manage your account and compliance preferences</p>
        </div>
      </div>
      <SettingsTabs
        tenant={tenantData}
        user={userData}
        tenantId={profile.tenant_id}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles (full check)**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/settings/page.tsx
git commit -m "feat: /dashboard/settings page — tabbed settings with Profile and Compliance"
```

---

## Task 6: Create the password reset page

**Files:**
- Create: `app/auth/reset-password/page.tsx`

This page is outside the dashboard layout — it has no sidebar. It reads the Supabase recovery token from the URL hash, sets the session, then shows the new password form.

- [ ] **Step 1: Create the file**

```bash
mkdir -p /Users/grahamjohn/Documents/GitHub/breachr/portal/app/auth/reset-password
```

Create `app/auth/reset-password/page.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [ready, setReady]       = useState(false)

  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash) {
      window.location.href = '/login?error=no_token'
      return
    }
    const params      = new URLSearchParams(hash)
    const accessToken  = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const type         = params.get('type')

    if (!accessToken || !refreshToken || type !== 'recovery') {
      window.location.href = '/login?error=invalid_token'
      return
    }

    const supabase = createClient()
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }).then(({ error }) => {
      if (error) {
        window.location.href = `/login?error=${encodeURIComponent(error.message)}`
      } else {
        setReady(true)
      }
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      window.location.href = '/dashboard/settings?passwordUpdated=1'
    }
  }

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(ellipse at top, rgba(25,118,210,0.06) 0%, transparent 60%)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '2px solid #42a5f5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#94a3b8', fontSize: 13 }}>Verifying reset link…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'radial-gradient(ellipse at top, rgba(25,118,210,0.06) 0%, transparent 60%)' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#1976d2,#42a5f5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <span className="font-display" style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>BREACHR</span>
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13 }}>Set your new password</p>
        </div>

        <div className="gs au1" style={{ padding: 32 }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label className="form-label">New password</label>
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Minimum 8 characters"
                autoFocus
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label className="form-label">Confirm password</label>
              <input
                className="form-input"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                placeholder="Repeat your password"
              />
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 16 }}>{error}</p>}
            <button type="submit" className="btn-p" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal
npx tsc --noEmit 2>&1 | grep "reset-password"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/auth/reset-password/page.tsx"
git commit -m "feat: /auth/reset-password — set new password after email link"
```

---

## Task 7: Deploy and verify

- [ ] **Step 1: Add redirect URL to Supabase** (manual — do this before testing)

In Supabase dashboard → Authentication → URL Configuration → Redirect URLs, add:
- `https://breachr-portal.vercel.app/auth/reset-password`
- `http://localhost:3000/auth/reset-password` (for local dev)

- [ ] **Step 2: Push and deploy**

```bash
cd /Users/grahamjohn/Documents/GitHub/breachr/portal
git push origin main
vercel --prod
vercel alias $(vercel ls --json 2>/dev/null | python3 -c "import sys,json; deps=json.load(sys.stdin); print(next(d['url'] for d in deps if d.get('target')=='production'))") breachr-portal.vercel.app
```

Or simply run `vercel --prod` then re-alias manually:
```bash
vercel --prod 2>&1 | tail -5
# note the new deployment URL, then:
vercel alias <new-deployment-url> breachr-portal.vercel.app
```

- [ ] **Step 3: Verify settings page loads**

Visit `https://breachr-portal.vercel.app/dashboard/settings`. Confirm:
- "Settings" appears in the sidebar
- Profile tab shows company form pre-populated with existing data
- Compliance tab shows the 3 framework checkboxes pre-checked per tenant's current selection

- [ ] **Step 4: Test company profile save**

Change the company name, click "Save changes". Confirm green "Changes saved" appears. Verify in Supabase:

```sql
SELECT name, industry, company_size, country FROM tenants WHERE id = '85596311-117b-4c7c-99d2-cd5137ba03ac';
```

- [ ] **Step 5: Test compliance save**

On the Compliance tab, deselect one framework and save. Verify in Supabase:

```sql
SELECT compliance_frameworks FROM tenants WHERE id = '85596311-117b-4c7c-99d2-cd5137ba03ac';
```

- [ ] **Step 6: Test password reset**

Click "Send password reset email" on the Profile tab. Confirm the button shows "Reset email sent ✓". Check the inbox for the reset email. Click the link — confirm it lands on `/auth/reset-password`, shows the new password form, and on submit redirects back to `/dashboard/settings` with the green "Password updated successfully" banner.
