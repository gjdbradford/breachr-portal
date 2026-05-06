import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { attack_surface_id, scan_type } = await req.json()
  if (!attack_surface_id) return NextResponse.json({ error: 'Missing attack_surface_id' }, { status: 400 })

  // Load tenant with live usage counts
  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('scans_this_month, plan_scans_limit, tokens_used_this_month, plan_tokens_limit')
    .eq('id', profile.tenant_id)
    .single()

  if (!tenant) return NextResponse.json({ error: 'No tenant' }, { status: 403 })

  // Enforce scan limit
  if (tenant.plan_scans_limit !== null && tenant.scans_this_month >= tenant.plan_scans_limit) {
    return NextResponse.json({
      error: 'scan_limit',
      scansUsed: tenant.scans_this_month,
      scansLimit: tenant.plan_scans_limit,
    }, { status: 429 })
  }

  // Enforce token limit
  if (tenant.plan_tokens_limit !== null && tenant.tokens_used_this_month >= tenant.plan_tokens_limit) {
    return NextResponse.json({
      error: 'token_limit',
      tokensUsed: tenant.tokens_used_this_month,
      tokensLimit: tenant.plan_tokens_limit,
    }, { status: 429 })
  }

  // Verify the surface belongs to this tenant
  const { data: surface } = await supabase
    .from('attack_surfaces')
    .select('id')
    .eq('id', attack_surface_id)
    .eq('tenant_id', profile.tenant_id)
    .single()

  if (!surface) return NextResponse.json({ error: 'Surface not found' }, { status: 404 })

  // Insert scan
  const { data: scan, error } = await supabase
    .from('scans')
    .insert({
      tenant_id: profile.tenant_id,
      attack_surface_id,
      scan_type: scan_type ?? 'full',
      status: 'queued',
      model_used: 'claude-sonnet-4-6',
      tests_total: 0,
      tests_run: 0,
      progress_pct: 0,
      current_phase: 'queued',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ scanId: scan.id })
}
