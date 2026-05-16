import { createHash, createHmac } from 'crypto'
import { createClient as adminClient } from '@supabase/supabase-js'
import type { RemediationStatusSource } from '@/lib/types'

const GENESIS_HASH = '0'.repeat(64)

function makeAdmin() {
  return adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

function hmacSha256Hex(key: string, data: string): string {
  return createHmac('sha256', Buffer.from(key, 'hex')).update(data, 'utf8').digest('hex')
}

async function getPrevHash(
  admin: ReturnType<typeof adminClient>,
  taskId: string,
  tenantId: string,
): Promise<string> {
  const { data } = await admin
    .from('remediation_status_log')
    .select('signature')
    .eq('task_id', taskId)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data?.signature) return GENESIS_HASH
  return sha256Hex(data.signature)
}

export async function logRemediationStatusChange({
  taskId,
  tenantId,
  fromStatus,
  toStatus,
  changedBy,
  source,
  note,
  scanResultSummary,
}: {
  taskId: string
  tenantId: string
  fromStatus: string
  toStatus: string
  changedBy: string | null
  source: RemediationStatusSource
  note?: string
  scanResultSummary?: string
}): Promise<void> {
  const signingKey = process.env.AUDIT_SIGNING_KEY
  if (!signingKey) {
    console.warn('[remediation-audit] AUDIT_SIGNING_KEY not set — skipping')
    return
  }

  const admin = makeAdmin()
  const ts = new Date().toISOString()
  const prevHash = await getPrevHash(admin, taskId, tenantId)

  const payload = `${taskId}|${fromStatus}|${toStatus}|${source}|${ts}|${prevHash}`
  const signature = hmacSha256Hex(signingKey, payload)

  const logRow = {
    task_id:             taskId,
    tenant_id:           tenantId,
    from_status:         fromStatus,
    to_status:           toStatus,
    changed_by:          changedBy ?? undefined,
    source,
    note:                note ?? undefined,
    scan_result_summary: scanResultSummary ?? undefined,
    prev_hash:           prevHash,
    signature,
    created_at:          ts,
  }

  const { error: logError } = await admin
    .from('remediation_status_log')
    .insert(logRow)

  if (logError) {
    console.error('[remediation-audit] status log insert failed:', logError.message)
    return
  }

  // Cross-reference in tenant-wide audit log (non-fatal if this fails)
  const detailStr = JSON.stringify({
    task_id:     taskId,
    from_status: fromStatus,
    to_status:   toStatus,
    source,
    _ts:         ts,
  })

  const { error: auditError } = await admin
    .from('audit_logs')
    .insert({
      tenant_id:    tenantId,
      user_id:      changedBy ?? null,
      action:       'remediation.task_status_changed',
      detail:       detailStr,
      reference_id: taskId,
    })

  if (auditError) {
    console.error('[remediation-audit] audit_logs cross-reference failed:', auditError.message)
  }
}
