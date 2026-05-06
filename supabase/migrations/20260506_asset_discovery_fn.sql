CREATE OR REPLACE FUNCTION upsert_asset(
  p_tenant_id uuid,
  p_sensor_id uuid,
  p_ip        text,
  p_mac       text,
  p_hostname  text,
  p_vendor    text,
  p_os_guess  text,
  p_last_seen timestamptz
) RETURNS TABLE (id uuid, hostname text, os_guess text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_hostname text;
  v_os_guess text;
BEGIN
  INSERT INTO assets (tenant_id, sensor_id, ip, mac, hostname, vendor, os_guess, last_seen, is_active)
  VALUES (p_tenant_id, p_sensor_id, p_ip::inet, p_mac::macaddr, p_hostname, p_vendor, p_os_guess, p_last_seen, true)
  ON CONFLICT (tenant_id, mac) DO UPDATE SET
    ip        = EXCLUDED.ip,
    sensor_id = EXCLUDED.sensor_id,
    last_seen = EXCLUDED.last_seen,
    is_active = true,
    hostname  = COALESCE(assets.hostname, EXCLUDED.hostname),
    vendor    = COALESCE(assets.vendor,   EXCLUDED.vendor),
    os_guess  = COALESCE(assets.os_guess, EXCLUDED.os_guess)
  RETURNING assets.id, assets.hostname, assets.os_guess INTO v_id, v_hostname, v_os_guess;

  RETURN QUERY SELECT v_id, v_hostname, v_os_guess;
END;
$$;
