-- Atomic audit log insertion using pgcrypto + advisory lock per tenant.
-- Replaces the non-atomic read-then-insert in logAuditEvent (TypeScript),
-- preventing concurrent writes from producing duplicate prev_hash values.

CREATE OR REPLACE FUNCTION insert_audit_log_signed(
  p_tenant_id   uuid,
  p_user_id     uuid,
  p_action      text,
  p_detail      text,
  p_signing_key text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_prev_sig  text;
  v_prev_hash text;
  v_payload   text;
  v_signature text;
BEGIN
  -- Serialize chain writes per tenant; lock is released when this transaction ends
  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id::text)::bigint);

  -- Fetch the most recent signed entry for this tenant
  SELECT signature INTO v_prev_sig
  FROM audit_logs
  WHERE tenant_id = p_tenant_id
    AND signature IS NOT NULL
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  -- Compute prev_hash (matches sha256Hex in lib/audit.ts)
  IF v_prev_sig IS NOT NULL THEN
    v_prev_hash := encode(digest(v_prev_sig, 'sha256'), 'hex');
  ELSE
    v_prev_hash := '0000000000000000000000000000000000000000000000000000000000000000';
  END IF;

  -- Build compact JSON payload matching JS JSON.stringify({ action, detail, prev_hash, tenant_id })
  v_payload :=
    '{"action":'    || to_json(p_action)         ||
    ',"detail":'    || to_json(p_detail)          ||
    ',"prev_hash":' || to_json(v_prev_hash)       ||
    ',"tenant_id":' || to_json(p_tenant_id::text) || '}';

  -- HMAC-SHA256; key is hex-decoded to match Buffer.from(key,'hex') in Node.js
  v_signature := encode(
    hmac(v_payload::bytea, decode(p_signing_key, 'hex'), 'sha256'),
    'hex'
  );

  INSERT INTO audit_logs (tenant_id, user_id, action, detail, signature, prev_hash)
  VALUES (p_tenant_id, p_user_id, p_action, p_detail, v_signature, v_prev_hash);
END;
$$;

REVOKE ALL ON FUNCTION insert_audit_log_signed(uuid, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION insert_audit_log_signed(uuid, uuid, text, text, text) TO service_role;
