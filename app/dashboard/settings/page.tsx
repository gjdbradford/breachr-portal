import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SettingsTabs from '@/components/settings/SettingsTabs'
import { resolvePermissions } from '@/lib/resolve-permissions'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, email, role, phone')
    .eq('supabase_uid', user.id)
    .single()
  if (!profile) redirect('/login')

  const [{ data: tenant }, resolved] = await Promise.all([
    supabase
      .from('tenants')
      .select('name, industry, company_size, country, timezone, compliance_frameworks')
      .eq('id', profile.tenant_id)
      .single(),
    resolvePermissions(user.id),
  ])

  const tenantData = tenant ?? { name: '', industry: '', company_size: '', country: null, timezone: 'UTC', compliance_frameworks: [] }
  const userData   = { email: profile.email ?? user.email ?? '', role: profile.role ?? 'member', phone: profile.phone ?? '' }

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>SETTINGS</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Manage your account and compliance preferences</p>
        </div>
      </div>
      <SettingsTabs
        tenant={tenantData}
        user={userData}
        tenantId={profile.tenant_id}
        currentUserId={user.id}
        canInvite={resolved['team.invite']}
      />
    </div>
  )
}
