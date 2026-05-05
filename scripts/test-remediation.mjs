#!/usr/bin/env node
/**
 * Breachr Remediation & Audit Trail Integration Test
 *
 * Tests the full lifecycle:
 *   Scan 1 → findings → status changes → audit log → Scan 2 → verified_fixed / regression
 *
 * Run from portal directory:
 *   node --env-file=.env.local scripts/test-remediation.mjs
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   AUDIT_SIGNING_KEY
 */

import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

// ─── Config ────────────────────────────────────────────────────────────────

const SUPABASE_URL       = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY
const AUDIT_SIGNING_KEY  = process.env.AUDIT_SIGNING_KEY

const TENANT_ID   = '85596311-117b-4c7c-99d2-cd5137ba03ac'
const USER_ID     = '70ba8a82-c08e-46e8-8b73-744f82d57868'  // testuser1@test.com
const SURFACE_ID  = '56aff2de-c56a-463e-b177-3d3d62571ed6'  // Breachr Website

const SCAN_TIMEOUT_MS   = 15 * 60 * 1000   // 15 minutes per scan
const POLL_INTERVAL_MS  = 10_000            // poll every 10s

// ─── Helpers ───────────────────────────────────────────────────────────────

const RESET = '\x1b[0m'
const GREEN = '\x1b[32m'
const RED   = '\x1b[31m'
const CYAN  = '\x1b[36m'
const DIM   = '\x1b[2m'
const BOLD  = '\x1b[1m'

const results = []

function pass(name) {
  results.push({ name, ok: true })
  console.log(`  ${GREEN}✓${RESET} ${name}`)
}
function fail(name, reason = '') {
  results.push({ name, ok: false, reason })
  console.log(`  ${RED}✗${RESET} ${name}${reason ? `  ${DIM}(${reason})${RESET}` : ''}`)
}
function section(title) {
  console.log(`\n${BOLD}${CYAN}── ${title} ──${RESET}`)
}
function info(msg) {
  console.log(`  ${DIM}${msg}${RESET}`)
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function hmacSha256Hex(key, data) {
  return createHmac('sha256', Buffer.from(key, 'hex')).update(data, 'utf8').digest('hex')
}

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000'

async function sha256Hex(str) {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', Buffer.from(str, 'utf8'))
  return Buffer.from(buf).toString('hex')
}

async function waitForScan(admin, scanId) {
  const deadline = Date.now() + SCAN_TIMEOUT_MS
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS)
    const { data } = await admin
      .from('scans')
      .select('status, current_phase, findings_count')
      .eq('id', scanId)
      .single()
    if (!data) throw new Error('Scan row disappeared')
    info(`polling scan ${scanId.slice(0, 8)}… phase=${data.current_phase} status=${data.status}`)
    if (data.status === 'complete' || data.status === 'failed') return data
  }
  throw new Error(`Scan timed out after ${SCAN_TIMEOUT_MS / 60000} minutes`)
}

async function insertAuditLog(admin, action, detail) {
  const ts        = new Date().toISOString()
  const detailStr = JSON.stringify({ ...detail, _ts: ts })

  const { data: last } = await admin
    .from('audit_logs')
    .select('signature')
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const prevHash  = last?.signature ? await sha256Hex(last.signature) : GENESIS_HASH
  const payload   = JSON.stringify({ action, detail: detailStr, prev_hash: prevHash, tenant_id: TENANT_ID })
  const signature = hmacSha256Hex(AUDIT_SIGNING_KEY, payload)

  const { error } = await admin.from('audit_logs').insert({
    tenant_id: TENANT_ID,
    user_id:   USER_ID,
    action,
    detail:    detailStr,
    signature,
    prev_hash: prevHash,
  })
  if (error) throw new Error(`audit_logs insert: ${error.message}`)
}

async function launchScan(admin) {
  const { data, error } = await admin.from('scans').insert({
    tenant_id:        TENANT_ID,
    attack_surface_id: SURFACE_ID,
    scan_type:        'full',
    status:           'queued',
    model_used:       'claude-sonnet-4-6',
    tests_total:      0,
    tests_run:        0,
    progress_pct:     0,
    current_phase:    'queued',
  }).select('id').single()
  if (error) throw new Error(`scan insert: ${error.message}`)
  return data.id
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n${BOLD}Breachr Remediation & Audit Trail Test${RESET}`)
  console.log(`Target: ${SURFACE_ID} | Tenant: ${TENANT_ID.slice(0, 8)}…`)

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !AUDIT_SIGNING_KEY) {
    console.error(`${RED}Missing env vars. Run with: node --env-file=.env.local scripts/test-remediation.mjs${RESET}`)
    process.exit(1)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // ── 0. SETUP ─────────────────────────────────────────────────────────────
  section('0. Setup — clear test data')

  await admin.from('compliance_reports').delete().eq('tenant_id', TENANT_ID)
  await admin.from('findings').delete().eq('tenant_id', TENANT_ID)
  await admin.from('scans').delete().eq('tenant_id', TENANT_ID)
  await admin.from('audit_logs').delete().eq('tenant_id', TENANT_ID)
  await admin.from('tenants')
    .update({ scans_this_month: 0, tokens_used_this_month: 0 })
    .eq('id', TENANT_ID)

  const { data: { scans_this_month } } = await admin
    .from('tenants').select('scans_this_month').eq('id', TENANT_ID).single()

  scans_this_month === 0
    ? pass('tenant counters reset to 0')
    : fail('tenant counters reset', `got ${scans_this_month}`)

  // ── 1. SCAN 1 ─────────────────────────────────────────────────────────────
  section('1. Scan 1 — baseline findings')

  const scan1Id = await launchScan(admin)
  info(`scan 1 launched: ${scan1Id}`)

  const scan1 = await waitForScan(admin, scan1Id)

  scan1.status === 'complete'
    ? pass('scan 1 completed successfully')
    : fail('scan 1 completed', `status=${scan1.status}`)

  const { data: findings1 } = await admin
    .from('findings')
    .select('id, title, severity, status')
    .eq('scan_id', scan1Id)
    .order('created_at', { ascending: true })

  findings1?.length > 0
    ? pass(`scan 1 produced ${findings1.length} finding(s)`)
    : fail('scan 1 produced findings', 'none found — scanner may be down')

  if (!findings1?.length) {
    console.log(`\n${RED}Cannot continue without findings. Aborting.${RESET}`)
    process.exit(1)
  }

  const findingA = findings1[0]
  const findingB = findings1[1] ?? findings1[0]
  info(`Finding A: "${findingA.title}" (${findingA.severity})`)
  info(`Finding B: "${findingB.title}" (${findingB.severity}) — will stay open`)

  // ── 2. STATUS CHANGES & AUDIT LOGGING ────────────────────────────────────
  section('2. Status changes — audit trail')

  // Change A: open → in_progress
  await admin.from('findings').update({ status: 'in_progress' }).eq('id', findingA.id)
  await insertAuditLog(admin, 'finding.status_changed', {
    finding_id: findingA.id,
    title: findingA.title,
    from: 'open',
    to: 'in_progress',
  })
  info(`"${findingA.title}" → in_progress`)

  // Change B: open → remediated
  await admin.from('findings').update({ status: 'remediated' }).eq('id', findingA.id)
  await insertAuditLog(admin, 'finding.status_changed', {
    finding_id: findingA.id,
    title: findingA.title,
    from: 'in_progress',
    to: 'remediated',
  })
  info(`"${findingA.title}" → remediated`)

  const { data: auditEntries } = await admin
    .from('audit_logs')
    .select('id, action, detail, prev_hash, signature')
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: true })

  auditEntries?.length === 2
    ? pass(`audit_logs has 2 entries for status changes`)
    : fail('audit_logs entry count', `expected 2, got ${auditEntries?.length ?? 0}`)

  // Verify finding A is actually remediated in DB
  const { data: updatedA } = await admin.from('findings').select('status').eq('id', findingA.id).single()
  updatedA?.status === 'remediated'
    ? pass('finding A status is remediated in DB')
    : fail('finding A status', `got ${updatedA?.status}`)

  // Finding B should still be open
  const { data: updatedB } = await admin.from('findings').select('status').eq('id', findingB.id).single()
  updatedB?.status === 'open'
    ? pass('finding B status remains open (control)')
    : fail('finding B status control', `got ${updatedB?.status}`)

  // ── 3. AUDIT CHAIN INTEGRITY (after 2 entries) ───────────────────────────
  section('3. Audit chain integrity — after scan 1')

  let chainValid = true
  for (let i = 0; i < auditEntries.length; i++) {
    const e = auditEntries[i]
    const expectedPrev = i === 0 ? GENESIS_HASH : await sha256Hex(auditEntries[i - 1].signature)
    if (e.prev_hash !== expectedPrev) { chainValid = false; break }
    const payload = JSON.stringify({ action: e.action, detail: e.detail ?? '', prev_hash: e.prev_hash, tenant_id: TENANT_ID })
    const expectedSig = hmacSha256Hex(AUDIT_SIGNING_KEY, payload)
    if (e.signature !== expectedSig) { chainValid = false; break }
  }
  chainValid
    ? pass('audit chain intact and HMAC valid for all entries')
    : fail('audit chain integrity')

  // ── 4. SCAN 2 — remediation re-test ──────────────────────────────────────
  section('4. Scan 2 — remediation re-test')

  // Reset scan counter so the limit doesn't block scan 2
  await admin.from('tenants').update({ scans_this_month: 0 }).eq('id', TENANT_ID)

  const scan2Id = await launchScan(admin)
  info(`scan 2 launched: ${scan2Id}`)

  const scan2 = await waitForScan(admin, scan2Id)

  scan2.status === 'complete'
    ? pass('scan 2 completed successfully')
    : fail('scan 2 completed', `status=${scan2.status}`)

  // ── 5. REMEDIATION OUTCOMES ───────────────────────────────────────────────
  section('5. Remediation outcomes')

  const { data: findings2 } = await admin
    .from('findings')
    .select('id, title, severity, status, description')
    .eq('scan_id', scan2Id)

  info(`scan 2 produced ${findings2?.length ?? 0} finding record(s)`)

  const verifiedFixed = findings2?.filter(f => f.status === 'verified_fixed') ?? []
  const regressions   = findings2?.filter(f => f.status === 'open' && f.description?.startsWith('REGRESSION')) ?? []
  const newFindings   = findings2?.filter(f => f.status === 'open' && !f.description?.startsWith('REGRESSION')) ?? []

  verifiedFixed.length > 0 || regressions.length > 0
    ? pass(`remediation outcome recorded (${verifiedFixed.length} verified_fixed, ${regressions.length} regression)`)
    : fail('remediation outcome', 'no verified_fixed or regression records — check scanner logs')

  verifiedFixed.length > 0
    ? pass(`fix confirmed: "${verifiedFixed[0].title}" → verified_fixed`)
    : info('finding A was found again (regression) — fix did not hold on this target')

  regressions.length > 0
    ? pass(`regression detected: "${regressions[0].title}" → open (REGRESSION)`)
    : info('no regressions (finding A not seen by scanner = fix held)')

  // Finding B (open) should have been skipped — no duplicate in scan 2
  const scan2Dupe = findings2?.find(f =>
    f.title === findingB.title && f.severity === findingB.severity && f.status === 'open' && !f.description?.startsWith('REGRESSION')
  )
  !scan2Dupe
    ? pass('open finding B correctly skipped in scan 2 (no cross-scan duplicate)')
    : fail('finding B dedup', 'scanner created a duplicate open finding')

  info(`Summary: ${verifiedFixed.length} verified_fixed | ${regressions.length} regressions | ${newFindings.length} new`)

  // ── 6. FULL AUDIT CHAIN ───────────────────────────────────────────────────
  section('6. Full audit chain — end to end')

  const { data: allEntries } = await admin
    .from('audit_logs')
    .select('id, action, detail, prev_hash, signature')
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: true })

  info(`total audit entries: ${allEntries?.length ?? 0}`)

  let fullChainValid = true
  let broken = null
  for (let i = 0; i < (allEntries?.length ?? 0); i++) {
    const e = allEntries[i]
    const expectedPrev = i === 0 ? GENESIS_HASH : await sha256Hex(allEntries[i - 1].signature)
    const payload = JSON.stringify({ action: e.action, detail: e.detail ?? '', prev_hash: e.prev_hash, tenant_id: TENANT_ID })
    const expectedSig = hmacSha256Hex(AUDIT_SIGNING_KEY, payload)
    if (e.prev_hash !== expectedPrev || e.signature !== expectedSig) {
      fullChainValid = false
      broken = i + 1
      break
    }
  }

  fullChainValid
    ? pass(`all ${allEntries?.length ?? 0} audit entries valid — chain intact, HMAC verified`)
    : fail('full audit chain', `broken at entry ${broken}`)

  // ── REPORT ────────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`)
  const passed = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok).length
  console.log(`${BOLD}Results: ${GREEN}${passed} passed${RESET}${BOLD}, ${failed > 0 ? RED : ''}${failed} failed${RESET}`)
  if (failed > 0) {
    console.log(`\n${RED}Failed checks:${RESET}`)
    results.filter(r => !r.ok).forEach(r => {
      console.log(`  ✗ ${r.name}${r.reason ? ` — ${r.reason}` : ''}`)
    })
  }
  console.log()
  process.exit(failed > 0 ? 1 : 0)
}

run().catch(err => {
  console.error(`\n${RED}Fatal error: ${err.message}${RESET}`)
  process.exit(1)
})
