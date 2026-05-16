// portal/app/api/sensors/[id]/heartbeat/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { sendNewDeviceAlert } from '@/lib/email'
import { logAuditEvent } from '@/lib/audit-log'

const PortSchema = z.object({
  port:     z.number().int().min(1).max(65535),
  protocol: z.enum(['tcp', 'udp']),
  service:  z.string().max(100).nullish(),
  banner:   z.string().max(500).nullish(),
})

const AssetSchema = z.object({
  ip:       z.union([z.string().ipv4(), z.string().ipv6()]),
  mac:      z.string().regex(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i),
  hostname: z.string().max(253).nullish(),
  vendor:   z.string().max(100).nullish(),
  os_guess: z.string().max(100).nullish(),
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
    .select('id, tenant_id, token_hash, status, name')
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

  type AssetResult = {
    id: string
    ports: z.infer<typeof PortSchema>[]
    isNew: boolean
    ip: string
    mac: string
    hostname: string | null
    vendor: string | null
  }
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
        return {
          id:       row.id,
          ports:    asset.ports,
          isNew:    row.is_new as boolean,
          ip:       asset.ip,
          mac:      asset.mac,
          hostname: asset.hostname ?? null,
          vendor:   asset.vendor ?? null,
        }
      })
    )
    assetResults.push(...settled.filter((r): r is AssetResult => r !== null))
  }

  // Fire email alerts for brand-new assets (fire-and-forget)
  const newAssets = assetResults.filter(r => r.isNew)
  if (newAssets.length > 0) {
    ;(async () => {
      try {
        const { data: members } = await admin.from('users').select('id').eq('tenant_id', sensor.tenant_id)
        const authResults = await Promise.all((members ?? []).map(m => admin.auth.admin.getUserById(m.id)))
        const emails = authResults.flatMap(r => r.data.user?.email ? [r.data.user.email] : [])
        for (const asset of newAssets) {
          for (const email of emails) {
            sendNewDeviceAlert({
              to:             email,
              deviceIp:       asset.ip,
              deviceMac:      asset.mac,
              deviceHostname: asset.hostname,
              deviceVendor:   asset.vendor,
              sensorName:     (sensor as { name?: string }).name ?? null,
              assetId:        asset.id,
            })
          }
        }
      } catch (err) {
        console.error('[heartbeat] email dispatch failed:', err)
      }
    })()
  }

  // Audit log new device discoveries sequentially (chain integrity requires sequential writes)
  if (newAssets.length > 0) {
    ;(async () => {
      for (const asset of newAssets) {
        await logAuditEvent({
          tenantId: sensor.tenant_id,
          userId:   null,
          action:   'asset.discovered',
          detail:   { assetId: asset.id, ip: asset.ip, mac: asset.mac, hostname: asset.hostname, sensorId },
        }).catch(err => console.error('[heartbeat] audit log failed:', err))
      }
    })()
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

  // Only log when new assets are discovered — logging every heartbeat would generate millions of rows/day at scale
  if (newAssets.length > 0) {
    admin.from('sensor_logs').insert({
      sensor_id:  sensorId,
      tenant_id:  sensor.tenant_id,
      event_type: 'assets_discovered',
      message:    `${newAssets.length} new asset${newAssets.length !== 1 ? 's' : ''} discovered`,
      metadata:   { new_assets: newAssets.length, asset_count: assets.length, ips: newAssets.map(a => a.ip) },
    }).then(({ error: logErr }) => {
      if (logErr) console.error('[heartbeat] sensor_logs insert failed:', logErr.message)
    })
  }

  return NextResponse.json({ upserted })
}
