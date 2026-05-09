-- Per-user mobile number for 2FA and SMS alerts
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone text;
