-- portal/supabase/migrations/20260511_packages.sql

CREATE TYPE package_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE access_mode    AS ENUM ('full', 'trial', 'paywalled', 'off');
CREATE TYPE env_name       AS ENUM ('staging', 'production');
CREATE TYPE push_status    AS ENUM ('success', 'failed', 'redacted');

CREATE TABLE packages (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  slug             text NOT NULL UNIQUE,
  description      text,
  price_monthly    int  NOT NULL DEFAULT 0,
  price_annual     int,
  scans_limit      int,
  tokens_limit     bigint,
  targets_limit    int,
  scan_types       text[] NOT NULL DEFAULT '{}',
  stripe_product_id text,
  status           package_status NOT NULL DEFAULT 'draft',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE package_modules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id   uuid NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  module_slug  text NOT NULL,
  access_mode  access_mode NOT NULL DEFAULT 'off',
  trial_days   int,
  UNIQUE (package_id, module_slug)
);

CREATE TABLE package_role_ceilings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id  uuid NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  role        text NOT NULL CHECK (role IN ('admin', 'member')),
  permission  text NOT NULL,
  enabled     boolean NOT NULL DEFAULT true,
  UNIQUE (package_id, role, permission)
);

CREATE TABLE tenant_packages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  package_id      uuid NOT NULL REFERENCES packages(id),
  assigned_at     timestamptz NOT NULL DEFAULT now(),
  assigned_by     uuid,
  override_reason text,
  stripe_sub_id   text
);

CREATE TABLE tenant_module_trials (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  module_slug      text NOT NULL,
  first_accessed_at timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL,
  extended_by      uuid,
  extended_at      timestamptz,
  UNIQUE (tenant_id, module_slug)
);

CREATE TABLE package_push_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id       uuid NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  environment      env_name NOT NULL,
  pushed_by        text NOT NULL,
  pushed_at        timestamptz NOT NULL DEFAULT now(),
  changes_summary  text NOT NULL DEFAULT '',
  status           push_status NOT NULL DEFAULT 'success',
  redacted_at      timestamptz,
  redacted_by      text
);

CREATE INDEX package_modules_pkg_idx        ON package_modules (package_id);
CREATE INDEX package_role_ceilings_pkg_idx  ON package_role_ceilings (package_id);
CREATE INDEX tenant_packages_tenant_idx     ON tenant_packages (tenant_id);
CREATE INDEX tenant_packages_package_idx    ON tenant_packages (package_id);
CREATE INDEX tenant_module_trials_tenant_idx ON tenant_module_trials (tenant_id);
CREATE INDEX package_push_log_pkg_idx       ON package_push_log (package_id, pushed_at DESC);

-- Auto-update updated_at on packages
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER packages_updated_at
  BEFORE UPDATE ON packages
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
