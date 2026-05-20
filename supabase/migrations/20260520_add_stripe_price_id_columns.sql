-- EUR Stripe price IDs managed by admin push-to-env flow
ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS stripe_price_monthly_id text,
  ADD COLUMN IF NOT EXISTS stripe_price_annual_id  text;
