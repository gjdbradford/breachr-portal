'use client'

import { useEffect, useState } from 'react'
import type { DataExport } from '@/lib/types'

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

function formatFilters(filters: Record<string, string>): string {
  if (!filters || Object.keys(filters).length === 0) return 'all records'
  return Object.entries(filters)
    .filter(([k]) => k !== 'p')
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ')
}

export default function ExportsTab() {
  const [exports_, setExports] = useState<(DataExport & { signed_url?: string | null })[]>([])
  const [loading, setLoading]  = useState(true)

  useEffect(() => {
    fetch('/api/exports')
      .then(r => r.ok ? r.json() : [])
      .then(setExports)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

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
    <div style={{ padding: '0 24px 24px' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Source</th>
            <th>Format</th>
            <th>Filters</th>
            <th>Rows</th>
            <th>Status</th>
            <th>Expires</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {exports_.map(e => {
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
                <td>
                  {e.expires_at && !isExpired ? (
                    <div>
                      <div style={{ fontSize: 11, color: '#f59e0b' }}>
                        {new Date(e.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      <div style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>Deleted for security</div>
                    </div>
                  ) : isExpired ? (
                    <span style={{ fontSize: 11, color: '#334155' }}>
                      {e.expires_at ? new Date(e.expires_at).toLocaleDateString('en-GB') : '—'} — deleted
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
    </div>
  )
}
