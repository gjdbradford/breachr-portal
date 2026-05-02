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
  status: string
  created_at: string
}
