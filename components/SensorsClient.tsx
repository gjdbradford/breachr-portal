'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useRegisterHelpContent } from '@/lib/help-panel-context'
import SensorRegistrationModal from './SensorRegistrationModal'
import SensorEmptyState from './SensorEmptyState'
import { DEPLOYMENT_TYPES, VALID_DEPLOYMENT_TYPE_IDS } from '@/lib/sensor-types'
import type { DeploymentType } from '@/lib/sensor-types'
import { formatFriendly } from '@/lib/format-date'

interface Sensor {
  id: string
  name: string
  location: string | null
  last_seen: string | null
  status: string
  deployment_type: DeploymentType
}

interface Props {
  sensors: Sensor[]
  assetCountMap: Record<string, number>
  timezone?: string
}

export default function SensorsClient({ sensors, assetCountMap, timezone = 'UTC' }: Props) {
  const [showModal, setShowModal]       = useState(false)
  const [selectedType, setSelectedType] = useState<DeploymentType>(() => {
    const t = sensors[0]?.deployment_type
    return VALID_DEPLOYMENT_TYPE_IDS.includes(t as DeploymentType) ? t as DeploymentType : 'docker'
  })
  const router       = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowModal(true)
      router.replace('/dashboard/sensors', { scroll: false })
    }
  }, [searchParams, router])

  useRegisterHelpContent({
    title: 'Sensor Assistant',
    defaultTab: 'chat',
    chatContextKey: 'sensors',
    guides: [
      { title: 'Deploy a Docker sensor', description: 'Linux host with --network host' },
      { title: 'Deploy on Raspberry Pi', description: '64-bit OS, Docker arm64' },
      { title: 'Deploy on Synology NAS', description: 'Container Manager, host network' },
      { title: 'Deploy with systemd', description: 'Native Linux, auto-restart on boot' },
      { title: 'Sensor offline checklist', description: 'Connectivity, firewall, service status' },
    ],
  })

  function isActive(sensor: Sensor) {
    if (!sensor.last_seen) return false
    return new Date(sensor.last_seen) > new Date(Date.now() - 5 * 60 * 1000)
  }

  function handleModalClose() {
    setShowModal(false)
    router.refresh()
  }

  if (sensors.length === 0) {
    return (
      <>
        {showModal && (
          <SensorRegistrationModal
            onClose={handleModalClose}
            initialDeploymentType={selectedType}
          />
        )}
        <SensorEmptyState
          onAddSensor={(type) => { setSelectedType(type); setShowModal(true) }}
          selectedType={selectedType}
          onTypeSelect={setSelectedType}
        />
      </>
    )
  }

  return (
    <>
      {showModal && (
        <SensorRegistrationModal
          onClose={handleModalClose}
          initialDeploymentType={selectedType}
        />
      )}

      <div style={{ padding: '0 24px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={() => setShowModal(true)} className="btn-p" style={{ fontSize: 13, padding: '8px 20px' }}>
          + Add sensor
        </button>
      </div>

      <div className="gs au1" style={{ padding: 24 }}>
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Location</th><th>Status</th><th>Assets</th><th>Last seen</th><th></th></tr>
          </thead>
          <tbody>
            {sensors.map(s => (
              <tr key={s.id}>
                <td style={{ fontSize: 13, color: '#e2e8f0' }}>{s.name}</td>
                <td style={{ fontSize: 12, color: '#64748b' }}>{s.location ?? '—'}</td>
                <td>
                  {s.status === 'disabled' ? (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                      Disabled
                    </span>
                  ) : (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                      background: isActive(s) ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)',
                      color: isActive(s) ? '#22c55e' : '#64748b',
                      border: `1px solid ${isActive(s) ? 'rgba(34,197,94,0.2)' : 'rgba(100,116,139,0.2)'}`,
                    }}>
                      {isActive(s) ? 'Active' : 'Offline'}
                    </span>
                  )}
                </td>
                <td style={{ fontSize: 12, color: '#64748b' }}>{assetCountMap[s.id] ?? 0}</td>
                <td style={{ fontSize: 12, color: '#64748b' }}>
                  {s.last_seen ? formatFriendly(s.last_seen, timezone) : 'Never'}
                </td>
                <td>
                  <Link href={`/dashboard/sensors/${s.id}`} className="btn-s" style={{ fontSize: 12, padding: '4px 12px' }}>
                    View sensor
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </>
  )
}
