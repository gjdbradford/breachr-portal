import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('supabase_uid', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 403 })

  const { data, error } = await supabase
    .from('saved_views')
    .select('id, name, filters_json, created_at')
    .eq('tenant_id', profile.tenant_id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('supabase_uid', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 403 })

  const { name, filters_json } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const { data, error } = await supabase
    .from('saved_views')
    .insert({
      tenant_id: profile.tenant_id,
      user_id: user.id,
      name: name.trim(),
      filters_json,
    })
    .select('id, name, filters_json, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
