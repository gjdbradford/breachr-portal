-- ============================================================
-- STAGING ONLY — NEVER RUN ON PRODUCTION
-- ============================================================
-- Purpose:
--   1. Drop FK constraints on audit_logs that reference public.users.
--      audit_logs is immutable (UPDATE/DELETE DO INSTEAD NOTHING rules),
--      so cascade deletes would silently fail. Audit logs are historical
--      records and should retain user IDs even after user deletion.
--
--   2. Clean up orphaned public.users rows — rows where supabase_uid
--      no longer exists in auth.users (left from manual test user deletes).
--
--   3. Add FK public.users.supabase_uid → auth.users.id ON DELETE CASCADE
--      so deleting an auth user cascades to the portal user profile.
--
--   4. Add ON DELETE CASCADE / SET NULL to all public.users dependents
--      so the full chain cleans up: auth.users → public.users → everything.
--
-- Run in: Supabase SQL editor on hvdwvzgtfhgntdcnwheu (staging only)
-- Safe to re-run: yes — all steps are idempotent
-- ============================================================

BEGIN;

-- ── Step 1: Drop audit_log FKs (immutable table — keep user IDs historically) ──
ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey,
  DROP CONSTRAINT IF EXISTS audit_logs_chain_annotation_by_fkey;

-- ── Step 2: Identify orphaned public.users rows ──────────────
CREATE TEMP TABLE _orphaned_user_ids AS
SELECT id FROM public.users
WHERE supabase_uid NOT IN (SELECT id FROM auth.users);

-- ── Step 3: Clean dependents of orphaned users ───────────────

-- NOT NULL FK columns → must delete the row
DELETE FROM public.asset_classification_log WHERE changed_by  IN (SELECT id FROM _orphaned_user_ids);
DELETE FROM public.invitations                WHERE invited_by IN (SELECT id FROM _orphaned_user_ids);

-- Nullable FK columns → SET NULL
UPDATE public.assets            SET classified_by = NULL WHERE classified_by IN (SELECT id FROM _orphaned_user_ids);
UPDATE public.deletion_requests SET user_id       = NULL WHERE user_id       IN (SELECT id FROM _orphaned_user_ids);
UPDATE public.events            SET user_id       = NULL WHERE user_id       IN (SELECT id FROM _orphaned_user_ids);
UPDATE public.scans             SET triggered_by  = NULL WHERE triggered_by  IN (SELECT id FROM _orphaned_user_ids);
-- NOTE: audit_logs deliberately skipped — immutable, retains historical user IDs

-- ── Step 4: Delete orphaned public.users rows ────────────────
DELETE FROM public.users WHERE id IN (SELECT id FROM _orphaned_user_ids);
DROP TABLE _orphaned_user_ids;

-- ── Step 5: Add FK public.users.supabase_uid → auth.users.id ─
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'users_supabase_uid_fkey'
      AND table_schema = 'public' AND table_name = 'users'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_supabase_uid_fkey
        FOREIGN KEY (supabase_uid) REFERENCES auth.users(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added users_supabase_uid_fkey';
  ELSE
    RAISE NOTICE 'users_supabase_uid_fkey already exists — skipping.';
  END IF;
END $$;

-- ── Step 6: Add CASCADE / SET NULL on public.users dependents ─

ALTER TABLE public.asset_classification_log
  DROP CONSTRAINT IF EXISTS asset_classification_log_changed_by_fkey,
  ADD CONSTRAINT asset_classification_log_changed_by_fkey
    FOREIGN KEY (changed_by) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.assets
  DROP CONSTRAINT IF EXISTS assets_classified_by_fkey,
  ADD CONSTRAINT assets_classified_by_fkey
    FOREIGN KEY (classified_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.deletion_requests
  DROP CONSTRAINT IF EXISTS deletion_requests_user_id_fkey,
  ADD CONSTRAINT deletion_requests_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_user_id_fkey,
  ADD CONSTRAINT events_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.invitations
  DROP CONSTRAINT IF EXISTS invitations_invited_by_fkey,
  ADD CONSTRAINT invitations_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.scans
  DROP CONSTRAINT IF EXISTS scans_triggered_by_fkey,
  ADD CONSTRAINT scans_triggered_by_fkey
    FOREIGN KEY (triggered_by) REFERENCES public.users(id) ON DELETE SET NULL;

COMMIT;

-- ── Verify ───────────────────────────────────────────────────
SELECT
  tc.table_name,
  kcu.column_name,
  rc.delete_rule,
  tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'users','audit_logs','events','scans','assets',
    'asset_classification_log','invitations','deletion_requests'
  )
ORDER BY tc.table_name, kcu.column_name;
