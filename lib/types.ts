export type Plan = 'freemium' | 'professional' | 'enterprise' | 'custom'
export type Industry = 'banking' | 'insurance' | 'healthtech' | 'payments' | 'energy' | 'other'
export type CompanySize = '1-10' | '11-50' | '51-200' | '201-1000' | '1000+'

export interface Tenant {
  id: string
  name: string
  domain: string | null
  plan: Plan
  company_size: CompanySize | null
  industry: Industry | null
  phone: string | null
  onboarding_complete: boolean
  created_at: string
}

export interface UserProfile {
  id: string
  tenant_id: string
  email: string
  role: string
  created_at: string
}

export interface AttackSurface {
  id: string
  tenant_id: string
  name: string
  target_url: string
  target_type: string
  active: boolean
  created_at: string
}

export interface Scan {
  id: string
  tenant_id: string
  attack_surface_id: string
  status: 'queued' | 'running' | 'complete' | 'failed' | 'cancelled'
  scan_type: string
  model_used: string | null
  tests_run: number
  tests_total: number
  progress_pct: number
  current_phase: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  attack_surfaces?: AttackSurface
}

export interface Finding {
  id: string
  scan_id: string
  tenant_id: string
  title: string
  description: string | null
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  cvss_score: number | null
  owasp_category: string | null
  status: 'open' | 'in_progress' | 'remediated' | 'verified_fixed' | 'accepted_risk' | string
  ai_model: string | null
  ai_confidence: number | null
  finding_hash: string | null
  remediation: string | null
  created_at: string
}

export interface AuditLog {
  id: string
  tenant_id: string
  user_id: string | null
  action: string
  detail: string | null
  signature: string | null
  prev_hash: string | null
  created_at: string
  chain_annotation: string | null
  chain_annotation_by: string | null
  chain_annotation_at: string | null
}

export const DORA_ARTICLES = [
  { ref: 'Art. 5–10', name: 'ICT Risk Management', desc: 'Governance framework' },
  { ref: 'Art. 17',   name: 'ICT Incident Management', desc: 'Classification & reporting' },
  { ref: 'Art. 24',   name: 'General ICT Testing', desc: 'Annual pen test coverage' },
  { ref: 'Art. 25',   name: 'Advanced Testing', desc: 'TLPT every 3 years' },
  { ref: 'Art. 26',   name: 'TIBER-EU TLPT', desc: 'Significant entities only' },
  { ref: 'Art. 28–30', name: 'Third-party ICT Risk', desc: 'Vendor pen testing' },
]

export interface DataExport {
  id: string
  tenant_id: string
  requested_by: string
  data_type: 'findings' | 'inventory' | 'audit_trail'
  format: 'csv' | 'xlsx'
  filters: Record<string, string>
  status: 'pending' | 'processing' | 'ready' | 'failed' | 'expired'
  file_path: string | null
  row_count: number | null
  error_msg: string | null
  expires_at: string | null
  created_at: string
  completed_at: string | null
  signed_url?: string | null  // generated on demand, not stored
}
