'use client'

import { useState, useRef, useEffect } from 'react'
import { DEPLOYMENT_TYPES } from '@/lib/sensor-types'
import type { DeploymentType } from '@/lib/sensor-types'

interface Props {
  deploymentType: DeploymentType
  sensor?: {
    id: string
    status: string
    last_seen: string | null
    deployment_type: string
  }
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  isError?: boolean
}

function capHistory(msgs: Message[]): Message[] {
  // Keep only the last 10 messages
  if (msgs.length <= 10) return msgs
  // Drop oldest pair (user + assistant) to bring total to 10
  const excess = msgs.length - 10
  // Drop in pairs from the front; excess is always even after a successful round trip
  return msgs.slice(excess)
}

export default function SensorHelpChat({ deploymentType, sensor }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const deploymentLabel =
    DEPLOYMENT_TYPES.find(dt => dt.id === deploymentType)?.label ?? deploymentType

  // Auto-scroll to bottom when messages or loading state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || trimmed.length > 500 || loading) return

    const userMessage: Message = { role: 'user', content: trimmed }
    const nextMessages = capHistory([...messages, userMessage])

    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const body: {
        messages: { role: 'user' | 'assistant'; content: string }[]
        deploymentType: DeploymentType
        sensorId?: string
      } = {
        messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
        deploymentType,
      }
      if (sensor?.id) {
        body.sensorId = sensor.id
      }

      const res = await fetch('/api/sensors/ai-help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const data = (await res.json()) as { reply: string }
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      } else {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: 'Something went wrong. Please try again.',
            isError: true,
          },
        ])
      }
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: 'Something went wrong. Please try again.',
          isError: true,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const showCounter = input.length > 400

  return (
    <>
      {/* Keyframe animation for typing dots */}
      <style>{`
        @keyframes brchr-dot-pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
          40%            { opacity: 1;   transform: scale(1);   }
        }
      `}</style>

      <div style={{ padding: '0 24px 48px', maxWidth: 860, margin: '0 auto' }}>
        <div style={{
          background: 'rgba(13,20,40,0.9)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '18px 22px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <p style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#e2e8f0',
              marginBottom: 4,
            }}>
              Still stuck? Ask the Breachr sensor assistant
            </p>
            <p style={{
              fontSize: 11,
              color: '#475569',
            }}>
              Only answers questions about sensor setup and troubleshooting
            </p>
          </div>

          {/* Message thread */}
          <div style={{
            maxHeight: 400,
            overflowY: 'auto',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            background: 'rgba(10,16,32,0.6)',
          }}>
            {/* Empty state placeholder */}
            {messages.length === 0 && !loading && (
              <p style={{
                fontSize: 12,
                color: '#334155',
                textAlign: 'center',
                padding: '28px 0',
                fontStyle: 'italic',
              }}>
                Ask anything about your {deploymentLabel} sensor setup...
              </p>
            )}

            {/* Message bubbles */}
            {messages.map((msg, i) => {
              const isUser = msg.role === 'user'
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: isUser ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div style={{
                    maxWidth: '78%',
                    padding: '9px 13px',
                    borderRadius: isUser ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                    fontSize: 13,
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    ...(isUser
                      ? {
                          background: 'rgba(99,102,241,0.8)',
                          color: '#ffffff',
                          border: '1px solid rgba(99,102,241,0.6)',
                        }
                      : msg.isError
                      ? {
                          background: 'rgba(239,68,68,0.1)',
                          color: '#fca5a5',
                          border: '1px solid rgba(239,68,68,0.25)',
                        }
                      : {
                          background: 'rgba(15,24,48,0.95)',
                          color: '#94a3b8',
                          border: '1px solid rgba(255,255,255,0.07)',
                        }),
                  }}>
                    {msg.content}
                  </div>
                </div>
              )
            })}

            {/* Typing indicator */}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '10px 14px',
                  borderRadius: '12px 12px 12px 3px',
                  background: 'rgba(15,24,48,0.95)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}>
                  {[0, 1, 2].map(n => (
                    <span
                      key={n}
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: '#64748b',
                        display: 'inline-block',
                        animation: `brchr-dot-pulse 1.2s ease-in-out ${n * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div style={{
            padding: '12px 18px 14px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(13,20,40,0.9)',
          }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  maxLength={500}
                  disabled={loading}
                  rows={2}
                  placeholder="Type a question and press Enter…"
                  style={{
                    width: '100%',
                    resize: 'none',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    padding: '9px 12px',
                    fontSize: 13,
                    color: '#e2e8f0',
                    lineHeight: 1.5,
                    outline: 'none',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    opacity: loading ? 0.6 : 1,
                  }}
                />
                {showCounter && (
                  <span style={{
                    position: 'absolute',
                    bottom: 6,
                    right: 8,
                    fontSize: 10,
                    color: input.length >= 500 ? '#ef4444' : '#64748b',
                    pointerEvents: 'none',
                  }}>
                    {input.length} / 500
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={loading || !input.trim()}
                style={{
                  padding: '9px 18px',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                  background: loading || !input.trim()
                    ? 'rgba(99,102,241,0.25)'
                    : 'rgba(99,102,241,0.85)',
                  color: loading || !input.trim() ? '#64748b' : '#ffffff',
                  border: '1px solid rgba(99,102,241,0.4)',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                  alignSelf: 'flex-end',
                  marginBottom: 1,
                }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
