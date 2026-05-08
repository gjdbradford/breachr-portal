'use client'

import { useState, useRef, useEffect } from 'react'
import { useHelpPanel } from '@/lib/help-panel-context'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  isError?: boolean
}

let msgId = 0
function nextId() { return String(++msgId) }

function capHistory(msgs: Message[]): Message[] {
  if (msgs.length <= 10) return msgs
  const sliced = msgs.slice(msgs.length - 10)
  const firstUserIdx = sliced.findIndex(m => m.role === 'user')
  return firstUserIdx > 0 ? sliced.slice(firstUserIdx) : sliced
}

export default function HelpPanel() {
  const { isOpen, close, config } = useHelpPanel()
  const [activeTab, setActiveTab] = useState<'chat' | 'guides' | 'videos'>('chat')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<Message[]>([])
  messagesRef.current = messages
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    setLoading(false)
  }, [config?.chatContextKey])

  useEffect(() => {
    if (config?.defaultTab) setActiveTab(config.defaultTab)
  }, [config?.defaultTab])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || trimmed.length > 500 || loading) return

    const userMsg: Message = { id: nextId(), role: 'user', content: trimmed }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const history = capHistory([...messagesRef.current, userMsg])
      abortRef.current = new AbortController()
      const res = await fetch('/api/help/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role, content: m.content })),
          contextKey: config?.chatContextKey ?? 'generic',
        }),
        signal: abortRef.current.signal,
      })

      if (res.ok) {
        const data = await res.json() as { reply: unknown }
        const reply = typeof data.reply === 'string' ? data.reply : 'Sorry, could not get a response.'
        setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: reply }])
      } else {
        setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: 'Something went wrong. Please try again.', isError: true }])
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setMessages(prev => [...prev, { id: nextId(), role: 'assistant', content: 'Something went wrong. Please try again.', isError: true }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() }
  }

  const tabs: { key: 'chat' | 'guides' | 'videos'; label: string }[] = [
    { key: 'chat', label: 'AI Chat' },
    { key: 'guides', label: 'Guides' },
    { key: 'videos', label: 'Videos' },
  ]

  return (
    <>
      <style>{`
        @keyframes help-dot-pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>

      <div className={`help-panel${isOpen ? ' open' : ''}`}>
        {/* Header */}
        <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>
              {config?.title ?? 'Breachr Assistant'}
            </div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>
              AI assistant · guides · how-to
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close help panel"
            style={{ fontSize: 18, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          {tabs.map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              style={{
                flex: 1, padding: '10px 0', fontSize: 11, fontWeight: 600,
                letterSpacing: '0.04em', border: 'none', cursor: 'pointer',
                background: 'none', transition: 'all 0.15s',
                borderBottom: activeTab === t.key ? '2px solid #42a5f5' : '2px solid transparent',
                color: activeTab === t.key ? '#42a5f5' : '#475569',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* AI Chat tab */}
        {activeTab === 'chat' && (
          <>
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, background: 'rgba(10,16,32,0.4)' }}>
              {messages.length === 0 && !loading && (
                <p style={{ fontSize: 12, color: '#334155', textAlign: 'center', padding: '32px 0', fontStyle: 'italic' }}>
                  Ask anything about {config?.title?.toLowerCase() ?? 'Breachr'}...
                </p>
              )}
              {messages.map(msg => {
                const isUser = msg.role === 'user'
                return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '80%', padding: '9px 13px', fontSize: 13, lineHeight: 1.6,
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      borderRadius: isUser ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                      ...(isUser
                        ? { background: 'rgba(99,102,241,0.8)', color: '#fff', border: '1px solid rgba(99,102,241,0.6)' }
                        : msg.isError
                        ? { background: 'rgba(239,68,68,0.1)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)' }
                        : { background: 'rgba(15,24,48,0.95)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.07)' }),
                    }}>
                      {msg.content}
                    </div>
                  </div>
                )
              })}
              {loading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '10px 14px', borderRadius: '12px 12px 12px 3px', background: 'rgba(15,24,48,0.95)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    {[0, 1, 2].map(n => (
                      <span key={n} style={{ width: 7, height: 7, borderRadius: '50%', background: '#64748b', display: 'inline-block', animation: `help-dot-pulse 1.2s ease-in-out ${n * 0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div style={{ padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', background: '#0d1428', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <textarea
                  aria-label="Message"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  maxLength={500}
                  disabled={loading}
                  rows={2}
                  placeholder="Type a question and press Enter…"
                  style={{ flex: 1, resize: 'none', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#e2e8f0', lineHeight: 1.5, outline: 'none', fontFamily: 'inherit', opacity: loading ? 0.6 : 1 }}
                />
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={loading || !input.trim()}
                  style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', background: loading || !input.trim() ? 'rgba(99,102,241,0.25)' : 'rgba(99,102,241,0.85)', color: loading || !input.trim() ? '#64748b' : '#fff', border: '1px solid rgba(99,102,241,0.4)', whiteSpace: 'nowrap', alignSelf: 'flex-end' }}
                >
                  Send
                </button>
              </div>
            </div>
          </>
        )}

        {/* Guides tab */}
        {activeTab === 'guides' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
            {(config?.guides ?? []).length === 0 ? (
              <p style={{ fontSize: 12, color: '#334155', textAlign: 'center', padding: '32px 0', fontStyle: 'italic' }}>No guides available for this page yet.</p>
            ) : (
              config?.guides?.map((g, i) => (
                <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {g.href ? (
                    <a href={g.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 600, color: '#42a5f5', textDecoration: 'none' }}>{g.title}</a>
                  ) : (
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>{g.title}</div>
                  )}
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{g.description}</div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Videos tab */}
        {activeTab === 'videos' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
            {(config?.videos ?? []).length === 0 ? (
              <p style={{ fontSize: 12, color: '#334155', textAlign: 'center', padding: '32px 0', fontStyle: 'italic' }}>Video guides coming soon.</p>
            ) : (
              config?.videos?.map((v, i) => (
                <a key={i} href={v.href} target="_blank" rel="noopener noreferrer" style={{ display: 'block', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', textDecoration: 'none' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#42a5f5' }}>{v.title}</div>
                </a>
              ))
            )}
          </div>
        )}
      </div>
    </>
  )
}
