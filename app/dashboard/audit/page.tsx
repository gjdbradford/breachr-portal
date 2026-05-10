import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { resolvePermissions } from '@/lib/resolve-permissions'
import AuditChain from '@/components/AuditChain'
import type { AuditLog } from '@/lib/types'

const PAGE_SIZE = 50

const ACTION_GROUPS: Record<string, string[]> = {
  scans:    ['scan.queued', 'scan.launched', 'scan.started', 'scan.completed'],
  findings: ['finding.discovered', 'finding.status_changed', 'finding.verified_fixed'],
  reports:  ['report.viewed', 'report.downloaded'],
  admin:    ['target.created', 'target.deleted', 'settings.updated'],
}

const DATE_PRESETS: Record<string, number> = {
  '24h':  1,
  '7d':   7,
  '30d':  30,
  '90d':  90,
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params   = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('tenant_id, role').eq('supabase_uid', user.id).single()
  if (!profile) redirect('/login')

  const resolved = await resolvePermissions(user.id)
  if (!resolved['audit.read']) redirect('/dashboard')

  const tenantId = profile.tenant_id
  const canExport = ['account_owner', 'admin'].includes((profile as any).role ?? '')

  const { data: tenantRow } = await supabase.from('tenants').select('timezone').eq('id', tenantId).single()
  const timezone = tenantRow?.timezone ?? 'UTC'

  // Parse filter params
  const groupFilter = params.group ?? ''           // 'scans' | 'findings' | 'reports' | 'admin'
  const datePreset  = params.date  ?? ''           // '24h' | '7d' | '30d' | '90d'
  const page        = Math.max(1, parseInt(params.p ?? '1') || 1)

  // Resolve action list from group filter
  const actionFilter: string[] = groupFilter && ACTION_GROUPS[groupFilter]
    ? ACTION_GROUPS[groupFilter]
    : []

  // Resolve date cutoff
  let dateCutoff: string | null = null
  if (datePreset && DATE_PRESETS[datePreset]) {
    const d = new Date()
    d.setDate(d.getDate() - DATE_PRESETS[datePreset])
    dateCutoff = d.toISOString()
  }

  // Build filtered queries
  function applyFilters(q: any) {
    if (actionFilter.length) q = q.in('action', actionFilter)
    if (dateCutoff)          q = q.gte('created_at', dateCutoff)
    return q
  }

  const [
    { data: logs, count: filteredCount },
    { count: totalCount },
  ] = await Promise.all([
    applyFilters(
      supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .eq('tenant_id', tenantId)
    )
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),

    supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId),
  ])

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>AUDIT TRAIL</h1>
          <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Cryptographically chained log — tamper-evident, regulator-ready</p>
        </div>
      </div>
      <Suspense fallback={<div style={{ color: '#64748b', padding: 24 }}>Loading…</div>}>
        <AuditChain
          entries={(logs ?? []) as AuditLog[]}
          filteredCount={filteredCount ?? 0}
          totalCount={totalCount ?? 0}
          page={page}
          pageSize={PAGE_SIZE}
          canExport={canExport}
          userRole={(profile as any).role ?? ''}
          timezone={timezone}
        />
      </Suspense>
    </div>
  )
}
