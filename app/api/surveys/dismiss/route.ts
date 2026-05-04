import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { survey_id } = await req.json()
  if (!survey_id) return NextResponse.json({ error: 'missing survey_id' }, { status: 400 })

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  await db.from('survey_dismissals').upsert(
    { survey_id, user_id: user.id },
    { onConflict: 'survey_id,user_id' }
  )

  return NextResponse.json({ ok: true })
}
