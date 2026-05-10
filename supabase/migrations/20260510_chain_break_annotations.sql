ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS chain_annotation      text,
  ADD COLUMN IF NOT EXISTS chain_annotation_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS chain_annotation_at   timestamptz;
