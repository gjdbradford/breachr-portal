-- role_permissions: per-tenant, per-role default permissions
-- account_owner is always unrestricted; only 'admin' and 'member' rows are stored.
CREATE TABLE IF NOT EXISTS role_permissions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('admin', 'member')),
  permission text NOT NULL,
  enabled    boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, role, permission)
);

-- Only the account_owner can read or modify role permissions.
-- We enforce this at the API layer (service-role key bypasses RLS for seeding).
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY role_permissions_owner_only ON role_permissions
  FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users
      WHERE supabase_uid = auth.uid() AND role = 'account_owner'
    )
  );

CREATE INDEX IF NOT EXISTS role_permissions_tenant_role_idx
  ON role_permissions (tenant_id, role);
