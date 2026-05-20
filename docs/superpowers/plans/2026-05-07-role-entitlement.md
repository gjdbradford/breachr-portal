# Role & Entitlement System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three-tier role system (account_owner / admin / member) with email-invite flow, enforced in API and UI.

**Architecture:** DB trigger auto-assigns account_owner to first user per tenant. Supabase built-in invite email. Auth callback creates public.users row for invited users. Team management tab in Settings.

**Tech Stack:** Supabase (Postgres trigger, RLS, admin.inviteUserByEmail), Next.js App Router, TypeScript strict, React client components.

---

## File Structure

- **Modify:** `app/auth/callback/route.ts` — handle invited user onboarding
- **Modify:** `app/dashboard/settings/page.tsx` — pass role to SettingsTabs
- **Modify:** `components/settings/SettingsTabs.tsx` — add Team tab
- **Create:** `components/settings/TeamTab.tsx` — team management UI
- **Create:** `app/api/team/route.ts` — GET members + pending invites
- **Create:** `app/api/team/invite/route.ts` — POST invite
- **Create:** `app/api/team/[userId]/role/route.ts` — PATCH role
- **Create:** `app/api/team/[userId]/route.ts` — DELETE member
- **Create:** `app/api/team/invitations/[id]/route.ts` — DELETE invitation
- **DB migration** applied via Supabase MCP

---

### Task 1: DB Migration

**Files:**
- DB migration via Supabase MCP (no file on disk)

- [ ] **Step 1: Apply migration**

Run via Supabase MCP `apply_migration` with this SQL:

```sql
-- 1. Add role constraint
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (role IN ('account_owner', 'admin', 'member'));

-- 2. Backfill: first user per tenant becomes account_owner
UPDATE public.users u
SET role = 'account_owner'
WHERE u.created_at = (
  SELECT MIN(u2.created_at)
  FROM public.users u2
  WHERE u2.tenant_id = u.tenant_id
);

-- 3. Trigger: auto-assign account_owner on first insert per tenant
CREATE OR REPLACE FUNCTION public.fn_assign_first_user_role()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE tenant_id = NEW.tenant_id AND id != NEW.id
  ) THEN
    NEW.role := 'account_owner';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_first_user_role ON public.users;
CREATE TRIGGER trg_assign_first_user_role
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_assign_first_user_role();

-- 4. Invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email       text NOT NULL,
  invited_by  uuid NOT NULL REFERENCES public.users(id),
  role        text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'member')),
  supabase_user_id uuid,
  expires_at  timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 5. RLS on invitations
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY invitations_tenant_select ON public.invitations
  FOR SELECT USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  );
```

- [ ] **Step 2: Verify**

Run this SQL to confirm:
```sql
-- Check backfill worked
SELECT role, COUNT(*) FROM public.users GROUP BY role;
-- Should show account_owner rows = number of tenants

-- Check invitations table exists
SELECT column_name FROM information_schema.columns
WHERE table_name = 'invitations' AND table_schema = 'public';
```

- [ ] **Step 3: Commit**
```bash
git add -A
git commit -m "feat: db migration for role system and invitations table"
```

---

### Task 2: Auth Callback — Handle Invited Users

**Files:**
- Modify: `app/auth/callback/route.ts`

Context: when `inviteUserByEmail` is called with `{ data: { invited_tenant_id, role } }`, Supabase sets those values in `user.user_metadata`. The invited user clicks the email link, lands on `/auth/callback`, code is exchanged for session. We need to detect this is a new invited user (no `public.users` row yet) and create the row.

- [ ] **Step 1: Write the modified callback**

Replace `app/auth/callback/route.ts` with:

```typescript
import { createServerClient } from '@supabase/ssr'
import { createClient as adminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Check if this is an invited user who needs a public.users row
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const admin = adminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        )

        const { data: existingUser } = await admin
          .from('users')
          .select('id')
          .eq('id', user.id)
          .single()

        if (!existingUser) {
          // Invited user — create their public.users row
          const invitedTenantId = user.user_metadata?.invited_tenant_id as string | undefined
          const role = (user.user_metadata?.role as string | undefined) ?? 'admin'

          if (invitedTenantId) {
            await admin.from('users').insert({
              id: user.id,
              tenant_id: invitedTenantId,
              email: user.email,
              role,
            })

            // Mark invitation as accepted
            await admin
              .from('invitations')
              .update({ accepted_at: new Date().toISOString(), supabase_user_id: user.id })
              .eq('email', user.email!)
              .eq('tenant_id', invitedTenantId)
              .is('accepted_at', null)
          }
        }
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
```

- [ ] **Step 2: Commit**
```bash
git add app/auth/callback/route.ts
git commit -m "feat: handle invited user onboarding in auth callback"
```

---

### Task 3: Team API Routes

**Files:**
- Create: `app/api/team/route.ts`
- Create: `app/api/team/invite/route.ts`
- Create: `app/api/team/[userId]/role/route.ts`
- Create: `app/api/team/[userId]/route.ts`
- Create: `app/api/team/invitations/[id]/route.ts`

Context: All routes use the admin Supabase client for DB operations. Auth check uses the regular client. Role check: fetch `public.users.role` for the current user and compare to `'account_owner'`.

Helper pattern used across routes:
```typescript
// Get current user + their role
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

const admin = adminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const { data: profile } = await admin
  .from('users')
  .select('tenant_id, role')
  .eq('id', user.id)
  .single()
if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

- [ ] **Step 1: Create `app/api/team/route.ts` (GET)**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: profile } = await admin
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: members }, { data: invitations }] = await Promise.all([
    admin
      .from('users')
      .select('id, email, role, created_at, last_login_at')
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: true }),
    admin
      .from('invitations')
      .select('id, email, role, expires_at, created_at')
      .eq('tenant_id', profile.tenant_id)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }),
  ])

  return NextResponse.json({ members: members ?? [], invitations: invitations ?? [] })
}
```

- [ ] **Step 2: Create `app/api/team/invite/route.ts` (POST)**

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: profile } = await admin
    .from('users')
    .select('tenant_id, role, email')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (profile.role !== 'account_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { email } = body
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  // Check not already a member
  const { data: existing } = await admin
    .from('users')
    .select('id')
    .eq('tenant_id', profile.tenant_id)
    .eq('email', email)
    .single()
  if (existing) return NextResponse.json({ error: 'Already a member' }, { status: 409 })

  // Check no pending invite
  const { data: pendingInvite } = await admin
    .from('invitations')
    .select('id')
    .eq('tenant_id', profile.tenant_id)
    .eq('email', email)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .single()
  if (pendingInvite) return NextResponse.json({ error: 'Invitation already sent' }, { status: 409 })

  // Send Supabase invite
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { invited_tenant_id: profile.tenant_id, role: 'admin' },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
  })
  if (inviteError) {
    console.error('[team/invite]', inviteError)
    return NextResponse.json({ error: 'Failed to send invitation' }, { status: 503 })
  }

  // Record invitation
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  await admin.from('invitations').insert({
    tenant_id: profile.tenant_id,
    email,
    invited_by: user.id,
    role: 'admin',
    expires_at: expiresAt,
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Create `app/api/team/[userId]/role/route.ts` (PATCH)**

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'

const VALID_ROLES = new Set(['admin', 'member'])

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: profile } = await admin
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (profile.role !== 'account_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const { role } = body
  if (!VALID_ROLES.has(role)) {
    return NextResponse.json({ error: 'role must be admin or member' }, { status: 400 })
  }

  // Verify target user is in same tenant and not account_owner
  const { data: target } = await admin
    .from('users')
    .select('role, tenant_id')
    .eq('id', userId)
    .single()
  if (!target || target.tenant_id !== profile.tenant_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (target.role === 'account_owner') {
    return NextResponse.json({ error: 'Cannot change account owner role' }, { status: 403 })
  }

  await admin.from('users').update({ role }).eq('id', userId)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Create `app/api/team/[userId]/route.ts` (DELETE)**

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (userId === user.id) {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 403 })
  }

  const admin = adminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: profile } = await admin
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (profile.role !== 'account_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: target } = await admin
    .from('users')
    .select('role, tenant_id')
    .eq('id', userId)
    .single()
  if (!target || target.tenant_id !== profile.tenant_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (target.role === 'account_owner') {
    return NextResponse.json({ error: 'Cannot remove account owner' }, { status: 403 })
  }

  await admin.from('users').delete().eq('id', userId)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 5: Create `app/api/team/invitations/[id]/route.ts` (DELETE)**

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: profile } = await admin
    .from('users')
    .select('tenant_id, role')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (profile.role !== 'account_owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: invitation } = await admin
    .from('invitations')
    .select('tenant_id')
    .eq('id', id)
    .single()
  if (!invitation || invitation.tenant_id !== profile.tenant_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await admin.from('invitations').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 6: Commit**
```bash
git add app/api/team/
git commit -m "feat: team management API routes (list, invite, role change, remove)"
```

---

### Task 4: Settings UI — Team Tab

**Files:**
- Modify: `app/dashboard/settings/page.tsx` — pass `currentUserId` to SettingsTabs
- Modify: `components/settings/SettingsTabs.tsx` — add Team tab
- Create: `components/settings/TeamTab.tsx` — full team management UI

Context: Settings page already fetches `profile.role`. Need to also pass `user.id` so TeamTab can identify which row is "you". SettingsTabs currently has two tabs (profile, compliance); add team as third.

- [ ] **Step 1: Update settings page to pass currentUserId**

In `app/dashboard/settings/page.tsx`, change:
```typescript
const userData = { email: profile.email ?? user.email ?? '', role: profile.role ?? 'member' }
```
to:
```typescript
const userData = { email: profile.email ?? user.email ?? '', role: profile.role ?? 'member', id: user.id }
```

And in the JSX, add `currentUserId={user.id}` prop to `<SettingsTabs>`.

- [ ] **Step 2: Update SettingsTabs to add Team tab**

In `components/settings/SettingsTabs.tsx`:

```typescript
'use client'

import { useState } from 'react'
import ProfileTab, { type TenantProfile, type UserProfile } from './ProfileTab'
import ComplianceTab from './ComplianceTab'
import TeamTab from './TeamTab'

type Tab = 'profile' | 'compliance' | 'team'

const TAB_LABELS: Record<Tab, string> = {
  profile:    'Profile',
  compliance: 'Compliance',
  team:       'Team',
}

export default function SettingsTabs({
  tenant,
  user,
  tenantId,
  currentUserId,
}: {
  tenant: TenantProfile & { compliance_frameworks: string[] }
  user: UserProfile
  tenantId: string
  currentUserId: string
}) {
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {(['profile', 'compliance', 'team'] as Tab[]).map(tab => (
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
      {activeTab === 'team'       && <TeamTab currentUserId={currentUserId} currentUserRole={user.role} />}
    </div>
  )
}
```

- [ ] **Step 3: Create `components/settings/TeamTab.tsx`**

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'

interface Member {
  id: string
  email: string
  role: string
  created_at: string
  last_login_at: string | null
}

interface Invitation {
  id: string
  email: string
  role: string
  expires_at: string
  created_at: string
}

const ROLE_BADGE: Record<string, { label: string; bg: string; color: string; border: string }> = {
  account_owner: { label: 'Owner',  bg: 'rgba(99,102,241,0.1)',  color: '#818cf8', border: 'rgba(99,102,241,0.3)' },
  admin:         { label: 'Admin',  bg: 'rgba(59,130,246,0.1)',  color: '#60a5fa', border: 'rgba(59,130,246,0.3)' },
  member:        { label: 'Member', bg: 'rgba(100,116,139,0.1)', color: '#94a3b8', border: 'rgba(100,116,139,0.3)' },
}

function RoleBadge({ role }: { role: string }) {
  const b = ROLE_BADGE[role] ?? ROLE_BADGE.member
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
      background: b.bg, color: b.color, border: `1px solid ${b.border}`,
      letterSpacing: '0.05em',
    }}>
      {b.label}
    </span>
  )
}

export default function TeamTab({
  currentUserId,
  currentUserRole,
}: {
  currentUserId: string
  currentUserRole: string
}) {
  const isOwner = currentUserRole === 'account_owner'
  const [members, setMembers]         = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading]         = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting]       = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [error, setError]             = useState('')
  const [success, setSuccess]         = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/team')
    if (res.ok) {
      const data = await res.json()
      setMembers(data.members)
      setInvitations(data.invitations)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setError('')
    setSuccess('')
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail }),
    })
    if (res.ok) {
      setSuccess(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      setShowInviteForm(false)
      load()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to send invite')
    }
    setInviting(false)
  }

  async function handleRoleChange(userId: string, role: string) {
    setError('')
    const res = await fetch(`/api/team/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    if (res.ok) { load() }
    else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to update role')
    }
  }

  async function handleRemove(userId: string) {
    if (!confirm('Remove this team member? They will lose access immediately.')) return
    setError('')
    const res = await fetch(`/api/team/${userId}`, { method: 'DELETE' })
    if (res.ok) { load() }
    else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to remove member')
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    setError('')
    const res = await fetch(`/api/team/invitations/${inviteId}`, { method: 'DELETE' })
    if (res.ok) { load() }
    else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Failed to revoke invite')
    }
  }

  if (loading) {
    return <p style={{ fontSize: 13, color: '#64748b' }}>Loading team…</p>
  }

  const cell: React.CSSProperties = { fontSize: 12, color: '#94a3b8', padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)' }
  const head: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: '#64748b', padding: '8px 12px', textTransform: 'uppercase', letterSpacing: '0.06em' }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', margin: 0 }}>Team Members</h3>
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        {isOwner && !showInviteForm && (
          <button
            type="button"
            onClick={() => { setShowInviteForm(true); setError(''); setSuccess('') }}
            className="btn-p"
            style={{ fontSize: 12, padding: '6px 16px' }}
          >
            + Invite Admin
          </button>
        )}
      </div>

      {/* Feedback */}
      {error   && <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)' }}>{error}</p>}
      {success && <p style={{ fontSize: 12, color: '#22c55e', marginBottom: 12, padding: '8px 12px', background: 'rgba(34,197,94,0.08)', borderRadius: 6, border: '1px solid rgba(34,197,94,0.2)' }}>{success}</p>}

      {/* Invite form */}
      {showInviteForm && (
        <form onSubmit={handleInvite} style={{ marginBottom: 20, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label className="form-label">Email address</label>
            <input
              type="email" required autoFocus
              className="form-input"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              style={{ marginTop: 4 }}
            />
          </div>
          <button type="submit" className="btn-p" style={{ fontSize: 12, padding: '8px 16px' }} disabled={inviting}>
            {inviting ? 'Sending…' : 'Send Invite'}
          </button>
          <button type="button" onClick={() => setShowInviteForm(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 12, padding: '8px 8px' }}>
            Cancel
          </button>
        </form>
      )}

      {/* Members table */}
      <div className="gs au1" style={{ marginBottom: invitations.length > 0 ? 24 : 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={head}>Email</th>
              <th style={head}>Role</th>
              <th style={head}>Joined</th>
              <th style={head}>Last login</th>
              {isOwner && <th style={head}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id}>
                <td style={cell}>
                  {m.email}
                  {m.id === currentUserId && <span style={{ marginLeft: 6, fontSize: 10, color: '#64748b' }}>(you)</span>}
                </td>
                <td style={cell}><RoleBadge role={m.role} /></td>
                <td style={cell}>{new Date(m.created_at).toLocaleDateString('en-GB')}</td>
                <td style={cell}>{m.last_login_at ? new Date(m.last_login_at).toLocaleDateString('en-GB') : '—'}</td>
                {isOwner && (
                  <td style={cell}>
                    {m.role !== 'account_owner' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        {m.role === 'admin' && (
                          <button
                            type="button"
                            onClick={() => handleRoleChange(m.id, 'member')}
                            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(100,116,139,0.1)', color: '#94a3b8', border: '1px solid rgba(100,116,139,0.2)', cursor: 'pointer' }}
                          >
                            Demote
                          </button>
                        )}
                        {m.role === 'member' && (
                          <button
                            type="button"
                            onClick={() => handleRoleChange(m.id, 'admin')}
                            style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)', cursor: 'pointer' }}
                          >
                            Promote
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemove(m.id)}
                          style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer' }}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginBottom: 12 }}>
            Pending Invitations ({invitations.length})
          </h3>
          <div className="gs au1">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={head}>Email</th>
                  <th style={head}>Role</th>
                  <th style={head}>Invited</th>
                  <th style={head}>Expires</th>
                  {isOwner && <th style={head}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {invitations.map(inv => (
                  <tr key={inv.id}>
                    <td style={cell}>{inv.email}</td>
                    <td style={cell}><RoleBadge role={inv.role} /></td>
                    <td style={cell}>{new Date(inv.created_at).toLocaleDateString('en-GB')}</td>
                    <td style={cell}>{new Date(inv.expires_at).toLocaleDateString('en-GB')}</td>
                    {isOwner && (
                      <td style={cell}>
                        <button
                          type="button"
                          onClick={() => handleRevokeInvite(inv.id)}
                          style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer' }}
                        >
                          Revoke
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Commit**
```bash
git add app/dashboard/settings/page.tsx components/settings/SettingsTabs.tsx components/settings/TeamTab.tsx
git commit -m "feat: team tab in settings with member management and invite UI"
```

---

### Task 5: Add NEXT_PUBLIC_APP_URL env var + Deploy

**Files:**
- Vercel env var (no file change)

The invite API uses `process.env.NEXT_PUBLIC_APP_URL` for the `redirectTo` in inviteUserByEmail. This must be set.

- [ ] **Step 1: Check if env var exists**

Run: `vercel env ls` and look for `NEXT_PUBLIC_APP_URL`.

If missing, add it:
```bash
echo "https://breachr-portal.vercel.app" | vercel env add NEXT_PUBLIC_APP_URL production
echo "http://localhost:3000" | vercel env add NEXT_PUBLIC_APP_URL development
```

- [ ] **Step 2: Deploy to production**
```bash
vercel --prod
```

- [ ] **Step 3: Smoke test**

1. Navigate to `/dashboard/settings` → confirm "Team" tab appears
2. Click Team tab → confirm current user shows with "Owner" badge
3. Click "Invite Admin" → enter an email → confirm "Invitation sent" success message
4. Check pending invitations section appears with the invite

- [ ] **Step 4: Commit env setup note (no secrets committed)**
```bash
git commit --allow-empty -m "chore: NEXT_PUBLIC_APP_URL env var required for invite redirectTo"
```
