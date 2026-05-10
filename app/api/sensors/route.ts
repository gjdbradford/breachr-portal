import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import bcrypt from 'bcryptjs'
import { VALID_DEPLOYMENT_TYPE_IDS, type DeploymentType } from '@/lib/sensor-types'
import { logAuditEvent } from '@/lib/audit-log'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('id, tenant_id').eq('supabase_uid', user.id).single()
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const rawName = body.name
  const name: string = (typeof rawName === 'string' ? rawName : '').trim()
  const rawLocation = body.location
  const location: string = (typeof rawLocation === 'string' ? rawLocation : '').trim()
  const rawDeploymentType = body.deployment_type
  const deploymentType: DeploymentType =
    VALID_DEPLOYMENT_TYPE_IDS.includes(rawDeploymentType) ? rawDeploymentType : 'docker'

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  if (name.length > 200)
    return NextResponse.json({ error: 'name must be 200 characters or fewer' }, { status: 400 })

  const token = randomBytes(32).toString('hex')
  const tokenHash = await bcrypt.hash(token, 10)

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: sensor, error } = await admin
    .from('sensors')
    .insert({
      tenant_id:       profile.tenant_id,
      name,
      location:        location || null,
      token_hash:      tokenHash,
      deployment_type: deploymentType,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[sensors] insert failed', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAuditEvent({
    tenantId: profile.tenant_id,
    userId:   profile.id,
    action:   'sensor.created',
    detail:   { sensorId: sensor.id, name, deploymentType },
  }).catch(err => console.error('[sensors] audit log failed:', err))

  await admin.from('sensor_logs').insert({
    sensor_id:  sensor.id,
    tenant_id:  profile.tenant_id,
    event_type: 'created',
    message:    `Sensor registered: ${name}`,
    metadata:   { deployment_type: deploymentType, location: location || null },
  })

  return NextResponse.json({ id: sensor.id, token }, { status: 201 })
}
