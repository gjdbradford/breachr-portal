-- Multi-tenant user support
-- Decouples users.id (PK) from the Supabase auth UUID so the same person
-- can be a member of multiple organisations simultaneously.
--
-- Before: users.id = auth.users.id (PK, means 1 row per auth user globally)
-- After:  users.id = gen_random_uuid() (PK, rows scoped per org)
--         users.supabase_uid = auth.users.id (new column, can repeat across tenants)

-- 1. Add supabase_uid column and backfill from existing id values
ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_uid uuid;
UPDATE users SET supabase_uid = id WHERE supabase_uid IS NULL;
ALTER TABLE users ALTER COLUMN supabase_uid SET NOT NULL;

-- 2. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_supabase_uid ON users(supabase_uid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_supabase_uid_tenant ON users(supabase_uid, tenant_id);

-- 3. Update RLS policies on the users table itself
--    (other tables use tenant_id subqueries which still work because existing rows
--    have id = supabase_uid = auth.uid(), and new multi-org rows are queried via
--    the admin/service_role client which bypasses RLS)
DROP POLICY IF EXISTS users_select_own ON users;
DROP POLICY IF EXISTS users_update_own ON users;

CREATE POLICY users_select_own ON users FOR SELECT TO authenticated
  USING (auth.uid() = id OR auth.uid() = supabase_uid);

CREATE POLICY users_update_own ON users FOR UPDATE TO authenticated
  USING (auth.uid() = id OR auth.uid() = supabase_uid);
