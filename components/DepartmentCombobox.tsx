'use client'

import { useState, useEffect, useRef } from 'react'

export default function DepartmentCombobox({
  value,
  onChange,
  style,
}: {
  value: string
  onChange: (v: string) => void
  style?: React.CSSProperties
}) {
  const [options, setOptions]   = useState<string[]>([])
  const [open, setOpen]         = useState(false)
  const [input, setInput]       = useState(value)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/assets/departments')
      .then(r => r.json())
      .then(d => setOptions(d.departments ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => { setInput(value) }, [value])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const filtered = input
    ? options.filter(o => o.toLowerCase().includes(input.toLowerCase()))
    : options

  function handleSelect(val: string) {
    setInput(val)
    onChange(val)
    setOpen(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInput(e.target.value)
    onChange(e.target.value)
    setOpen(true)
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '7px 10px', borderRadius: 6, fontSize: 12,
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#e2e8f0', outline: 'none', boxSizing: 'border-box',
    ...style,
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <input
        style={inp}
        value={input}
        placeholder="e.g. Engineering"
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, marginTop: 2,
          background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 6, maxHeight: 200, overflowY: 'auto',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {filtered.map(opt => (
            <button
              key={opt}
              type="button"
              onMouseDown={() => handleSelect(opt)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '7px 10px', fontSize: 12, border: 'none',
                background: opt === input ? 'rgba(255,255,255,0.08)' : 'none',
                color: opt === input ? '#e2e8f0' : '#94a3b8',
                cursor: 'pointer',
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
