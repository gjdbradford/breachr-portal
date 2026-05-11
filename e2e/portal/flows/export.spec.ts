import { test, expect, type APIRequestContext } from '@playwright/test'

// ── Config ────────────────────────────────────────────────────────────────────

const CASES = [
  { dataType: 'findings',    label: 'Findings',    route: '/dashboard/findings'  },
  { dataType: 'audit_trail', label: 'Audit Trail', route: '/dashboard/audit'     },
  { dataType: 'inventory',   label: 'Inventory',   route: '/dashboard/inventory' },
] as const

type Format = 'csv' | 'xlsx'
const FORMATS: Format[] = ['csv', 'xlsx']

const EMAIL_TO         = 'test1@breachr.ai'
const EMAIL_TIMEOUT_MS = 30_000
const POLL_INTERVAL_MS = 3_000

// ── Helpers ───────────────────────────────────────────────────────────────────

type ExportRow = {
  id: string; data_type: string; format: string
  status: string; created_at: string; signed_url: string | null
  row_count: number | null
}

async function pollExportReady(
  request: APIRequestContext,
  dataType: string,
  format: string,
  after: number,
  timeoutMs = 60_000,
): Promise<ExportRow> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res  = await request.get('/api/exports')
      const list = await res.json() as ExportRow[]
      const job  = list.find(e =>
        e.data_type === dataType &&
        e.format    === format   &&
        new Date(e.created_at).getTime() >= after - 10_000 &&
        e.status    === 'ready'
      )
      if (job) return job
    } catch { /* transient network error — retry on next interval */ }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
  }
  throw new Error(`Export ${dataType}/${format} did not reach status=ready within ${timeoutMs}ms`)
}

async function pollLastEmail(
  request: APIRequestContext,
  to: string,
  after: number,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + EMAIL_TIMEOUT_MS
  while (Date.now() < deadline) {
    const res  = await request.get(`/api/test/last-email?to=${encodeURIComponent(to)}&after=${after}`)
    const body = await res.json() as Record<string, unknown> | null
    if (body?.received_at) return body
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
  }
  throw new Error(`Email to ${to} not received within ${EMAIL_TIMEOUT_MS}ms`)
}

async function deleteExport(request: APIRequestContext, exportId: string) {
  const res = await request.delete(`/api/exports/${exportId}`)
  expect(res.status(), `Cleanup DELETE /api/exports/${exportId} failed`).toBe(200)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

for (const { dataType, label, route } of CASES) {
  for (const format of FORMATS) {
    test(`${dataType} › export ${format} @flow`, async ({ page, request }) => {
      const testStartedAt = Date.now()
      let exportId: string | null = null

      try {
        // ── 1. Trigger export — wait for POST /api/exports to commit ──────────
        await page.goto(route)
        await page.getByRole('button', { name: /export/i }).click()

        // Intercept the POST so we know the job is in DB before calling cron
        const [exportRes] = await Promise.all([
          page.waitForResponse(
            r => r.url().includes('/api/exports') && r.request().method() === 'POST',
            { timeout: 15_000 },
          ),
          page.getByRole('button', {
            name: format === 'csv' ? 'CSV' : 'Excel (.xlsx)',
          }).click(),
        ])
        expect(exportRes.status(), 'POST /api/exports should return 2xx').toBeLessThan(300)

        // POST /api/exports auto-triggers the cron fire-and-forget —
        // no explicit cron call needed here.

        // ── Capture export ID — poll until status=ready ─────────────────────
        const job = await pollExportReady(request, dataType, format, testStartedAt)
        exportId = job.id

        // ── 2. File is downloadable ─────────────────────────────────────────
        expect(job.signed_url, 'signed_url should not be null').not.toBeNull()
        expect(job.row_count, 'row_count should be > 0').toBeGreaterThan(0)

        const fileRes = await request.get(job.signed_url!)
        expect(fileRes.status(), 'Signed URL should return 200').toBe(200)

        const body = await fileRes.body()
        expect(body.length, 'Downloaded file should not be empty').toBeGreaterThan(0)

        const ct = fileRes.headers()['content-type'] ?? ''
        if (format === 'csv') {
          expect(ct, 'Content-Type should be text/csv').toMatch(/text\/csv/)
        } else {
          expect(ct, 'Content-Type should be XLSX').toMatch(/spreadsheetml/)
        }

        // ── 3. Reports Exports tab shows job ───────────────────────────────
        await page.goto('/dashboard/reports?tab=exports')
        await page.waitForLoadState('load')
        const row = page.locator('tr').filter({ hasText: label }).filter({ hasText: format.toUpperCase() })
        await expect(row.getByText('Ready').first(), 'Export should show Ready in Reports tab').toBeVisible({ timeout: 15_000 })

        // ── 4. Audit event logged ───────────────────────────────────────────
        await page.goto('/dashboard/audit')
        await page.waitForLoadState('load')
        await expect(
          page.getByText('Export Requested').first(),
          'Audit trail should contain Export Requested event',
        ).toBeVisible()
        await expect(
          page.getByText(`${label} (${format.toUpperCase()})`).first(),
          `Audit detail should show "${label} (${format.toUpperCase()})"`,
        ).toBeVisible()

        // ── 5. Email delivered (soft — Resend webhook may be delayed/deduped) ──
        const emailEvent = await pollLastEmail(request, EMAIL_TO, testStartedAt).catch(() => null)
        if (emailEvent) {
          expect(
            String(emailEvent.subject ?? '').toLowerCase(),
            'Email subject should mention export',
          ).toMatch(/export/)
        } else {
          console.warn(`⚠ Email to ${EMAIL_TO} not received within ${EMAIL_TIMEOUT_MS}ms — Resend may have deduplicated or delayed delivery`)
        }

      } finally {
        if (exportId) await deleteExport(request, exportId)
      }
    })
  }
}
