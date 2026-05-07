'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import SensorRegistrationModal from './SensorRegistrationModal'

interface Sensor {
  id: string
  name: string
  location: string | null
  last_seen: string | null
  status: string
}

interface Props {
  sensors: Sensor[]
  assetCountMap: Record<string, number>
}

export default function SensorsClient({ sensors, assetCountMap }: Props) {
  const [showModal, setShowModal] = useState(false)
  const router = useRouter()

  function isActive(sensor: Sensor) {
    if (!sensor.last_seen) return false
    return new Date(sensor.last_seen) > new Date(Date.now() - 5 * 60 * 1000)
  }

  function handleModalClose() {
    setShowModal(false)
    router.refresh()
  }

  return (
    <>
      {showModal && <SensorRegistrationModal onClose={handleModalClose} />}

      <div style={{ padding: '0 24px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowModal(true)} className="btn-p" style={{ fontSize: 13, padding: '8px 20px' }}>
          + Add sensor
        </button>
      </div>

      <div className="gs au1" style={{ padding: 24 }}>
        {sensors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
            <p style={{ fontSize: 15, marginBottom: 8 }}>No sensors yet</p>
            <p style={{ fontSize: 13 }}>Click &quot;Add sensor&quot; to register your first network sensor.</p>
          </div>
        ) : (
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
        )}
      </div>
    </>
  )
}
