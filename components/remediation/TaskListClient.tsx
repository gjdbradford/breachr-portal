'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type TaskRow = {
  id: string
  status: string
  finding_id: string
  jira_issue_key: string | null
  updated_at: string
  finding: { title: string; severity: string; owasp_category: string | null } | null
}

const SEV_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#3b82f6', info: '#64748b',
}
const STATUS_LABEL: Record<string, string> = {
  open: 'Open', in_progress: 'In Progress', review_requested: 'Review Requested',
  verified_fixed: 'Verified Fixed', failed_verification: 'Failed Verification', reopened: 'Reopened',
}
const STATUS_COLOR: Record<string, string> = {
  open: '#94a3b8', in_progress: '#42a5f5', review_requested: '#f97316',
  verified_fixed: '#4ade80', failed_verification: '#ef4444', reopened: '#fbbf24',
}

export default function TaskListClient({
  batchId,
  tasks: initialTasks,
  isAdmin,
}: {
  batchId: string
  tasks: TaskRow[]
  isAdmin: boolean
}) {
  const router = useRouter()
  const [statusFilter, setStatusFilter]   = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [selected, setSelected]           = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading]     = useState(false)
  const [tasks, setTasks]                 = useState(initialTasks)

  const filtered = tasks.filter(t => {
    if (statusFilter   && t.status              !== statusFilter)   return false
    if (severityFilter && t.finding?.severity   !== severityFilter) return false
    return true
  })

  const openCount = tasks.filter(t => t.status === 'open').length

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleBulkStart() {
    setBulkLoading(true)
    const ids = [...selected].filter(id => tasks.find(t => t.id === id)?.status === 'open')
    await Promise.all(ids.map(taskId =>
      fetch(`/api/remediation/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStatus: 'in_progress' }),
      })
    ))
    setTasks(prev => prev.map(t =>
      selected.has(t.id) && t.status === 'open' ? { ...t, status: 'in_progress' } : t
    ))
    setSelected(new Set())
    setBulkLoading(false)
    router.refresh()
  }

  const selStyle: React.CSSProperties = {
    padding: '6px 10px', borderRadius: 6, fontSize: 12,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0',
  }

  return (
    <div style={{ padding: '0 24px 24px' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <select style={selStyle} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select style={selStyle} value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
          <option value="">All severities</option>
          {['critical', 'high', 'medium', 'low', 'info'].map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        {!isAdmin && selected.size > 0 && (
          <button onClick={handleBulkStart} disabled={bulkLoading} className="btn-p"
            style={{ marginLeft: 'auto', fontSize: 12, padding: '6px 14px' }}>
            {bulkLoading ? 'Starting…' : `Start working (${selected.size})`}
          </button>
        )}
        {!isAdmin && selected.size === 0 && openCount > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b' }}>
            {openCount} open — select to bulk-start
          </span>
        )}
      </div>

      <div className="gs au1" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {!isAdmin && <th style={{ padding: '10px 16px', width: 32 }} />}
              {['Finding', 'Severity', 'OWASP', 'Status', 'Updated', ''].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 6 : 7} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>
                  No tasks match the current filter.
                </td>
              </tr>
            ) : filtered.map(task => {
              const sColor  = SEV_COLOR[task.finding?.severity ?? ''] ?? '#64748b'
              const stColor = STATUS_COLOR[task.status] ?? '#94a3b8'
              const checked = selected.has(task.id)
              return (
                <tr key={task.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: checked ? 'rgba(66,165,245,0.04)' : 'transparent' }}>
                  {!isAdmin && (
                    <td style={{ padding: '10px 16px' }}>
                      {task.status === 'open' && (
                        <input type="checkbox" checked={checked} onChange={() => toggleSelect(task.id)} style={{ accentColor: '#42a5f5' }} />
                      )}
                    </td>
                  )}
                  <td style={{ padding: '10px 16px', color: '#e2e8f0', fontWeight: 600, maxWidth: 280 }}>
                    <span style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {task.finding?.title ?? task.finding_id}
                    </span>
                    {task.jira_issue_key && (
                      <span style={{ fontSize: 10, color: '#0079b9', display: 'block', marginTop: 1 }}>{task.jira_issue_key}</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: `${sColor}15`, color: sColor }}>
                      {(task.finding?.severity ?? '').toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#94a3b8', fontSize: 12 }}>
                    {task.finding?.owasp_category ?? '—'}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: stColor }}>
                      {STATUS_LABEL[task.status] ?? task.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#94a3b8', fontSize: 11 }}>
                    {new Date(task.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <Link href={`/dashboard/remediation/${batchId}/${task.id}`} style={{ fontSize: 12, color: '#42a5f5' }}>
                      View →
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
