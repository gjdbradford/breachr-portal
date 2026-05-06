import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import ReportsTable from '@/components/ReportsTable'
import GenerateReportButton from '@/components/GenerateReportButton'

const PAGE_SIZE = 25

const DATE_PRESETS: Record<string, number> = {
  '30d': 30,
  '90d': 90,
  '1y':  365,
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params   = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) redirect('/login')

  const tenantId = profile.tenant_id

  // Parse filter params
  const frameworkFilter = params.framework ? params.framework.split(',').filter(Boolean) : []
  const datePreset      = params.date ?? ''
  const page            = Math.max(1, parseInt(params.p ?? '1') || 1)
  const typeFilter      = params.type ?? 'organizational'

  // Resolve date cutoff
  let dateCutoff: string | null = null
  if (datePreset && DATE_PRESETS[datePreset]) {
    const d = new Date()
    d.setDate(d.getDate() - DATE_PRESETS[datePreset])
    dateCutoff = d.toISOString()
  }

  function applyFilters(q: any) {
    if (frameworkFilter.length) q = q.in('framework', frameworkFilter)
    if (dateCutoff)             q = q.gte('created_at', dateCutoff)
    if (typeFilter)             q = q.eq('report_type', typeFilter)
    return q
  }

  const [
    { data: reports, count: filteredCount },
    { count: totalCount },
    { data: frameworkRows },
    { count: orgCount },
    { data: tenantRow },
  ] = await Promise.all([
    applyFilters(
      supabase
        .from('compliance_reports')
        .select('id, framework, title, status, framework_summary, generated_at, created_at, scan_id, report_type', { count: 'exact' })
        .eq('tenant_id', tenantId)
    )
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),

    supabase
      .from('compliance_reports')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),

    supabase
      .from('compliance_reports')
      .select('framework')
      .eq('tenant_id', tenantId),

    supabase
      .from('compliance_reports')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('report_type', 'organizational'),

    supabase
      .from('tenants')
      .select('compliance_frameworks')
      .eq('id', tenantId)
      .single(),
  ])

  const frameworkCounts: Record<string, number> = {}
  for (const r of frameworkRows ?? []) {
    frameworkCounts[r.framework] = (frameworkCounts[r.framework] ?? 0) + 1
  }

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>REPORTS</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{orgCount ?? 0} organisational reports · {totalCount ?? 0} total</p>
        </div>
        <GenerateReportButton enabledFrameworks={tenantRow?.compliance_frameworks ?? []} />
      </div>
      <Suspense fallback={<div style={{ color: '#64748b', padding: 24 }}>Loading…</div>}>
        <ReportsTable
          reports={(reports ?? []) as any[]}
          filteredCount={filteredCount ?? 0}
          totalCount={totalCount ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          frameworkCounts={frameworkCounts}
          orgCount={orgCount ?? 0}
        />
      </Suspense>
    </div>
  )
}
