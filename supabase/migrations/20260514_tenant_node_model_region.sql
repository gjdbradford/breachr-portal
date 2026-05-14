-- supabase/migrations/20260514_tenant_node_model_region.sql
alter table tenants
  add column if not exists node_count        smallint not null default 1,
  add column if not exists ai_model_override text,
  add column if not exists data_region       text not null default 'eu';
