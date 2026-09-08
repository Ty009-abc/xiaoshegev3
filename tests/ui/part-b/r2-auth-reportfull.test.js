/**
 * R2 FIXPACK A1 — REPORTFULL AUTHORITY WIRING (AUTH-01..06)
 *
 * Verifies that the single shared full-report navigation authority path in
 * pages/report-preview/report-preview.js gates BOTH goFull() and
 * onCloseUpgrade() behind permissionService.checkPermission('full_report').
 *
 * Contract:
 *   - permission authorized        → navigate to report-detail
 *   - permission denied            → NO protected navigation (upgrade UX shown)
 *   - permission throws/error      → FAIL CLOSED (no navigation)
 *   - report.locked missing        → must NOT implicitly authorize (fail-closed)
 *   - isVip=true + denied          → blocked (isVip is NOT authority)
 *   - isVip=false + authorized     → allowed
 *   - onCloseUpgrade cannot bypass the shared authority path
 *
 * Logic-only. No WXML/WXSS/DevTools/device/E2E claim.
 * Guard contract: LIVE_AI_CALL_COUNT=0, REAL_DB_MUTATION_COUNT=0, PRIMARY=NO.
 *
 * @env TEST_ONLY / NON_PRODUCTION / NO REAL PAYMENT / NO REAL DB
 * Run: NODE_PATH=/tmp/mpspike/node_modules node --test tests/ui/part-b/r2-auth-reportfull.test.js
 */

const test = require('node:test')
const assert = require('node:assert')
const { loadPage } = require('../helpers/pageShim')
const { buildGuardedWx, getGuards, resetGuards, seedModule, svcPath } = require('../helpers/guards')

resetGuards()

// Seed the REAL permissionService module so report-preview's authority decision
// is deterministic and does NOT touch the live cloud boundary.
function seedPermission({ granted, throws } = {}) {
  const impl = {
    checkPermission: async () => {
      if (throws) throw new Error('permission lookup failed')
      return { granted: !!granted, needPay: !granted }
    },
  }
  seedModule(svcPath('permissionService.js'), impl)
}

// Seed the REAL aiReportService module (used by onGenerate) for a deterministic,
// in-memory response — NO live AI.
function seedAiReport(genResult) {
  const impl = {
    generateAiReport: async () => genResult,
    getAiReport: async () => ({ code: 0, data: {} }),
    generateDiagnosticReport: async () => ({ code: 0, data: {} }),
    generateV2ShadowReport: async () => ({ code: 0 }),
  }
  seedModule(svcPath('aiReportService.js'), impl)
}

test('AUTH-01: permission authorized → navigate to report-detail', async () => {
  seedPermission({ granted: true })
  const { wx } = buildGuardedWx({})
  const { harness, error } = loadPage('report-preview', wx, { globalData: { isVip: false } })
  assert.ifError(error)
  harness.setData({ recordId: 'r1', report: { reportId: 'AR_TEST_VALID' } })
  const r = await harness.goFull()
  assert.strictEqual(r, true)
  assert.ok(wx._calls.some(c => c.type === 'navigateTo' && c.url.includes('report-detail')), 'authorized must navigate')
})

test('AUTH-02: permission denied → no navigate (goFull + onCloseUpgrade cannot bypass)', async () => {
  seedPermission({ granted: false })
  const { wx } = buildGuardedWx({})
  const { harness, error } = loadPage('report-preview', wx, { globalData: { isVip: true } })
  assert.ifError(error)
  harness.setData({ recordId: 'r1', report: { _id: 'rep1' } })

  const r1 = await harness.goFull()
  assert.strictEqual(r1, false)
  assert.strictEqual(harness.data.showUpgradeModal, true, 'denied must show upgrade UX')

  // onCloseUpgrade (先看报告 →) MUST route through the same authority path.
  const r2 = await harness.onCloseUpgrade()
  assert.strictEqual(r2, false, 'onCloseUpgrade must not bypass authority')
  assert.ok(!wx._calls.some(c => c.type === 'navigateTo' && c.url.includes('report-detail')), 'denied must never navigate')
})

test('AUTH-03: permission throws/error → fail closed (no navigate)', async () => {
  seedPermission({ throws: true })
  const { wx } = buildGuardedWx({})
  const { harness, error } = loadPage('report-preview', wx, { globalData: { isVip: false } })
  assert.ifError(error)
  harness.setData({ recordId: 'r1', report: { _id: 'rep1' } })
  const r = await harness.goFull()
  assert.strictEqual(r, false)
  assert.strictEqual(harness.data.showUpgradeModal, true)
  assert.ok(!wx._calls.some(c => c.type === 'navigateTo' && c.url.includes('report-detail')), 'error must fail closed')
})

test('AUTH-04: report.locked missing → cannot implicitly authorize (fail-closed)', async () => {
  seedPermission({ granted: false })
  // generateAiReport returns a report WITHOUT a `locked` field.
  seedAiReport({ code: 0, data: { reportType: 'challenge_final', content: { oneSentence: 's' } } })
  const { wx } = buildGuardedWx({})
  const { harness, error } = loadPage('report-preview', wx, { globalData: { isVip: false } })
  assert.ifError(error)
  harness.setData({ recordId: 'r1' })
  harness.onGenerate()
  await new Promise(r => setTimeout(r, 2300))
  assert.strictEqual(harness.data.locked, true, 'missing locked must fail closed, not authorize')
  assert.ok(!wx._calls.some(c => c.type === 'navigateTo' && c.url.includes('report-detail')))
})

test('AUTH-05: isVip=true + permission denied → no navigate', async () => {
  seedPermission({ granted: false })
  const { wx } = buildGuardedWx({})
  const { harness, error } = loadPage('report-preview', wx, { globalData: { isVip: true } })
  assert.ifError(error)
  harness.setData({ recordId: 'r1', report: { _id: 'rep1' } })
  const r = await harness.goFull()
  assert.strictEqual(r, false)
  assert.ok(!wx._calls.some(c => c.type === 'navigateTo' && c.url.includes('report-detail')), 'isVip=true must not override denied permission')
})

test('AUTH-06: isVip=false + permission authorized → navigate', async () => {
  seedPermission({ granted: true })
  const { wx } = buildGuardedWx({})
  const { harness, error } = loadPage('report-preview', wx, { globalData: { isVip: false } })
  assert.ifError(error)
  harness.setData({ recordId: 'r1', report: { reportId: 'AR_TEST_VALID' } })
  const r = await harness.goFull()
  assert.strictEqual(r, true)
  assert.ok(wx._calls.some(c => c.type === 'navigateTo' && c.url.includes('report-detail')), 'isVip=false with authorized permission must navigate')
})
