// components/dashboard/FrameworkAccordion.tsx
import Link from 'next/link'
import type { FrameworkScore } from '@/lib/frameworks'
import { FRAMEWORKS } from '@/lib/frameworks'
import FrameworkRow from './FrameworkRow'

interface FrameworkAccordionProps {
  activeFrameworks: string[]   // e.g. ['DORA','PCI-DSS']
  scores: FrameworkScore[]
}

export default function FrameworkAccordion({ activeFrameworks, scores }: FrameworkAccordionProps) {
  const scoreMap = Object.fromEntries(scores.map(s => [s.id, s]))

  if (activeFrameworks.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 10 }}>No compliance frameworks configured.</p>
        <Link href="/dashboard/settings?tab=compliance" style={{ fontSize: 12, color: '#42a5f5' }}>Configure frameworks →</Link>
      </div>
    )
  }

  const activeDefinitions = FRAMEWORKS.filter(f => activeFrameworks.includes(f.id))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Compliance Frameworks</p>
          <p style={{ fontSize: 10, color: '#475569', marginTop: 1 }}>
            Expand a framework to see article-level detail ·{' '}
            <Link href="/dashboard/settings?tab=compliance" style={{ color: '#42a5f5', textDecoration: 'none' }}>Manage →</Link>
          </p>
        </div>
        <span style={{ fontSize: 10, color: '#64748b' }}>Based on scan history</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {activeDefinitions.map((fw) => {
          const score = scoreMap[fw.id]
          if (!score) return null
          return <FrameworkRow key={fw.id} score={score} frameworkName={fw.name} />
        })}
      </div>
    </div>
  )
}
