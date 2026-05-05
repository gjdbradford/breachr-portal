'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

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
}

export default function ProfileTab({
  tenant,
  user,
  tenantId,
}: {
  tenant: TenantProfile
  user: UserProfile
  tenantId: string
}) {
  const [name, setName]               = useState(tenant.name ?? '')
  const [industry, setIndustry]       = useState(tenant.industry ?? '')
  const [companySize, setCompanySize] = useState(tenant.company_size ?? '')
  const [country, setCountry]         = useState(tenant.country ?? '')
  const [saving, setSaving]           = useState(false)
  const [saveMsg, setSaveMsg]         = useState('')
  const [resetting, setResetting]     = useState(false)
  const [resetMsg, setResetMsg]       = useState('')
  const [passwordUpdated, setPasswordUpdated] = useState(false)

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
    const { error } = await supabase
      .from('tenants')
      .update({ name, industry, company_size: companySize, country: country || null })
      .eq('id', tenantId)
    setSaving(false)
    if (error) {
      setSaveMsg(`Error: ${error.message}`)
    } else {
      setSaveMsg('Changes saved')
      setTimeout(() => setSaveMsg(''), 3000)
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
            <input className="form-input" value={country} onChange={e => setCountry(e.target.value)} placeholder="United Kingdom" />
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

      <div className="gs au1" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 20, letterSpacing: '0.04em' }}>PERSONAL</h2>
        <div style={{ marginBottom: 16 }}>
          <label className="form-label">Email</label>
          <div style={{ padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, fontSize: 13, color: '#64748b' }}>
            {user.email}
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label className="form-label">Role</label>
          <div>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', padding: '3px 10px', borderRadius: 4, background: 'rgba(66,165,245,0.1)', color: '#42a5f5', border: '1px solid rgba(66,165,245,0.2)' }}>
              {(user.role ?? 'admin').toUpperCase()}
            </span>
          </div>
        </div>
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
