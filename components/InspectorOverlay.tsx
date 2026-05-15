'use client'

import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function InspectorOverlay() {
  const params = useSearchParams()
  const [active, setActive] = useState(false)
  const [captured, setCaptured] = useState<string | null>(null)
  const highlightRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (params.get('guide-inspect') === '1') {
      sessionStorage.setItem('guide-inspect', '1')
    }
    if (sessionStorage.getItem('guide-inspect') === '1') {
      setActive(true)
    }
  }, [params])

  useEffect(() => {
    if (!active) return

    const SKIP_TAGS = new Set(['HTML', 'BODY', 'SCRIPT', 'STYLE', 'HEAD'])

    function getSelector(el: HTMLElement): string {
      const attr = el.getAttribute('data-guide-target')
      if (attr) return `[data-guide-target="${attr}"]`
      if (el.id) return `#${el.id}`
      const tag = el.tagName.toLowerCase()
      const cls = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''
      return `${tag}${cls}`
    }

    function onMouseOver(e: MouseEvent) {
      const el = e.target as HTMLElement
      if (SKIP_TAGS.has(el.tagName)) return
      if (highlightRef.current && highlightRef.current !== el) {
        highlightRef.current.style.outline = ''
        highlightRef.current.style.outlineOffset = ''
      }
      el.style.outline = '2px solid #42a5f5'
      el.style.outlineOffset = '2px'
      highlightRef.current = el
    }

    function onMouseOut() {
      if (highlightRef.current) {
        highlightRef.current.style.outline = ''
        highlightRef.current.style.outlineOffset = ''
      }
    }

    function onClick(e: MouseEvent) {
      e.preventDefault()
      e.stopPropagation()
      const el = e.target as HTMLElement
      if (SKIP_TAGS.has(el.tagName)) return

      const selector = getSelector(el)
      const route = window.location.pathname
      const elementLabel = (el.textContent ?? '').trim().slice(0, 60)
      const adminOrigin = document.referrer ? new URL(document.referrer).origin : '*'

      window.opener?.postMessage(
        { type: 'guide-target-selected', route, selector, elementLabel },
        adminOrigin
      )

      if (highlightRef.current) {
        highlightRef.current.style.outline = ''
        highlightRef.current.style.outlineOffset = ''
      }

      const hasAttr = !!(el as HTMLElement).getAttribute('data-guide-target')
      setCaptured(hasAttr ? selector : `${selector} ⚠ add data-guide-target attr`)
      setTimeout(() => setCaptured(null), 2500)
    }

    document.addEventListener('mouseover', onMouseOver)
    document.addEventListener('mouseout', onMouseOut)
    document.addEventListener('click', onClick, true)

    return () => {
      document.removeEventListener('mouseover', onMouseOver)
      document.removeEventListener('mouseout', onMouseOut)
      document.removeEventListener('click', onClick, true)
    }
  }, [active])

  if (!active) return null

  return (
    <>
      {/* Banner */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
        background: 'rgba(25,118,210,0.95)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', fontSize: 12, fontWeight: 600,
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}>
        <span>&#9711; Inspector active — click any element to capture its selector. Navigate to any page.</span>
        <button
          onClick={() => { sessionStorage.removeItem('guide-inspect'); setActive(false) }}
          style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: 5, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}
        >
          Exit Inspector
        </button>
      </div>

      {/* Captured toast */}
      {captured && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15,24,48,0.97)', border: '1px solid rgba(66,165,245,0.4)',
          borderRadius: 8, padding: '10px 16px', zIndex: 99999,
          fontSize: 12, color: '#42a5f5', fontFamily: 'monospace',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          ✓ Captured: {captured}
        </div>
      )}
    </>
  )
}
