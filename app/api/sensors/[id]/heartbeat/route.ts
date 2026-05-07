// portal/app/api/sensors/[id]/heartbeat/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const PortSchema = z.object({
  port:     z.number().int().min(1).max(65535),
  protocol: z.enum(['tcp', 'udp']),
  service:  z.string().optional(),
  banner:   z.string().optional(),
})

const AssetSchema = z.object({
  ip:       z.union([z.string().ipv4(), z.string().ipv6()]),
  mac:      z.string().regex(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i),
  hostname: z.string().optional(),
  vendor:   z.string().optional(),
  os_guess: z.string().optional(),
  ports:    z.array(PortSchema).default([]),
})

const HeartbeatSchema = z.object({
  assets: z.array(AssetSchema).min(0).max(500),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sensorId } = await params

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

  if (!sensor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
  let upserted = 0

  for (const asset of assets) {
    // upsert_asset uses COALESCE to preserve existing hostname/vendor/os_guess
    const { data: rows } = await admin.rpc('upsert_asset', {
      p_tenant_id: sensor.tenant_id,
      p_sensor_id: sensorId,
      p_ip:        asset.ip,
      p_mac:       asset.mac,
      p_hostname:  asset.hostname ?? null,
      p_vendor:    asset.vendor ?? null,
      p_os_guess:  asset.os_guess ?? null,
      p_last_seen: now,
    })

    const upsertedAsset = rows?.[0]
    if (!upsertedAsset) continue

    upserted++

    // Upsert ports
    if (asset.ports.length > 0) {
      await admin.from('asset_ports').upsert(
        asset.ports.map(p => ({
          asset_id:  upsertedAsset.id,
          port:      p.port,
          protocol:  p.protocol,
          service:   p.service ?? null,
          banner:    p.banner ?? null,
          last_seen: now,
        })),
        { onConflict: 'asset_id,port,protocol', ignoreDuplicates: false }
      )
    }
  }

  // Mark assets not seen in 24h as inactive
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  await admin
    .from('assets')
    .update({ is_active: false })
    .eq('sensor_id', sensorId)
    .lt('last_seen', cutoff)
    .eq('is_active', true)

  // Update sensor last_seen
  await admin.from('sensors').update({ last_seen: now }).eq('id', sensorId)

  return NextResponse.json({ upserted })
}
