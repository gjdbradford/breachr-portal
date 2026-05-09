import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

const VALID_CRITICALITY  = new Set(['mission_critical', 'business_essential', 'business_support', 'non_essential'])
const VALID_ASSET_TYPES  = new Set(['server', 'workstation', 'network_device', 'iot', 'cloud_service', 'mobile', 'other'])
const CLASSIFICATION_FIELDS = ['criticality', 'asset_type_label', 'department', 'owner_name', 'owner_email', 'physical_location', 'classification_notes'] as const
type ClassificationField = typeof CLASSIFICATION_FIELDS[number]

function recordHash(assetId: string, field: string, oldValue: string | null, newValue: string | null, changedBy: string, changedAt: string): string {
  const payload = [assetId, field, oldValue ?? '', newValue ?? '', changedBy, changedAt].join('|')
  return createHash('sha256').update(payload).digest('hex')
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: assetId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: profile } = await admin.from('users').select('tenant_id, role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['account_owner', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Verify asset belongs to this tenant
  const { data: asset } = await admin
    .from('assets')
    .select('id, criticality, asset_type_label, department, owner_name, owner_email, physical_location, classification_notes')
    .eq('id', assetId)
    .eq('tenant_id', profile.tenant_id)
    .single()
  if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))

  // Validate
  if ('criticality' in body && body.criticality !== null && !VALID_CRITICALITY.has(body.criticality)) {
    return NextResponse.json({ error: 'Invalid criticality value' }, { status: 400 })
  }
  if ('asset_type_label' in body && body.asset_type_label !== null && !VALID_ASSET_TYPES.has(body.asset_type_label)) {
    return NextResponse.json({ error: 'Invalid asset_type_label value' }, { status: 400 })
  }

  // Build update payload and audit log entries
  const updates: Record<string, string | null> = {}
  const logRows: object[] = []
  const changedAt = new Date().toISOString()

  for (const field of CLASSIFICATION_FIELDS) {
    if (!(field in body)) continue
    const newValue = body[field] ?? null
    const oldValue = (asset as Record<string, string | null>)[field] ?? null
    if (newValue === oldValue) continue

    updates[field] = newValue
    logRows.push({
      asset_id:    assetId,
      tenant_id:   profile.tenant_id,
      changed_by:  user.id,
      changed_at:  changedAt,
      field,
      old_value:   oldValue,
      new_value:   newValue,
      record_hash: recordHash(assetId, field, oldValue, newValue, user.id, changedAt),
    })
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, changed: 0 })
  }

  updates.classified_at = changedAt
  updates.classified_by = user.id

  const [{ error: updateErr }, { error: logErr }] = await Promise.all([
    admin.from('assets').update(updates).eq('id', assetId),
    admin.from('asset_classification_log').insert(logRows),
  ])

  if (updateErr || logErr) {
    console.error('[classify]', updateErr ?? logErr)
    return NextResponse.json({ error: 'Failed to save classification' }, { status: 503 })
  }

  return NextResponse.json({ ok: true, changed: logRows.length })
}
