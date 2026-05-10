'use client'

import { useEffect, useState, useMemo } from 'react'
import type { DataExport } from '@/lib/types'
import { formatFriendly } from '@/lib/format-date'

const PAGE_SIZE = 25

const DATA_TYPE_LABELS: Record<string, string> = {
  findings:    'Findings',
  inventory:   'Inventory',
  audit_trail: 'Audit Trail',
}

const STATUS_STYLES: Record<string, { color: string; bg: string; border: string }> = {
  pending:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)' },
  processing: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.2)' },
  ready:      { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   border: 'rgba(34,197,94,0.2)'  },
  failed:     { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.2)'  },
  expired:    { color: '#475569', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.2)'},
}

const DATE_PRESETS = [
  { label: 'Today',     value: 'today', days: 1   },
  { label: 'This week', value: '7d',    days: 7   },
  { label: '2 weeks',   value: '14d',   days: 14  },
  { label: 'Last 30d',  value: '30d',   days: 30  },
  { label: 'Last 90d',  value: '90d',   days: 90  },
  { label: 'Last year', value: '1y',    days: 365 },
]

const DATE_PRESET_LABELS: Record<string, string> = Object.fromEntries(
  DATE_PRESETS.map(p => [p.value, p.label])
)

function formatFilters(filters: Record<string, string>): string {
  if (!filters || Object.keys(filters).length === 0) return 'all records'
  return Object.entries(filters)
    .filter(([k]) => k !== 'p')
    .map(([k, v]) => {
      if (k === 'date') return `date: ${DATE_PRESET_LABELS[v] ?? v}`
      return `${k}: ${v}`
    })
    .join(' · ')
}

const SOURCE_FILTERS = [
  { label: 'Findings',    value: 'findings'    },
  { label: 'Inventory',   value: 'inventory'   },
  { label: 'Audit Trail', value: 'audit_trail' },
]

export default function ExportsTab({ timezone = 'UTC' }: { timezone?: string }) {
  const [exports_, setExports] = useState<(DataExport & { signed_url?: string | null })[]>([])
  const [loading, setLoading]      = useState(true)
  const [dateFilter, setDateFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    fetch('/api/exports')
      .then(r => r.ok ? r.json() : [])
      .then(setExports)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let result = exports_
    if (sourceFilter) {
      result = result.filter(e => e.data_type === sourceFilter)
    }
    if (dateFilter) {
      const cutoff = new Date()
      if (dateFilter === 'today') {
        cutoff.setHours(0, 0, 0, 0)
      } else {
        const preset = DATE_PRESETS.find(p => p.value === dateFilter)
        if (!preset) return result
        cutoff.setDate(cutoff.getDate() - preset.days)
      }
      result = result.filter(e => new Date(e.created_at) >= cutoff)
    }
    return result
  }, [exports_, dateFilter, sourceFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const isFiltered = !!dateFilter || !!sourceFilter

  function toggleDate(value: string) {
    setDateFilter(prev => prev === value ? '' : value)
    setPage(1)
  }

  function toggleSource(value: string) {
    setSourceFilter(prev => prev === value ? '' : value)
    setPage(1)
  }

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#475569', fontSize: 13 }}>Loading exports…</div>
  }

  if (exports_.length === 0) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 15, color: '#475569', marginBottom: 8 }}>No exports yet</p>
        <p style={{ fontSize: 13, color: '#334155' }}>
          Use the Export button on Findings, Audit Trail, or Inventory to queue an export.
          Only admins and account owners can create exports.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', padding: '12px 24px 0' }}>

        {/* Source pills */}
        {SOURCE_FILTERS.map(({ label, value }) => {
          const active = sourceFilter === value
          return (
            <button
              key={value}
              onClick={() => toggleSource(value)}
              style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
                background: active ? 'rgba(66,165,245,0.15)' : 'rgba(255,255,255,0.04)',
                color: active ? '#42a5f5' : '#64748b',
                border: `1px solid ${active ? 'rgba(66,165,245,0.4)' : 'rgba(255,255,255,0.08)'}`,
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          )
        })}

        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)' }} />

        {/* Date pills */}
        {DATE_PRESETS.map(({ label, value }) => {
          const active = dateFilter === value
          return (
            <button
              key={value}
              onClick={() => toggleDate(value)}
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

        {isFiltered && (
          <button
            onClick={() => { setDateFilter(''); setSourceFilter(''); setPage(1) }}
            style={{ fontSize: 11, color: '#475569', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px' }}
          >
            Clear
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#475569' }}>
          {isFiltered ? `${filtered.length} of ${exports_.length}` : `${exports_.length} total`}
        </span>
      </div>

      {/* Table */}
      <div style={{ padding: '0 24px' }}>
        {paginated.length === 0 ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: '#475569', marginBottom: 8 }}>No exports match these filters</p>
            <button
              onClick={() => { setDateFilter(''); setSourceFilter(''); setPage(1) }}
              style={{ fontSize: 13, color: '#42a5f5', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Clear filter
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Format</th>
                <th>Filters</th>
                <th>Rows</th>
                <th>Status</th>
                <th>Created</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(e => {
                const style = STATUS_STYLES[e.status] ?? STATUS_STYLES.pending
                const isExpired = e.status === 'expired'
                return (
                  <tr key={e.id} style={{ opacity: isExpired ? 0.45 : 1 }}>
                    <td style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>
                      {DATA_TYPE_LABELS[e.data_type] ?? e.data_type}
                    </td>
                    <td>
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                        padding: '2px 7px', borderRadius: 3,
                        background: e.format === 'xlsx' ? 'rgba(99,102,241,0.1)' : 'rgba(34,197,94,0.1)',
                        color:      e.format === 'xlsx' ? '#818cf8' : '#22c55e',
                        border:     `1px solid ${e.format === 'xlsx' ? 'rgba(99,102,241,0.2)' : 'rgba(34,197,94,0.2)'}`,
                      }}>
                        {e.format === 'xlsx' ? 'XLSX' : 'CSV'}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: '#64748b', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {formatFilters(e.filters)}
                    </td>
                    <td style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'monospace' }}>
                      {e.row_count != null ? e.row_count.toLocaleString() : '—'}
                    </td>
                    <td>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 3,
                        background: style.bg, color: style.color, border: `1px solid ${style.border}`,
                      }}>
                        {e.status === 'processing' ? 'Processing' : e.status.charAt(0).toUpperCase() + e.status.slice(1)}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: '#64748b' }}>
                      {formatFriendly(e.created_at, timezone)}
                    </td>
                    <td>
                      {e.expires_at && !isExpired ? (
                        <div>
                          <div style={{ fontSize: 11, color: '#f59e0b' }}>
                            {formatFriendly(e.expires_at, timezone)}
                          </div>
                          <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>Deleted for security</div>
                        </div>
                      ) : isExpired ? (
                        <span style={{ fontSize: 11, color: '#334155' }}>
                          {e.expires_at ? formatFriendly(e.expires_at, timezone) : '—'} — deleted
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, color: '#475569' }}>—</span>
                      )}
                    </td>
                    <td>
                      {e.status === 'ready' && e.signed_url ? (
                        <a
                          href={e.signed_url}
                          download
                          style={{
                            fontSize: 11, fontWeight: 600, padding: '5px 12px',
                            background: 'rgba(25,118,210,0.12)',
                            border: '1px solid rgba(25,118,210,0.25)',
                            borderRadius: 4, color: '#42a5f5', textDecoration: 'none',
                          }}
                        >
                          ↓ Download
                        </a>
                      ) : (e.status === 'pending' || e.status === 'processing') ? (
                        <span style={{ fontSize: 11, color: '#475569' }}>You&apos;ll be emailed</span>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px 8px', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#475569' }}>
            Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} export{filtered.length !== 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setPage(p => p - 1)}
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
                  onClick={() => setPage(n as number)}
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
            onClick={() => setPage(p => p + 1)}
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
        </div>
      )}
    </div>
  )
}
