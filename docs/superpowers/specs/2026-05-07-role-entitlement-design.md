# Role & Entitlement System Design

**Goal:** Three-tier role system (account_owner / admin / member) with email-invite flow for admins, enforced in the portal UI and API.

**Architecture:** DB trigger auto-assigns `account_owner` to first user per tenant on insert. Supabase built-in invite email handles delivery. Auth callback creates `public.users` row for invited users using metadata. Team management UI lives as a new tab in Settings.

**Tech Stack:** Supabase Auth `admin.inviteUserByEmail`, Postgres trigger, Next.js App Router API routes, React client component.

---

## Roles

| Role | Assigned by | Capabilities |
|------|-------------|-------------|
| `account_owner` | DB trigger (first user per tenant) | Everything: invite/demote/revoke admins, edit all data, manage billing |
| `admin` | Invited by account_owner | Edit assets/sensors/classifications, view all data |
| `member` | Future — not built in this spec | Read-only |

- One `account_owner` per tenant; role is immutable (cannot be demoted or reassigned)
- Account owner can demote `admin` → `member` or delete an admin entirely
- `member` role is a valid DB value but not exposed in UI yet

---

## DB Changes

### 1. Role constraint
Add check constraint: `role IN ('account_owner', 'admin', 'member')`

### 2. Backfill
Set earliest `created_at` user per tenant to `account_owner`. All others stay `admin`.

### 3. Trigger: auto-assign account_owner
On `public.users` INSERT: if no existing user for that `tenant_id`, set `NEW.role = 'account_owner'`. This means website registration requires no changes.

### 4. Invitations table
```sql
CREATE TABLE public.invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email       text NOT NULL,
  invited_by  uuid NOT NULL REFERENCES users(id),
  role        text NOT NULL DEFAULT 'admin',
  token       text NOT NULL UNIQUE,  -- Supabase invite token (for display/cancel)
  expires_at  timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
```
RLS: tenant members can SELECT their own tenant's invitations. Only API routes (service role) write.

---

## Auth Callback Update

`/auth/callback/route.ts` currently just exchanges code and redirects. Add: after `exchangeCodeForSession`, check if `public.users` row exists for `user.id`. If not, this is an invited user — read `user.user_metadata.invited_tenant_id` and `user.user_metadata.role`, create the row, then redirect to `/dashboard`.

---

## API Routes

All routes require auth. Role checks use the `public.users.role` field via admin client.

### `GET /api/team`
Returns `{ members: User[], pendingInvites: Invitation[] }` for the current user's tenant.

### `POST /api/team/invite`
- Requires `account_owner` role
- Body: `{ email: string }`
- Calls `supabase.auth.admin.inviteUserByEmail(email, { data: { invited_tenant_id, role: 'admin' } })`
- Inserts row into `invitations` table
- Returns 409 if email already a member or has pending invite

### `PATCH /api/team/[userId]/role`
- Requires `account_owner` role
- Body: `{ role: 'admin' | 'member' }`
- Cannot change `account_owner` role
- Updates `public.users.role`

### `DELETE /api/team/[userId]`
- Requires `account_owner` role
- Cannot delete self (account_owner)
- Deletes `public.users` row (Supabase auth user remains but loses tenant access)
- Also deletes any pending invitations for that user

### `DELETE /api/team/invitations/[id]`
- Requires `account_owner` role
- Deletes invitation row (revokes the invite — Supabase token becomes orphaned, login creates no user row)

---

## UI: Team Tab in Settings

New `TeamTab` component added as third tab in `SettingsTabs`. Only renders full management controls if current user is `account_owner`; admins see read-only member list.

**Layout:**
- "Team Members" section: table with Name/Email, Role badge, Last login, Actions (Demote / Remove) — actions hidden for account_owner row
- "Pending Invitations" section (if any): table with Email, Invited date, Expires date, Revoke button
- "Invite Admin" button at top right: opens inline form to enter email + submit

**Role badges:**
- `account_owner` → indigo badge "Owner"
- `admin` → blue badge "Admin"  
- `member` → grey badge "Member"

---

## Error States

- Invite to existing member → 409 "Already a member"
- Invite to pending invite → 409 "Invitation already sent"
- Non-account_owner attempts team actions → 403
- Demoting account_owner → 403

---

## Not in scope

- Ownership transfer
- Member role UI permissions enforcement (read-only gating across dashboard)
- Bulk invite
- Invite expiry extension
