'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const ALL_FRAMEWORKS = ['DORA', 'NIS2', 'PCI-DSS', 'HIPAA', 'ISO27001', 'SOC2'] as const
type Framework = typeof ALL_FRAMEWORKS[number]

const FRAMEWORK_LABELS: Record<Framework, { name: string; description: string }> = {
  'DORA':     { name: 'DORA',     description: 'EU Digital Operational Resilience Act — mandatory for financial entities operating in the EU.' },
  'NIS2':     { name: 'NIS2',     description: 'EU Network & Information Security Directive — mandatory for essential sectors including healthcare, finance, energy, and digital infrastructure.' },
  'PCI-DSS':  { name: 'PCI-DSS',  description: 'Payment Card Industry Data Security Standard — required if you process, store or transmit card data.' },
  'HIPAA':    { name: 'HIPAA',    description: 'Health Insurance Portability & Accountability Act — applies to health data handlers in the US and globally.' },
  'ISO27001': { name: 'ISO 27001', description: 'International standard for information security management — globally recognised certification for systematic risk management.' },
  'SOC2':     { name: 'SOC 2',    description: 'Service Organisation Control 2 — trust services criteria for SaaS and cloud service providers.' },
}

export default function ComplianceTab({
  frameworks,
  tenantId,
  lockedReason = null,
}: {
  frameworks: string[]
  tenantId: string
  lockedReason?: 'admin' | 'locked' | null
}) {
  const readOnly = lockedReason !== null

  const [selected, setSelected] = useState<Framework[]>(
    (frameworks ?? []).filter((f): f is Framework => (ALL_FRAMEWORKS as readonly string[]).includes(f))
  )
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  function toggle(fw: Framework) {
    if (readOnly) return
    setSelected(prev => prev.includes(fw) ? prev.filter(f => f !== fw) : [...prev, fw])
  }

  async function handleSave() {
    setSaving(true)
    setSaveMsg('')
    const supabase = createClient()
    const { error, data } = await supabase
      .from('tenants')
      .update({ compliance_frameworks: selected })
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

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="gs au1" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.04em' }}>COMPLIANCE FRAMEWORKS</h2>
          {readOnly && (
            <span style={{ fontSize: 11, color: '#64748b', padding: '3px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              View only
            </span>
          )}
        </div>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
          {readOnly
            ? 'Regulatory frameworks selected for your organisation.'
            : 'Select the regulatory frameworks applicable to your organisation.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {ALL_FRAMEWORKS.map(fw => {
            const isSelected = selected.includes(fw)
            return (
              <button
                key={fw}
                type="button"
                onClick={() => toggle(fw)}
                disabled={readOnly}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16,
                  background: isSelected ? 'rgba(25,118,210,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isSelected ? 'rgba(25,118,210,0.5)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 8, cursor: readOnly ? 'default' : 'pointer',
                  textAlign: 'left', width: '100%',
                  opacity: readOnly && !isSelected ? 0.45 : 1,
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 2,
                  background: isSelected ? '#1976d2' : 'transparent',
                  border: `2px solid ${isSelected ? '#1976d2' : '#475569'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isSelected && (
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

        {!readOnly && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <button onClick={handleSave} className="btn-p" style={{ fontSize: 13, padding: '8px 20px' }} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              {saveMsg && (
                <span style={{ fontSize: 13, color: saveMsg.startsWith('Error') ? '#ef4444' : '#22c55e' }}>{saveMsg}</span>
              )}
            </div>
            <p style={{ fontSize: 12, color: '#475569', fontStyle: 'italic' }}>
              Changes take effect on your next scan. Existing reports are not modified.
            </p>
          </>
        )}

        {lockedReason === 'locked' && (
          <div style={{ padding: '12px 16px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 8, fontSize: 12, color: '#94a3b8' }}>
            Compliance frameworks are locked once set. To make changes, contact{' '}
            <a href="mailto:support@breachr.ai" style={{ color: '#42a5f5' }}>support@breachr.ai</a>.
          </div>
        )}

        {lockedReason === 'admin' && (
          <p style={{ fontSize: 12, color: '#475569' }}>
            Only the account owner can change compliance settings.
          </p>
        )}
      </div>
    </div>
  )
}
