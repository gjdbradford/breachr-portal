-- Authenticated users also need to read active packages (for payment wall)
CREATE POLICY "Authenticated can read active packages"
  ON packages FOR SELECT
  TO authenticated
  USING (status = 'active'::package_status);
