CREATE TABLE IF NOT EXISTS tenants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    domain text,
    plan text DEFAULT 'freemium'::text NOT NULL,
    fusionauth_tenant_id text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    onboarding_complete bool DEFAULT false NOT NULL,
    company_size text,
    industry text,
    phone text,
    monthly_budget_usd numeric(10,2) DEFAULT 50.00,
    budget_used_usd numeric(10,2) DEFAULT 0,
    budget_reset_at timestamptz DEFAULT (date_trunc('month'::text, now()) + '1 mon'::interval),
    tokens_used_this_month int DEFAULT 0,
    plan_scans_limit int DEFAULT 3,
    plan_targets_limit int DEFAULT 1,
    plan_tokens_limit bigint DEFAULT 200000,
    scans_this_month int DEFAULT 0,
    plan_reset_at timestamptz DEFAULT (date_trunc('month'::text, now()) + '1 mon'::interval),
    stripe_customer_id text,
    payment_failed bool DEFAULT false,
    mrr_eur int DEFAULT 0 NOT NULL,
    lifetime_revenue_eur int DEFAULT 0 NOT NULL,
    plan_started_at timestamptz,
    cac_eur int,
    activated_at timestamptz,
    first_target_at timestamptz,
    first_scan_at timestamptz,
    last_scan_at timestamptz,
    last_login_at timestamptz,
    cancelled_at timestamptz,
    total_scans_all_time int DEFAULT 0 NOT NULL,
    total_findings_all_time int DEFAULT 0 NOT NULL,
    total_cost_usd_all_time numeric(10,4) DEFAULT 0 NOT NULL,
    churn_risk_score numeric(5,2),
    compliance_frameworks text[] DEFAULT '{}'::text[],
    country text,
    referral_source text,
    total_tokens_all_time bigint DEFAULT 0,
    is_enterprise_managed bool DEFAULT false,
    max_concurrent_scans int DEFAULT 1,
    environments jsonb DEFAULT '[]'::jsonb,
    cancellation_reason text,
    stripe_subscription_id text
);

CREATE TABLE IF NOT EXISTS cve_cache (
    cve_id text NOT NULL,
    data jsonb NOT NULL,
    fetched_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS surveys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    trigger_event text,
    trigger_count int,
    trigger_days_after_signup int,
    cooldown_days int DEFAULT 30 NOT NULL,
    questions jsonb NOT NULL,
    active bool DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    fusionauth_user_id text,
    email text NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    is_superuser bool DEFAULT false NOT NULL,
    last_login_at timestamptz,
    login_count int DEFAULT 0 NOT NULL,
    onboarding_completed_at timestamptz,
    first_name text,
    last_name text
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    plan text NOT NULL,
    billing_period text DEFAULT 'monthly'::text NOT NULL,
    mrr_eur int DEFAULT 0 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    trial_ends_at timestamptz,
    current_period_start timestamptz,
    current_period_end timestamptz,
    stripe_sub_id text,
    cancelled_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS subscription_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    event_type text NOT NULL,
    from_plan text,
    to_plan text,
    mrr_delta_eur int,
    mrr_after_eur int,
    billing_period text,
    stripe_event_id text,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS token_purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    tokens_purchased bigint NOT NULL,
    amount_eur int NOT NULL,
    stripe_payment_id text,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS cancellations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    reason text,
    reason_category text,
    access_until timestamptz,
    refund_requested bool DEFAULT false NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    email text NOT NULL,
    invited_by uuid NOT NULL,
    role text DEFAULT 'admin'::text NOT NULL,
    supabase_user_id uuid,
    expires_at timestamptz NOT NULL,
    accepted_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS enquiries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name text NOT NULL,
    last_name text,
    email text NOT NULL,
    company text NOT NULL,
    role text,
    message text,
    source text DEFAULT 'website'::text,
    status text DEFAULT 'new'::text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    phone text,
    company_size text,
    industry text,
    password_hash text
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id bigint NOT NULL,
    tenant_id uuid,
    user_id uuid,
    action text NOT NULL,
    resource text,
    resource_id uuid,
    metadata jsonb,
    ip_address inet,
    created_at timestamptz DEFAULT now() NOT NULL,
    signature text,
    prev_hash text,
    detail text
);

CREATE TABLE IF NOT EXISTS deletion_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    user_id uuid,
    requested_by_email text NOT NULL,
    reason text,
    status text DEFAULT 'pending'::text NOT NULL,
    resolved_at timestamptz,
    resolved_by text,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS deletion_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deletion_request_id uuid NOT NULL,
    data_categories_purged text DEFAULT 'users,tenants,scans,findings,events,subscriptions,admin_notes'::text NOT NULL,
    completed_by text NOT NULL,
    deleted_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS sandbox_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    environment text DEFAULT 'isolated'::text NOT NULL,
    cloud_provider text,
    region text DEFAULT 'eu-central-1'::text,
    config jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    name text NOT NULL,
    filters_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid,
    event text NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS survey_dismissals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    survey_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS survey_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    survey_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    user_id uuid NOT NULL,
    triggered_by text,
    answers jsonb NOT NULL,
    nps_score int,
    csat_score int,
    pmf_score text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    crest_certified bool DEFAULT false NOT NULL,
    certifications text[] DEFAULT '{}'::text[] NOT NULL,
    available bool DEFAULT true NOT NULL,
    active_engagement_count int DEFAULT 0 NOT NULL,
    max_concurrent int DEFAULT 2 NOT NULL,
    seniority text,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    sensor_id uuid NOT NULL,
    ip inet NOT NULL,
    mac macaddr NOT NULL,
    hostname text,
    vendor text,
    os_guess text,
    first_seen timestamptz DEFAULT now() NOT NULL,
    last_seen timestamptz DEFAULT now() NOT NULL,
    is_active bool DEFAULT true NOT NULL,
    risk_score int DEFAULT 0 NOT NULL,
    acknowledged_at timestamptz,
    criticality text,
    asset_type_label text,
    department text,
    owner_name text,
    owner_email text,
    physical_location text,
    classification_notes text,
    classified_at timestamptz,
    classified_by uuid
);

CREATE TABLE IF NOT EXISTS scans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    attack_surface_id uuid NOT NULL,
    triggered_by uuid,
    status text DEFAULT 'queued'::text NOT NULL,
    scan_type text DEFAULT 'automated'::text NOT NULL,
    llm_provider text,
    llm_model text,
    llm_version text,
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    model_used text,
    tests_run int DEFAULT 0 NOT NULL,
    tests_total int DEFAULT 1247 NOT NULL,
    progress_pct int DEFAULT 0 NOT NULL,
    current_phase text,
    tokens_input int DEFAULT 0,
    tokens_output int DEFAULT 0,
    cost_usd numeric(10,6) DEFAULT 0,
    target_url text,
    findings_count int DEFAULT 0 NOT NULL,
    critical_count int DEFAULT 0 NOT NULL,
    error_message text,
    queue_wait_ms int,
    probe_duration_ms int,
    analysis_duration_ms int,
    total_duration_ms int,
    error_type text,
    high_count int DEFAULT 0,
    medium_count int DEFAULT 0,
    low_count int DEFAULT 0,
    false_positive_count int DEFAULT 0,
    prompt_cache_hit bool,
    ai_latency_ms int
);

CREATE TABLE IF NOT EXISTS sensors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    token_hash text NOT NULL,
    location text,
    last_seen timestamptz,
    status text DEFAULT 'active'::text NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    deployment_type text DEFAULT 'docker'::text NOT NULL
);

CREATE TABLE IF NOT EXISTS engagements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    tenant_id uuid NOT NULL,
    phase text DEFAULT 'requested'::text NOT NULL,
    regulation_type text NOT NULL,
    value_eur int,
    start_date date,
    end_date date,
    bafin_notification_required bool DEFAULT false NOT NULL,
    rules_of_engagement text,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS findings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scan_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    severity text NOT NULL,
    cvss_score numeric(4,2),
    owasp_category text,
    mitre_technique text,
    llm_provider text,
    llm_model text,
    llm_version text,
    llm_confidence numeric(5,4),
    sha256_hash text,
    rsa_signature text,
    signed_at timestamptz,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    ai_model text,
    ai_confidence numeric(5,2),
    finding_hash text,
    remediation text,
    false_positive bool DEFAULT false NOT NULL,
    remediated_at timestamptz,
    days_to_remediate int,
    false_positive_at timestamptz,
    false_positive_by uuid,
    viewed_at timestamptz,
    recurrence_count int DEFAULT 0,
    replication_steps text,
    risk_acceptance_reason text,
    risk_accepted_by uuid
);

CREATE TABLE IF NOT EXISTS asset_ports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    port int NOT NULL,
    protocol text NOT NULL,
    service text,
    banner text,
    last_seen timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS asset_vulns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    cve_id text NOT NULL,
    severity text NOT NULL,
    cvss_score numeric(4,1),
    title text,
    last_checked timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS asset_classification_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    asset_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    changed_by uuid NOT NULL,
    changed_at timestamptz DEFAULT now() NOT NULL,
    field text NOT NULL,
    old_value text,
    new_value text,
    record_hash text NOT NULL
);

CREATE TABLE IF NOT EXISTS attack_surfaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    target_url text NOT NULL,
    target_type text DEFAULT 'web'::text NOT NULL,
    active bool DEFAULT true NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS compliance_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    finding_id uuid NOT NULL,
    framework text NOT NULL,
    article_ref text NOT NULL,
    article_title text,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS compliance_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    scan_id uuid,
    framework text NOT NULL,
    title text NOT NULL,
    status text DEFAULT 'generating'::text NOT NULL,
    storage_path text,
    sha256_hash text,
    rsa_signature text,
    page_count int,
    generated_at timestamptz,
    created_at timestamptz DEFAULT now() NOT NULL,
    findings_snapshot jsonb,
    framework_summary jsonb,
    pdf_hash text,
    pdf_generated_at timestamptz,
    report_type text DEFAULT 'scan'::text NOT NULL,
    report_period_start timestamptz,
    report_period_end timestamptz,
    scan_ids uuid[],
    scan_count int,
    targets_covered jsonb
);

CREATE TABLE IF NOT EXISTS ai_training_context (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    scan_type text,
    content text NOT NULL,
    enabled bool DEFAULT true NOT NULL,
    version int DEFAULT 1 NOT NULL,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS engagement_phases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    engagement_id uuid NOT NULL,
    phase_name text NOT NULL,
    started_at timestamptz,
    completed_at timestamptz,
    notes text,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS engagement_team (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    engagement_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    role text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS engagement_findings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    engagement_id uuid NOT NULL,
    title text NOT NULL,
    severity text NOT NULL,
    description text,
    evidence text,
    recommendation text,
    cvss_score numeric(3,1),
    created_by uuid,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_finding_quality (
    month timestamptz,
    severity text,
    total_findings bigint,
    false_positives bigint,
    false_positive_pct numeric,
    remediated bigint,
    avg_days_to_remediate numeric,
    avg_ai_confidence numeric
);

CREATE TABLE IF NOT EXISTS admin_funnel (
    id uuid,
    registered_at timestamptz,
    first_target_at timestamptz,
    first_scan_at timestamptz,
    activated_at timestamptz,
    plan text,
    mrr_eur int,
    last_login_at timestamptz,
    last_scan_at timestamptz,
    churn_risk_score numeric(5,2),
    funnel_stage text,
    mins_to_first_target numeric,
    mins_to_first_scan numeric,
    mins_to_activation numeric,
    days_since_login numeric,
    days_since_scan numeric
);

CREATE TABLE IF NOT EXISTS admin_mrr (
    plan text,
    tenant_count bigint,
    mrr_eur bigint,
    arr_eur bigint,
    arpu_eur numeric,
    total_scans bigint,
    total_tokens numeric,
    total_ai_cost_usd numeric
);

CREATE TABLE IF NOT EXISTS admin_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    content text NOT NULL,
    created_by text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_scan_metrics (
    scan_date timestamptz,
    scan_type text,
    model_used text,
    scan_count bigint,
    completed bigint,
    failed bigint,
    avg_duration_secs numeric,
    avg_tokens numeric,
    avg_cost_usd numeric,
    avg_findings numeric,
    cost_per_finding_usd numeric
);
