-- Enable RLS on packages and allow anonymous reads of active packages.
-- service_role key bypasses RLS entirely — admin portal and portal backend are unaffected.
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active packages"
ON packages FOR SELECT
TO anon
USING (status = 'active');
