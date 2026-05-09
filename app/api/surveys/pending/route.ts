import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ survey: null })

  const db = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [
    { data: profile },
    { data: surveys },
    { data: responses },
    { data: dismissals },
    { data: eventRows },
  ] = await Promise.all([
    db.from('users').select('tenant_id, created_at').eq('supabase_uid', user.id).single(),
    db.from('surveys').select('*').eq('active', true).order('created_at'),
    db.from('survey_responses').select('survey_id, created_at').eq('user_id', user.id),
    db.from('survey_dismissals').select('survey_id').eq('user_id', user.id),
    db.from('events').select('event').eq('user_id', user.id),
  ])

  if (!profile || !surveys?.length) return NextResponse.json({ survey: null })

  const now = Date.now()
  const daysSinceSignup = (now - new Date(profile.created_at).getTime()) / 86_400_000
  const dismissedIds = new Set((dismissals ?? []).map((d: any) => d.survey_id))

  const eventCountMap: Record<string, number> = {}
  for (const e of eventRows ?? []) {
    eventCountMap[(e as any).event] = (eventCountMap[(e as any).event] ?? 0) + 1
  }

  for (const survey of surveys as any[]) {
    if (dismissedIds.has(survey.id)) continue

    // Cooldown check
    const lastResponse = (responses ?? []).find((r: any) => r.survey_id === survey.id)
    if (lastResponse) {
      const daysSince = (now - new Date(lastResponse.created_at).getTime()) / 86_400_000
      if (daysSince < survey.cooldown_days) continue
    }

    // Trigger eligibility
    let eligible = false
    if (survey.trigger_event && survey.trigger_count !== null) {
      if ((eventCountMap[survey.trigger_event] ?? 0) >= survey.trigger_count) eligible = true
    }
    if (survey.trigger_days_after_signup !== null) {
      if (daysSinceSignup >= survey.trigger_days_after_signup) eligible = true
    }
    if (!survey.trigger_event && survey.trigger_days_after_signup === null) {
      eligible = true
    }

    if (eligible) return NextResponse.json({ survey })
  }

  return NextResponse.json({ survey: null })
}
