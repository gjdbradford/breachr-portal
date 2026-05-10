-- portal/supabase/migrations/20260510_webhook_events.sql
CREATE TABLE IF NOT EXISTS webhook_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  type        text        NOT NULL,
  to_email    text        NOT NULL,
  subject     text,
  payload     jsonb,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_to_received
  ON webhook_events (to_email, received_at DESC);
