import { createClient as adminClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'
import { sha256Hex, GENESIS_HASH } from '@/lib/audit'

export const VALID_AUDIT_ACTIONS = [
  // User lifecycle
  'user.registered', 'user.invited', 'user.invite_accepted', 'user.login',
  'user.permissions_updated', 'user.role_changed',
  // Scans
  'scan.queued', 'scan.started', 'scan.completed', 'scan.launched', 'scan.cancelled',
  // Findings
  'finding.discovered', 'finding.verified_fixed', 'finding.status_changed', 'finding.acknowledged',
  // Assets / inventory
  'asset.discovered', 'asset.created', 'asset.updated', 'asset.classified', 'asset.acknowledged', 'asset.decommissioned',
  // Reports & exports
  'report.generated', 'report.viewed', 'report.exported',
  'export.requested', 'export.completed',
  // Remediation
  'remediation.updated',
  // Sensors
  'sensor.created', 'sensor.updated', 'sensor.activated', 'sensor.deactivated', 'sensor.token_regenerated',
  // Targets & settings
  'target.created', 'target.archived',
  'settings.updated',
] as const

export type AuditAction = typeof VALID_AUDIT_ACTIONS[number]

function hmacSha256Hex(key: string, data: string): string {
  return createHmac('sha256', Buffer.from(key, 'hex')).update(data, 'utf8').digest('hex')
}

export async function logAuditEvent({
  tenantId,
  userId,
  action,
  detail,
}: {
  tenantId: string
  userId: string | null
  action: AuditAction
  detail: Record<string, unknown>
}): Promise<void> {
  const signingKey = process.env.AUDIT_SIGNING_KEY
  if (!signingKey) {
    console.warn('[audit] AUDIT_SIGNING_KEY not set — skipping')
    return
  }

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const ts = new Date().toISOString()
  const detailStr = JSON.stringify({ ...detail, _ts: ts })

  const { data: lastEntry } = await admin
    .from('audit_logs')
    .select('signature')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const prevHash = lastEntry?.signature
    ? await sha256Hex(lastEntry.signature)
    : GENESIS_HASH

  const payload = JSON.stringify({ action, detail: detailStr, prev_hash: prevHash, tenant_id: tenantId })
  const signature = hmacSha256Hex(signingKey, payload)

  const { error } = await admin
    .from('audit_logs')
    .insert({
      tenant_id: tenantId,
      ...(userId !== null ? { user_id: userId } : {}),
      action,
      detail: detailStr,
      signature,
      prev_hash: prevHash,
    })

  if (error) console.error('[audit] insert failed:', error.message)
}
