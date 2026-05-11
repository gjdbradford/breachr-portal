'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

function makeAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function startModuleTrial(moduleSlug: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const admin = makeAdmin()

  const { data: profile } = await admin
    .from('users')
    .select('tenant_id')
    .eq('supabase_uid', user.id)
    .single()
  if (!profile) return

  const { data: pkgRow } = await admin
    .from('tenant_packages')
    .select('package:packages(package_modules(module_slug,access_mode,trial_days))')
    .eq('tenant_id', profile.tenant_id)
    .maybeSingle()

  if (!pkgRow?.package) return

  const pkg = pkgRow.package as any
  const moduleConfig = (pkg.package_modules ?? []).find(
    (m: any) => m.module_slug === moduleSlug && m.access_mode === 'trial'
  )
  if (!moduleConfig) return

  const trialDays = moduleConfig.trial_days ?? 14
  const now = new Date()
  const expiresAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000)

  await admin
    .from('tenant_module_trials')
    .upsert(
      {
        tenant_id: profile.tenant_id,
        module_slug: moduleSlug,
        first_accessed_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: 'tenant_id,module_slug', ignoreDuplicates: true }
    )
}
