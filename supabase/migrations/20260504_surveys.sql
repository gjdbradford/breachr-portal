-- ============================================================
-- Migration: Customer Feedback Surveys
-- Tables: surveys, survey_responses, survey_dismissals
-- ============================================================

CREATE TABLE surveys (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      text NOT NULL,
  type                      text NOT NULL CHECK (type IN ('nps','csat','pmf','feature_request','exit')),
  trigger_event             text,            -- null = not event-triggered
  trigger_count             integer,         -- fire when user hits Nth occurrence of trigger_event
  trigger_days_after_signup integer,         -- fire N days after user signup
  cooldown_days             integer NOT NULL DEFAULT 30,
  questions                 jsonb NOT NULL,  -- [{ id, type, text, options?, optional? }]
  active                    boolean NOT NULL DEFAULT true,
  created_at                timestamptz DEFAULT now()
);

CREATE TABLE survey_responses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id    uuid REFERENCES surveys(id) ON DELETE CASCADE NOT NULL,
  tenant_id    uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  triggered_by text,           -- event name that triggered it, or 'schedule'
  answers      jsonb NOT NULL, -- { question_id: value }
  nps_score    integer,        -- denormalised for fast admin queries
  csat_score   integer,
  pmf_score    text,           -- 'Very disappointed' | 'Somewhat disappointed' | 'Not disappointed'
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX idx_survey_responses_user_id    ON survey_responses(user_id);
CREATE INDEX idx_survey_responses_survey_id  ON survey_responses(survey_id);
CREATE INDEX idx_survey_responses_created_at ON survey_responses(created_at DESC);

CREATE TABLE survey_dismissals (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid REFERENCES surveys(id) ON DELETE CASCADE NOT NULL,
  user_id   uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(survey_id, user_id)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE surveys           ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_dismissals ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read active surveys
CREATE POLICY "auth_read_active_surveys" ON surveys
  FOR SELECT TO authenticated USING (active = true);
CREATE POLICY "service_full_surveys" ON surveys
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users can submit and read their own responses
CREATE POLICY "auth_insert_own_response" ON survey_responses
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "auth_read_own_responses" ON survey_responses
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "service_full_survey_responses" ON survey_responses
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Users can dismiss surveys
CREATE POLICY "auth_insert_own_dismissal" ON survey_dismissals
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "auth_read_own_dismissals" ON survey_dismissals
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "service_full_survey_dismissals" ON survey_dismissals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ── Seed surveys ──────────────────────────────────────────────────────────────

INSERT INTO surveys (name, type, trigger_event, trigger_count, trigger_days_after_signup, cooldown_days, questions) VALUES

-- NPS: fires after 5th completed scan, every 90 days
('Net Promoter Score', 'nps', 'scan.completed', 5, null, 90,
'[
  {"id":"q1","type":"rating_10","text":"How likely are you to recommend Breachr to a compliance peer or colleague?"},
  {"id":"q2","type":"open_text","text":"What is the main reason for your score?","optional":true}
]'::jsonb),

-- CSAT: fires 3 days after signup, every 60 days
('Product Satisfaction', 'csat', null, null, 3, 60,
'[
  {"id":"q1","type":"rating_5","text":"How satisfied are you with Breachr overall?"},
  {"id":"q2","type":"rating_5","text":"How easy is it to understand and act on your scan results?"},
  {"id":"q3","type":"open_text","text":"What could we improve?","optional":true}
]'::jsonb),

-- PMF (Sean Ellis method): fires 14 days after signup, every 120 days
('Product-Market Fit', 'pmf', null, null, 14, 120,
'[
  {"id":"q1","type":"choice","text":"How would you feel if you could no longer use Breachr?","options":["Very disappointed","Somewhat disappointed","Not disappointed"]}
]'::jsonb),

-- Feature request: fires 30 days after signup, every 90 days
('Feature Wishlist', 'feature_request', null, null, 30, 90,
'[
  {"id":"q1","type":"open_text","text":"What one feature or improvement would make the biggest difference for your compliance workflow?"},
  {"id":"q2","type":"choice","text":"Which area matters most to you right now?","options":["Scan coverage & speed","Report quality","DORA / NIS2 compliance depth","Integrations & APIs","Pricing & value","Other"]}
]'::jsonb),

-- Exit survey: fires on cancellation event, no cooldown
('Exit Survey', 'exit', 'billing.plan_cancelled', 1, null, 0,
'[
  {"id":"q1","type":"choice","text":"What is the main reason you are cancelling?","options":["Too expensive","Missing features I need","Switching to a competitor","No longer need pentesting","Technical issues","Other"]},
  {"id":"q2","type":"open_text","text":"Is there anything we could have done differently?","optional":true}
]'::jsonb);
