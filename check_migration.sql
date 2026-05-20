-- Check packages table columns
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'packages' AND column_name IN ('trial_period_days', 'stripe_price_monthly_usd_id', 'stripe_price_annual_usd_id')
ORDER BY column_name;

-- Check tenants table columns
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'tenants' AND column_name = 'intended_package_slug'
ORDER BY column_name;
