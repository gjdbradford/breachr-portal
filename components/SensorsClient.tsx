'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import SensorRegistrationModal from './SensorRegistrationModal'
import SensorEmptyState from './SensorEmptyState'
import SensorTroubleshooting from './SensorTroubleshooting'
import SensorHelpChat from './SensorHelpChat'
import type { DeploymentType } from '@/lib/sensor-types'

interface Sensor {
  id: string
  name: string
  location: string | null
  last_seen: string | null
  status: string
  deployment_type: string
}

interface Props {
  sensors: Sensor[]
  assetCountMap: Record<string, number>
}

export default function SensorsClient({ sensors, assetCountMap }: Props) {
  const [showModal, setShowModal]       = useState(false)
  const [selectedType, setSelectedType] = useState<DeploymentType>('docker')
  const router = useRouter()

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
        <div id="sensor-troubleshooting">
          <SensorTroubleshooting selectedType={selectedType} />
        </div>
        <SensorHelpChat deploymentType={selectedType} />
      </>
    )
  }

  const firstSensor = sensors[0]

  return (
    <>
      {showModal && (
        <SensorRegistrationModal
          onClose={handleModalClose}
          initialDeploymentType={selectedType}
        />
      )}

      <div style={{ padding: '0 24px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowModal(true)} className="btn-p" style={{ fontSize: 13, padding: '8px 20px' }}>
          + Add sensor
        </button>
      </div>

      <div className="gs au1" style={{ padding: 24 }}>
        <table className="data-table">
          <thead>
            <tr><th>Name</th><th>Location</th><th>Status</th><th>Assets</th><th>Last seen</th></tr>
          </thead>
          <tbody>
            {sensors.map(s => (
              <tr key={s.id}>
                <td style={{ fontSize: 13, color: '#e2e8f0' }}>{s.name}</td>
                <td style={{ fontSize: 12, color: '#64748b' }}>{s.location ?? '—'}</td>
                <td>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                    background: isActive(s) ? 'rgba(34,197,94,0.1)' : 'rgba(100,116,139,0.1)',
                    color: isActive(s) ? '#22c55e' : '#64748b',
                    border: `1px solid ${isActive(s) ? 'rgba(34,197,94,0.2)' : 'rgba(100,116,139,0.2)'}`,
                  }}>
                    {isActive(s) ? 'Active' : 'Offline'}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: '#64748b' }}>{assetCountMap[s.id] ?? 0}</td>
                <td style={{ fontSize: 12, color: '#64748b' }}>
                  {s.last_seen ? new Date(s.last_seen).toLocaleString('en-GB') : 'Never'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div id="sensor-troubleshooting">
        <SensorTroubleshooting selectedType={selectedType} />
      </div>
      <SensorHelpChat
        deploymentType={selectedType}
        sensor={{
          id: firstSensor.id,
          status: firstSensor.status,
          last_seen: firstSensor.last_seen,
          deployment_type: firstSensor.deployment_type,
        }}
      />
    </>
  )
}
