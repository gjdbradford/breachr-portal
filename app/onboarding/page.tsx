'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Step = 1 | 2 | 3

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [error, setError] = useState('')
  const [tenantId, setTenantId] = useState<string | null>(null)

  // Step 1: company details (pre-populated from registration)
  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry] = useState('')
  const [companySize, setCompanySize] = useState('')

  // Step 2: target URLs
  const [targets, setTargets] = useState([{ name: '', url: '', type: 'webapp' }])

  // Load existing profile + tenant data on mount to pre-populate form
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single()

      if (!profile) {
        setLoadingProfile(false)
        setError('Could not load profile — check RLS policies in Supabase (run supabase-migration.sql)')
        return
      }

      setTenantId(profile.tenant_id)

      const { data: tenant } = await supabase
        .from('tenants')
        .select('name, industry, company_size, onboarding_complete')
        .eq('id', profile.tenant_id)
        .single()

      if (tenant) {
        if (tenant.name)         setCompanyName(tenant.name)
        if (tenant.industry)     setIndustry(tenant.industry)
        if (tenant.company_size) setCompanySize(tenant.company_size)
        if (tenant.onboarding_complete) {
          router.push('/dashboard')
          return
        }
      }

      setLoadingProfile(false)
    })
  }, [router])

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    if (!tenantId) { setError('Profile not loaded — please refresh'); return }
    setLoading(true)
    setError('')
    const supabase = createClient()

    const { error } = await supabase
      .from('tenants')
      .update({ name: companyName, industry, company_size: companySize })
      .eq('id', tenantId)

    if (error) { setError(error.message); setLoading(false); return }
    setStep(2)
    setLoading(false)
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault()
    if (!tenantId) { setError('Profile not loaded — please refresh'); return }
    setLoading(true)
    setError('')
    const supabase = createClient()

    const rows = targets
      .filter(t => t.name.trim() && t.url.trim())
      .map(t => ({ tenant_id: tenantId, name: t.name, target_url: t.url, target_type: t.type, active: true }))

    if (rows.length === 0) { setError('Add at least one target URL'); setLoading(false); return }

    const { error } = await supabase.from('attack_surfaces').insert(rows)
    if (error) { setError(error.message); setLoading(false); return }
    setStep(3)
    setLoading(false)
  }

  async function handleFinish() {
    if (!tenantId) return
    setLoading(true)
    const supabase = createClient()
    await supabase.from('tenants').update({ onboarding_complete: true }).eq('id', tenantId)
    router.push('/dashboard')
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
        {/* Steps indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
          {([1, 2, 3] as Step[]).map(s => (
            <div key={s} className={`onboarding-step-dot${step >= s ? ' active' : ''}`} />
          ))}
        </div>

        {step === 1 && (
          <>
            <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 4, letterSpacing: '0.05em' }}>
              CONFIRM YOUR COMPANY
            </h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>We pre-filled this from your registration — just confirm or update.</p>

            <form onSubmit={handleStep1}>
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Company Name</label>
                <input className="form-input" value={companyName} onChange={e => setCompanyName(e.target.value)} required placeholder="Acme Financial" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Industry</label>
                <select className="form-input" value={industry} onChange={e => setIndustry(e.target.value)} required>
                  <option value="">Select industry</option>
                  <option value="banking">Banking</option>
                  <option value="insurance">Insurance</option>
                  <option value="healthtech">HealthTech</option>
                  <option value="payments">Payments</option>
                  <option value="energy">Energy</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div style={{ marginBottom: 24 }}>
                <label className="form-label">Company Size</label>
                <select className="form-input" value={companySize} onChange={e => setCompanySize(e.target.value)} required>
                  <option value="">Select size</option>
                  <option value="1-10">1–10</option>
                  <option value="11-50">11–50</option>
                  <option value="51-200">51–200</option>
                  <option value="201-1000">201–1,000</option>
                  <option value="1000+">1,000+</option>
                </select>
              </div>
              {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 16 }}>{error}</p>}
              <button type="submit" className="btn-p" style={{ width: '100%' }} disabled={loading || !tenantId}>
                {loading ? 'Saving…' : 'Confirm & Continue →'}
              </button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 6, letterSpacing: '0.05em' }}>
              ADD TARGET URLS
            </h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>The systems you want Breachr to test.</p>

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
                  <input className="form-input" value={t.url} onChange={e => updateTarget(i, 'url', e.target.value)} placeholder="https://app.yourcompany.com" type="url" />
                </div>
              ))}

              <button type="button" onClick={addTarget} className="btn-s" style={{ width: '100%', marginBottom: 16, fontSize: 13 }}>
                + Add Another Target
              </button>

              {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 16 }}>{error}</p>}
              <button type="submit" className="btn-p" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Saving…' : 'Continue →'}
              </button>
            </form>
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg,#1976d2,#42a5f5)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
              <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 8, letterSpacing: '0.05em' }}>
                YOU&apos;RE ALL SET
              </h2>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 32, maxWidth: 280, margin: '0 auto 32px' }}>
                Your workspace is ready. Launch your first scan from the dashboard.
              </p>
              <button onClick={handleFinish} className="btn-p pulse" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Setting up…' : 'Go to Dashboard →'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
