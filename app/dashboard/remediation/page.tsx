import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolvePermissions } from '@/lib/resolve-permissions'
import { can } from '@/lib/permissions'
import Link from 'next/link'

type Batch = {
  id: string
  name: string
  description: string | null
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: 'active' | 'completed' | 'archived'
  due_date: string | null
  jira_push_enabled: boolean
  total_tasks: number
  completed_tasks: number
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#3b82f6',
}

const STATUS_CHIP: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: 'Active',    color: '#4ade80', bg: 'rgba(74,222,128,0.1)' },
  completed: { label: 'Completed', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  archived:  { label: 'Archived',  color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
}

function isDueUrgent(due_date: string | null): boolean {
  if (!due_date) return false
  const due = new Date(due_date)
  const now = new Date()
  return due <= new Date(now.getTime() + 48 * 60 * 60 * 1000)
}

const PRIORITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }

export default async function RemediationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id, role')
    .eq('supabase_uid', user.id)
    .single()
  if (!profile) redirect('/login')

  const resolved = await resolvePermissions(user.id)
  if (!can(resolved, 'remediation.tasks.read')) redirect('/dashboard')

  // Admins/owners get the admin view (Plan 3)
  if (profile.role === 'account_owner' || profile.role === 'admin') {
    redirect('/dashboard/remediation/admin')
  }

  // Developer: RLS scopes to assigned_to automatically
  const { data: rawBatches } = await supabase
    .from('remediation_batches')
    .select(`
      id, name, description, priority, status, due_date,
      jira_push_enabled,
      tasks:remediation_tasks(id, status)
    `)

  const batches: Batch[] = (rawBatches ?? []).map(b => {
    const tasks = (b.tasks as Array<{ id: string; status: string }>) ?? []
    return {
      id:              b.id,
      name:            b.name,
      description:     b.description,
      priority:        b.priority as Batch['priority'],
      status:          b.status as Batch['status'],
      due_date:        b.due_date,
      jira_push_enabled: b.jira_push_enabled,
      total_tasks:     tasks.length,
      completed_tasks: tasks.filter(t => t.status === 'verified_fixed').length,
    }
  })

  batches.sort((a, b) => {
    const aUrgent = isDueUrgent(a.due_date) ? 1 : 0
    const bUrgent = isDueUrgent(b.due_date) ? 1 : 0
    if (bUrgent !== aUrgent) return bUrgent - aUrgent
    const pDiff = (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0)
    if (pDiff !== 0) return pDiff
    if (!a.due_date && b.due_date) return 1
    if (a.due_date && !b.due_date) return -1
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
    return 0
  })

  return (
    <div className="portal-content">
      <div className="portal-header">
        <div>
          <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.05em' }}>MY TASKS</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>Your assigned remediation batches</p>
        </div>
      </div>

      {batches.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 24px', color: '#64748b' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>&#x2713;</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>No active batches</p>
          <p style={{ fontSize: 13 }}>Your admin will assign remediation work here when it&apos;s ready.</p>
        </div>
      ) : (
        <div style={{ padding: 24, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {batches.map(batch => {
            const pct    = batch.total_tasks > 0 ? Math.round((batch.completed_tasks / batch.total_tasks) * 100) : 0
            const urgent = isDueUrgent(batch.due_date)
            const chip   = STATUS_CHIP[batch.status] ?? STATUS_CHIP.active
            const pColor = PRIORITY_COLOR[batch.priority] ?? '#94a3b8'

            return (
              <Link key={batch.id} href={`/dashboard/remediation/${batch.id}`} style={{ textDecoration: 'none' }}>
                <div className="gs au1" style={{ padding: 20, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', flex: 1, marginRight: 8 }}>{batch.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: chip.bg, color: chip.color, border: `1px solid ${chip.color}33`, whiteSpace: 'nowrap', letterSpacing: '0.05em' }}>
                      {chip.label}
                    </span>
                  </div>

                  {batch.description && (
                    <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {batch.description}
                    </p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: `${pColor}15`, color: pColor, border: `1px solid ${pColor}30`, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      {batch.priority}
                    </span>
                    {batch.due_date && (
                      <span style={{ fontSize: 11, color: urgent ? '#ef4444' : '#64748b' }}>
                        {urgent ? '⚠ ' : ''}Due {new Date(batch.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                    {batch.jira_push_enabled && (
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: 'rgba(0,121,185,0.12)', color: '#0079b9', border: '1px solid rgba(0,121,185,0.25)', marginLeft: 'auto' }}>Jira</span>
                    )}
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, color: '#64748b' }}>{batch.completed_tasks} of {batch.total_tasks} tasks complete</span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>{pct}%</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{ height: '100%', borderRadius: 2, background: pct === 100 ? '#4ade80' : '#42a5f5', width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
