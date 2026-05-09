'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { COUNTRIES } from '@/lib/countries'

const INDUSTRIES: { value: string; label: string }[] = [
  { value: 'banking',    label: 'Banking'    },
  { value: 'insurance',  label: 'Insurance'  },
  { value: 'payments',   label: 'Payments'   },
  { value: 'healthtech', label: 'HealthTech' },
  { value: 'energy',     label: 'Energy'     },
  { value: 'other',      label: 'Other'      },
]
const SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+']

export type TenantProfile = {
  name: string
  industry: string
  company_size: string
  country: string | null
}

export type UserProfile = {
  email: string
  role: string
  phone: string
}

function CountryPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (code: string) => void
}) {
  const [open, setOpen]       = useState(false)
  const [search, setSearch]   = useState('')
  const containerRef          = useRef<HTMLDivElement>(null)
  const inputRef              = useRef<HTMLInputElement>(null)

  const selected = COUNTRIES.find(c => c.code === value)
  const filtered = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dial.includes(search)
  )

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="form-input"
        style={{
          width: '100%', textAlign: 'left', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8, background: 'rgba(255,255,255,0.04)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {selected ? (
            <>
              <span style={{ fontSize: 18 }}>{selected.flag}</span>
              <span style={{ fontSize: 13, color: '#e2e8f0' }}>{selected.name}</span>
              <span style={{ fontSize: 12, color: '#64748b' }}>{selected.dial}</span>
            </>
          ) : (
            <span style={{ fontSize: 13, color: '#64748b' }}>Select country</span>
          )}
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
          <path d="M2 4l4 4 4-4" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
          background: '#0f1729', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search country or dial code…"
              style={{
                width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 6, padding: '6px 10px', fontSize: 13, color: '#e2e8f0', outline: 'none',
              }}
            />
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px 16px', fontSize: 13, color: '#64748b' }}>No results</div>
            ) : filtered.map(c => (
              <button
                key={c.code}
                type="button"
                onClick={() => { onChange(c.code); setOpen(false); setSearch('') }}
                style={{
                  width: '100%', textAlign: 'left', border: 'none',
                  padding: '8px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                  fontSize: 13,
                  color: c.code === value ? '#42a5f5' : '#e2e8f0',
                  background: c.code === value ? 'rgba(66,165,245,0.08)' : 'transparent',
                }}
                onMouseEnter={e => { if (c.code !== value) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = c.code === value ? 'rgba(66,165,245,0.08)' : 'transparent' }}
              >
                <span style={{ fontSize: 18, lineHeight: 1 }}>{c.flag}</span>
                <span style={{ flex: 1 }}>{c.name}</span>
                <span style={{ fontSize: 12, color: '#64748b' }}>{c.dial}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ProfileTab({
  tenant,
  user,
  tenantId,
  currentUserId,
}: {
  tenant: TenantProfile
  user: UserProfile
  tenantId: string
  currentUserId: string
}) {
  const [name, setName]               = useState(tenant.name ?? '')
  const [industry, setIndustry]       = useState(tenant.industry ?? '')
  const [companySize, setCompanySize] = useState(tenant.company_size ?? '')
  const [countryCode, setCountryCode] = useState(tenant.country ?? '')
  const [saving, setSaving]           = useState(false)
  const [saveMsg, setSaveMsg]         = useState('')

  const [phone, setPhone]             = useState(user.phone ?? '')
  const [savingPhone, setSavingPhone] = useState(false)
  const [phoneMsg, setPhoneMsg]       = useState('')

  const [resetting, setResetting]     = useState(false)
  const [resetMsg, setResetMsg]       = useState('')
  const [passwordUpdated, setPasswordUpdated] = useState(false)

  const selectedCountry = COUNTRIES.find(c => c.code === countryCode)
  const dialCode        = selectedCountry?.dial ?? ''

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('passwordUpdated') === '1') {
      setPasswordUpdated(true)
      window.history.replaceState({}, '', '/dashboard/settings')
      setTimeout(() => setPasswordUpdated(false), 5000)
    }
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveMsg('')
    const supabase = createClient()
    const { error, data } = await supabase
      .from('tenants')
      .update({ name, industry, company_size: companySize, country: countryCode || null })
      .eq('id', tenantId)
      .select('id')
    setSaving(false)
    if (error) {
      setSaveMsg(`Error: ${error.message}`)
    } else if (!data?.length) {
      setSaveMsg('Error: update failed — please refresh and try again')
    } else {
      setSaveMsg('Changes saved')
      setTimeout(() => setSaveMsg(''), 3000)
    }
  }

  async function handleSavePhone(e: React.FormEvent) {
    e.preventDefault()
    setSavingPhone(true)
    setPhoneMsg('')
    const supabase = createClient()
    const fullPhone = phone ? `${dialCode} ${phone}`.trim() : null
    const { error } = await supabase
      .from('users')
      .update({ phone: fullPhone })
      .eq('id', currentUserId)
    setSavingPhone(false)
    if (error) {
      setPhoneMsg(`Error: ${error.message}`)
    } else {
      setPhoneMsg('Saved')
      setTimeout(() => setPhoneMsg(''), 3000)
    }
  }

  async function handlePasswordReset() {
    setResetting(true)
    setResetMsg('')
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    setResetting(false)
    if (error) {
      setResetMsg(`Error: ${error.message}`)
    } else {
      setResetMsg('Reset email sent ✓')
      setTimeout(() => setResetMsg(''), 3000)
    }
  }

  return (
    <div style={{ maxWidth: 560 }}>
      {passwordUpdated && (
        <div style={{ padding: '10px 16px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, marginBottom: 24, fontSize: 13, color: '#22c55e' }}>
          Password updated successfully
        </div>
      )}

      {/* Company */}
      <div className="gs au1" style={{ padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 20, letterSpacing: '0.04em' }}>COMPANY</h2>
        <form onSubmit={handleSave}>
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Company Name</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Acme Financial" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Industry</label>
            <select className="form-input" value={industry} onChange={e => setIndustry(e.target.value)}>
              <option value="">Select industry</option>
              {INDUSTRIES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Company Size</label>
            <select className="form-input" value={companySize} onChange={e => setCompanySize(e.target.value)}>
              <option value="">Select size</option>
              {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label className="form-label">Country</label>
            <CountryPicker value={countryCode} onChange={setCountryCode} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="submit" className="btn-p" style={{ fontSize: 13, padding: '8px 20px' }} disabled={saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            {saveMsg && (
              <span style={{ fontSize: 13, color: saveMsg.startsWith('Error') ? '#ef4444' : '#22c55e' }}>{saveMsg}</span>
            )}
          </div>
        </form>
      </div>

      {/* Personal */}
      <div className="gs au1" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 20, letterSpacing: '0.04em' }}>PERSONAL</h2>
        <div style={{ marginBottom: 16 }}>
          <label className="form-label">Email</label>
          <div style={{ padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, fontSize: 13, color: '#64748b' }}>
            {user.email}
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label className="form-label">Role</label>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', padding: '3px 10px', borderRadius: 4, background: 'rgba(66,165,245,0.1)', color: '#42a5f5', border: '1px solid rgba(66,165,245,0.2)' }}>
              {(user.role ?? 'member').toUpperCase()}
            </span>
          </div>
        </div>

        {/* Mobile */}
        <form onSubmit={handleSavePhone} style={{ marginBottom: 20 }}>
          <label className="form-label">Mobile</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '9px 12px', background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
              fontSize: 13, color: '#64748b', whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {selectedCountry ? (
                <><span style={{ fontSize: 16 }}>{selectedCountry.flag}</span><span>{dialCode}</span></>
              ) : (
                <span>—</span>
              )}
            </div>
            <input
              className="form-input"
              style={{ flex: 1 }}
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="Enter mobile number"
            />
          </div>
          {!selectedCountry && (
            <p style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>Select a country above to set the dial code.</p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
            <button type="submit" className="btn-s" style={{ fontSize: 13, padding: '7px 18px' }} disabled={savingPhone}>
              {savingPhone ? 'Saving…' : 'Save mobile'}
            </button>
            {phoneMsg && (
              <span style={{ fontSize: 13, color: phoneMsg.startsWith('Error') ? '#ef4444' : '#22c55e' }}>{phoneMsg}</span>
            )}
          </div>
        </form>

        <div>
          <button
            type="button"
            onClick={handlePasswordReset}
            className="btn-s"
            style={{ fontSize: 13 }}
            disabled={resetting}
          >
            {resetting ? 'Sending…' : (resetMsg && !resetMsg.startsWith('Error')) ? resetMsg : 'Send password reset email'}
          </button>
          {resetMsg && resetMsg.startsWith('Error') && (
            <p style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>{resetMsg}</p>
          )}
        </div>
      </div>
    </div>
  )
}
