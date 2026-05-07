'use client'

import { useState } from 'react'

type DeploymentType = 'docker' | 'raspberry_pi' | 'synology' | 'native'

interface Props {
  onClose: () => void
}

const DEPLOYMENT_TYPES: { id: DeploymentType; label: string; sub: string; icon: string }[] = [
  { id: 'docker',       label: 'Docker — Linux',    sub: 'Ubuntu, Debian, CentOS, any Linux host',    icon: '🐋' },
  { id: 'raspberry_pi', label: 'Raspberry Pi',       sub: 'Pi 3, 4, 5 — dedicated always-on sensor',  icon: '🫐' },
  { id: 'synology',     label: 'Synology NAS',       sub: 'Container Manager (DSM 7+)',                icon: '💾' },
  { id: 'native',       label: 'Native Linux',       sub: 'systemd service, no Docker required',      icon: '⚙️' },
]

export default function SensorRegistrationModal({ onClose }: Props) {
  const [name, setName]                     = useState('')
  const [location, setLocation]             = useState('')
  const [deploymentType, setDeploymentType] = useState<DeploymentType>('docker')
  const [loading, setLoading]               = useState(false)
  const [error, setError]                   = useState('')
  const [result, setResult]                 = useState<{ id: string; token: string } | null>(null)

  const apiUrl = typeof window !== 'undefined' ? window.location.origin : ''

  async function handleRegister() {
    if (!name.trim()) { setError('Name is required'); return }
    setLoading(true); setError('')
    const res = await fetch('/api/sensors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:            name.trim(),
        location:        location.trim(),
        deployment_type: deploymentType,
      }),
    })
    setLoading(false)
    if (!res.ok) { setError((await res.json()).error ?? 'Failed'); return }
    setResult(await res.json())
  }

  const dockerCmd = result
    ? `docker run -d --network host \\\n  --restart unless-stopped \\\n  --cap-add=NET_ADMIN --cap-add=NET_RAW \\\n  -e BREACHR_SENSOR_TOKEN=${result.token} \\\n  -e BREACHR_SENSOR_ID=${result.id} \\\n  -e BREACHR_API_URL=${apiUrl} \\\n  ghcr.io/gjdbradford/sensor:latest`
    : ''

  const systemdUnit = result
    ? `[Unit]
Description=Breachr Network Sensor
After=network.target

[Service]
Type=simple
User=root
Environment=BREACHR_SENSOR_TOKEN=${result.token}
Environment=BREACHR_SENSOR_ID=${result.id}
Environment=BREACHR_API_URL=${apiUrl}
WorkingDirectory=/opt/breachr-sensor
ExecStart=/usr/bin/python3 main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target`
    : ''

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#0f1629', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
        padding: 32, width: 560, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 }}>Add Sensor</h2>

        {!result ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>Name *</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Office London"
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>Location (optional)</label>
              <input
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="2nd floor server room"
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 6,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 10 }}>Deployment type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {DEPLOYMENT_TYPES.map(dt => (
                  <button
                    key={dt.id}
                    onClick={() => setDeploymentType(dt.id)}
                    style={{
                      textAlign: 'left', padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                      background: deploymentType === dt.id ? 'rgba(66,165,245,0.12)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${deploymentType === dt.id ? 'rgba(66,165,245,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 16, marginBottom: 4 }}>{dt.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: deploymentType === dt.id ? '#42a5f5' : '#cbd5e1', marginBottom: 2 }}>{dt.label}</div>
                    <div style={{ fontSize: 10, color: '#475569', lineHeight: 1.4 }}>{dt.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {error && <p style={{ fontSize: 13, color: '#ef4444', marginBottom: 16 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={handleRegister} disabled={loading} className="btn-p"
                style={{ fontSize: 13, padding: '8px 20px' }}>
                {loading ? 'Registering…' : 'Register sensor'}
              </button>
              <button onClick={onClose} style={{ fontSize: 13, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <SetupInstructions
            deploymentType={deploymentType}
            dockerCmd={dockerCmd}
            systemdUnit={systemdUnit}
            sensorId={result.id}
            token={result.token}
            apiUrl={apiUrl}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  )
}

function SetupInstructions({
  deploymentType, dockerCmd, systemdUnit, sensorId, token, apiUrl, onClose,
}: {
  deploymentType: DeploymentType
  dockerCmd: string
  systemdUnit: string
  sensorId: string
  token: string
  apiUrl: string
  onClose: () => void
}) {
  const [lastCopied, setLastCopied] = useState<string | null>(null)

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text)
    setLastCopied(text)
    setTimeout(() => setLastCopied(null), 2000)
  }

  const tokenWarning = (
    <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16, lineHeight: 1.6 }}>
      Sensor registered.{' '}
      <strong style={{ color: '#ef4444' }}>Copy the token now — it will not be shown again.</strong>
    </p>
  )

  const codeBlock = (text: string) => (
    <div style={{
      background: 'rgba(0,0,0,0.4)', borderRadius: 6, padding: 16, marginBottom: 12,
      fontFamily: 'monospace', fontSize: 11, color: '#94a3b8', whiteSpace: 'pre-wrap',
      border: '1px solid rgba(255,255,255,0.08)', wordBreak: 'break-all',
    }}>
      {text}
    </div>
  )

  const copyBtn = (text: string, label = 'Copy') => (
    <button onClick={() => handleCopy(text)} className="btn-p" style={{ fontSize: 13, padding: '8px 20px' }}>
      {lastCopied === text ? 'Copied!' : label}
    </button>
  )

  const doneBtn = (
    <button onClick={onClose} style={{ fontSize: 13, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>
      Done
    </button>
  )

  if (deploymentType === 'docker' || deploymentType === 'raspberry_pi') {
    return (
      <>
        {tokenWarning}
        {deploymentType === 'raspberry_pi' && (
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12, padding: '8px 12px', background: 'rgba(66,165,245,0.06)', borderRadius: 6, border: '1px solid rgba(66,165,245,0.12)' }}>
            Make sure Docker is installed on your Pi first:{' '}
            <code style={{ fontSize: 11 }}>curl -fsSL https://get.docker.com | sh</code>
          </p>
        )}
        {codeBlock(dockerCmd)}
        <div style={{ display: 'flex', gap: 12 }}>
          {copyBtn(dockerCmd, 'Copy command')}
          {doneBtn}
        </div>
      </>
    )
  }

  if (deploymentType === 'synology') {
    return (
      <>
        {tokenWarning}
        <ol style={{ fontSize: 12, color: '#94a3b8', lineHeight: 2, paddingLeft: 20, marginBottom: 16 }}>
          <li>Open <strong>Container Manager</strong> in DSM</li>
          <li>Go to <strong>Registry</strong> → search <code>ghcr.io/gjdbradford/sensor</code> → Download → latest</li>
          <li>Go to <strong>Container</strong> → Create → select the image</li>
          <li>Under <strong>Environment</strong>, add these three variables:</li>
        </ol>
        {codeBlock(`BREACHR_SENSOR_TOKEN  =  ${token}\nBREACHR_SENSOR_ID     =  ${sensorId}\nBREACHR_API_URL       =  ${apiUrl}`)}
        <ol start={5} style={{ fontSize: 12, color: '#94a3b8', lineHeight: 2, paddingLeft: 20, marginBottom: 16 }}>
          <li>Under <strong>Network</strong> → enable <strong>Use the same network as Docker Host</strong></li>
          <li>Under <strong>Capabilities</strong> → check <strong>NET_ADMIN</strong> and <strong>NET_RAW</strong></li>
          <li>Enable <strong>Auto-restart</strong> → Apply → Run</li>
        </ol>
        <div style={{ display: 'flex', gap: 12 }}>
          {copyBtn(`BREACHR_SENSOR_TOKEN=${token}\nBREACHR_SENSOR_ID=${sensorId}\nBREACHR_API_URL=${apiUrl}`, 'Copy env vars')}
          {doneBtn}
        </div>
      </>
    )
  }

  const installCmds = `# 1. Clone and install
sudo git clone https://github.com/gjdbradford/breachr-sensor /opt/breachr-sensor
cd /opt/breachr-sensor
sudo pip3 install -r requirements.txt

# 2. Save the systemd unit file
sudo nano /etc/systemd/system/breachr-sensor.service
# (paste the unit file content below, then save)

# 3. Enable and start
sudo systemctl daemon-reload
sudo systemctl enable breachr-sensor
sudo systemctl start breachr-sensor
sudo systemctl status breachr-sensor`

  return (
    <>
      {tokenWarning}
      <p style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
        1. Install commands
      </p>
      {codeBlock(installCmds)}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        {copyBtn(installCmds, 'Copy install commands')}
      </div>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
        2. systemd unit file — save to /etc/systemd/system/breachr-sensor.service
      </p>
      {codeBlock(systemdUnit)}
      <div style={{ display: 'flex', gap: 12 }}>
        {copyBtn(systemdUnit, 'Copy unit file')}
        {doneBtn}
      </div>
    </>
  )
}
