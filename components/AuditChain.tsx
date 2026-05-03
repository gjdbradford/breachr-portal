'use client'

import { useEffect, useState } from 'react'
import type { AuditLog } from '@/lib/types'
import { sha256Hex, GENESIS_HASH } from '@/lib/audit'

const ACTION_COLORS: Record<string, string> = {
  'scan.queued':           '#3b82f6',
  'scan.started':          '#42a5f5',
  'finding.discovered':    '#f59e0b',
  'scan.completed':        '#22c55e',
}

type ChainResult = { chainValid: boolean; sigValid?: boolean }

export default function AuditChain({ entries }: { entries: AuditLog[] }) {
  const [chainResults, setChainResults] = useState<Record<string, ChainResult>>({})
  const [verifying, setVerifying] = useState(false)
  const [serverResult, setServerResult] = useState<{ allValid: boolean } | null>(null)

  useEffect(() => {
    if (!entries.length) return
    ;(async () => {
      const results: Record<string, ChainResult> = {}
      for (let i = 0; i < entries.length; i++) {
        const expected = i === 0
          ? GENESIS_HASH
          : await sha256Hex(entries[i - 1].signature ?? '')
        results[entries[i].id] = { chainValid: entries[i].prev_hash === expected }
      }
      setChainResults(results)
    })()
  }, [entries])

  async function handleVerify() {
    setVerifying(true)
    try {
      const res = await fetch('/api/audit/verify')
      const data = await res.json()
      // Merge HMAC results into chainResults
      setChainResults(prev => {
        const next = { ...prev }
        for (const e of data.entries ?? []) {
          next[e.id] = { ...next[e.id], sigValid: e.sigValid, chainValid: e.chainValid }
        }
        return next
      })
      setServerResult({ allValid: data.allValid })
    } catch {
      // ignore
    } finally {
      setVerifying(false)
    }
  }

  const chainIntact = Object.values(chainResults).every(r => r.chainValid)
  const total = entries.length
  const validCount = Object.values(chainResults).filter(r => r.chainValid).length

  return (
    <div className="gs au1" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>AUDIT CHAIN</span>
          <span style={{ fontSize: 11, color: '#64748b' }}>{total} entries</span>
          {total > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: chainIntact ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${chainIntact ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`, color: chainIntact ? '#22c55e' : '#ef4444' }}>
              {chainIntact ? '⛓ Chain intact' : '⚠ Chain broken'} — {validCount}/{total}
            </span>
          )}
          {serverResult != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: serverResult.allValid ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${serverResult.allValid ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, color: serverResult.allValid ? '#4ade80' : '#f87171' }}>
              🔐 {serverResult.allValid ? 'HMAC verified' : 'HMAC failed'}
            </span>
          )}
        </div>
        <button
          onClick={handleVerify}
          disabled={verifying || total === 0}
          className="btn-s"
          style={{ fontSize: 11, padding: '6px 14px' }}
        >
          {verifying ? 'Verifying…' : '🔐 Verify with Server'}
        </button>
      </div>

      {total === 0 ? (
        <div style={{ padding: '40px 24px', textAlign: 'center', color: '#475569' }}>
          <p style={{ fontSize: 13 }}>No audit entries yet. Launch a scan to start building the chain.</p>
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Time (UTC)</th>
              <th>Action</th>
              <th>Detail</th>
              <th style={{ fontFamily: 'monospace' }}>prev_hash</th>
              <th style={{ fontFamily: 'monospace' }}>Signature</th>
              <th>Chain</th>
              <th>HMAC</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => {
              const result = chainResults[entry.id]
              const isGenesis = i === 0
              return (
                <tr key={entry.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 10, color: '#64748b' }}>{i + 1}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 10, color: '#94a3b8', whiteSpace: 'nowrap' }}>
                    {new Date(entry.created_at).toISOString().slice(11, 19)} UTC
                  </td>
                  <td>
                    <span style={{ padding: '2px 7px', borderRadius: 3, fontSize: 9, fontWeight: 700, fontFamily: 'monospace', background: `${ACTION_COLORS[entry.action] ?? '#64748b'}18`, border: `1px solid ${ACTION_COLORS[entry.action] ?? '#64748b'}40`, color: ACTION_COLORS[entry.action] ?? '#94a3b8' }}>
                      {entry.action}
                    </span>
                  </td>
                  <td style={{ maxWidth: 180 }}>
                    <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.detail ?? ''}>
                      {entry.detail ?? '—'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: 9, color: isGenesis ? '#3b82f6' : '#3b5f8a' }} title={entry.prev_hash ?? ''}>
                      {isGenesis ? 'GENESIS' : `${(entry.prev_hash ?? '').slice(0, 12)}…`}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#42a5f5' }} title={entry.signature ?? ''}>
                      {entry.signature ? `${entry.signature.slice(0, 12)}…` : '—'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {result == null ? (
                      <span style={{ color: '#334155', fontSize: 12 }}>…</span>
                    ) : result.chainValid ? (
                      <span style={{ color: '#22c55e', fontSize: 13 }} title="prev_hash matches previous signature">✓</span>
                    ) : (
                      <span style={{ color: '#ef4444', fontSize: 13 }} title="Chain broken — entry may have been tampered with">✗</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {result?.sigValid == null ? (
                      <span style={{ color: '#334155', fontSize: 11 }}>—</span>
                    ) : result.sigValid ? (
                      <span style={{ color: '#22c55e', fontSize: 13 }} title="HMAC signature verified by server">🔐</span>
                    ) : (
                      <span style={{ color: '#ef4444', fontSize: 13 }} title="HMAC verification failed">✗</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
