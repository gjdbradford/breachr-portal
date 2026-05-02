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
