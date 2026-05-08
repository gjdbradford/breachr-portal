'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CriticalityBadgeSmall, CriticalityPopover } from './CriticalityPopover'
import ExportButton from './ExportButton'

interface Asset {
  id: string
  ip: string
  hostname: string | null
  vendor: string | null
  os_guess: string | null
  last_seen: string
  is_active: boolean
  risk_score: number | null
  acknowledged_at: string | null
  criticality: string | null
  owner_name: string | null
}

export default function InventoryTable({
  assets: initial,
  portCountMap,
  canClassify,
  canExport,
  page,
  pageSize,
  totalCount,
}: {
  assets: Asset[]
  portCountMap: Record<string, number>
  canClassify: boolean
  canExport: boolean
  page: number
  pageSize: number
  totalCount: number
}) {
  const [assets, setAssets] = useState(initial)
  const router       = useRouter()
  const searchParams = useSearchParams()

  const totalPages = Math.ceil(totalCount / pageSize)

  function goToPage(n: number) {
    const p = new URLSearchParams(searchParams.toString())
    if (n > 1) p.set('p', String(n)); else p.delete('p')
    router.replace(`?${p.toString()}`, { scroll: false })
  }

  function updateCriticality(assetId: string, value: string | null) {
    setAssets(prev => prev.map(a => a.id === assetId ? { ...a, criticality: value } : a))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#475569' }}>
          {totalCount} total assets
        </span>
        <ExportButton dataType="inventory" canExport={canExport} />
      </div>

      {/* Table */}
      <table className="data-table">
        <thead>
          <tr>
            <th>IP</th>
            <th>Hostname</th>
            <th>Vendor / OS</th>
            <th>Criticality</th>
            <th>Owner</th>
            <th>Ports</th>
            <th>Risk</th>
            <th>Last seen</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {assets.map(a => {
            const score = a.risk_score ?? 0
            const riskColor = score >= 80 ? '#ef4444' : score >= 50 ? '#f97316' : score >= 20 ? '#f59e0b' : '#22c55e'
            return (
              <tr key={a.id}>
                <td style={{ fontFamily: 'monospace', fontSize: 13, color: '#e2e8f0' }}>
                  {a.ip}
                  {!a.acknowledged_at && (
                    <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, letterSpacing: '0.06em',
                      background: 'rgba(239,68,68,0.15)', color: '#ef4444',
                      border: '1px solid rgba(239,68,68,0.3)', borderRadius: 3, padding: '1px 5px' }}>
                      NEW
                    </span>
                  )}
                </td>
                <td style={{ fontSize: 12, color: '#94a3b8' }}>{a.hostname ?? '—'}</td>
                <td style={{ fontSize: 12, color: '#64748b' }}>
                  {[a.vendor, a.os_guess].filter(Boolean).join(' · ') || '—'}
                </td>
                <td>
                  {canClassify ? (
                    <CriticalityPopover
                      assetId={a.id}
                      value={a.criticality}
                      onUpdated={v => updateCriticality(a.id, v)}
                    />
                  ) : (
                    <CriticalityBadgeSmall value={a.criticality} />
                  )}
                </td>
                <td style={{ fontSize: 12, color: '#64748b' }}>{a.owner_name ?? '—'}</td>
                <td style={{ fontSize: 12, color: '#64748b' }}>{portCountMap[a.id] ?? 0}</td>
                <td>
                  <span style={{ fontSize: 12, fontWeight: 700, color: score > 0 ? riskColor : '#475569' }}>
                    {score > 0 ? score : '—'}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: '#64748b' }}>
                  {new Date(a.last_seen).toLocaleDateString('en-GB')}
                  {!a.is_active && (
                    <span style={{ marginLeft: 6, fontSize: 10, color: '#475569',
                      background: 'rgba(255,255,255,0.05)', padding: '1px 5px', borderRadius: 3 }}>
                      offline
                    </span>
                  )}
                </td>
                <td>
                  <Link href={`/dashboard/inventory/${a.id}`} className="btn-s"
                    style={{ fontSize: 12, padding: '4px 12px' }}>
                    View
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page === 1}
            style={{
              padding: '5px 10px', borderRadius: 4, fontSize: 12, cursor: page === 1 ? 'not-allowed' : 'pointer',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              color: page === 1 ? '#334155' : '#94a3b8',
            }}
          >←</button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
            .reduce<(number | '…')[]>((acc, n, idx, arr) => {
              if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push('…')
              acc.push(n)
              return acc
            }, [])
            .map((n, i) =>
              n === '…' ? (
                <span key={`e-${i}`} style={{ padding: '5px 6px', color: '#475569', fontSize: 12 }}>…</span>
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
                >{n}</button>
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
          >→</button>
        </div>
      )}
    </div>
  )
}
