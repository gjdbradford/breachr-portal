-- Stripe price IDs stored per package (populated automatically on push-to-production)
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS stripe_price_monthly_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_annual_id  text;

-- Region determines which payment provider to use at checkout
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS billing_region text NOT NULL DEFAULT 'eu';

-- Track which provider was used for each tenant package assignment
ALTER TABLE tenant_packages
  ADD COLUMN IF NOT EXISTS payment_provider text NOT NULL DEFAULT 'stripe';
