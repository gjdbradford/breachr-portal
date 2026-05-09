import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Look up the current user's profile row from public.users.
 *
 * Multi-org: a user can belong to multiple tenants. We query by supabase_uid
 * (the stable auth UUID) rather than the row PK (id), which is now a random
 * UUID for secondary-org memberships. Ordering by created_at ascending returns
 * the user's primary (first-joined) org when no active-tenant cookie is set —
 * good enough until an org-switcher UI is built.
 *
 * For single-org users (the common case) supabase_uid = id = auth.uid(), so
 * nothing changes behaviourally.
 */
export async function getUserProfile<T extends Record<string, unknown>>(
  db: SupabaseClient,
  supabaseUid: string,
  columns = 'tenant_id, role',
): Promise<T | null> {
  const { data } = await db
    .from('users')
    .select(columns)
    .eq('supabase_uid', supabaseUid)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return (data as T | null)
}
