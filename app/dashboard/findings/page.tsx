import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import FindingsTable from '@/components/FindingsTable'

const PAGE_SIZE = 50

const SORTABLE: Record<string, string> = {
  title:          'title',
  severity:       'severity',
  cvss_score:     'cvss_score',
  status:         'status',
  created_at:     'created_at',
  owasp_category: 'owasp_category',
}

export default async function FindingsPage({
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
  const sevFilter    = params.sev    ? params.sev.split(',').filter(Boolean)    : []
  const statusFilter = params.status ? params.status.split(',').filter(Boolean) : []
  const searchQuery  = params.q?.trim() ?? ''
  const targetFilter = params.target ?? ''
  const scanFilter   = params.scan   ?? ''
  const sortCol      = SORTABLE[params.sort ?? ''] ?? 'created_at'
  const sortAsc      = params.dir === 'asc'
  const page         = Math.max(1, parseInt(params.p ?? '1') || 1)

  // Resolve target/scan → scan IDs (two-step: names → IDs)
  let scanIds: string[] | null = null
  if (targetFilter || scanFilter) {
    let scansQ = supabase.from('scans').select('id').eq('tenant_id', tenantId)
    if (scanFilter) scansQ = scansQ.eq('scan_type', scanFilter)
    if (targetFilter) {
      const { data: surfaces } = await supabase
        .from('attack_surfaces').select('id').eq('name', targetFilter)
      const ids = surfaces?.map((s: any) => s.id) ?? []
      if (ids.length === 0) {
        scanIds = [] // target exists but no scans for it
      } else {
        scansQ = scansQ.in('attack_surface_id', ids)
      }
    }
    if (scanIds === null) {
      const { data: matchingScans } = await scansQ
      scanIds = matchingScans?.map((s: any) => s.id) ?? []
    }
  }

  // Apply shared filters to any query builder
  function applyFilters(q: any): any | null {
    if (sevFilter.length)    q = q.in('severity', sevFilter)
    if (statusFilter.length) q = q.in('status', statusFilter)
    if (searchQuery)         q = q.or(`title.ilike.%${searchQuery}%,owasp_category.ilike.%${searchQuery}%`)
    if (scanIds !== null) {
      if (scanIds.length === 0) return null
      q = q.in('scan_id', scanIds)
    }
    return q
  }

  // Run support queries in parallel (sev counts + dropdown options are always unfiltered)
  const [sevCountsRes, scansMetaRes] = await Promise.all([
    supabase.from('findings').select('severity').eq('tenant_id', tenantId),
    supabase.from('scans').select('scan_type, attack_surfaces(name)').eq('tenant_id', tenantId),
  ])

  const sevCounts: Record<string, number> = {}
  for (const f of sevCountsRes.data ?? []) {
    sevCounts[f.severity] = (sevCounts[f.severity] ?? 0) + 1
  }

  const availableTargets: string[] = [
    ...new Set(
      (scansMetaRes.data ?? [])
        .map((s: any) => s.attack_surfaces?.name)
        .filter(Boolean)
    ),
  ].sort()

  const availableScanTypes: string[] = [
    ...new Set((scansMetaRes.data ?? []).map((s: any) => s.scan_type).filter(Boolean)),
  ].sort()

  const totalCount = Object.values(sevCounts).reduce((a, b) => a + b, 0)

  // Main filtered queries: count + page data
  const filteredBase = applyFilters(
    supabase.from('findings').select('*', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  )

  // If no matching scan IDs, skip the data query entirely
  if (!filteredBase) {
    return renderPage({
      findings: [], filteredCount: 0, totalCount, page,
      sevCounts, availableTargets, availableScanTypes,
    })
  }

  const dataQuery = applyFilters(
    supabase
      .from('findings')
      .select('*, scans(id, scan_type, attack_surfaces(name, target_url))')
      .eq('tenant_id', tenantId)
  )

  const [{ count: filteredCount }, { data: findings }] = await Promise.all([
    filteredBase,
    dataQuery!
      .order(sortCol, { ascending: sortAsc })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
  ])

  return renderPage({
    findings: findings ?? [],
    filteredCount: filteredCount ?? 0,
    totalCount,
    page,
    sevCounts,
    availableTargets,
    availableScanTypes,
  })
}

function renderPage({
  findings, filteredCount, totalCount, page,
  sevCounts, availableTargets, availableScanTypes,
}: {
  findings: any[]
  filteredCount: number
  totalCount: number
  page: number
  sevCounts: Record<string, number>
  availableTargets: string[]
  availableScanTypes: string[]
}) {
  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>FINDINGS</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{totalCount} total findings across all scans</p>
        </div>
      </div>
      <Suspense fallback={<div style={{ color: '#64748b', padding: 24 }}>Loading…</div>}>
        <FindingsTable
          findings={findings}
          filteredCount={filteredCount}
          totalCount={totalCount}
          page={page}
          pageSize={PAGE_SIZE}
          sevCounts={sevCounts}
          availableTargets={availableTargets}
          availableScanTypes={availableScanTypes}
        />
      </Suspense>
    </div>
  )
}
