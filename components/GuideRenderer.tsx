'use client'

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useGuide } from '@/lib/guide-context'
import { useConfetti } from '@/components/ConfettiCanvas'

export default function GuideRenderer() {
  const {
    activeGuide, steps, progress, currentStepIndex,
    loading, advanceStep, goBack, dismissGuide, completeGuide, rateGuide, nextGuide,
  } = useGuide()
  const { triggerBurst, triggerCelebration } = useConfetti()

  const [showCompletion, setShowCompletion] = useState(false)
  const [rated, setRated] = useState(false)
  const pulseCleanupRef = useRef<(() => void) | null>(null)

  const currentStep = steps[currentStepIndex] ?? null
  const isLastStep  = currentStepIndex === steps.length - 1
  const isCompleted = !!progress?.completed_at

  // Element targeting: add pulse class to target element
  useEffect(() => {
    if (pulseCleanupRef.current) { pulseCleanupRef.current(); pulseCleanupRef.current = null }
    if (!currentStep?.target_selector) return

    const el = document.querySelector(currentStep.target_selector) as HTMLElement | null
    if (!el) return

    el.classList.add('guide-target-pulse')

    async function handleElementClick(e: Event) {
      e.stopPropagation()
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      triggerBurst(rect.left + rect.width / 2, rect.top + rect.height / 2)
      el!.classList.remove('guide-target-pulse')
      if (isLastStep) {
        await completeGuide()
        setShowCompletion(true)
        triggerCelebration()
      } else {
        await advanceStep()
      }
    }

    el.addEventListener('click', handleElementClick)
    pulseCleanupRef.current = () => {
      el.removeEventListener('click', handleElementClick)
      el.classList.remove('guide-target-pulse')
    }

    return () => { pulseCleanupRef.current?.(); pulseCleanupRef.current = null }
  }, [currentStep?.target_selector, currentStepIndex, isLastStep, advanceStep, completeGuide, triggerBurst, triggerCelebration])

  async function handleNext() {
    if (isLastStep) {
      await completeGuide()
      setShowCompletion(true)
      triggerCelebration()
    } else {
      await advanceStep()
    }
  }

  async function handleRate(helpful: boolean) {
    await rateGuide(helpful)
    setRated(true)
  }

  if (loading) {
    return <p style={{ fontSize: 12, color: '#334155', textAlign: 'center', padding: '32px 0', fontStyle: 'italic' }}>Loading guide&hellip;</p>
  }

  if (!activeGuide || steps.length === 0) {
    return <p style={{ fontSize: 12, color: '#334155', textAlign: 'center', padding: '32px 0', fontStyle: 'italic' }}>No guide available for this page.</p>
  }

  // Completion screen
  if (showCompletion || isCompleted) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 16px', gap: 12, textAlign: 'center' }}>
        <div style={{ fontSize: 36 }}>🎉</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Guide complete!</div>
        {!rated ? (
          <>
            <div style={{ fontSize: 11, color: '#475569' }}>Was this guide helpful?</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {([true, false] as const).map(h => (
                <button key={String(h)} onClick={() => handleRate(h)} style={{ width: 48, height: 48, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', fontSize: 22, cursor: 'pointer' }}>
                  {h ? '👍' : '👎'}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 11, color: '#4ade80' }}>Thanks for your feedback!</div>
        )}
        {nextGuide && (
          <>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', width: '100%' }} />
            <div style={{ fontSize: 10, color: '#475569' }}>Continue your setup</div>
            <button
              onClick={() => { setShowCompletion(false); setRated(false) }}
              style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid rgba(66,165,245,0.3)', background: 'rgba(66,165,245,0.08)', fontSize: 11, color: '#42a5f5', cursor: 'pointer', fontWeight: 600 }}
            >
              &#8594; {nextGuide.title}
            </button>
          </>
        )}
      </div>
    )
  }

  // Step renderer
  const pct = steps.length > 0 ? (currentStepIndex / steps.length) * 100 : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Step overview list */}
        <div style={{ padding: '12px 16px 4px' }}>
          {steps.map((s, idx) => {
            const done   = idx < currentStepIndex
            const active = idx === currentStepIndex
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, marginBottom: 2, background: active ? 'rgba(25,118,210,0.1)' : 'transparent', border: active ? '1px solid rgba(25,118,210,0.2)' : '1px solid transparent' }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, background: done ? 'rgba(34,197,94,0.2)' : active ? 'rgba(25,118,210,0.25)' : 'rgba(255,255,255,0.05)', color: done ? '#4ade80' : active ? '#42a5f5' : '#334155' }}>
                  {done ? '✓' : idx + 1}
                </div>
                <span style={{ fontSize: 11, color: done ? '#475569' : active ? '#e2e8f0' : '#334155', fontWeight: active ? 600 : 400, textDecoration: done ? 'line-through' : 'none' }}>
                  {s.title}
                </span>
              </div>
            )
          })}
        </div>

        {/* Active step detail */}
        {currentStep && (
          <div style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>
              Step {currentStepIndex + 1} of {steps.length}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 8, lineHeight: 1.4 }}>{currentStep.title}</div>

            {currentStep.image_url && (
              <img src={currentStep.image_url} alt="" style={{ width: '100%', borderRadius: 6, marginBottom: 10, border: '1px solid rgba(255,255,255,0.06)' }} />
            )}

            {currentStep.video_url && (
              <div style={{ marginBottom: 10, borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.06)' }}>
                <iframe src={currentStep.video_url.replace('watch?v=', 'embed/')} style={{ width: '100%', height: 140, border: 'none' }} allow="accelerometer; autoplay; encrypted-media; gyroscope" allowFullScreen={true} />
              </div>
            )}

            <div className="guide-body" style={{ fontSize: 12, color: '#64748b', lineHeight: 1.65, marginBottom: 10 }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{currentStep.body}</ReactMarkdown>
            </div>

            {currentStep.target_selector && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', background: 'rgba(66,165,245,0.06)', border: '1px solid rgba(66,165,245,0.2)', borderRadius: 6, marginBottom: 10 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#42a5f5', flexShrink: 0, animation: 'guide-dot-pulse 1.5s ease-in-out infinite', display: 'inline-block' }} />
                <span style={{ fontSize: 10, color: '#42a5f5' }}>The highlighted element is on the page &#8594;</span>
              </div>
            )}

            {currentStep.links.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {currentStep.links.map((l, i) => (
                  <a key={i} href={l.href} target={l.external ? '_blank' : undefined} rel={l.external ? 'noopener noreferrer' : undefined} style={{ fontSize: 11, color: '#42a5f5', textDecoration: 'none' }}>
                    {l.external ? '↗' : '→'} {l.label}
                    {l.external && <span style={{ fontSize: 9, color: '#334155', marginLeft: 4 }}>external</span>}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#1976d2,#42a5f5)', borderRadius: '0 2px 2px 0', transition: 'width 0.4s' }} />
      </div>

      {/* Nav bar */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={goBack} disabled={currentStepIndex === 0} style={{ padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: currentStepIndex === 0 ? '#334155' : '#64748b', cursor: currentStepIndex === 0 ? 'not-allowed' : 'pointer' }}>
          &#8592; Back
        </button>
        <button
          title="Mark as done"
          onClick={handleNext}
          style={{ width: 30, height: 30, borderRadius: 6, border: '1px solid rgba(66,165,245,0.3)', background: 'rgba(66,165,245,0.08)', color: '#42a5f5', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          &#10003;
        </button>
        <button onClick={handleNext} style={{ flex: 1, padding: '6px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, background: 'rgba(25,118,210,0.85)', border: '1px solid rgba(25,118,210,0.4)', color: '#fff', cursor: 'pointer' }}>
          {isLastStep ? 'Finish ✓' : 'Next step →'}
        </button>
      </div>
    </div>
  )
}
