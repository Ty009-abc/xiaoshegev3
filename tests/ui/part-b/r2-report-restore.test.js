/**
 * R2 FIXPACK B — REPORT ID / CONTRACT RESTORE (RESTORE-01..08)
 *
 * Verifies canonical reportId recovery for pages/report-detail/report-detail.js
 * and business-reportId provenance for pages/report-preview/report-preview.js.
 *
 * Contract (FIX B):
 *   - report-preview navigation uses report.reportId (never _id / recordId).
 *   - report-detail uses this.data.reportId (from opt.reportId) as the ONE
 *     canonical report ID; the dead _urlParams.reportId source is removed.
 *   - reportId recovery calls aiReportService.getAiReport(reportId) and awaits
 *     the full authority + normalize/render (or failure) BEFORE the safe
 *     data-loss fallback. No timer/redirect may preempt pending recovery.
 *   - Envelope { code, message, data }; code===0 → payload = data.
 *   - Only payload.type === 'challenge_final' is supported for recovery.
 *   - Known reportId is NOT authorization: full_report re-checked, fail-closed.
 *   - payload.locked === true → no protected full render.
 *   - challenge_final content normalized via canonical field mapping.
 *
 * Logic-only. No WXML/WXSS/DevTools/device/E2E claim.
 * Guard contract: PAYMENT_REAL_CALL_COUNT=0, LIVE_AI_CALL_COUNT=0,
 * REAL_DB_MUTATION_COUNT=0, PRIMARY=NO, BATCH2/3=NO, GATE_B=NO.
 *
 * @env TEST_ONLY / NON_PRODUCTION / NO REAL PAYMENT / NO REAL DB
 * Run: NODE_PATH=/tmp/mpspike/node_modules node --test tests/ui/part-b/r2-report-restore.test.js
 */

const test = require('node:test')
const assert = require('node:assert')
const { loadPage } = require('../helpers/pageShim')
const { buildGuardedWx, getGuards, resetGuards, seedModule, svcPath } = require('../helpers/guards')

resetGuards()

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Distinct challenge_final content so normalization assertions are unambiguous.
const CF_CONTENT = {
  oneSentence: '你被单一工资结构困住了',
  worldModelType: 'world_model_v2',
  whyNotRich: '缺乏可复利的资产管道',
  biggestCognitiveGap: '高估了打工的确定性',
  turnaroundProbability: 0.62,
  threeYearRisk: '收入结构三年内不会自动改善',
  bestPath: '用副业验证一个可复利方向',
  thirtyDayActions: ['第1天：选定方向', '第2天：跑通最小闭环'],
  finalStrike: '翻身从来不是拼命，而是看懂规则。',
}

// Seed the REAL aiReportService module with a deterministic in-memory
// getAiReport (NO live AI / NO wx.cloud.callFunction → LIVE_AI_CALL_COUNT=0).
function seedAiReport(getImpl) {
  const impl = {
    getAiReport: getImpl,
    generateAiReport: async () => ({ code: 0, data: {} }),
    generateDiagnosticReport: async () => ({ code: 0, data: {} }),
    generateV2ShadowReport: async () => ({ code: 0 }),
  }
  seedModule(svcPath('aiReportService.js'), impl)
  return impl
}

function seedPermission({ granted, throws } = {}) {
  const impl = {
    checkPermission: async () => {
      if (throws) throw new Error('permission lookup failed')
      return { granted: !!granted, needPay: !granted }
    },
  }
  seedModule(svcPath('permissionService.js'), impl)
  return impl
}

function unlockPayload(content) {
  return { code: 0, data: { type: 'challenge_final', locked: false, content } }
}

// Load the canonical report-detail page with the given globalData and no
// in-memory diagnostic answers. Returns { harness, error, wx }.
function loadDetail(appGlobal, guardedOpts) {
  const { wx } = buildGuardedWx(guardedOpts || {})
  const app = { globalData: appGlobal || {} }
  const { harness, error } = loadPage('report-detail', wx, app)
  return { harness, error, wx }
}

test('RESTORE-01: DIRECT ENTRY — reportId recovery renders protected challenge_final + canonical normalization', async () => {
  let sentId = null
  seedAiReport(async (id) => { sentId = id; return unlockPayload(CF_CONTENT) })
  seedPermission({ granted: true })
  const { harness, error, wx } = loadDetail({})
  assert.ifError(error)

  harness.setData({ reportId: 'AR_TEST_001' })
  await harness._startDiagnostic()
  await sleep(2000) // allow V3 reveal delays (max 1700ms)

  assert.strictEqual(sentId, 'AR_TEST_001', 'exact reportId must be sent to getAiReport')
  assert.strictEqual(harness.data.loading, false)
  assert.strictEqual(harness.data.reportVersion, 'v3')
  assert.strictEqual(harness.data.sections.length, 5, 'protected report rendered as 5 sections')
  assert.strictEqual(harness.data.error, '')
  assert.ok(!wx._calls.some((c) => c.type === 'redirectTo' && c.url.includes('challenge-play')), 'no redirect on success')

  // Canonical normalization semantics (no subpkg-ai field names).
  assert.strictEqual(harness.data.sections[0].text, CF_CONTENT.oneSentence, 'oneSentence → basicInsight')
  assert.strictEqual(harness.data.sections[1].text, CF_CONTENT.whyNotRich, 'whyNotRich → systemTrap')
  assert.strictEqual(harness.data.sections[2].text, CF_CONTENT.biggestCognitiveGap, 'biggestCognitiveGap → coreProblem')
  assert.strictEqual(harness.data.sections[3].text, CF_CONTENT.bestPath, 'bestPath → turnaroundPath')
  assert.strictEqual(harness.data.sections[4].text, CF_CONTENT.thirtyDayActions.join('\n'), 'thirtyDayActions → actionAdvice (join \\n)')
  assert.strictEqual(harness.data._cfMeta.worldModelType, CF_CONTENT.worldModelType, 'worldModelType → worldModelType')
  assert.strictEqual(harness.data._cfMeta.turnaroundProbability, CF_CONTENT.turnaroundProbability, 'turnaroundProbability preserved')
  assert.strictEqual(harness.data._cfMeta.threeYearRisk, CF_CONTENT.threeYearRisk, 'threeYearRisk preserved')
  assert.notStrictEqual(harness.data._cfMeta.worldModelType, 'challenge_final', 'payload.type must NOT be used as worldModelType')
})

test('RESTORE-02: RE-ENTRY — no in-memory data, valid reportId → cloud recovery executes and succeeds', async () => {
  let calls = 0
  seedAiReport(async () => { calls++; return unlockPayload(CF_CONTENT) })
  seedPermission({ granted: true })
  const { harness, error, wx } = loadDetail({ _diagnosticAnswers: null, _diagnosticReport: null })
  assert.ifError(error)

  harness.setData({ reportId: 'AR_TEST_002' })
  await harness._startDiagnostic()
  await sleep(2000)

  assert.strictEqual(calls, 1, 'cloud getAiReport must execute exactly once')
  assert.strictEqual(harness.data.sections.length, 5, 'recovery succeeded')
  assert.strictEqual(harness.data.error, '')
  assert.ok(!wx._calls.some((c) => c.type === 'redirectTo'), 'no redirect on success')
})

test('RESTORE-03: NOT_FOUND — no protected render, safe fallback only, no false success', async () => {
  seedAiReport(async () => ({ code: 10004, message: '报告不存在', data: null }))
  seedPermission({ granted: true })
  const { harness, error } = loadDetail({})
  assert.ifError(error)

  harness.setData({ reportId: 'AR_TEST_003' })
  await harness._startDiagnostic()

  assert.strictEqual(harness.data.sections.length, 0, 'no protected render')
  assert.strictEqual(harness.data.reportVersion, 'v4', 'reportVersion not switched to v3')
  assert.ok(!harness.data._cfMeta, 'no protected meta rendered')
  assert.ok(harness.data.error.includes('诊断数据丢失'), 'safe fallback error shown')
})

test('RESTORE-04: LOCKED — protected full content NOT rendered even if permission would grant', async () => {
  seedAiReport(async () => ({ code: 0, data: { type: 'challenge_final', locked: true, summary: {}, preview: '完整报告需解锁' } }))
  seedPermission({ granted: true }) // would grant, but locked must block
  const { harness, error } = loadDetail({})
  assert.ifError(error)

  harness.setData({ reportId: 'AR_TEST_004' })
  await harness._startDiagnostic()

  assert.strictEqual(harness.data.sections.length, 0, 'locked payload must not render full content')
  assert.ok(!harness.data._cfMeta, 'no protected meta rendered')
})

test('RESTORE-05: FULL_REPORT denied + error/unknown → fail closed, no protected render', async () => {
  // denied
  seedAiReport(async () => unlockPayload(CF_CONTENT))
  seedPermission({ granted: false })
  let loaded = loadDetail({})
  assert.ifError(loaded.error)
  loaded.harness.setData({ reportId: 'AR_TEST_005A' })
  await loaded.harness._startDiagnostic()
  assert.strictEqual(loaded.harness.data.sections.length, 0, 'denied must not render protected content')
  assert.ok(loaded.harness.data.error.includes('诊断数据丢失'), 'denied → fail closed → safe fallback')

  // error/unknown (permission throws)
  seedPermission({ throws: true })
  loaded = loadDetail({})
  assert.ifError(loaded.error)
  loaded.harness.setData({ reportId: 'AR_TEST_005B' })
  await loaded.harness._startDiagnostic()
  assert.strictEqual(loaded.harness.data.sections.length, 0, 'permission throw must fail closed')
})

test('RESTORE-06: MISSING reportId — existing safe fallback preserved, no invented recovery source', async () => {
  let aiCalled = false
  seedAiReport(async () => { aiCalled = true; return unlockPayload(CF_CONTENT) })
  seedPermission({ granted: true })
  const { harness, error, wx } = loadDetail({})
  assert.ifError(error)

  harness.setData({ reportId: '' }) // no reportId, no L1/L2
  await harness._startDiagnostic()
  await sleep(1600) // fallback redirect is scheduled at 1500ms

  assert.strictEqual(aiCalled, false, 'no invented recovery source — getAiReport not called')
  assert.ok(harness.data.error.includes('诊断数据丢失'))
  assert.ok(wx._calls.some((c) => c.type === 'redirectTo' && c.url.includes('challenge-play?mode=diagnostic')), 'safe fallback redirect preserved')
})

test('RESTORE-07: ID PROVENANCE — report-preview navigation uses business reportId, never _id/recordId', async () => {
  seedPermission({ granted: true })
  seedAiReport(async () => ({ code: 0, data: {} }))
  const { wx } = buildGuardedWx({})
  const { harness, error } = loadPage('report-preview', wx, { globalData: { isVip: false } })
  assert.ifError(error)

  harness.setData({ recordId: 'CR_WRONG_007', report: { _id: 'rep_wrong_007', reportId: 'AR_TEST_007' } })
  const r = await harness.goFull()
  assert.strictEqual(r, true)

  const nav = wx._calls.filter((c) => c.type === 'navigateTo' && c.url.includes('report-detail'))
  assert.strictEqual(nav.length, 1)
  assert.ok(nav[0].url.includes('reportId=AR_TEST_007'), 'must navigate with business reportId')
  assert.ok(!nav[0].url.includes('CR_WRONG_007'), 'recordId fallback must NOT control navigation')
  assert.ok(!nav[0].url.includes('rep_wrong_007'), '_id fallback must NOT control navigation')

  // Absent business reportId → fail safely, no navigation with a wrong identifier.
  const { wx: wx2 } = buildGuardedWx({})
  const l2 = loadPage('report-preview', wx2, { globalData: { isVip: false } })
  assert.ifError(l2.error)
  l2.harness.setData({ recordId: 'CR_WRONG_007', report: { _id: 'rep_wrong_007' } }) // no reportId
  const r2 = await l2.harness.goFull()
  assert.strictEqual(r2, false, 'missing reportId must fail safely')
  assert.ok(!wx2._calls.some((c) => c.type === 'navigateTo'), 'no navigation on missing reportId')
})

test('RESTORE-08: ASYNC ORDER — no redirect/timer preempts pending recovery; authority checked after payload', async () => {
  let resolveGet = null
  let permCalls = 0
  seedAiReport(() => new Promise((res) => { resolveGet = res }))
  seedModule(svcPath('permissionService.js'), {
    checkPermission: async () => { permCalls++; return { granted: true, needPay: false } },
  })
  const { harness, error, wx } = loadDetail({})
  assert.ifError(error)

  harness.setData({ reportId: 'AR_TEST_008' })
  const p = harness._startDiagnostic() // do NOT await yet — recovery is pending

  await sleep(30) // let it reach the awaited getAiReport

  assert.strictEqual(harness.data.error, '', 'no premature data-missing error while recovery pending')
  assert.ok(!wx._calls.some((c) => c.type === 'redirectTo'), 'no premature redirect while recovery pending')
  assert.strictEqual(permCalls, 0, 'authority must NOT be checked before recovery payload exists')

  resolveGet(unlockPayload(CF_CONTENT))
  await p
  await sleep(2000) // reveal delays

  assert.strictEqual(permCalls, 1, 'authority checked after recovery payload resolved')
  assert.strictEqual(harness.data.sections.length, 5, 'final success decided after await')
  assert.ok(!wx._calls.some((c) => c.type === 'redirectTo' && c.url.includes('challenge-play')), 'no preemption by redirect/timer')
})

// Guard sanity: no live AI call, no real DB mutation, no PRIMARY/BATCH/GATE-B.
test('R2-REPORT-RESTORE: guard counters are clean', () => {
  const g = getGuards()
  assert.strictEqual(g.liveAiCallCount, 0, 'LIVE_AI_CALL_COUNT must be 0')
  assert.strictEqual(g.realDbMutationCount, 0, 'REAL_DB_MUTATION_COUNT must be 0')
  assert.strictEqual(g.primaryActivated, false)
  assert.strictEqual(g.batch2RuntimeUsed, false)
  assert.strictEqual(g.batch3RuntimeUsed, false)
  assert.strictEqual(g.gateBStateChanged, false)
})
