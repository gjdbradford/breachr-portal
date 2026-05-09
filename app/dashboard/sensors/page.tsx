import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SensorsClient from '@/components/SensorsClient'

export default async function SensorsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('supabase_uid', user.id).single()
  if (!profile) redirect('/login')

  const { data: sensors } = await supabase
    .from('sensors')
    .select('id, name, location, last_seen, status, deployment_type')
    .eq('tenant_id', profile.tenant_id)
    .order('name', { ascending: true })

  const sensorIds = (sensors ?? []).map(s => s.id)
  const { data: assetRows } = sensorIds.length > 0
    ? await supabase.from('assets').select('sensor_id').in('sensor_id', sensorIds).eq('is_active', true)
    : { data: [] }

  const assetCountMap: Record<string, number> = {}
  for (const a of assetRows ?? []) {
    assetCountMap[a.sensor_id] = (assetCountMap[a.sensor_id] ?? 0) + 1
  }

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>SENSORS</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            {(sensors ?? []).length} sensor{(sensors ?? []).length !== 1 ? 's' : ''} registered
          </p>
        </div>
      </div>
      <SensorsClient sensors={sensors ?? []} assetCountMap={assetCountMap} />
    </div>
  )
}
