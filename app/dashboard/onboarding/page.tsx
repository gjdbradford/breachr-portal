'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Step = 1 | 2 | 3 | 4

const ALL_FRAMEWORKS = ['DORA', 'NIS2', 'PCI-DSS', 'HIPAA', 'ISO27001', 'SOC2'] as const
type Framework = typeof ALL_FRAMEWORKS[number]

const FRAMEWORK_LABELS: Record<Framework, { name: string; description: string }> = {
  'DORA':     { name: 'DORA',     description: 'EU Digital Operational Resilience Act — mandatory for financial entities operating in the EU.' },
  'NIS2':     { name: 'NIS2',     description: 'EU Network & Information Security Directive — applies to essential and important sector entities.' },
  'PCI-DSS':  { name: 'PCI-DSS',  description: 'Payment Card Industry Data Security Standard — required if you process, store or transmit card data.' },
  'HIPAA':    { name: 'HIPAA',    description: 'Health Insurance Portability & Accountability Act — applies to health data handlers in the US and globally.' },
  'ISO27001': { name: 'ISO 27001', description: 'International standard for information security management — globally recognised certification.' },
  'SOC2':     { name: 'SOC 2',    description: 'Service Organisation Control 2 — trust services criteria for SaaS and cloud service providers.' },
}

const INDUSTRY_FRAMEWORKS: Record<string, Framework[]> = {
  banking:    ['DORA', 'NIS2', 'PCI-DSS'],
  insurance:  ['DORA', 'NIS2', 'ISO27001'],
  payments:   ['DORA', 'NIS2', 'PCI-DSS'],
  healthtech: ['NIS2', 'HIPAA', 'ISO27001'],
  energy:     ['NIS2', 'ISO27001'],
  other:      ['SOC2'],
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Step 1: company details
  const [companyName, setCompanyName] = useState('')
  const [industry, setIndustry] = useState('')
  const [companySize, setCompanySize] = useState('')

  // Step 2: target URLs
  const [targets, setTargets] = useState([{ name: '', url: '', type: 'webapp' }])

  // Step 3: compliance frameworks
  const [selectedFrameworks, setSelectedFrameworks] = useState<Framework[]>([])

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('users').select('tenant_id').eq('supabase_uid', user.id).single()
    if (!profile) { setError('Profile not found'); setLoading(false); return }

    const { error } = await supabase
      .from('tenants')
      .update({ name: companyName, industry, company_size: companySize })
      .eq('id', profile.tenant_id)

    if (error) { setError(error.message); setLoading(false); return }
    setStep(2)
    setLoading(false)
  }

  async function handleStep2(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('users').select('tenant_id').eq('supabase_uid', user.id).single()
    if (!profile) { setError('Profile not found'); setLoading(false); return }

    const rows = targets
      .filter(t => t.name.trim() && t.url.trim())
      .map(t => ({ tenant_id: profile.tenant_id, name: t.name, target_url: t.url, target_type: t.type, active: true }))

    if (rows.length === 0) { setError('Add at least one target URL'); setLoading(false); return }

    const { error } = await supabase.from('attack_surfaces').insert(rows)
    if (error) { setError(error.message); setLoading(false); return }
    setSelectedFrameworks(INDUSTRY_FRAMEWORKS[industry] ?? [])
    setStep(3)
    setLoading(false)
  }

  async function handleStep3(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('users').select('tenant_id').eq('supabase_uid', user.id).single()
    if (!profile) { setError('Profile not found'); setLoading(false); return }

    const { error } = await supabase
      .from('tenants')
      .update({ compliance_frameworks: selectedFrameworks })
      .eq('id', profile.tenant_id)

    if (error) { setError(error.message); setLoading(false); return }
    setStep(4)
    setLoading(false)
  }

  function toggleFramework(fw: Framework) {
    setSelectedFrameworks(prev =>
      prev.includes(fw) ? prev.filter(f => f !== fw) : [...prev, fw]
    )
  }

  async function handleFinish() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: profile } = await supabase.from('users').select('tenant_id').eq('supabase_uid', user.id).single()
    if (profile) {
      await supabase.from('tenants').update({ onboarding_complete: true }).eq('id', profile.tenant_id)
    }
    router.push('/dashboard')
  }

  function addTarget() {
    setTargets(prev => [...prev, { name: '', url: '', type: 'webapp' }])
  }

  function updateTarget(i: number, field: string, value: string) {
    setTargets(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t))
  }

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        {/* Steps indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
          {([1, 2, 3, 4] as Step[]).map(s => (
            <div key={s} className={`onboarding-step-dot${step >= s ? ' active' : ''}`} />
          ))}
        </div>

        {step === 1 && (
          <>
            <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 6, letterSpacing: '0.05em' }}>
              CONFIRM YOUR COMPANY
            </h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>This sets up your tenant workspace.</p>

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
              <button type="submit" className="btn-p" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Saving…' : 'Continue →'}
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
            <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginBottom: 6, letterSpacing: '0.05em' }}>
              SELECT COMPLIANCE FRAMEWORKS
            </h2>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>
              We&apos;ve recommended frameworks based on your industry. Adjust as needed.
            </p>

            <form onSubmit={handleStep3}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                {ALL_FRAMEWORKS.map(fw => {
                  const selected = selectedFrameworks.includes(fw)
                  return (
                    <button
                      key={fw}
                      type="button"
                      onClick={() => toggleFramework(fw)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16,
                        background: selected ? 'rgba(25,118,210,0.1)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${selected ? 'rgba(25,118,210,0.5)' : 'rgba(255,255,255,0.06)'}`,
                        borderRadius: 8, cursor: 'pointer', textAlign: 'left', width: '100%',
                      }}
                    >
                      <div style={{
                        width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 2,
                        background: selected ? '#1976d2' : 'transparent',
                        border: `2px solid ${selected ? '#1976d2' : '#475569'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {selected && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{FRAMEWORK_LABELS[fw].name}</p>
                        <p style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>{FRAMEWORK_LABELS[fw].description}</p>
                      </div>
                    </button>
                  )
                })}
              </div>

              {error && <p style={{ color: '#ef4444', fontSize: 12, marginBottom: 16 }}>{error}</p>}
              <button type="submit" className="btn-p" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Saving…' : 'Continue →'}
              </button>
            </form>
          </>
        )}

        {step === 4 && (
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
