'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Step = 1 | 2 | 3 | 4
type Developer = { id: string; name: string; email: string; activeTasks: number }
type Finding   = { id: string; title: string; severity: string; owasp_category: string | null; status: string }

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#3b82f6', info: '#64748b',
}

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13,
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  color: '#e2e8f0', outline: 'none', boxSizing: 'border-box',
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b',
  marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase',
}

export default function NewBatchPage() {
  const router = useRouter()
  const [step, setStep]             = useState<Step>(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')

  const [name, setName]             = useState('')
  const [description, setDesc]      = useState('')
  const [priority, setPriority]     = useState('high')
  const [dueDate, setDueDate]       = useState('')

  const [developers, setDevelopers]     = useState<Developer[]>([])
  const [assignedTo, setAssignedTo]     = useState('')
  const [loadingDevs, setLoadingDevs]   = useState(false)

  const [findings, setFindings]               = useState<Finding[]>([])
  const [selectedIds, setSelectedIds]         = useState<Set<string>>(new Set())
  const [loadingFindings, setLoadingFindings] = useState(false)
  const [severityFilter, setSeverityFilter]   = useState('')
  const [statusFilter, setStatusFilter]       = useState('open')

  const [jiraPush, setJiraPush] = useState(false)

  const loadDevelopers = useCallback(async () => {
    setLoadingDevs(true)
    const res = await fetch('/api/team/developers')
    if (res.ok) { const d = await res.json(); setDevelopers(d.developers ?? []) }
    setLoadingDevs(false)
  }, [])

  const loadFindings = useCallback(async () => {
    setLoadingFindings(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (severityFilter) params.set('severity', severityFilter)
    const res = await fetch(`/api/findings?${params}`)
    if (res.ok) { const d = await res.json(); setFindings(d.findings ?? []) }
    setLoadingFindings(false)
  }, [statusFilter, severityFilter])

  useEffect(() => { if (step === 2) loadDevelopers() }, [step, loadDevelopers])
  useEffect(() => { if (step === 3) loadFindings() }, [step, loadFindings, statusFilter, severityFilter])

  function toggleFinding(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function handleSubmit() {
    setSubmitting(true); setError('')
    const res = await fetch('/api/remediation/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, description: description || undefined,
        priority, due_date: dueDate || undefined,
        assigned_to: assignedTo,
        jira_push_enabled: jiraPush,
        finding_ids: Array.from(selectedIds),
      }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to create batch'); setSubmitting(false); return
    }
    const { batch } = await res.json()
    router.push(`/dashboard/remediation/${batch.id}`)
  }

  const STEPS = ['Batch details', 'Assign developer', 'Select findings', 'Review & confirm']

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>NEW BATCH</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Create a remediation batch and assign it to a developer</p>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px', maxWidth: 760 }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 32 }}>
          {STEPS.map((label, i) => {
            const n = (i + 1) as Step
            const active = step === n; const done = step > n
            return (
              <div key={n} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800,
                    background: done ? '#42a5f5' : active ? 'rgba(66,165,245,0.15)' : 'rgba(255,255,255,0.05)',
                    color: done ? '#0a0e1a' : active ? '#42a5f5' : '#64748b',
                    border: `1px solid ${active ? '#42a5f5' : done ? '#42a5f5' : 'rgba(255,255,255,0.1)'}` }}>
                    {done ? '✓' : n}
                  </div>
                  <span style={{ fontSize: 12, color: active ? '#e2e8f0' : '#64748b', whiteSpace: 'nowrap' }}>{label}</span>
                </div>
                {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 12px' }} />}
              </div>
            )
          })}
        </div>

        <div className="gs au1" style={{ padding: 28 }}>

          {/* Step 1 */}
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 }}>Batch details</h2>
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Name *</label>
                <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sprint 3 — API Hardening" autoFocus />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Description</label>
                <textarea style={{ ...inp, minHeight: 80, resize: 'vertical' } as React.CSSProperties} value={description} onChange={e => setDesc(e.target.value)} placeholder="Optional context for the developer" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div>
                  <label style={lbl}>Priority *</label>
                  <select style={inp} value={priority} onChange={e => setPriority(e.target.value)}>
                    {['critical','high','medium','low'].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Due date</label>
                  <input type="date" style={inp} value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
              </div>
              <button className="btn-p" style={{ width: '100%', padding: 12 }} onClick={() => setStep(2)} disabled={!name.trim()}>Continue →</button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 }}>Assign developer</h2>
              {loadingDevs ? (
                <p style={{ color: '#64748b', fontSize: 13 }}>Loading developers…</p>
              ) : developers.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                  No developers yet. <a href="/dashboard/settings" style={{ color: '#42a5f5' }}>Invite one from Settings → Team</a>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                  {developers.map(dev => (
                    <label key={dev.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                      background: assignedTo === dev.id ? 'rgba(66,165,245,0.08)' : 'transparent',
                      border: `1px solid ${assignedTo === dev.id ? '#42a5f5' : 'rgba(255,255,255,0.06)'}` }}>
                      <input type="radio" name="assignee" value={dev.id} checked={assignedTo === dev.id} onChange={() => setAssignedTo(dev.id)} style={{ accentColor: '#42a5f5' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{dev.name}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{dev.email}</div>
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{dev.activeTasks} active tasks</div>
                    </label>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={{ flex: 1, padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: 13, cursor: 'pointer' }} onClick={() => setStep(1)}>← Back</button>
                <button className="btn-p" style={{ flex: 1, padding: 12 }} onClick={() => setStep(3)} disabled={!assignedTo}>Continue →</button>
              </div>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 16 }}>Select findings</h2>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <select style={{ ...inp, width: 'auto' }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                  <option value="open">Open</option>
                  <option value="">All statuses</option>
                </select>
                <select style={{ ...inp, width: 'auto' }} value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}>
                  <option value="">All severities</option>
                  {['critical','high','medium','low','info'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                </select>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: '#64748b', alignSelf: 'center' }}>{selectedIds.size} selected</span>
              </div>
              {loadingFindings ? (
                <p style={{ color: '#64748b', fontSize: 13 }}>Loading findings…</p>
              ) : (
                <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 24 }}>
                  {findings.length === 0 && <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', padding: 16 }}>No findings match the current filter.</p>}
                  {findings.map(f => (
                    <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                      background: selectedIds.has(f.id) ? 'rgba(66,165,245,0.06)' : 'transparent',
                      border: `1px solid ${selectedIds.has(f.id) ? 'rgba(66,165,245,0.3)' : 'rgba(255,255,255,0.04)'}` }}>
                      <input type="checkbox" checked={selectedIds.has(f.id)} onChange={() => toggleFinding(f.id)} style={{ accentColor: '#42a5f5', flexShrink: 0 }} />
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: `${SEVERITY_COLOR[f.severity] ?? '#64748b'}15`, color: SEVERITY_COLOR[f.severity] ?? '#64748b', flexShrink: 0 }}>
                        {f.severity.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 13, color: '#e2e8f0', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.title}</span>
                      {f.owasp_category && <span style={{ fontSize: 10, color: '#64748b', flexShrink: 0 }}>{f.owasp_category}</span>}
                    </label>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={{ flex: 1, padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: 13, cursor: 'pointer' }} onClick={() => setStep(2)}>← Back</button>
                <button className="btn-p" style={{ flex: 1, padding: 12 }} onClick={() => setStep(4)}>Review →</button>
              </div>
            </div>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 }}>Review & confirm</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20, padding: 16, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {(([
                  ['Batch name', name],
                  ['Priority', priority],
                  dueDate ? ['Due date', new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })] : null,
                  ['Assigned to', developers.find(d => d.id === assignedTo)?.name ?? assignedTo],
                  ['Findings selected', String(selectedIds.size)],
                ].filter(Boolean)) as [string, string][]).map(([k, v]) => (
                  <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: '#64748b' }}>{k}</span>
                    <span style={{ color: '#e2e8f0', fontWeight: 600, textTransform: k === 'Priority' ? 'capitalize' : undefined }}>{v}</span>
                  </div>
                ))}
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 8, marginBottom: 24, cursor: 'pointer',
                background: jiraPush ? 'rgba(0,121,185,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${jiraPush ? 'rgba(0,121,185,0.3)' : 'rgba(255,255,255,0.06)'}` }}>
                <input type="checkbox" checked={jiraPush} onChange={e => setJiraPush(e.target.checked)} style={{ accentColor: '#0079b9' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>Enable Jira push</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Push tasks to Jira when developer requests review (coming soon)</div>
                </div>
              </label>
              {error && <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 16, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>{error}</p>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button style={{ flex: 1, padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: 13, cursor: 'pointer' }} onClick={() => setStep(3)} disabled={submitting}>← Back</button>
                <button className="btn-p" style={{ flex: 1, padding: 12 }} onClick={handleSubmit} disabled={submitting}>{submitting ? 'Creating…' : 'Create Batch →'}</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
