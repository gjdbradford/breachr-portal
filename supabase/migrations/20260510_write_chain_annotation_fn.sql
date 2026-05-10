CREATE OR REPLACE FUNCTION write_chain_annotation(
  p_id             bigint,
  p_annotation     text,
  p_annotation_by  uuid,
  p_annotation_at  timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  SET LOCAL session_replication_role = 'replica';
  UPDATE audit_logs
  SET
    chain_annotation    = p_annotation,
    chain_annotation_by = p_annotation_by,
    chain_annotation_at = p_annotation_at
  WHERE id = p_id;
END;
$$;
