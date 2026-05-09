import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { getControls, type Framework } from '@/lib/frameworks'
import { logAuditEvent } from '@/lib/audit-log'

const VALID_FRAMEWORKS: Framework[] = ['DORA', 'NIS2', 'PCI-DSS']
const VALID_PERIODS = [30, 90, 365]

export async function POST(req: NextRequest) {
  try {
    return await handlePost(req)
  } catch (err) {
    console.error('[compliance-reports/generate] unhandled error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handlePost(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const framework: Framework = body.framework
  const periodDays: number   = body.period_days ?? 90

  if (!VALID_FRAMEWORKS.includes(framework))
    return NextResponse.json({ error: 'Invalid framework' }, { status: 400 })
  if (!VALID_PERIODS.includes(periodDays))
    return NextResponse.json({ error: 'Invalid period_days. Use 30, 90, or 365.' }, { status: 400 })

  const tenantId      = profile.tenant_id
  const periodEnd     = new Date()
  const periodStart   = new Date(periodEnd.getTime() - periodDays * 86_400_000)
  const periodEndISO  = periodEnd.toISOString()
  const periodStartISO = periodStart.toISOString()

  // Verify tenant has this framework selected
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, compliance_frameworks')
    .eq('id', tenantId)
    .single()

  const enabledFrameworks: string[] = tenant?.compliance_frameworks ?? []
  if (!enabledFrameworks.includes(framework))
    return NextResponse.json(
      { error: `Framework ${framework} is not enabled for this tenant. Add it in Settings → Compliance.` },
      { status: 422 }
    )

  // All complete scans in the period
  const { data: scans } = await supabase
    .from('scans')
    .select('id, attack_surface_id, completed_at')
    .eq('tenant_id', tenantId)
    .eq('status', 'complete')
    .gte('completed_at', periodStartISO)
    .lte('completed_at', periodEndISO)

  if (!scans || scans.length === 0)
    return NextResponse.json(
      { error: 'No completed scans in this period. Run at least one scan before generating a report.' },
      { status: 422 }
    )

  const scanIds        = scans.map(s => s.id)
  const surfaceIds     = [...new Set(scans.map(s => s.attack_surface_id).filter(Boolean))]

  // Covered targets
  const { data: surfaces } = await supabase
    .from('attack_surfaces')
    .select('id, name, target_url')
    .in('id', surfaceIds)

  const targetsCovered = (surfaces ?? []).map(s => ({
    id: s.id, name: s.name, url: s.target_url,
  }))

  // All findings from those scans
  const { data: rawFindings } = await supabase
    .from('findings')
    .select('title, severity, owasp_category, description, remediation, status, created_at, scan_id')
    .eq('tenant_id', tenantId)
    .in('scan_id', scanIds)

  // Deduplicate: same (title, severity) → keep latest, prefer open over remediated
  const STATUS_PRIORITY: Record<string, number> = {
    open: 0, in_progress: 1, remediated: 2, verified_fixed: 3, accepted_risk: 4, false_positive: 5,
  }
  type Finding = NonNullable<typeof rawFindings>[number]
  const seen = new Map<string, Finding>()
  for (const f of rawFindings ?? []) {
    const key = `${f.title}|||${f.severity}`
    const existing = seen.get(key)
    if (!existing) { seen.set(key, f); continue }
    const existingPriority = STATUS_PRIORITY[existing.status] ?? 99
    const newPriority      = STATUS_PRIORITY[f.status]       ?? 99
    // Prefer more-open status; on tie prefer more recent
    if (newPriority < existingPriority ||
       (newPriority === existingPriority && f.created_at > existing.created_at)) {
      seen.set(key, f)
    }
  }

  const findings = [...seen.values()]

  // Map to framework controls and build snapshot
  const sevCounts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
  const snapshot = findings.map(f => {
    const sev = f.severity as string
    if (sev in sevCounts) sevCounts[sev]++
    return {
      title:          f.title,
      severity:       sev,
      owasp_category: f.owasp_category ?? '',
      description:    f.description   ?? '',
      remediation:    f.remediation   ?? '',
      status:         f.status,
      controls:       getControls(f.owasp_category, framework),
    }
  })

  // SHA-256 over canonical snapshot
  const snapshotJson = JSON.stringify(snapshot.map(f => ({
    title: f.title, severity: f.severity, owasp_category: f.owasp_category,
    controls: f.controls,
  })).sort((a, b) => a.title.localeCompare(b.title)))
  const sha256Hash = createHash('sha256').update(snapshotJson).digest('hex')

  const now   = periodEnd.toISOString()
  const title = `${framework} Compliance Report — ${periodStart.toISOString().slice(0, 10)} to ${periodEnd.toISOString().slice(0, 10)}`

  // Insert via admin client (service role) to bypass any RLS gaps
  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: report, error } = await admin
    .from('compliance_reports')
    .insert({
      tenant_id:           tenantId,
      scan_id:             null,
      framework,
      title,
      status:              'ready',
      report_type:         'organizational',
      report_period_start: periodStartISO,
      report_period_end:   periodEndISO,
      scan_ids:            scanIds,
      scan_count:          scanIds.length,
      targets_covered:     targetsCovered,
      findings_snapshot:   snapshot,
      framework_summary:   sevCounts,
      sha256_hash:         sha256Hash,
      generated_at:        now,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Failed to insert compliance report', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: { user } } = await supabase.auth.getUser()
  await logAuditEvent({
    tenantId,
    userId:  user?.id ?? null,
    action:  'report.generated',
    detail:  { reportId: report.id, framework, periodDays, scanCount: scanIds.length },
  }).catch(() => {})

  return NextResponse.json({ reportId: report.id })
}
