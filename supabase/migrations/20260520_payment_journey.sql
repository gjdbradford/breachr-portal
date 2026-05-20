-- Add trial period and USD parity pricing to packages
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS trial_period_days integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS stripe_price_monthly_usd_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_annual_usd_id text;

-- Track intended package selection during checkout flow
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS intended_package_slug text;

-- Referential integrity: clear intent if package is deleted
ALTER TABLE tenants
  ADD CONSTRAINT fk_intended_package_slug
  FOREIGN KEY (intended_package_slug) REFERENCES packages(slug) ON DELETE SET NULL;

-- Index for onboarding payment wall lookup
CREATE INDEX IF NOT EXISTS idx_tenants_intended_package_slug ON tenants(intended_package_slug);
