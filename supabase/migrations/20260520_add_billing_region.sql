-- billing_region derives from country code at onboarding Step 1
-- 'eu' = EU-27, 'row' = rest of world (default)
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS billing_region text NOT NULL DEFAULT 'row'
  CHECK (billing_region IN ('eu', 'row'));

CREATE INDEX IF NOT EXISTS idx_tenants_billing_region ON tenants(billing_region);
