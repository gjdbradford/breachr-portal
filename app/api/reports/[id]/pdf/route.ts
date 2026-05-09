import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as adminClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { createElement as h } from 'react'
import { logAuditEvent } from '@/lib/audit-log'

export const runtime = 'nodejs'

const FRAMEWORK_FULL: Record<string, string> = {
  'DORA':    'Digital Operational Resilience Act (DORA)',
  'NIS2':    'Network & Information Security Directive (NIS2)',
  'PCI-DSS': 'Payment Card Industry Data Security Standard (PCI-DSS)',
}

const SEV_ORDER = ['critical', 'high', 'medium', 'low', 'info']

const SEV_COLOUR: Record<string, string> = {
  critical: '#c0392b',
  high:     '#e67e22',
  medium:   '#d4a017',
  low:      '#27ae60',
  info:     '#7f8c8d',
}

const s = StyleSheet.create({
  page:      { fontFamily: 'Helvetica', fontSize: 9, color: '#1a202c', padding: '40 50' },
  // header
  brand:     { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1a365d', marginBottom: 2 },
  framework: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#2d3748', marginBottom: 3 },
  sub:       { fontSize: 9, color: '#718096' },
  divider:   { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginTop: 14, marginBottom: 14 },
  // section
  section:   { marginBottom: 16 },
  h2:        { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#2d3748', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  // chain of custody
  hashBox:   { backgroundColor: '#f7fafc', borderWidth: 1, borderColor: '#e2e8f0', padding: '8 10', borderRadius: 4, marginBottom: 6 },
  hashLabel: { fontSize: 8, color: '#718096', marginBottom: 3 },
  hashValue: { fontFamily: 'Courier', fontSize: 7.5, color: '#2b6cb0', letterSpacing: 0.3 },
  hashNote:  { fontSize: 7.5, color: '#718096', marginTop: 6, fontStyle: 'italic' },
  // severity counts
  sevRow:    { flexDirection: 'row', gap: 8, marginBottom: 8 },
  sevBox:    { flex: 1, borderWidth: 1, padding: '6 8', borderRadius: 4, alignItems: 'center' },
  sevNum:    { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  sevLabel:  { fontSize: 7, textTransform: 'uppercase', letterSpacing: 0.5 },
  // overall risk
  riskBox:   { padding: '8 12', borderRadius: 4, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  riskLabel: { fontSize: 9, color: '#4a5568' },
  riskVal:   { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  // table
  tableHead: { flexDirection: 'row', backgroundColor: '#edf2f7', padding: '5 8', borderRadius: 2, marginBottom: 1 },
  tableRow:  { flexDirection: 'row', padding: '5 8', borderBottomWidth: 1, borderBottomColor: '#f0f4f8' },
  colSev:    { width: '10%', fontSize: 8, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  colTitle:  { width: '40%', paddingRight: 6 },
  colOwasp:  { width: '22%', fontSize: 8, color: '#718096' },
  colCtrl:   { width: '28%', fontSize: 7.5, color: '#718096' },
  // full mode finding block
  findBlock: { marginBottom: 12, padding: '8 10', borderLeftWidth: 3, backgroundColor: '#fafafa' },
  findTitle: { fontFamily: 'Helvetica-Bold', fontSize: 9, marginBottom: 4 },
  findText:  { fontSize: 8.5, color: '#4a5568', lineHeight: 1.5, marginBottom: 4 },
  findLabel: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: '#718096', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  // footer
  footer:    { position: 'absolute', bottom: 30, left: 50, right: 50, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 6 },
  footerTxt: { fontSize: 7, color: '#a0aec0' },
})

function overallRisk(summary: Record<string, number>): { label: string; color: string; bg: string; border: string } {
  if ((summary.critical ?? 0) > 0) return { label: 'CRITICAL RISK — Immediate action required', color: '#c0392b', bg: '#fff5f5', border: '#fed7d7' }
  if ((summary.high ?? 0) > 0)     return { label: 'HIGH RISK — Action required',               color: '#e67e22', bg: '#fffaf0', border: '#fbd38d' }
  if ((summary.medium ?? 0) > 0)   return { label: 'MEDIUM RISK — Review recommended',          color: '#d4a017', bg: '#fffff0', border: '#f6e05e' }
  if ((summary.low ?? 0) > 0)      return { label: 'LOW RISK — Monitor',                        color: '#27ae60', bg: '#f0fff4', border: '#9ae6b4' }
  return                                   { label: 'PASSED — No significant gaps identified',   color: '#27ae60', bg: '#f0fff4', border: '#9ae6b4' }
}

function buildPDF(report: any, tenantName: string, mode: 'summary' | 'full') {
  const findings: any[] = (report.findings_snapshot ?? []).slice().sort(
    (a: any, b: any) => SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity)
  )
  const summary: Record<string, number> = report.framework_summary ?? {}
  const risk   = overallRisk(summary)
  const genAt  = new Date().toUTCString()
  const fwFull = FRAMEWORK_FULL[report.framework] ?? report.framework

  return h(Document, { title: `${report.framework} Compliance Report` },
    h(Page, { size: 'A4', style: s.page },

      // ── Header ──────────────────────────────────────────────────────────────
      h(View, null,
        h(Text, { style: s.brand }, 'BREACHR'),
        h(Text, { style: s.framework }, fwFull),
        h(Text, { style: s.sub },
          `${report.report_type === 'organizational' ? 'Organisational Compliance Report' : 'Scan-Level Technical Report'}  ·  AI-Powered Security Intelligence`),
      ),
      h(View, { style: s.divider }),

      // Tenant / dates row
      h(View, { style: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 } },
        h(View, null,
          h(Text, { style: { fontSize: 8, color: '#718096', marginBottom: 2 } }, 'ORGANISATION'),
          h(Text, { style: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#2d3748' } }, tenantName),
        ),
        h(View, { style: { alignItems: 'flex-end' } },
          h(Text, { style: { fontSize: 8, color: '#718096', marginBottom: 2 } }, 'GENERATED'),
          h(Text, { style: { fontSize: 9, color: '#2d3748' } }, genAt),
          h(Text, { style: { fontSize: 8, color: '#718096', marginTop: 2 } },
            `Mode: ${mode === 'full' ? 'Full Report' : 'Summary'}`),
        ),
      ),

      // ── Chain of Custody ────────────────────────────────────────────────────
      h(View, { style: s.section },
        h(Text, { style: s.h2 }, 'Chain of Custody'),
        h(View, { style: s.hashBox },
          h(Text, { style: s.hashLabel }, 'FINDINGS SNAPSHOT SHA-256 (computed at report generation over deduplicated findings)'),
          h(Text, { style: s.hashValue }, report.sha256_hash ?? '—'),
          h(Text, { style: { ...s.hashLabel, marginTop: 8 } }, 'REPORT ID'),
          h(Text, { style: s.hashValue }, report.id),
          ...(report.report_type === 'organizational'
            ? [
                h(Text, { style: { ...s.hashLabel, marginTop: 8 } }, 'REPORTING PERIOD'),
                h(Text, { style: s.hashValue },
                  `${report.report_period_start ? report.report_period_start.slice(0, 10) : '?'} → ${report.report_period_end ? report.report_period_end.slice(0, 10) : '?'}`),
                h(Text, { style: { ...s.hashLabel, marginTop: 8 } }, 'SCANS INCLUDED'),
                h(Text, { style: s.hashValue }, String(report.scan_count ?? (report.scan_ids?.length ?? '—'))),
                h(Text, { style: { ...s.hashLabel, marginTop: 8 } }, 'TARGETS ASSESSED'),
                h(Text, { style: s.hashValue },
                  (Array.isArray(report.targets_covered) ? report.targets_covered as any[] : [])
                    .map((t: any) => (t?.name ? String(t.name) : null)).filter(Boolean).join(', ') || '—'),
              ]
            : [
                h(Text, { style: { ...s.hashLabel, marginTop: 8 } }, 'SCAN ID'),
                h(Text, { style: s.hashValue }, report.scan_id ?? '—'),
              ]
          ),
          h(Text, { style: s.hashNote },
            'The findings snapshot SHA-256 above was computed at report generation and stored in the Breachr audit log. ' +
            'A separate SHA-256 of this PDF is recorded in the Breachr database upon download. ' +
            'CONFIDENTIAL — REGULATORY USE ONLY'),
        ),
      ),

      // ── Overall Risk ────────────────────────────────────────────────────────
      h(View, { style: { ...s.riskBox, backgroundColor: risk.bg, borderWidth: 1, borderColor: risk.border } },
        h(Text, { style: { ...s.riskVal, color: risk.color } }, risk.label),
      ),

      // ── Severity Counts ─────────────────────────────────────────────────────
      h(View, { style: s.section },
        h(Text, { style: s.h2 }, 'Finding Summary'),
        h(View, { style: s.sevRow },
          ...['critical','high','medium','low','info'].map(sev =>
            h(View, { key: sev, style: { ...s.sevBox, borderColor: SEV_COLOUR[sev] + '80' } },
              h(Text, { style: { ...s.sevNum, color: SEV_COLOUR[sev] } }, String(summary[sev] ?? 0)),
              h(Text, { style: { ...s.sevLabel, color: SEV_COLOUR[sev] } }, sev),
            )
          ),
        ),
      ),

      // ── Findings ────────────────────────────────────────────────────────────
      h(View, { style: s.section },
        h(Text, { style: s.h2 }, `Findings (${findings.length})`),

        // Table header
        h(View, { style: s.tableHead },
          h(Text, { style: s.colSev }, 'Severity'),
          h(Text, { style: s.colTitle }, 'Finding'),
          h(Text, { style: s.colOwasp }, 'OWASP'),
          h(Text, { style: s.colCtrl }, 'Controls'),
        ),

        mode === 'summary'
          // Summary: compact table rows
          ? h(View, null,
              ...findings.map((f: any, i: number) =>
                h(View, { key: i, style: s.tableRow },
                  h(Text, { style: { ...s.colSev, color: SEV_COLOUR[f.severity] ?? '#718096' } }, f.severity),
                  h(Text, { style: s.colTitle }, f.title),
                  h(Text, { style: s.colOwasp }, f.owasp_category || '—'),
                  h(Text, { style: s.colCtrl }, (f.controls ?? []).join(', ') || '—'),
                )
              )
            )
          // Full: expanded blocks
          : h(View, null,
              ...findings.map((f: any, i: number) =>
                h(View, { key: i, style: { ...s.findBlock, borderLeftColor: SEV_COLOUR[f.severity] ?? '#718096' } },
                  h(View, { style: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 } },
                    h(Text, { style: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: SEV_COLOUR[f.severity] ?? '#718096', textTransform: 'uppercase' } }, f.severity),
                    h(Text, { style: s.findTitle }, f.title),
                  ),
                  f.owasp_category && h(Text, { style: { fontSize: 7.5, color: '#718096', marginBottom: 4 } }, `OWASP: ${f.owasp_category}`),
                  f.description && h(View, null,
                    h(Text, { style: s.findLabel }, 'Description'),
                    h(Text, { style: s.findText }, f.description),
                  ),
                  f.remediation && h(View, null,
                    h(Text, { style: s.findLabel }, 'Remediation'),
                    h(Text, { style: s.findText }, f.remediation),
                  ),
                  (f.controls ?? []).length > 0 && h(Text, { style: { fontSize: 7.5, color: '#718096' } },
                    `Controls: ${f.controls.join(', ')}`),
                )
              )
            ),
      ),

      // ── Footer ──────────────────────────────────────────────────────────────
      h(View, { style: s.footer },
        h(Text, { style: s.footerTxt }, `Breachr Security Intelligence  ·  ${report.framework} Compliance Report`),
        h(Text, { style: s.footerTxt }, 'CONFIDENTIAL — REGULATORY USE ONLY'),
      ),
    )
  )
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const mode = (req.nextUrl.searchParams.get('mode') ?? 'summary') as 'summary' | 'full'

  // Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'No profile' }, { status: 403 })

  // Fetch report — RLS ensures tenant ownership
  const { data: report } = await supabase
    .from('compliance_reports')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', profile.tenant_id)
    .single()
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Tenant name for cover page
  const { data: tenant } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', profile.tenant_id)
    .single()
  const tenantName = tenant?.name ?? 'Organisation'

  // Generate PDF
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderToBuffer(buildPDF(report, tenantName, mode))
  } catch (err: any) {
    console.error('PDF generation failed', err)
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 })
  }

  // Hash the final PDF bytes (chain of custody step 2)
  const pdfHash = createHash('sha256').update(pdfBuffer).digest('hex')
  const pdfGeneratedAt = new Date().toISOString()

  // Store pdf_hash in DB (service role — bypasses RLS for write-back)
  const admin = adminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  await admin
    .from('compliance_reports')
    .update({ pdf_hash: pdfHash, pdf_generated_at: pdfGeneratedAt })
    .eq('id', id)

  await logAuditEvent({
    tenantId: profile.tenant_id,
    userId:   user.id,
    action:   'report.exported',
    detail:   { reportId: id, framework: report.framework, mode, pdfHash },
  }).catch(() => {})

  const filename = `breachr-${report.framework.toLowerCase()}-${id.slice(0, 8)}-${mode}.pdf`

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      String(pdfBuffer.length),
      'X-PDF-Hash':          pdfHash,
      'Cache-Control':       'no-store',
    },
  })
}
