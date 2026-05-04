'use client'

import { useEffect, useState } from 'react'

interface Question {
  id: string
  type: 'rating_10' | 'rating_5' | 'open_text' | 'choice'
  text: string
  options?: string[]
  optional?: boolean
}

interface Survey {
  id: string
  name: string
  type: string
  questions: Question[]
}

export default function SurveyBanner() {
  const [survey, setSurvey] = useState<Survey | null>(null)
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [current, setCurrent] = useState<unknown>(null)
  const [done, setDone] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    fetch('/api/surveys/pending')
      .then(r => r.json())
      .then(({ survey }) => {
        if (survey) {
          setSurvey(survey)
          setTimeout(() => setVisible(true), 1800)
        }
      })
      .catch(() => {})
  }, [])

  if (!survey || !visible) return null

  const questions = survey.questions
  const question = questions[step]
  const isLast = step === questions.length - 1
  const canAdvance = question.optional || current !== null

  function handleAnswer(val: unknown) {
    setCurrent(val)
  }

  async function handleNext() {
    const nextAnswers = { ...answers, [question.id]: current }
    setAnswers(nextAnswers)
    setCurrent(null)

    if (isLast) {
      setDone(true)
      await fetch('/api/surveys/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ survey_id: survey!.id, answers: nextAnswers }),
      }).catch(() => {})
      setTimeout(() => setVisible(false), 2200)
    } else {
      setStep(s => s + 1)
    }
  }

  async function handleDismiss() {
    setVisible(false)
    await fetch('/api/surveys/dismiss', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ survey_id: survey!.id }),
    }).catch(() => {})
  }

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
      width: 340, background: 'rgba(10,14,26,0.97)',
      border: '1px solid rgba(25,118,210,0.35)', borderRadius: 14,
      boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(25,118,210,0.1)',
      animation: 'slideUp 0.35s ease-out both',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#42a5f5', flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#42a5f5', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Quick Feedback
          </span>
        </div>
        <button onClick={handleDismiss} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '2px 4px' }} aria-label="Dismiss">×</button>
      </div>

      {/* Body */}
      <div style={{ padding: '16px 16px 14px' }}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 22, marginBottom: 8 }}>🙏</div>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>Thank you — appreciated.</p>
            <p style={{ fontSize: 11, color: '#64748b' }}>Your feedback shapes what we build next.</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.5, marginBottom: 14 }}>{question.text}</p>

            {question.type === 'rating_10' && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {Array.from({ length: 11 }, (_, i) => (
                    <button key={i} onClick={() => handleAnswer(i)}
                      style={{
                        width: 28, height: 28, borderRadius: 6, border: '1px solid',
                        borderColor: current === i ? '#42a5f5' : 'rgba(255,255,255,0.1)',
                        background: current === i ? 'rgba(66,165,245,0.2)' : 'rgba(255,255,255,0.03)',
                        color: current === i ? '#42a5f5' : '#94a3b8',
                        fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                      {i}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 9, color: '#475569' }}>
                  <span>Not likely</span><span>Very likely</span>
                </div>
              </div>
            )}

            {question.type === 'rating_5' && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} onClick={() => handleAnswer(n)}
                    style={{
                      flex: 1, height: 36, borderRadius: 8, border: '1px solid',
                      borderColor: current === n ? '#42a5f5' : 'rgba(255,255,255,0.1)',
                      background: current === n ? 'rgba(66,165,245,0.15)' : 'rgba(255,255,255,0.02)',
                      color: current === n ? '#42a5f5' : '#64748b',
                      fontSize: 18, cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                    {'★'.repeat(n)}
                  </button>
                ))}
              </div>
            )}

            {question.type === 'choice' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {question.options?.map(opt => (
                  <button key={opt} onClick={() => handleAnswer(opt)}
                    style={{
                      textAlign: 'left', padding: '9px 12px', borderRadius: 8, border: '1px solid',
                      borderColor: current === opt ? '#42a5f5' : 'rgba(255,255,255,0.08)',
                      background: current === opt ? 'rgba(66,165,245,0.12)' : 'rgba(255,255,255,0.02)',
                      color: current === opt ? '#e2e8f0' : '#94a3b8',
                      fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                    }}>
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {question.type === 'open_text' && (
              <textarea
                value={typeof current === 'string' ? current : ''}
                onChange={e => handleAnswer(e.target.value || null)}
                placeholder="Your thoughts…"
                rows={3}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8, marginBottom: 12,
                  background: 'rgba(10,14,26,0.85)', border: '1px solid rgba(25,118,210,0.22)',
                  color: '#e2e8f0', fontSize: 12, fontFamily: 'inherit', resize: 'vertical',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Progress dots */}
              <div style={{ display: 'flex', gap: 4 }}>
                {questions.map((_, i) => (
                  <div key={i} style={{
                    width: i === step ? 14 : 6, height: 6, borderRadius: 3,
                    background: i === step ? '#42a5f5' : i < step ? 'rgba(66,165,245,0.4)' : 'rgba(255,255,255,0.1)',
                    transition: 'all 0.2s',
                  }} />
                ))}
              </div>

              <button onClick={handleNext} disabled={!canAdvance}
                className="btn-p"
                style={{ fontSize: 12, padding: '8px 18px', opacity: canAdvance ? 1 : 0.4 }}>
                {isLast ? 'Submit' : 'Next →'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
