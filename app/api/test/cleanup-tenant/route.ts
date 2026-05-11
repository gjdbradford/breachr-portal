import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function DELETE(req: NextRequest) {
  if (process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Missing Supabase env vars' }, { status: 500 })
  }

  const body = await req.json().catch(() => ({}))
  const { ownerEmail } = body as { ownerEmail?: string }
  if (!ownerEmail) return NextResponse.json({ error: 'Missing ownerEmail' }, { status: 400 })

  const trimmedEmail = ownerEmail.trim()
  if (!trimmedEmail.includes('@')) {
    return NextResponse.json({ error: 'Invalid ownerEmail' }, { status: 400 })
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )

  try {
    // Find the tenant via the owner's users row
    const { data: ownerRow } = await admin
      .from('users')
      .select('tenant_id, supabase_uid')
      .eq('email', trimmedEmail)
      .eq('role', 'account_owner')
      .maybeSingle()

    if (!ownerRow) return NextResponse.json({ ok: true }) // already cleaned up

    const tenantId = ownerRow.tenant_id

    // Collect all supabase_uid values before deleting users rows
    const { data: tenantUsers } = await admin
      .from('users')
      .select('supabase_uid')
      .eq('tenant_id', tenantId)

    const uids = (tenantUsers ?? []).map(u => u.supabase_uid as string).filter(Boolean)

    // Collect scan IDs for this tenant (needed to delete findings/compliance_reports by scan_id)
    const { data: tenantScans } = await admin
      .from('scans')
      .select('id')
      .eq('tenant_id', tenantId)

    const scanIds = (tenantScans ?? []).map(s => s.id as string).filter(Boolean)

    // Delete in FK-safe order: most-dependent tables first

    // 1. audit_logs (tenant_id, ON DELETE SET NULL — delete explicitly for clean test state)
    const { error: e1 } = await admin.from('audit_logs').delete().eq('tenant_id', tenantId)
    if (e1) throw new Error(`audit_logs delete failed: ${e1.message}`)

    // 2. invitations (tenant_id, ON DELETE CASCADE)
    const { error: e2 } = await admin.from('invitations').delete().eq('tenant_id', tenantId)
    if (e2) throw new Error(`invitations delete failed: ${e2.message}`)

    // 3. survey_responses (tenant_id, ON DELETE CASCADE)
    const { error: e3 } = await admin.from('survey_responses').delete().eq('tenant_id', tenantId)
    if (e3) throw new Error(`survey_responses delete failed: ${e3.message}`)

    // 4. saved_views (tenant_id, ON DELETE CASCADE)
    const { error: e4 } = await admin.from('saved_views').delete().eq('tenant_id', tenantId)
    if (e4) throw new Error(`saved_views delete failed: ${e4.message}`)

    // 5. events (tenant_id, ON DELETE SET NULL — delete explicitly for clean test state)
    const { error: e5 } = await admin.from('events').delete().eq('tenant_id', tenantId)
    if (e5) throw new Error(`events delete failed: ${e5.message}`)

    // 6. sandbox_configs (tenant_id, ON DELETE CASCADE)
    const { error: e6 } = await admin.from('sandbox_configs').delete().eq('tenant_id', tenantId)
    if (e6) throw new Error(`sandbox_configs delete failed: ${e6.message}`)

    // 7. admin_notes (tenant_id, ON DELETE CASCADE)
    const { error: e7 } = await admin.from('admin_notes').delete().eq('tenant_id', tenantId)
    if (e7) throw new Error(`admin_notes delete failed: ${e7.message}`)

    // 8. role_permissions (tenant_id, ON DELETE CASCADE)
    const { error: e8 } = await admin.from('role_permissions').delete().eq('tenant_id', tenantId)
    if (e8) throw new Error(`role_permissions delete failed: ${e8.message}`)

    // 9. tenant_packages (tenant_id, ON DELETE CASCADE)
    const { error: e9 } = await admin.from('tenant_packages').delete().eq('tenant_id', tenantId)
    if (e9) throw new Error(`tenant_packages delete failed: ${e9.message}`)

    // 10. tenant_module_trials (tenant_id, ON DELETE CASCADE)
    const { error: e10 } = await admin.from('tenant_module_trials').delete().eq('tenant_id', tenantId)
    if (e10) throw new Error(`tenant_module_trials delete failed: ${e10.message}`)

    // 11. compliance_mappings — FK is on finding_id, delete before findings
    if (scanIds.length > 0) {
      const { data: tenantFindings } = await admin
        .from('findings')
        .select('id')
        .eq('tenant_id', tenantId)
      const findingIds = (tenantFindings ?? []).map(f => f.id as string).filter(Boolean)
      if (findingIds.length > 0) {
        const { error: e11 } = await admin.from('compliance_mappings').delete().in('finding_id', findingIds)
        if (e11) throw new Error(`compliance_mappings delete failed: ${e11.message}`)
      }
    }

    // 12. findings (tenant_id, ON DELETE CASCADE)
    const { error: e12 } = await admin.from('findings').delete().eq('tenant_id', tenantId)
    if (e12) throw new Error(`findings delete failed: ${e12.message}`)

    // 13. compliance_reports (tenant_id, ON DELETE CASCADE)
    const { error: e13 } = await admin.from('compliance_reports').delete().eq('tenant_id', tenantId)
    if (e13) throw new Error(`compliance_reports delete failed: ${e13.message}`)

    // 14. scans (tenant_id, ON DELETE CASCADE)
    const { error: e14 } = await admin.from('scans').delete().eq('tenant_id', tenantId)
    if (e14) throw new Error(`scans delete failed: ${e14.message}`)

    // 15. engagements (tenant_id, ON DELETE CASCADE)
    const { error: e15 } = await admin.from('engagements').delete().eq('tenant_id', tenantId)
    if (e15) throw new Error(`engagements delete failed: ${e15.message}`)

    // 16. subscriptions (tenant_id, ON DELETE CASCADE)
    const { error: e16 } = await admin.from('subscriptions').delete().eq('tenant_id', tenantId)
    if (e16) throw new Error(`subscriptions delete failed: ${e16.message}`)

    // 17. subscription_events (tenant_id, ON DELETE SET NULL — delete explicitly for clean test state)
    const { error: e17 } = await admin.from('subscription_events').delete().eq('tenant_id', tenantId)
    if (e17) throw new Error(`subscription_events delete failed: ${e17.message}`)

    // 18. token_purchases (tenant_id, ON DELETE CASCADE)
    const { error: e18 } = await admin.from('token_purchases').delete().eq('tenant_id', tenantId)
    if (e18) throw new Error(`token_purchases delete failed: ${e18.message}`)

    // 19. cancellations (tenant_id, ON DELETE SET NULL — delete explicitly for clean test state)
    const { error: e19 } = await admin.from('cancellations').delete().eq('tenant_id', tenantId)
    if (e19) throw new Error(`cancellations delete failed: ${e19.message}`)

    // 20. deletion_requests (tenant_id, ON DELETE SET NULL — delete explicitly for clean test state)
    const { error: e20 } = await admin.from('deletion_requests').delete().eq('tenant_id', tenantId)
    if (e20) throw new Error(`deletion_requests delete failed: ${e20.message}`)

    // 21. asset_classification_log — FK is on tenant_id (ON DELETE CASCADE) and asset_id
    const { error: e21 } = await admin.from('asset_classification_log').delete().eq('tenant_id', tenantId)
    if (e21) throw new Error(`asset_classification_log delete failed: ${e21.message}`)

    // 22. assets (tenant_id, ON DELETE CASCADE) — asset_ports and asset_vulns cascade from assets
    const { error: e22 } = await admin.from('assets').delete().eq('tenant_id', tenantId)
    if (e22) throw new Error(`assets delete failed: ${e22.message}`)

    // 23. sensors (tenant_id, ON DELETE CASCADE)
    const { error: e23 } = await admin.from('sensors').delete().eq('tenant_id', tenantId)
    if (e23) throw new Error(`sensors delete failed: ${e23.message}`)

    // 24. attack_surfaces (tenant_id, ON DELETE CASCADE)
    const { error: e24 } = await admin.from('attack_surfaces').delete().eq('tenant_id', tenantId)
    if (e24) throw new Error(`attack_surfaces delete failed: ${e24.message}`)

    // 25. data_exports (tenant_id)
    const { error: e25 } = await admin.from('data_exports').delete().eq('tenant_id', tenantId)
    if (e25) throw new Error(`data_exports delete failed: ${e25.message}`)

    // 26. users (tenant_id, ON DELETE CASCADE) — must come after all tables that reference users
    const { error: e26 } = await admin.from('users').delete().eq('tenant_id', tenantId)
    if (e26) throw new Error(`users delete failed: ${e26.message}`)

    // 27. tenants (the root)
    const { error: e27 } = await admin.from('tenants').delete().eq('id', tenantId)
    if (e27) throw new Error(`tenants delete failed: ${e27.message}`)

    // Remove Supabase auth records last (after all DB rows referencing auth.users are gone)
    for (const uid of uids) {
      const { error: authErr } = await admin.auth.admin.deleteUser(uid)
      if (authErr) throw new Error(`auth.deleteUser ${uid} failed: ${authErr.message}`)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
