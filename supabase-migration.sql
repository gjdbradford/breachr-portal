-- Breachr portal schema migration
-- Run this in Supabase SQL editor: https://supabase.com/dashboard/project/hvdwvzgtfhgntdcnwheu/sql

-- scans: columns needed by the scan engine
ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS model_used      text,
  ADD COLUMN IF NOT EXISTS tests_run       integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tests_total     integer NOT NULL DEFAULT 1247,
  ADD COLUMN IF NOT EXISTS progress_pct    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_phase   text;

-- findings: AI provenance columns
ALTER TABLE findings
  ADD COLUMN IF NOT EXISTS ai_model        text,
  ADD COLUMN IF NOT EXISTS ai_confidence   numeric(5,2),
  ADD COLUMN IF NOT EXISTS finding_hash    text UNIQUE;

-- audit_logs: cryptographic signature
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS signature       text;

-- attack_surfaces: ensure active flag exists
ALTER TABLE attack_surfaces
  ADD COLUMN IF NOT EXISTS active          boolean NOT NULL DEFAULT true;

-- ── RLS POLICIES ────────────────────────────────────────────────────────────
-- users: authenticated user can read/update their own row
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='users_select_own') THEN
    CREATE POLICY users_select_own ON users FOR SELECT TO authenticated USING (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='users' AND policyname='users_update_own') THEN
    CREATE POLICY users_update_own ON users FOR UPDATE TO authenticated USING (auth.uid() = id);
  END IF;
END $$;

-- tenants: members of the tenant can read/update their own tenant
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tenants' AND policyname='tenants_select_own') THEN
    CREATE POLICY tenants_select_own ON tenants FOR SELECT TO authenticated
      USING (id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tenants' AND policyname='tenants_update_own') THEN
    CREATE POLICY tenants_update_own ON tenants FOR UPDATE TO authenticated
      USING (id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- scans: tenant members can read and insert
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='scans' AND policyname='scans_tenant') THEN
    CREATE POLICY scans_tenant ON scans FOR ALL TO authenticated
      USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- findings: tenant members can read and insert
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='findings' AND policyname='findings_tenant') THEN
    CREATE POLICY findings_tenant ON findings FOR ALL TO authenticated
      USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- attack_surfaces: tenant members can manage their own surfaces
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='attack_surfaces' AND policyname='surfaces_tenant') THEN
    CREATE POLICY surfaces_tenant ON attack_surfaces FOR ALL TO authenticated
      USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- audit_logs: tenant members can read their own logs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='audit_logs' AND policyname='audit_logs_tenant') THEN
    CREATE POLICY audit_logs_tenant ON audit_logs FOR SELECT TO authenticated
      USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;
