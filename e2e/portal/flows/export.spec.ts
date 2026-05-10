import { test, expect, type APIRequestContext } from '@playwright/test'

// ── Config ────────────────────────────────────────────────────────────────────

const CASES = [
  { dataType: 'findings',    label: 'Findings',    route: '/dashboard/findings'  },
  { dataType: 'audit_trail', label: 'Audit Trail', route: '/dashboard/audit'     },
  { dataType: 'inventory',   label: 'Inventory',   route: '/dashboard/inventory' },
] as const

type Format = 'csv' | 'xlsx'
const FORMATS: Format[] = ['csv', 'xlsx']

const EMAIL_TO         = 'graham@breachr.ai'
const EMAIL_TIMEOUT_MS = 60_000
const POLL_INTERVAL_MS = 3_000

// ── Helpers ───────────────────────────────────────────────────────────────────

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
        // ── 1. Trigger export and wait for ready toast ──────────────────────
        await page.goto(route)
        await page.getByRole('button', { name: /export/i }).click()
        await page.getByRole('button', {
          name: format === 'csv' ? 'CSV' : 'Excel (.xlsx)',
        }).click()

        await expect(
          page.getByText(/export ready/i),
          'Export ready toast did not appear within 30s — job may have failed',
        ).toBeVisible({ timeout: 30_000 })

        // ── Capture export ID ───────────────────────────────────────────────
        const listRes = await request.get('/api/exports')
        expect(listRes.status()).toBe(200)

        type ExportRow = {
          id: string; data_type: string; format: string
          status: string; created_at: string; signed_url: string | null
          row_count: number | null
        }
        const list = await listRes.json() as ExportRow[]
        const job  = list.find(e =>
          e.data_type === dataType &&
          e.format    === format   &&
          new Date(e.created_at).getTime() >= testStartedAt - 10_000
        )
        expect(job, `Export job (${dataType}/${format}) not found in /api/exports`).toBeTruthy()
        exportId = job!.id

        // ── 2. File is downloadable ─────────────────────────────────────────
        expect(job!.status, 'Job status should be ready').toBe('ready')
        expect(job!.signed_url, 'signed_url should not be null').not.toBeNull()
        expect(job!.row_count, 'row_count should be > 0').toBeGreaterThan(0)

        const fileRes = await request.get(job!.signed_url!)
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
        await page.waitForLoadState('networkidle')
        const row = page.locator('tr').filter({ hasText: label }).filter({ hasText: format.toUpperCase() })
        await expect(row.getByText('Ready').first(), 'Export should show Ready in Reports tab').toBeVisible({ timeout: 10_000 })

        // ── 4. Audit event logged ───────────────────────────────────────────
        await page.goto('/dashboard/audit')
        await page.waitForLoadState('networkidle')
        await expect(
          page.getByText('Export Requested').first(),
          'Audit trail should contain Export Requested event',
        ).toBeVisible()
        await expect(
          page.getByText(`${label} (${format.toUpperCase()})`).first(),
          `Audit detail should show "${label} (${format.toUpperCase()})"`,
        ).toBeVisible()

        // ── 5. Email delivered ──────────────────────────────────────────────
        const emailEvent = await pollLastEmail(request, EMAIL_TO, testStartedAt)
        expect(
          String(emailEvent.subject ?? '').toLowerCase(),
          'Email subject should mention export',
        ).toMatch(/export/)

      } finally {
        if (exportId) await deleteExport(request, exportId)
      }
    })
  }
}
