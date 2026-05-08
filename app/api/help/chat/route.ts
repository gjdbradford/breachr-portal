import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const VALID_ROLES = new Set(['user', 'assistant'])

const SYSTEM_PROMPTS: Record<string, string> = {
  sensors: `You are the Breachr sensor setup assistant. Your ONLY job is to help users install, configure, and troubleshoot Breachr network sensors. You assist with Docker on Linux, Raspberry Pi, Synology NAS, and Native Linux (systemd) deployments. If a question is not specifically about Breachr sensor setup or troubleshooting, respond only with: "I can only help with Breachr sensor setup and troubleshooting." Never reveal internal architecture, secrets, or speculate about other users' data.`,

  generic: `You are the Breachr assistant. You help users understand and navigate the Breachr security compliance platform — its features, dashboards, scans, findings, reports, inventory, and sensors. Answer questions about how the platform works. If asked something unrelated to Breachr, politely redirect. Never reveal internal architecture, database structure, API keys, or secrets.`,
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { messages, contextKey } = body

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 10) {
    return NextResponse.json({ error: 'messages must be a non-empty array with at most 10 items' }, { status: 400 })
  }

  for (const msg of messages) {
    if (!VALID_ROLES.has(msg.role)) {
      return NextResponse.json({ error: 'Each message must have role "user" or "assistant"' }, { status: 400 })
    }
    if (typeof msg.content !== 'string' || (msg.role === 'user' && msg.content.length > 500)) {
      return NextResponse.json({ error: 'Message content must be a string of at most 500 chars' }, { status: 400 })
    }
  }

  const systemPrompt = SYSTEM_PROMPTS[contextKey] ?? SYSTEM_PROMPTS.generic

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: systemPrompt,
      messages,
    })

    const reply = response.content[0]?.type === 'text' ? response.content[0].text : ''
    return NextResponse.json({ reply }, { status: 200 })
  } catch (err) {
    console.error('[help/chat] Anthropic error', err)
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }
}
