import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ step: 'user', error: 'no user', userError })

  const { data: profile, error: profileError } = await supabase
    .from('users').select('tenant_id').eq('supabase_uid', user.id).single()

  if (!profile) return NextResponse.json({ step: 'profile', error: 'no profile', profileError: profileError?.message })

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('billing_region, intended_package_slug, country')
    .eq('id', (profile as any).tenant_id)
    .single()

  const intendedSlug = (tenant as any)?.intended_package_slug as string | null

  if (!intendedSlug) return NextResponse.json({ step: 'intendedSlug', error: 'null slug', tenant, tenantError: tenantError?.message })

  // Test 1: select all columns
  const { data: pkgAll, error: pkgAllErr } = await supabase
    .from('packages').select('*').eq('slug', intendedSlug).eq('status', 'active')

  // Test 2: maybeSingle with trial_period_days
  const { data: pkg, error: pkgError } = await supabase
    .from('packages')
    .select('id, name, price_monthly, trial_period_days')
    .eq('slug', intendedSlug)
    .eq('status', 'active')
    .maybeSingle()

  return NextResponse.json({
    ok: true,
    userId: user.id,
    tenant,
    intendedSlug,
    pkg,
    pkgError: pkgError?.message,
    pkgAllCount: pkgAll?.length,
    pkgAllErr: pkgAllErr?.message,
  })
}
