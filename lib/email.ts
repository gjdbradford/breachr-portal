import { Resend } from 'resend'

export async function sendNewDeviceAlert({
  to,
  deviceIp,
  deviceMac,
  deviceHostname,
  deviceVendor,
  sensorName,
  assetId,
}: {
  to: string
  deviceIp: string
  deviceMac: string
  deviceHostname?: string | null
  deviceVendor?: string | null
  sensorName?: string | null
  assetId: string
}) {
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  if (!resend) return

  const deviceLabel = deviceHostname ?? deviceIp
  const portalUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://breachr-portal.vercel.app'

  await resend.emails.send({
    from: process.env.RESEND_FROM ?? 'Breachr <onboarding@breachr.ai>',
    to,
    subject: `New device on your network: ${deviceLabel}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0e1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0e1a;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0d1428;border:1px solid rgba(25,118,210,0.2);border-radius:12px;overflow:hidden;max-width:560px;">

        <!-- Header -->
        <tr><td style="padding:24px 32px;border-bottom:1px solid rgba(255,255,255,0.06);">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:32px;height:32px;background:linear-gradient(135deg,#1976d2,#42a5f5);border-radius:8px;text-align:center;vertical-align:middle;">
              <span style="color:#fff;font-size:16px;">⬡</span>
            </td>
            <td style="padding-left:10px;">
              <span style="font-size:14px;font-weight:900;color:#fff;letter-spacing:0.08em;">BREACHR</span>
            </td>
          </tr></table>
        </td></tr>

        <!-- Alert badge -->
        <tr><td style="padding:24px 32px 0;">
          <span style="display:inline-block;padding:3px 10px;border-radius:4px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);color:#ef4444;font-size:10px;font-weight:700;letter-spacing:0.08em;">NEW DEVICE DETECTED</span>
        </td></tr>

        <!-- Title -->
        <tr><td style="padding:16px 32px 8px;">
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#e2e8f0;">
            ${deviceLabel}
          </h1>
          <p style="margin:8px 0 0;font-size:14px;color:#64748b;">
            A device not previously seen has appeared on your network${sensorName ? ` via <strong style="color:#94a3b8">${sensorName}</strong>` : ''}.
          </p>
        </td></tr>

        <!-- Device details -->
        <tr><td style="padding:20px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:8px;overflow:hidden;">
            ${[
              ['IP Address', deviceIp],
              ['MAC Address', deviceMac],
              ['Hostname', deviceHostname ?? 'Unknown'],
              ['Vendor', deviceVendor ?? 'Unknown'],
            ].map(([label, value], i) => `
            <tr style="border-top:${i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none'}">
              <td style="padding:10px 16px;font-size:11px;color:#475569;width:120px;">${label}</td>
              <td style="padding:10px 16px;font-size:12px;color:#94a3b8;font-family:monospace;">${value}</td>
            </tr>`).join('')}
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:0 32px 32px;">
          <a href="${portalUrl}/dashboard/inventory/${assetId}"
            style="display:inline-block;padding:10px 24px;background:linear-gradient(135deg,#1565c0,#1976d2);color:#fff;font-size:13px;font-weight:600;text-decoration:none;border-radius:6px;">
            View device in Inventory →
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:11px;color:#334155;">
            You're receiving this because new device alerts are enabled for your Breachr account.
            <a href="${portalUrl}/dashboard/settings" style="color:#42a5f5;">Manage alert settings</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  }).catch(err => console.error('[email] sendNewDeviceAlert failed:', err))
}

export async function sendExportReadyEmail({
  to,
  dataType,
  format,
  rowCount,
  expiresAt,
  portalUrl,
  requestedAt,
}: {
  to: string
  dataType: string
  format: string
  rowCount: number
  expiresAt: string
  portalUrl: string
  requestedAt: string
}) {
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  if (!resend) return

  const labelMap: Record<string, string> = {
    findings: 'Findings', inventory: 'Inventory', audit_trail: 'Audit Trail',
  }
  const dataTypeLabel = labelMap[dataType] ?? dataType
  const formatLabel   = format === 'xlsx' ? 'Excel (.xlsx)' : 'CSV'
  const expiryDate     = new Date(expiresAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const requestedDate  = new Date(requestedAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  await resend.emails.send({
    from: process.env.RESEND_FROM ?? 'Breachr <onboarding@breachr.ai>',
    to,
    subject: `Your ${dataTypeLabel} export is ready`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0e1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0e1a;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0d1428;border:1px solid rgba(25,118,210,0.2);border-radius:12px;overflow:hidden;max-width:560px;">

        <tr><td style="padding:24px 32px;border-bottom:1px solid rgba(255,255,255,0.06);">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="width:32px;height:32px;background:linear-gradient(135deg,#1976d2,#42a5f5);border-radius:8px;text-align:center;vertical-align:middle;">
              <span style="color:#fff;font-size:16px;">⬡</span>
            </td>
            <td style="padding-left:10px;">
              <span style="font-size:14px;font-weight:900;color:#fff;letter-spacing:0.08em;">BREACHR</span>
            </td>
          </tr></table>
        </td></tr>

        <tr><td style="padding:24px 32px 0;">
          <span style="display:inline-block;padding:3px 10px;border-radius:4px;background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.3);color:#22c55e;font-size:10px;font-weight:700;letter-spacing:0.08em;">EXPORT READY</span>
        </td></tr>

        <tr><td style="padding:16px 32px 8px;">
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#e2e8f0;">Your ${dataTypeLabel} export is ready</h1>
          <p style="margin:8px 0 0;font-size:14px;color:#64748b;">
            Your export of <strong style="color:#94a3b8;">${rowCount.toLocaleString()} rows</strong> has been generated and is ready to download.
          </p>
        </td></tr>

        <tr><td style="padding:20px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:8px;overflow:hidden;">
            ${[
              ['Source', dataTypeLabel],
              ['Format', formatLabel],
              ['Rows exported', rowCount.toLocaleString()],
              ['Expires', `${expiryDate} — then deleted for security`],
            ].map(([label, value], i) => `
            <tr style="border-top:${i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none'}">
              <td style="padding:10px 16px;font-size:11px;color:#475569;width:130px;">${label}</td>
              <td style="padding:10px 16px;font-size:12px;color:${label === 'Expires' ? '#f59e0b' : '#94a3b8'};">${value}</td>
            </tr>`).join('')}
          </table>
        </td></tr>

        <tr><td style="padding:0 32px 32px;">
          <a href="${portalUrl}/dashboard/reports?tab=exports"
            style="display:inline-block;padding:10px 24px;background:linear-gradient(135deg,#1565c0,#1976d2);color:#fff;font-size:13px;font-weight:600;text-decoration:none;border-radius:6px;">
            View &amp; Download Export →
          </a>
          <p style="margin:10px 0 0;font-size:11px;color:#334155;">Takes you to Reports › Exports in your portal.</p>
        </td></tr>

        <tr><td style="padding:16px 32px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:11px;color:#334155;">
            Requested by you on ${requestedDate}. Only admins and account owners can generate exports.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  }).catch(err => console.error('[email] sendExportReadyEmail failed:', err))
}
