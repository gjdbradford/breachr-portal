import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import FindingsTable from '@/components/FindingsTable'

export default async function FindingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const { data: findings } = await supabase
    .from('findings')
    .select('*, scans(id, scan_type, attack_surfaces(name, target_url))')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: false })

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>FINDINGS</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{findings?.length ?? 0} total findings across all scans</p>
        </div>
      </div>
      <FindingsTable findings={findings ?? []} />
    </div>
  )
}
