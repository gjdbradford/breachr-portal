'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { COUNTRIES } from '@/lib/countries'
import { TIMEZONES, TZ_REGIONS } from '@/lib/timezones'
import { getBillingRegion } from '@/lib/eu-countries'

type Step = 1 | 2 | 3 | 4


const FRAMEWORKS = [
  {
    id: 'DORA',
    label: 'DORA',
    full: 'Digital Operational Resilience Act',
    desc: 'Mandatory for EU financial entities from Jan 2025.',
    badge: 'EU · Financial',
    color: '#3b82f6',
  },
  {
    id: 'NIS2',
    label: 'NIS2',
    full: 'Network & Information Security Directive 2',
    desc: 'Critical infrastructure & essential services operators.',
    badge: 'EU · All sectors',
    color: '#8b5cf6',
  },
  {
    id: 'PCI-DSS',
    label: 'PCI-DSS',
    full: 'Payment Card Industry Data Security Standard',
    desc: 'Required if you process, store or transmit card data.',
    badge: 'Global · Payments',
    color: '#10b981',
  },
  {
    id: 'HIPAA',
    label: 'HIPAA',
    full: 'Health Insurance Portability & Accountability Act',
    desc: 'Applies to health data handlers in the US and globally.',
    badge: 'US · Health',
    color: '#f59e0b',
  },
  {
    id: 'ISO27001',
    label: 'ISO 27001',
    full: 'Information Security Management Standard',
    desc: 'Internationally recognised security certification.',
    badge: 'Global',
    color: '#64748b',
  },
  {
    id: 'SOC2',
    label: 'SOC 2',
    full: 'Service Organisation Control 2',
    desc: 'Trust services criteria for SaaS and cloud providers.',
    badge: 'US · SaaS',
    color: '#ec4899',
  },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep]                 = useState<Step>(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('step')
      const n = parseInt(p ?? '1', 10)
      return (n >= 1 && n <= 4 ? n : 1) as Step
    }
    return 1
  })
  const [loading, setLoading]           = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [error, setError]               = useState('')
  const [tenantId, setTenantId]         = useState<string | null>(null)
  const [userId, setUserId]             = useState<string | null>(null)
  const [intendedPackageSlug, setIntendedPackageSlug] = useState<string | null>(null)

  // Step 1 — location & mobile
  const [country, setCountry]           = useState('')
  const [timezone, setTimezone]         = useState('UTC')
  const [mobileNumber, setMobileNumber] = useState('')
  const [tzOpen, setTzOpen]             = useState(false)
  const [tzSearch, setTzSearch]         = useState('')
  const tzRef = useRef<HTMLDivElement>(null)

  // Step 2 — target URLs
  const [targets, setTargets]           = useState([{ name: '', url: '', type: 'webapp' }])

  // Step 3 — compliance frameworks
  const [frameworks, setFrameworks]     = useState<string[]>([])

  // Step 4 — invite admin
  const [inviteEmail, setInviteEmail]   = useState('')
  const [inviteSent, setInviteSent]     = useState(false)

  const selectedCountry  = COUNTRIES.find(c => c.code === country)
  const dialCode         = selectedCountry?.dial ?? ''
  const [countryOpen, setCountryOpen]     = useState(false)
  const [countrySearch, setCountrySearch] = useState('')
  const countryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setCountryOpen(false)
        setCountrySearch('')
      }
      if (tzRef.current && !tzRef.current.contains(e.target as Node)) {
        setTzOpen(false)
        setTzSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.dial.includes(countrySearch)
  )

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setUserId(user.id)

      const { data: profile } = await supabase
        .from('users').select('tenant_id').eq('supabase_uid', user.id).single()
      if (!profile) {
        await supabase.auth.signOut()
        router.push('/login?error=no_account')
        return
      }

      setTenantId(profile.tenant_id)

      const { data: tenant } = await supabase
        .from('tenants')
        .select('country, timezone, compliance_frameworks, onboarding_complete, intended_package_slug')
        .eq('id', profile.tenant_id)
        .single()

      if (tenant) {
        if (tenant.onboarding_complete) { router.push('/dashboard'); return }
        if (tenant.country)              setCountry(tenant.country)
        if (tenant.timezone)             setTimezone(tenant.timezone)
        if (tenant.compliance_frameworks?.length) setFrameworks(tenant.compliance_frameworks)
        setIntendedPackageSlug((tenant as any).intended_package_slug ?? null)
      }

      setLoadingProfile(false)
    })
  }, [router])

  // Step 1 — save country + mobile, advance
  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    if (!tenantId || !userId) return
    setLoading(true); setError('')
    const supabase = createClient()

    const fullPhone = mobileNumber.trim() ? `${dialCode} ${mobileNumber.trim()}` : null
    const billing_region = getBillingRegion(country)

    const [tenantRes] = await Promise.all([
      supabase.from('tenants').update({ country, timezone, billing_region }).eq('id', tenantId),
      fullPhone
        ? supabase.from('users').update({ phone: fullPhone } as any).eq('id', userId)
        : Promise.resolve({ error: null }),
    ])

    if (tenantRes.error) { setError(tenantRes.error.message); setLoading(false); return }

    if (intendedPackageSlug) {
      router.push('/onboarding/payment')
      return
    }

    setStep(2); setLoading(false)
  }

  // Step 2 — save targets (skip if empty)
  async function handleStep2(e: React.FormEvent) {
    e.preventDefault()
    if (!tenantId) return
    setLoading(true); setError('')
    const supabase = createClient()

    const rows = targets
      .filter(t => t.name.trim() && t.url.trim())
      .map(t => ({ tenant_id: tenantId, name: t.name, target_url: t.url, target_type: t.type, active: true }))

    if (rows.length > 0) {
      const { error } = await supabase.from('attack_surfaces').insert(rows)
      if (error) { setError(error.message); setLoading(false); return }
    }

    setStep(3); setLoading(false)
  }

  // Step 3 — save compliance frameworks (skip if none selected)
  async function handleStep3(skip = false) {
    if (!tenantId) return
    setLoading(true)
    const supabase = createClient()
    if (!skip && frameworks.length > 0) {
      await supabase.from('tenants').update({ compliance_frameworks: frameworks }).eq('id', tenantId)
    }
    setStep(4); setLoading(false)
  }

  // Step 4 — invite admin (optional) then finish
  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Failed to send invite'); setLoading(false); return }
    setInviteSent(true); setLoading(false)
  }

  async function handleFinish() {
    if (!tenantId) return
    setLoading(true)
    const supabase = createClient()
    await supabase.from('tenants').update({ onboarding_complete: true }).eq('id', tenantId)
    router.push('/dashboard')
  }

  function toggleFramework(id: string) {
    setFrameworks(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id])
  }

  function addTarget() {
    setTargets(prev => [...prev, { name: '', url: '', type: 'webapp' }])
  }

  function updateTarget(i: number, field: string, value: string) {
    setTargets(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t))
  }

  if (loadingProfile) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0e1a' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 32, height: 32, border: '2px solid #42a5f5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: '#94a3b8', fontSize: 13 }}>Loading your workspace…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">

        {/* Step progress bars */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
          {([1, 2, 3, 4] as Step[]).map(s => (
            <div key={s} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: step >= s ? 'linear-gradient(90deg,#1976d2,#42a5f5)' : 'rgba(255,255,255,0.08)',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {/* ── Step 1: Country + Mobile ── */}
        {step === 1 && (
          <>
            <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 4, letterSpacing: '0.05em' }}>
              WHERE ARE YOU BASED?
            </h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>
              Your location sets your regulatory context and enables SMS verification.
            </p>

            <form onSubmit={handleStep1}>
              <div style={{ marginBottom: 16, position: 'relative' }} ref={countryRef}>
                <label className="form-label">Country *</label>
                <button
                  type="button"
                  onClick={() => { setCountryOpen(o => !o); setCountrySearch('') }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    color: selectedCountry ? '#e2e8f0' : '#475569', fontSize: 14,
                  }}
                >
                  <span>{selectedCountry ? `${selectedCountry.flag}  ${selectedCountry.name}` : 'Select your country'}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5, flexShrink: 0, transform: countryOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>

                {countryOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4,
                    background: '#0d1428', border: '1px solid rgba(25,118,210,0.3)', borderRadius: 8,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden',
                  }}>
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search country or dial code…"
                        value={countrySearch}
                        onChange={e => setCountrySearch(e.target.value)}
                        style={{
                          width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 6, padding: '7px 10px', color: '#e2e8f0', fontSize: 13, outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                      {filteredCountries.length === 0 && (
                        <div style={{ padding: '12px 14px', color: '#475569', fontSize: 13 }}>No results</div>
                      )}
                      {filteredCountries.map(c => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => { setCountry(c.code); setCountryOpen(false); setCountrySearch('') }}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                            padding: '9px 14px', background: c.code === country ? 'rgba(25,118,210,0.15)' : 'transparent',
                            border: 'none', cursor: 'pointer', color: '#e2e8f0', fontSize: 14, textAlign: 'left',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                          onMouseLeave={e => (e.currentTarget.style.background = c.code === country ? 'rgba(25,118,210,0.15)' : 'transparent')}
                        >
                          <span style={{ fontSize: 18, lineHeight: 1 }}>{c.flag}</span>
                          <span style={{ flex: 1 }}>{c.name}</span>
                          <span style={{ color: '#475569', fontSize: 12, fontFamily: 'monospace' }}>{c.dial}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 16, position: 'relative' }} ref={tzRef}>
                <label className="form-label">Timezone *</label>
                <button
                  type="button"
                  onClick={() => { setTzOpen(o => !o); setTzSearch('') }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#e2e8f0', fontSize: 14,
                  }}
                >
                  <span>{TIMEZONES.find(t => t.iana === timezone)?.label ?? timezone}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.5, flexShrink: 0, transform: tzOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>
                {tzOpen && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4,
                    background: '#0d1428', border: '1px solid rgba(25,118,210,0.3)', borderRadius: 8,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden',
                  }}>
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <input
                        autoFocus
                        type="text"
                        placeholder="Search timezone…"
                        value={tzSearch}
                        onChange={e => setTzSearch(e.target.value)}
                        style={{
                          width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 6, padding: '7px 10px', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                    </div>
                    <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                      {TZ_REGIONS.map(region => {
                        const items = TIMEZONES.filter(t => t.region === region && (
                          !tzSearch || t.label.toLowerCase().includes(tzSearch.toLowerCase()) || t.iana.toLowerCase().includes(tzSearch.toLowerCase())
                        ))
                        if (items.length === 0) return null
                        return (
                          <div key={region}>
                            <div style={{ padding: '6px 14px 2px', fontSize: 10, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{region}</div>
                            {items.map(t => (
                              <button
                                key={t.iana}
                                type="button"
                                onClick={() => { setTimezone(t.iana); setTzOpen(false); setTzSearch('') }}
                                style={{
                                  width: '100%', display: 'flex', alignItems: 'center',
                                  padding: '9px 14px', background: t.iana === timezone ? 'rgba(25,118,210,0.15)' : 'transparent',
                                  border: 'none', cursor: 'pointer', color: '#e2e8f0', fontSize: 14, textAlign: 'left',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                                onMouseLeave={e => (e.currentTarget.style.background = t.iana === timezone ? 'rgba(25,118,210,0.15)' : 'transparent')}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 24 }}>
                <label className="form-label">Mobile number * <span style={{ color: '#475569', fontWeight: 400 }}>(used for 2FA &amp; alerts)</span></label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, padding: '0 12px', minWidth: 80, whiteSpace: 'nowrap',
                    color: dialCode ? '#94a3b8' : '#334155', fontSize: 14,
                  }}>
                    {selectedCountry ? `${selectedCountry.flag} ${dialCode}` : '—'}
                  </div>
                  <input
                    className="form-input"
                    style={{ flex: 1 }}
                    type="tel"
                    placeholder="30 000 0000"
                    value={mobileNumber}
                    onChange={e => setMobileNumber(e.target.value)}
                    required
                    disabled={!country}
                  />
                </div>
                {country && (
                  <p style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>
                    Full number: {dialCode} {mobileNumber || '—'}
                  </p>
                )}
              </div>

              {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 16 }}>{error}</p>}
              <button type="submit" className="btn-p" style={{ width: '100%' }} disabled={loading || !tenantId}>
                {loading ? 'Saving…' : 'Continue →'}
              </button>
            </form>
          </>
        )}

        {/* ── Step 2: Target URLs ── */}
        {step === 2 && (
          <>
            <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 6, letterSpacing: '0.05em' }}>
              ADD TARGET URLS
            </h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>The systems you want Breachr to test. You can add more later.</p>

            <form onSubmit={handleStep2}>
              {targets.map((t, i) => (
                <div key={i} style={{ marginBottom: 16, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div>
                      <label className="form-label">Name</label>
                      <input className="form-input" value={t.name} onChange={e => updateTarget(i, 'name', e.target.value)} placeholder="Main API" />
                    </div>
                    <div>
                      <label className="form-label">Type</label>
                      <select className="form-input" value={t.type} onChange={e => updateTarget(i, 'type', e.target.value)}>
                        <option value="webapp">Web App</option>
                        <option value="api">API</option>
                        <option value="mobile">Mobile</option>
                        <option value="network">Network</option>
                      </select>
                    </div>
                  </div>
                  <label className="form-label">URL</label>
                  <input
                    className="form-input"
                    value={t.url}
                    onChange={e => updateTarget(i, 'url', e.target.value)}
                    onBlur={e => {
                      const v = e.target.value.trim()
                      if (v && !v.startsWith('http')) updateTarget(i, 'url', 'https://' + v)
                    }}
                    placeholder="app.yourcompany.com"
                    type="text"
                  />
                </div>
              ))}

              <button type="button" onClick={addTarget} className="btn-s" style={{ width: '100%', marginBottom: 16, fontSize: 13 }}>
                + Add Another Target
              </button>

              {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 16 }}>{error}</p>}
              <button type="submit" className="btn-p" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Saving…' : 'Continue →'}
              </button>
              <button type="button" onClick={() => setStep(3)} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: '#475569', fontSize: 13, cursor: 'pointer', padding: '6px 0' }}>
                Skip for now
              </button>
            </form>
          </>
        )}

        {/* ── Step 3: Compliance Frameworks ── */}
        {step === 3 && (
          <>
            <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 4, letterSpacing: '0.05em' }}>
              COMPLIANCE OBLIGATIONS
            </h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>
              Select every framework that applies. This configures your compliance reports and scan coverage.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {FRAMEWORKS.map(fw => {
                const selected = frameworks.includes(fw.id)
                return (
                  <button
                    key={fw.id}
                    type="button"
                    onClick={() => toggleFramework(fw.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                      padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                      background: selected ? `rgba(${fw.color === '#3b82f6' ? '59,130,246' : fw.color === '#8b5cf6' ? '139,92,246' : fw.color === '#10b981' ? '16,185,129' : fw.color === '#f59e0b' ? '245,158,11' : fw.color === '#ec4899' ? '236,72,153' : '100,116,139'},0.1)` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${selected ? fw.color + '60' : 'rgba(255,255,255,0.07)'}`,
                      transition: 'all 0.15s',
                      width: '100%',
                    }}
                  >
                    <div style={{
                      width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                      border: `2px solid ${selected ? fw.color : 'rgba(255,255,255,0.2)'}`,
                      background: selected ? fw.color : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {selected && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: selected ? '#e2e8f0' : '#94a3b8' }}>{fw.label}</span>
                        <span style={{ fontSize: 10, color: fw.color, background: fw.color + '20', padding: '1px 6px', borderRadius: 3, fontWeight: 600 }}>{fw.badge}</span>
                      </div>
                      <span style={{ fontSize: 11, color: '#475569' }}>{fw.desc}</span>
                    </div>
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => handleStep3(false)}
              className="btn-p"
              style={{ width: '100%' }}
              disabled={loading}
            >
              {loading ? 'Saving…' : frameworks.length > 0 ? `Save ${frameworks.length} framework${frameworks.length > 1 ? 's' : ''} →` : 'Continue →'}
            </button>
            <button type="button" onClick={() => handleStep3(true)} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: '#475569', fontSize: 13, cursor: 'pointer', padding: '6px 0' }}>
              Skip for now
            </button>
          </>
        )}

        {/* ── Step 4: Invite Admin ── */}
        {step === 4 && (
          <>
            <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 4, letterSpacing: '0.05em' }}>
              INVITE YOUR SECURITY OFFICER
            </h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>
              Add your Admin — they can run scans, manage findings, and generate reports. You control what they can access.
            </p>

            {inviteSent ? (
              <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#1976d2,#42a5f5)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                </div>
                <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 24 }}>
                  Invite sent to <strong style={{ color: '#42a5f5' }}>{inviteEmail}</strong>
                </p>
                <button onClick={handleFinish} className="btn-p pulse" style={{ width: '100%' }} disabled={loading}>
                  {loading ? 'Setting up…' : 'Go to Dashboard →'}
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={handleInvite}>
                  <div style={{ marginBottom: 16 }}>
                    <label className="form-label">Admin email address</label>
                    <input
                      className="form-input"
                      type="email"
                      placeholder="security@yourcompany.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      required
                    />
                  </div>
                  {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 16 }}>{error}</p>}
                  <button type="submit" className="btn-p" style={{ width: '100%' }} disabled={loading || !inviteEmail}>
                    {loading ? 'Sending…' : 'Send Invite →'}
                  </button>
                </form>
                <button type="button" onClick={handleFinish} style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: '#475569', fontSize: 13, cursor: 'pointer', padding: '6px 0' }} disabled={loading}>
                  {loading ? 'Setting up…' : "I'll do this later"}
                </button>
              </>
            )}
          </>
        )}

      </div>
    </div>
  )
}
