'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface AiMessage {
  role: 'user' | 'assistant'
  content: string
  tokens: number
  timestamp: string
}

const DAILY_LIMIT         = 20
const SESSION_TOKEN_LIMIT = 5000

export default function AiAssistPanel({
  taskId,
  initialMessages,
  initialTokensUsed,
  initialDailyCount,
  compact = false,
}: {
  taskId: string
  initialMessages:   AiMessage[]
  initialTokensUsed: number
  initialDailyCount: number
  compact?:          boolean
}) {
  const [open, setOpen]           = useState(false)
  const [messages, setMessages]   = useState<AiMessage[]>(initialMessages)
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [tokensUsed, setTokens]   = useState(initialTokensUsed)
  const [dailyCount, setDaily]    = useState(initialDailyCount)
  const bottomRef                 = useRef<HTMLDivElement>(null)

  const dailyLimitReached = dailyCount >= DAILY_LIMIT
  const tokenLimitReached = tokensUsed >= SESSION_TOKEN_LIMIT

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || loading || dailyLimitReached || tokenLimitReached) return

    setInput('')
    setLoading(true)
    setError('')

    const userEntry: AiMessage = { role: 'user', content: text, tokens: 0, timestamp: new Date().toISOString() }
    setMessages(prev => [...prev, userEntry])

    const res = await fetch('/api/remediation/ai-assist', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ taskId, message: text }),
    })

    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      if      (d.error === 'daily_limit_reached') setDaily(DAILY_LIMIT)
      else if (d.error === 'token_limit_reached') setTokens(SESSION_TOKEN_LIMIT)
      else { setError(d.error ?? 'Something went wrong'); setMessages(prev => prev.slice(0, -1)) }
      setLoading(false)
      return
    }

    const data = await res.json()
    const assistantEntry: AiMessage = {
      role: 'assistant', content: data.content, tokens: data.tokens, timestamp: new Date().toISOString(),
    }
    setMessages(prev => [...prev, assistantEntry])
    setTokens(data.tokensUsed)
    setDaily(data.dailyCount)
    setLoading(false)
  }, [input, loading, dailyLimitReached, tokenLimitReached, taskId])

  const tokenPct = Math.min((tokensUsed / SESSION_TOKEN_LIMIT) * 100, 100)
  const dailyPct = Math.min((dailyCount / DAILY_LIMIT) * 100, 100)
  const warn     = (pct: number) => pct >= 80 ? '#f97316' : '#64748b'

  const bubbleStyle = (role: 'user' | 'assistant'): React.CSSProperties => ({
    maxWidth: '88%', padding: '8px 12px', borderRadius: 8, fontSize: 12,
    lineHeight: 1.6, color: '#e2e8f0', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    background: role === 'user' ? 'rgba(66,165,245,0.12)' : 'rgba(255,255,255,0.05)',
    border:    `1px solid ${role === 'user' ? 'rgba(66,165,245,0.2)' : 'rgba(255,255,255,0.06)'}`,
  })

  const expanded = compact || open

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: compact ? 1 : undefined }}>
      {/* Header / toggle — hidden in compact (HelpPanel) mode */}
      {!compact && (
        <button
          onClick={() => setOpen(p => !p)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', color: '#e2e8f0', fontSize: 13, fontWeight: 600, borderBottom: open ? '1px solid rgba(255,255,255,0.06)' : 'none', width: '100%', textAlign: 'left' }}
        >
          AI Assist
          <span style={{ color: '#64748b', fontSize: 11 }}>{open ? '▲' : '▼'}</span>
        </button>
      )}

      {expanded && (
        <>
          {/* Usage bars */}
          <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: warn(tokenPct) }}>
              <span>Tokens: {tokensUsed.toLocaleString()} / {SESSION_TOKEN_LIMIT.toLocaleString()}</span>
            </div>
            <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ height: '100%', borderRadius: 2, width: `${tokenPct}%`, background: tokenPct >= 80 ? '#f97316' : '#42a5f5', transition: 'width 0.3s' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: warn(dailyPct) }}>
              <span>AI questions today: {dailyCount} / {DAILY_LIMIT}</span>
            </div>
            <div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
              <div style={{ height: '100%', borderRadius: 2, width: `${dailyPct}%`, background: dailyPct >= 80 ? '#f97316' : '#42a5f5', transition: 'width 0.3s' }} />
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, minHeight: 120 }}>
            {messages.length === 0 && (
              <p style={{ fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 20 }}>
                Finding context is pre-loaded. Ask anything about this vulnerability.
              </p>
            )}
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={bubbleStyle(msg.role)}>{msg.content}</div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', fontSize: 12, color: '#64748b' }}>
                  Thinking&hellip;
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input or limit message */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {dailyLimitReached ? (
              <p style={{ fontSize: 11, color: '#f97316', margin: 0 }}>
                You&apos;ve reached your daily AI assist limit. Resets at midnight UTC.
              </p>
            ) : tokenLimitReached ? (
              <p style={{ fontSize: 11, color: '#f97316', margin: 0 }}>
                AI assist token limit reached for this task.
              </p>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
                {error && <p style={{ fontSize: 11, color: '#ef4444', margin: 0 }}>{error}</p>}
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                    placeholder="Ask about this vulnerability… (Enter to send, Shift+Enter for new line)"
                    rows={2}
                    style={{ flex: 1, padding: '7px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', fontSize: 12, resize: 'none', lineHeight: 1.5 }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    className="btn-p"
                    style={{ fontSize: 12, padding: '8px 12px', flexShrink: 0, alignSelf: 'flex-end' }}
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
