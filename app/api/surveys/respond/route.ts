import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json()
  const { survey_id, answers, triggered_by } = body
  if (!survey_id || !answers) return NextResponse.json({ error: 'missing fields' }, { status: 400 })

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data: profile }, { data: survey }] = await Promise.all([
    db.from('users').select('tenant_id').eq('supabase_uid', user.id).single(),
    db.from('surveys').select('type').eq('id', survey_id).single(),
  ])

  if (!profile) return NextResponse.json({ error: 'no profile' }, { status: 400 })

  const nps_score  = survey?.type === 'nps'  ? (answers.q1 ?? null) : null
  const csat_score = survey?.type === 'csat' ? (answers.q1 ?? null) : null
  const pmf_score  = survey?.type === 'pmf'  ? (answers.q1 ?? null) : null

  await db.from('survey_responses').insert({
    survey_id,
    tenant_id: profile.tenant_id,
    user_id: user.id,
    triggered_by: triggered_by ?? null,
    answers,
    nps_score,
    csat_score,
    pmf_score,
  })

  return NextResponse.json({ ok: true })
}
