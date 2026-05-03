import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AuditChain from '@/components/AuditChain'
import type { AuditLog } from '@/lib/types'

export default async function AuditPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: true })

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>AUDIT TRAIL</h1>
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Cryptographically chained log — tamper-evident, regulator-ready</p>
        </div>
      </div>
      <AuditChain entries={(logs ?? []) as AuditLog[]} />
    </div>
  )
}
