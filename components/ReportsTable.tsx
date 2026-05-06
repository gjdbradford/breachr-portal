'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const FRAMEWORK_COLOURS: Record<string, string> = {
  'DORA':    '#1976d2',
  'NIS2':    '#7b1fa2',
  'PCI-DSS': '#c62828',
}

const DATE_PRESETS = [
  { label: 'Last 30d', value: '30d' },
  { label: 'Last 90d', value: '90d' },
  { label: 'Last year', value: '1y' },
]

function SeveritySummary({ summary }: { summary: Record<string, number> | null }) {
  if (!summary) return <span style={{ color: '#475569' }}>—</span>
  const parts: string[] = []
  if (summary.critical > 0) parts.push(`${summary.critical} critical`)
  if (summary.high > 0)     parts.push(`${summary.high} high`)
  if (summary.medium > 0)   parts.push(`${summary.medium} medium`)
  if (summary.low > 0)      parts.push(`${summary.low} low`)
  if (parts.length === 0)   return <span style={{ color: '#22c55e', fontSize: 12 }}>No findings</span>
  const hasGaps = (summary.critical ?? 0) + (summary.high ?? 0) > 0
  return (
    <span style={{ fontSize: 12, color: hasGaps ? '#ef4444' : '#f59e0b' }}>
      {parts.join(' · ')}
    </span>
  )
}

interface Props {
  reports:        any[]
  filteredCount:  number
  totalCount:     number
  page:           number
  pageSize:       number
  frameworkCounts: Record<string, number>
  orgCount?:      number
}

export default function ReportsTable({
  reports, filteredCount, totalCount, page, pageSize, frameworkCounts, orgCount = 0,
}: Props) {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const totalPages      = Math.ceil(filteredCount / pageSize)
  const activeFrameworks = (searchParams.get('framework') ?? '').split(',').filter(Boolean)
  const activeDatePreset = searchParams.get('date') ?? ''

  function setParam(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString())
    if (value) p.set(key, value); else p.delete(key)
    p.delete('p')
    router.replace(`?${p.toString()}`, { scroll: false })
  }

  function toggleFramework(fw: string) {
    const next = activeFrameworks.includes(fw)
      ? activeFrameworks.filter(f => f !== fw)
      : [...activeFrameworks, fw]
    setParam('framework', next.join(','))
  }

  function goToPage(n: number) {
    const p = new URLSearchParams(searchParams.toString())
    if (n > 1) p.set('p', String(n)); else p.delete('p')
    router.replace(`?${p.toString()}`, { scroll: false })
  }

  const allFrameworks = Object.keys(frameworkCounts).sort()
  const isFiltered = activeFrameworks.length > 0 || !!activeDatePreset

  function clearFilters() {
    router.replace('?', { scroll: false })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', padding: '0 24px' }}>

        {/* Framework pills */}
        {allFrameworks.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {allFrameworks.map(fw => {
              const active = activeFrameworks.includes(fw)
              const colour = FRAMEWORK_COLOURS[fw] ?? '#64748b'
              return (
                <button
                  key={fw}
                  onClick={() => toggleFramework(fw)}
                  style={{
                    fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                    padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
                    background: active ? `${colour}22` : 'rgba(255,255,255,0.04)',
                    color: active ? colour : '#64748b',
                    border: `1px solid ${active ? `${colour}55` : 'rgba(255,255,255,0.08)'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  {fw} <span style={{ opacity: 0.6 }}>({frameworkCounts[fw]})</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Divider */}
        {allFrameworks.length > 0 && (
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />
        )}

        {/* Date presets */}
        <div style={{ display: 'flex', gap: 4 }}>
          {DATE_PRESETS.map(({ label, value }) => {
            const active = activeDatePreset === value
            return (
              <button
                key={value}
                onClick={() => setParam('date', active ? '' : value)}
                style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
                  background: active ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                  color: active ? '#818cf8' : '#64748b',
                  border: `1px solid ${active ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Report type toggle */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['organizational', 'scan', ''] as const).map(t => {
            const label = t === 'organizational' ? 'Org reports' : t === 'scan' ? 'Scan reports' : 'All'
            const active = (searchParams.get('type') ?? 'organizational') === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => setParam('type', t)}
                style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
                  background: active ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
                  color: active ? '#22c55e' : '#64748b',
                  border: `1px solid ${active ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
                  transition: 'all 0.15s',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>

        {/* Clear */}
        {isFiltered && (
          <button
            onClick={clearFilters}
            style={{ fontSize: 11, color: '#475569', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}
          >
            Clear filters
          </button>
        )}

        {/* Count */}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#475569' }}>
          {isFiltered ? `${filteredCount} of ${totalCount}` : `${totalCount} total`}
        </span>
      </div>

      {/* Table */}
      <div className="gs au1" style={{ padding: 24 }}>
        {reports.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Report</th>
                <th>Type</th>
                <th>Framework</th>
                <th>Findings</th>
                <th>Generated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r: any) => (
                <tr key={r.id}>
                  <td style={{ fontSize: 13, color: '#e2e8f0' }}>
                    {r.title ?? `Report ${r.id.slice(0, 8)}`}
                  </td>
                  <td>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                      background: r.report_type === 'organizational' ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)',
                      color: r.report_type === 'organizational' ? '#22c55e' : '#64748b',
                      border: `1px solid ${r.report_type === 'organizational' ? 'rgba(34,197,94,0.2)' : 'rgba(100,116,139,0.2)'}`,
                    }}>
                      {r.report_type === 'organizational' ? 'Org' : 'Scan'}
                    </span>
                  </td>
                  <td>
                    <span style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
                      padding: '2px 8px', borderRadius: 4,
                      background: `${FRAMEWORK_COLOURS[r.framework] ?? '#334155'}22`,
                      color: FRAMEWORK_COLOURS[r.framework] ?? '#94a3b8',
                      border: `1px solid ${FRAMEWORK_COLOURS[r.framework] ?? '#334155'}44`,
                    }}>
                      {r.framework}
                    </span>
                  </td>
                  <td>
                    <SeveritySummary summary={r.framework_summary} />
                  </td>
                  <td style={{ color: '#64748b', fontSize: 12 }}>
                    {r.generated_at
                      ? new Date(r.generated_at).toLocaleDateString('en-GB')
                      : new Date(r.created_at).toLocaleDateString('en-GB')}
                  </td>
                  <td>
                    {r.status === 'ready' ? (
                      <Link
                        href={`/dashboard/reports/${r.id}`}
                        className="btn-s"
                        style={{ fontSize: 12, padding: '4px 12px' }}
                      >
                        View Report
                      </Link>
                    ) : (
                      <span style={{ color: '#475569', fontSize: 12 }}>Generating…</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
            {isFiltered ? (
              <>
                <p style={{ fontSize: 15, marginBottom: 8 }}>No reports match these filters</p>
                <button
                  onClick={clearFilters}
                  style={{ fontSize: 13, color: '#42a5f5', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <p style={{ fontSize: 15, marginBottom: 8 }}>No compliance reports yet</p>
                <p style={{ fontSize: 13, color: '#64748b' }}>
                  Run a scan first, then use the Generate Report button to create an organisational compliance report.
                </p>
                {orgCount === 0 && totalCount > 0 && (
                  <p style={{ fontSize: 12, color: '#475569', marginTop: 8 }}>
                    {totalCount} legacy scan-level report{totalCount !== 1 ? 's' : ''} exist — switch to &quot;All&quot; to view them.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, padding: '0 24px 8px' }}>
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page === 1}
            style={{
              padding: '5px 10px', borderRadius: 4, fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              color: page === 1 ? '#334155' : '#94a3b8',
            }}
          >
            ←
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
            .reduce<(number | '…')[]>((acc, n, idx, arr) => {
              if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push('…')
              acc.push(n)
              return acc
            }, [])
            .map((n, i) =>
              n === '…' ? (
                <span key={`ellipsis-${i}`} style={{ padding: '5px 6px', color: '#475569', fontSize: 12 }}>…</span>
              ) : (
                <button
                  key={n}
                  onClick={() => goToPage(n as number)}
                  style={{
                    padding: '5px 10px', borderRadius: 4, fontSize: 12, cursor: 'pointer',
                    background: n === page ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${n === page ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    color: n === page ? '#818cf8' : '#94a3b8',
                    fontWeight: n === page ? 700 : 400,
                  }}
                >
                  {n}
                </button>
              )
            )}

          <button
            onClick={() => goToPage(page + 1)}
            disabled={page === totalPages}
            style={{
              padding: '5px 10px', borderRadius: 4, fontSize: 12, cursor: page === totalPages ? 'not-allowed' : 'pointer',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              color: page === totalPages ? '#334155' : '#94a3b8',
            }}
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}
