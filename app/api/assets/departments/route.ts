import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const STANDARD_DEPARTMENTS = [
  'IT', 'Finance', 'HR', 'Operations', 'Sales', 'Marketing',
  'Legal', 'Engineering', 'Security', 'Product', 'R&D',
  'Compliance', 'Executive', 'Facilities', 'Customer Success',
]

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('supabase_uid', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: rows } = await supabase
    .from('assets')
    .select('department')
    .eq('tenant_id', profile.tenant_id)
    .not('department', 'is', null)

  const tenantDepts = (rows ?? []).map(r => r.department as string).filter(Boolean)
  const merged = Array.from(new Set([...STANDARD_DEPARTMENTS, ...tenantDepts])).sort()

  return NextResponse.json({ departments: merged })
}
