-- Add trial period and USD parity pricing to packages
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS trial_period_days integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS stripe_price_monthly_usd_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_annual_usd_id text;

-- Track intended package selection during checkout flow
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS intended_package_slug text;
