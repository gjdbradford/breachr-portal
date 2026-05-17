import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { resolvePermissions } from '@/lib/resolve-permissions'
import { can } from '@/lib/permissions'
import { logRemediationStatusChange } from '@/lib/remediation-audit'
import type { RemediationStatusSource } from '@/lib/types'

const DEVELOPER_TRANSITIONS: Record<string, string[]> = {
  open:                ['in_progress'],
  in_progress:         ['review_requested'],
  failed_verification: ['in_progress'],
  reopened:            ['in_progress'],
}

const ADMIN_TRANSITIONS: Record<string, string[]> = {
  review_requested: ['verified_fixed', 'reopened'],
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const resolved = await resolvePermissions(user.id)
  if (!can(resolved, 'remediation.tasks.update')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const toStatus: string | undefined = body?.toStatus
  const note: string | undefined = body?.note

  if (!toStatus) return NextResponse.json({ error: 'toStatus is required' }, { status: 400 })

  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: actorUser } = await admin
    .from('users')
    .select('id, tenant_id, role')
    .eq('supabase_uid', user.id)
    .single()
  if (!actorUser) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { data: task } = await admin
    .from('remediation_tasks')
    .select('id, status, tenant_id, finding_id, verification_attempts')
    .eq('id', taskId)
    .eq('tenant_id', actorUser.tenant_id)
    .single()
  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const role = actorUser.role
  const isDeveloper    = role === 'developer'
  const isAdminOrOwner = role === 'admin' || role === 'account_owner'

  if (isDeveloper) {
    const allowed = DEVELOPER_TRANSITIONS[task.status]?.includes(toStatus) ?? false
    if (!allowed) return NextResponse.json({ error: `Cannot transition from ${task.status} to ${toStatus}` }, { status: 422 })
  } else if (isAdminOrOwner) {
    const allowed = ADMIN_TRANSITIONS[task.status]?.includes(toStatus) ?? false
    if (!allowed) return NextResponse.json({ error: `Cannot transition from ${task.status} to ${toStatus}` }, { status: 422 })
    if (toStatus === 'reopened' && !note) {
      return NextResponse.json({ error: 'A note is required when reopening a task' }, { status: 422 })
    }
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updatePayload: Record<string, unknown> = {
    status:     toStatus,
    updated_at: new Date().toISOString(),
  }
  if (toStatus === 'verified_fixed') {
    updatePayload.resolved_by           = actorUser.id
    updatePayload.resolved_at           = new Date().toISOString()
    updatePayload.resolution_source     = 'manual'
    updatePayload.verification_attempts = ((task as any).verification_attempts ?? 0) + 1
  }

  const { error: updateErr } = await admin
    .from('remediation_tasks')
    .update(updatePayload)
    .eq('id', taskId)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Queue a verification scan when a fix is marked as verified
  let scanQueued = false
  if (toStatus === 'verified_fixed' && (task as any).finding_id) {
    try {
      const { data: finding } = await admin
        .from('findings')
        .select('scan_id')
        .eq('id', (task as any).finding_id)
        .single()

      if (finding?.scan_id) {
        const { data: originalScan } = await admin
          .from('scans')
          .select('attack_surface_id')
          .eq('id', finding.scan_id)
          .single()

        if (originalScan?.attack_surface_id) {
          const { error: scanErr } = await admin
            .from('scans')
            .insert({
              tenant_id:         task.tenant_id,
              attack_surface_id: originalScan.attack_surface_id,
              scan_type:         'verification',
              status:            'queued',
              model_used:        'claude-sonnet-4-6',
              tests_total:       0,
              tests_run:         0,
              progress_pct:      0,
              current_phase:     'queued',
            })
          if (!scanErr) scanQueued = true
        }
      }
    } catch {
      // Non-fatal — verification scan failure doesn't block the status update
    }
  }

  const source: RemediationStatusSource = isDeveloper ? 'developer' : 'admin'
  const logNote = scanQueued
    ? [note, 'Verification scan automatically queued.'].filter(Boolean).join(' — ')
    : note
  await logRemediationStatusChange({
    taskId,
    tenantId:   task.tenant_id,
    fromStatus: task.status,
    toStatus,
    changedBy:  actorUser.id,
    source,
    note:       logNote,
  })

  return NextResponse.json({ ok: true, status: toStatus, scanQueued })
}
