// portal/app/api/sensors/[id]/heartbeat/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const PortSchema = z.object({
  port:     z.number().int().min(1).max(65535),
  protocol: z.enum(['tcp', 'udp']),
  service:  z.string().max(100).optional(),
  banner:   z.string().max(500).optional(),
})

const AssetSchema = z.object({
  ip:       z.union([z.string().ipv4(), z.string().ipv6()]),
  mac:      z.string().regex(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i),
  hostname: z.string().max(253).optional(),
  vendor:   z.string().max(100).optional(),
  os_guess: z.string().max(100).optional(),
  ports:    z.array(PortSchema).max(1000).default([]),
})

const HeartbeatSchema = z.object({
  assets: z.array(AssetSchema).min(0).max(500),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sensorId } = await params

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!UUID_RE.test(sensorId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Validate sensor token
  const { data: sensor } = await admin
    .from('sensors')
    .select('id, tenant_id, token_hash, status')
    .eq('id', sensorId)
    .single()

  if (!sensor) {
    // Constant-time rejection to prevent sensor UUID enumeration via timing
    await bcrypt.compare(token, '$2b$10$invalidhashXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (sensor.status === 'disabled') return NextResponse.json({ error: 'Sensor disabled' }, { status: 403 })

  const valid = await bcrypt.compare(token, sensor.token_hash)
  if (!valid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = HeartbeatSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload', details: parsed.error.flatten() }, { status: 400 })
  }

  const { assets } = parsed.data
  const now = new Date().toISOString()

  const CONCURRENCY = 30

  type AssetResult = { id: string; ports: z.infer<typeof PortSchema>[] }
  const assetResults: AssetResult[] = []
  let upserted = 0

  for (let i = 0; i < assets.length; i += CONCURRENCY) {
    const batch = assets.slice(i, i + CONCURRENCY)
    const settled = await Promise.all(
      batch.map(async (asset) => {
        const { data: rows, error: rpcError } = await admin.rpc('upsert_asset', {
          p_tenant_id: sensor.tenant_id,
          p_sensor_id: sensorId,
          p_ip:        asset.ip,
          p_mac:       asset.mac,
          p_hostname:  asset.hostname ?? null,
          p_vendor:    asset.vendor ?? null,
          p_os_guess:  asset.os_guess ?? null,
          p_last_seen: now,
        })
        if (rpcError) {
          console.error('[heartbeat] upsert_asset failed for mac', asset.mac, rpcError.message)
          return null
        }
        const row = rows?.[0]
        if (!row) return null
        upserted++
        return { id: row.id, ports: asset.ports }
      })
    )
    assetResults.push(...settled.filter((r): r is AssetResult => r !== null))
  }

  // Single bulk port upsert for all assets
  const allPortRows = assetResults.flatMap(({ id, ports }) =>
    ports.map(p => ({
      asset_id:  id,
      port:      p.port,
      protocol:  p.protocol,
      service:   p.service ?? null,
      banner:    p.banner ?? null,
      last_seen: now,
    }))
  )
  if (allPortRows.length > 0) {
    const { error: portError } = await admin
      .from('asset_ports')
      .upsert(allPortRows, { onConflict: 'asset_id,port,protocol', ignoreDuplicates: false })
    if (portError) console.error('[heartbeat] port upsert failed', portError.message)
  }

  // Mark assets not seen in 24h as inactive
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { error: staleError } = await admin
    .from('assets')
    .update({ is_active: false })
    .eq('sensor_id', sensorId)
    .lt('last_seen', cutoff)
    .eq('is_active', true)
  if (staleError) console.error('[heartbeat] stale-asset update failed', staleError.message)

  // Update sensor last_seen
  const { error: sensorError } = await admin
    .from('sensors')
    .update({ last_seen: now })
    .eq('id', sensorId)
  if (sensorError) console.error('[heartbeat] sensor last_seen update failed', sensorError.message)

  return NextResponse.json({ upserted })
}
