import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SensorDetail from '@/components/SensorDetail'

export default async function SensorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(id)) notFound()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, role')
    .eq('supabase_uid', user.id)
    .single()
  if (!profile) redirect('/login')

  const [{ data: sensor }, { data: tenantRow }] = await Promise.all([
    supabase
      .from('sensors')
      .select('id, name, location, last_seen, status, deployment_type')
      .eq('id', id)
      .eq('tenant_id', profile.tenant_id)
      .single(),
    supabase
      .from('tenants')
      .select('timezone')
      .eq('id', profile.tenant_id)
      .single(),
  ])

  if (!sensor) notFound()

  const canManage = ['admin', 'account_owner'].includes(profile.role)

  return (
    <div style={{ padding: 32 }}>
      <SensorDetail
        sensor={sensor}
        canManage={canManage}
        timezone={tenantRow?.timezone ?? 'UTC'}
      />
    </div>
  )
}
