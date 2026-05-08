import { NextResponse, type NextRequest } from 'next/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { sendExportReadyEmail } from '@/lib/email'

export const maxDuration = 300

const BATCH_SIZE  = 5
const EXPIRY_DAYS = 30

const ACTION_GROUPS: Record<string, string[]> = {
  scans:    ['scan.queued', 'scan.launched', 'scan.started', 'scan.completed'],
  findings: ['finding.discovered', 'finding.status_changed', 'finding.verified_fixed'],
  reports:  ['report.viewed', 'report.downloaded'],
  admin:    ['target.created', 'target.deleted', 'settings.updated'],
}
const DATE_PRESETS: Record<string, number> = { '24h': 1, '7d': 7, '30d': 30, '90d': 90 }

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // Expiry sweep
  const { data: expired } = await admin
    .from('data_exports')
    .select('id, file_path')
    .eq('status', 'ready')
    .lt('expires_at', new Date().toISOString())

  for (const row of expired ?? []) {
    if (row.file_path) {
      await admin.storage.from('exports').remove([row.file_path])
    }
    await admin.from('data_exports').update({ status: 'expired' }).eq('id', row.id)
  }

  // Process pending jobs
  const { data: jobs } = await admin
    .from('data_exports')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)

  let processed = 0

  for (const job of jobs ?? []) {
    await admin.from('data_exports').update({ status: 'processing' }).eq('id', job.id)

    try {
      const rows = await fetchRows(admin, job.data_type, job.tenant_id, job.filters ?? {})
      const ext  = job.format === 'xlsx' ? 'xlsx' : 'csv'
      const buf  = job.format === 'xlsx' ? generateXlsx(rows) : generateCsv(rows)
      const path = `${job.tenant_id}/${job.id}.${ext}`
      const contentType = job.format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv'

      const { error: uploadErr } = await admin.storage
        .from('exports')
        .upload(path, buf, { contentType, upsert: false })
      if (uploadErr) throw uploadErr

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + EXPIRY_DAYS)

      await admin.from('data_exports').update({
        status:       'ready',
        file_path:    path,
        row_count:    rows.length,
        expires_at:   expiresAt.toISOString(),
        completed_at: new Date().toISOString(),
      }).eq('id', job.id)

      const { data: authUser } = await admin.auth.admin.getUserById(job.requested_by)
      if (authUser?.user?.email) {
        await sendExportReadyEmail({
          to:          authUser.user.email,
          dataType:    job.data_type,
          format:      job.format,
          rowCount:    rows.length,
          expiresAt:   expiresAt.toISOString(),
          requestedAt: job.created_at,
          portalUrl:   process.env.NEXT_PUBLIC_APP_URL ?? 'https://breachr-portal.vercel.app',
        })
      }

      processed++
    } catch (err) {
      console.error(`[process-exports] job ${job.id} failed:`, err)
      await admin.from('data_exports').update({
        status:    'failed',
        error_msg: String(err),
      }).eq('id', job.id)
    }
  }

  return NextResponse.json({ ok: true, processed, expired: expired?.length ?? 0 })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchRows(
  admin: any,
  dataType: string,
  tenantId: string,
  filters: Record<string, string>,
): Promise<Record<string, unknown>[]> {
  if (dataType === 'findings')    return fetchFindings(admin, tenantId, filters)
  if (dataType === 'inventory')   return fetchInventory(admin, tenantId)
  if (dataType === 'audit_trail') return fetchAuditTrail(admin, tenantId, filters)
  return []
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchFindings(admin: any, tenantId: string, filters: Record<string, string>) {
  let q = admin.from('findings')
    .select('title, severity, cvss_score, owasp_category, status, created_at, scans(scan_type, attack_surfaces(name))')
    .eq('tenant_id', tenantId)

  if (filters.sev)    q = q.in('severity', filters.sev.split(','))
  if (filters.status) q = q.in('status', filters.status.split(','))
  if (filters.q)      q = q.or(`title.ilike.%${filters.q}%,owasp_category.ilike.%${filters.q}%`)
  if (filters.sort && filters.dir) {
    q = q.order(filters.sort, { ascending: filters.dir === 'asc' })
  } else {
    q = q.order('created_at', { ascending: false })
  }

  const { data } = await q
  return (data ?? []).map((f: Record<string, unknown>) => ({
    Title:            (f.title as string) ?? '',
    Severity:         (f.severity as string) ?? '',
    CVSS:             (f.cvss_score as number | null) ?? '',
    'OWASP Category': (f.owasp_category as string | null) ?? '',
    Status:           (f.status as string) ?? '',
    'Scan Type':      ((f.scans as Record<string, unknown> | null)?.scan_type as string | null) ?? '',
    Target:           (((f.scans as Record<string, unknown> | null)?.attack_surfaces as Record<string, unknown> | null)?.name as string | null) ?? '',
    'Discovered At':  (f.created_at as string) ?? '',
  }))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchInventory(admin: any, tenantId: string) {
  const { data } = await admin.from('assets')
    .select('ip, hostname, vendor, os_guess, criticality, owner_name, risk_score, is_active, last_seen, acknowledged_at')
    .eq('tenant_id', tenantId)
    .order('risk_score', { ascending: false })

  return (data ?? []).map((a: Record<string, unknown>) => ({
    IP:           (a.ip as string) ?? '',
    Hostname:     (a.hostname as string | null) ?? '',
    Vendor:       (a.vendor as string | null) ?? '',
    OS:           (a.os_guess as string | null) ?? '',
    Criticality:  (a.criticality as string | null) ?? '',
    Owner:        (a.owner_name as string | null) ?? '',
    'Risk Score': (a.risk_score as number | null) ?? '',
    Active:       a.is_active ? 'Yes' : 'No',
    Acknowledged: a.acknowledged_at ? 'Yes' : 'No',
    'Last Seen':  (a.last_seen as string) ?? '',
  }))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAuditTrail(admin: any, tenantId: string, filters: Record<string, string>) {
  let q = admin.from('audit_logs')
    .select('action, detail, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (filters.group && ACTION_GROUPS[filters.group]) {
    q = q.in('action', ACTION_GROUPS[filters.group])
  }
  if (filters.date && DATE_PRESETS[filters.date]) {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - DATE_PRESETS[filters.date])
    q = q.gte('created_at', cutoff.toISOString())
  }

  const { data } = await q
  return (data ?? []).map((e: Record<string, unknown>) => ({
    Action:            (e.action as string) ?? '',
    Detail:            (e.detail as string | null) ?? '',
    'Timestamp (UTC)': (e.created_at as string) ?? '',
  }))
}

function generateCsv(rows: Record<string, unknown>[]): Buffer {
  if (rows.length === 0) return Buffer.from('')
  const headers = Object.keys(rows[0])
  const escape  = (v: unknown) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.join(','), ...rows.map(r => headers.map(h => escape(r[h])).join(','))]
  return Buffer.from(lines.join('\n'), 'utf-8')
}

function generateXlsx(rows: Record<string, unknown>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Export')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}
