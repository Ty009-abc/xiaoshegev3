'use strict'
/**
 * tests/v6/client/rc8.4-v6-r29-client-cutover.test.js
 *
 * R29 §17/§18 — production client 9Q cutover tests + local E2E contract test.
 * NO network. Loads the REAL client page JS + utils via a tiny Page/getApp/wx shim.
 *
 * Covers:
 *   HOME_CTA_V6_ROUTE · V6_EXACT_9_QUESTIONS · V6_PROGRESS_1_TO_9
 *   NEXT_BLOCKED_WITHOUT_ANSWER · PREVIOUS_ANSWER_PRESERVED · Q1_TO_Q9_MAPPING
 *   SUBMIT_DIAGNOSTIC_VERSION_V6 · NO_V21_PAYLOAD · PRIMARY_RESPONSE_TO_5_CARDS
 *   NO_PRIMARY_SAFE_RENDER · INVALID_INPUT_SAFE_RENDER · NO_LEGACY_ROUTE_LEAK
 *   + E2E_9Q_FLOW (HOME → 9Q → submit → payload → five-card report)
 */

const path = require('path')
const assert = require('assert')
const h = require('../_harness.js')

const ROOT = path.resolve(__dirname, '../../..')
const Q = require(path.join(ROOT, 'utils/v6/turnaroundQuestionnaireV6.js'))
const VM = require(path.join(ROOT, 'utils/v6/turnaroundReportViewModelV6.js'))
const BACKEND_CONTRACT = require(path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6/questionnaireContractV6.js'))

// ── tiny client runtime shim ──────────────────────────────────────────────
function makeWx () {
  const calls = []
  const store = {}
  const wx = {
    _calls: calls,
    _store: store,
    showToast: (o) => { calls.push({ type: 'showToast', title: o && o.title }) },
    navigateTo: (o) => { calls.push({ type: 'navigateTo', url: o.url }) },
    redirectTo: (o) => { calls.push({ type: 'redirectTo', url: o.url }) },
    navigateBack: (o) => { calls.push({ type: 'navigateBack', delta: (o && o.delta) || 1 }) },
    switchTab: (o) => { calls.push({ type: 'switchTab', url: o.url }) },
    getWindowInfo: () => ({ statusBarHeight: 44 }),
    getSystemInfoSync: () => ({ statusBarHeight: 44 }),
    getMenuButtonBoundingClientRect: () => ({ top: 48, height: 32 }),
    setStorageSync: (k, v) => { store[k] = v },
    getStorageSync: (k) => store[k],
    cloud: {
      database: () => ({
        collection: () => ({
          add: async () => ({ _id: 'mock' }),
          doc: () => ({ get: async () => ({ data: null }), set: async () => {}, update: async () => {} }),
          where: () => ({ orderBy: () => ({ limit: () => ({ get: async () => ({ data: [] }) }) }), limit: () => ({ get: async () => ({ data: [] }) }) }),
          orderBy: () => ({ limit: () => ({ get: async () => ({ data: [] }) }) }),
          limit: () => ({ get: async () => ({ data: [] }) }),
        }),
      }),
      callFunction: async (req) => (wx._callFunctionImpl ? wx._callFunctionImpl(req) : { result: null }),
    },
  }
  return wx
}

function loadClientModule (relPath, app, wx) {
  const abs = path.join(ROOT, relPath)
  let captured = null
  global.getApp = () => app
  global.Page = (cfg) => { captured = cfg }
  global.wx = wx
  delete require.cache[require.resolve(abs)]
  require(abs)
  return captured
}

function instantiate (cfg, app) {
  const inst = Object.assign({}, cfg)
  inst.data = JSON.parse(JSON.stringify(cfg.data || {}))
  inst.setData = function (patch) { Object.assign(this.data, patch) }
  // bind methods to instance
  for (const k of Object.keys(cfg)) {
    if (typeof cfg[k] === 'function') inst[k] = cfg[k].bind(inst)
  }
  inst.__app = app
  return inst
}

function answerAll (page, qids) {
  // Deterministically pick the FIRST option of each question and step through.
  const qs = page.data.questions
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i]
    const optId = (qids && qids[q.qid]) || q.options[0].optionId
    page.selectOption({ currentTarget: { dataset: { optionId: optId } } })
    if (i < qs.length - 1) page.goNext()
  }
}

async function main () {
// ── SECTION 1: client↔backend contract ───────────────────────────────────
h.section('CLIENT ↔ BACKEND CONTRACT')
{
  h.eq(Q.QUESTION_COUNT_V6, 9, 'client question count = 9')
  h.eq(Q.V6_QUESTIONS.length, 9, 'client questions.length = 9')
  h.eq(BACKEND_CONTRACT.QUESTIONS.length, 9, 'backend question count = 9')

  const norm = (s) => String(s).replace(/\s+/g, '').replace(/·/g, '/').replace(/[–—]/g, '-')
  let mismatches = 0
  let optionChecks = 0
  for (const bq of BACKEND_CONTRACT.QUESTIONS) {
    const cq = Q.V6_QUESTIONS.find((x) => x.qid === bq.id)
    if (!cq || cq.key !== bq.key) { mismatches++; continue }
    for (const [oid, txt] of bq.options) {
      optionChecks++
      const co = cq.options.find((o) => o.optionId === oid)
      if (!co || norm(co.text) !== norm(txt)) mismatches++
    }
  }
  h.eq(optionChecks, 54, 'total option checks (5+6+5+8+10+7+4+4+5)')
  h.eq(mismatches, 0, 'zero client/backend id or text mismatches (100% match)')
  h.eq(Q.REQUIRED_QIDS.join(','), 'Q1,Q2,Q3,Q4,Q5,Q6,Q7,Q8,Q9', 'canonical qid order')
  h.eq(Q.V6_QUESTIONS.map((q) => q.key).join(','),
    'AGE_STAGE,INCOME_MODE,MONTHLY_SURPLUS,PRIMARY_PROBLEM,USER_BELIEF,EXECUTION_STAGE,UNCERTAINTY_BEHAVIOR,TIME_BEHAVIOR,NO_RESULT_BEHAVIOR',
    'semantic key order matches §3')
}

// ── SECTION 2: HOME CTA cutover ──────────────────────────────────────────
h.section('HOME CTA → V6 HYBRID 10Q')
{
  const app = { globalData: {} }
  const wx = makeWx()
  const home = instantiate(loadClientModule('pages/home/home.js', app, wx), app)
  home.goStrategy()
  const nav = wx._calls.filter((c) => c.type === 'navigateTo')
  // R44 §19: the single primary Home entry now points at the Hybrid 10Q route.
  h.ok(nav.some((c) => c.url === '/pages/turnaround-v6-hybrid-questionnaire/turnaround-v6-hybrid-questionnaire'),
    'HOME_CTA_HYBRID_ROUTE: goStrategy navigates to the Hybrid 10Q questionnaire')
  h.eq(nav.length, 1, 'HOME has exactly ONE primary strategy entry')
  h.ok(!nav.some((c) => c.url === '/pages/turnaround-v6-questionnaire/turnaround-v6-questionnaire'),
    'V6 9Q page is frozen as reference, no longer the primary CTA')
  h.ok(!nav.some((c) => c.url.includes('v21-questionnaire')),
    'HOME no longer navigates to legacy 18Q v21-questionnaire')
  h.ok(!nav.some((c) => c.url.includes('challenge-play?mode=diagnostic')),
    'HOME no longer uses old challenge-play diagnostic')
}

// ── SECTION 3: questionnaire behaviour ───────────────────────────────────
h.section('V6 QUESTIONNAIRE')
{
  const app = { globalData: {} }
  const wx = makeWx()
  const page = instantiate(loadClientModule('pages/turnaround-v6-questionnaire/turnaround-v6-questionnaire.js', app, wx), app)
  page.onLoad()

  h.eq(page.data.totalCount, 9, 'V6_EXACT_9_QUESTIONS: totalCount = questions.length = 9')
  h.eq(page.data.questions.length, 9, 'questions array length = 9')
  h.ok(!page.data.started, 'not started initially')

  page.startSession()
  h.ok(page.data.started, 'started after startSession')
  h.eq(page.data.currentIndex, 0, 'starts at Q1')
  h.eq(page.data.progressPercent, Math.round((1 / 9) * 100), 'V6_PROGRESS_1_TO_9: progress at Q1 = 11%')

  // NEXT_BLOCKED_WITHOUT_ANSWER
  page.goNext()
  h.eq(page.data.currentIndex, 0, 'NEXT_BLOCKED_WITHOUT_ANSWER: cannot advance with no selection')
  h.ok(wx._calls.some((c) => c.type === 'showToast'), 'blocked advance shows a toast')

  // answer Q1, advance
  const q1 = page.data.questions[0]
  page.selectOption({ currentTarget: { dataset: { optionId: q1.options[1].optionId } } })
  h.eq(page.data.selectedOptionId, q1.options[1].optionId, 'selection recorded + highlighted')
  page.goNext()
  h.eq(page.data.currentIndex, 1, 'advanced to Q2')
  h.eq(page.data.progressPercent, Math.round((2 / 9) * 100), 'progress at Q2 = 22%')

  // answer Q2, then go back → PREVIOUS_ANSWER_PRESERVED
  const q2 = page.data.questions[1]
  page.selectOption({ currentTarget: { dataset: { optionId: q2.options[0].optionId } } })
  page.goBack()
  h.eq(page.data.currentIndex, 0, 'goBack → Q1')
  h.eq(page.data.selectedOptionId, q1.options[1].optionId, 'PREVIOUS_ANSWER_PRESERVED: Q1 selection restored')
  page.goNext()
  h.eq(page.data.selectedOptionId, q2.options[0].optionId, 'Q2 selection restored on forward')

  // disable goBack guard at first question
  page.goBack(); page.goBack()
  h.eq(page.data.currentIndex, 0, 'goBack guard: stays at Q1 at boundary')
}

// ── SECTION 4: submit payload ────────────────────────────────────────────
h.section('SUBMIT PAYLOAD')
{
  const app = { globalData: {} }
  const wx = makeWx()
  let capturedReq = null
  wx._callFunctionImpl = async (req) => {
    capturedReq = req
    return {
      result: {
        code: 0, message: 'success',
        data: {
          reportType: 'turnaround_strategy_v6', diagnosticVersion: 'turnaround_strategy_v6',
          v6PrimaryActive: true, reportVersion: 'v6-report/1', reportState: 'PRIMARY',
          cards: {
            fatalInsight: { title: '致命一句话', text: 'A', provenance: { x: 1 } },
            coreProblem: { title: '核心问题', text: 'B' },
            systemLoop: { title: '系统困局', steps: ['s1', 's2'], text: 'C' },
            turnaroundPath: { title: '翻身路径', from: 'now', to: 'next', text: 'D' },
            firstAction: { title: '现在就做', action: 'do1', checks: ['c1'], text: 'E' },
          },
        },
      },
    }
  }
  const page = instantiate(loadClientModule('pages/turnaround-v6-questionnaire/turnaround-v6-questionnaire.js', app, wx), app)
  page.onLoad()
  page.startSession()
  answerAll(page, null) // first option of every question

  await page.submit()
  h.ok(capturedReq, 'cloud function was called on submit')
  h.eq(capturedReq.name, 'generateAiReport', 'calls generateAiReport')
  h.eq(capturedReq.data.type, 'diagnostic', 'type = diagnostic')
  h.eq(capturedReq.data.diagnosticVersion, 'turnaround_strategy_v6', 'SUBMIT_DIAGNOSTIC_VERSION_V6')
  h.ok(!('previewMode' in capturedReq.data), 'NO previewMode (not a V2.1 TEST_PREVIEW request)')
  h.ok(!JSON.stringify(capturedReq).includes('world_model_v2_1'), 'NO_V21_PAYLOAD: no world_model_v2_1')
  h.eq(Object.keys(capturedReq.data.answers).filter((k) => /^Q\d$/.test(k)).length, 9, 'payload has exactly Q1..Q9')
  h.ok(app.globalData.turnaroundV6Result, 'result stored on app.globalData for report page')
  h.ok(wx._calls.some((c) => c.type === 'redirectTo' && c.url === '/pages/turnaround-v6-report/turnaround-v6-report'),
    'redirects to V6 five-card report page')
}

// ── SECTION 5: report view model ─────────────────────────────────────────
h.section('REPORT VIEW MODEL')
{
  const primary = { code: 0, data: { reportType: 'turnaround_strategy_v6', diagnosticVersion: 'turnaround_strategy_v6', v6PrimaryActive: true, reportState: 'PRIMARY', reportVersion: 'v6-report/1', cards: {
    fatalInsight: { title: '致命一句话', text: 'A', provenance: { secret: 1 } },
    coreProblem: { title: '核心问题', text: 'B' },
    systemLoop: { title: '系统困局', steps: ['s1', 's2'], text: 'C' },
    turnaroundPath: { title: '翻身路径', from: 'now', to: 'next', text: 'D' },
    firstAction: { title: '现在就做', action: 'do1', checks: ['c1'], text: 'E' },
  } } }
  const vm = VM.buildTurnaroundReportViewModelV6(primary)
  h.eq(vm.uiState, 'PRIMARY', 'PRIMARY uiState')
  h.eq(vm.cards.length, 5, 'PRIMARY_RESPONSE_TO_5_CARDS: 5 cards')
  h.eq(vm.cards.map((c) => c.key).join(','), 'fatalInsight,coreProblem,systemLoop,turnaroundPath,firstAction', 'card order 01→05')
  h.eq(vm.cards.map((c) => c.title).join(','), '致命一句话,核心问题,系统困局,翻身路径,现在就做', 'five-card titles')
  h.ok(vm.cards.every((c) => !('provenance' in c)), 'no provenance leaks into view model')
  h.ok(!JSON.stringify(vm).includes('secret'), 'no raw metadata value leaks')

  const noPrimary = { code: 0, data: { v6PrimaryActive: true, reportState: 'NO_PRIMARY', cards: {
    fatalInsight: { title: '先说结论', text: 'lead' },
    coreProblem: { title: '现在的情况', text: 'x' },
    systemLoop: { title: '为什么还没定论', steps: ['a'], text: 'y' },
    turnaroundPath: { title: '往哪走', from: 'f', to: 't', text: 'z' },
    firstAction: { title: '现在就做', action: 'act', checks: [], text: 'w' },
  } } }
  const vmN = VM.buildTurnaroundReportViewModelV6(noPrimary)
  h.eq(vmN.uiState, 'NO_PRIMARY', 'NO_PRIMARY uiState')
  h.eq(vmN.cards.length, 5, 'NO_PRIMARY_SAFE_RENDER: still 5 safe cards')
  h.ok(vmN.hasReport, 'NO_PRIMARY renders a report (no crash)')

  const invalid = { code: 0, data: { v6PrimaryActive: false, reportState: 'INVALID_INPUT', cards: null } }
  const vmI = VM.buildTurnaroundReportViewModelV6(invalid)
  h.eq(vmI.uiState, 'INVALID_INPUT', 'INVALID_INPUT uiState')
  h.eq(vmI.hasReport, false, 'INVALID_INPUT_SAFE_RENDER: no cards')
  h.eq(vmI.cards.length, 0, 'INVALID_INPUT → 0 cards')
  h.ok(vmI.message && !/stack|undefined|error code/i.test(vmI.message), 'INVALID_INPUT message is human-readable')

  const unavailable = { code: 0, data: { reportType: 'turnaround_strategy_v6', diagnosticVersion: 'turnaround_strategy_v6', v6PrimaryActive: false, message: 'turnaround_strategy_v6 当前未开放为主诊断' } }
  const vmU = VM.buildTurnaroundReportViewModelV6(unavailable)
  h.eq(vmU.uiState, 'UNAVAILABLE', 'v6PrimaryActive=false → UNAVAILABLE (no crash)')
  h.eq(vmU.hasReport, false, 'UNAVAILABLE renders no cards')
  h.ok(!JSON.stringify(vmU).includes('turnaround_strategy_v6'), 'no internal reportType token leaks to view model')

  const bad = VM.buildTurnaroundReportViewModelV6(null)
  h.eq(bad.uiState, 'ERROR', 'null result → ERROR state')
  h.ok(!/undefined/.test(bad.message), 'error message is clean')
}

// ── SECTION 6: report page + no legacy leak + E2E ────────────────────────
h.section('REPORT PAGE + E2E 9Q FLOW')
{
  const app = { globalData: {} }
  const wx = makeWx()
  const report = instantiate(loadClientModule('pages/turnaround-v6-report/turnaround-v6-report.js', app, wx), app)

  // E2E: home → questionnaire → answer 9 → submit → report
  const home = instantiate(loadClientModule('pages/home/home.js', app, wx), app)
  home.goStrategy()
  const navUrl = wx._calls.filter((c) => c.type === 'navigateTo').pop().url
  h.eq(navUrl, '/pages/turnaround-v6-hybrid-questionnaire/turnaround-v6-hybrid-questionnaire', 'E2E step 1: HOME → Hybrid 10Q')

  const qpage = instantiate(loadClientModule('pages/turnaround-v6-questionnaire/turnaround-v6-questionnaire.js', app, wx), app)
  qpage.onLoad()
  qpage.startSession()
  answerAll(qpage, null)
  h.eq(Object.keys(qpage.data.answers).length, 9, 'E2E step 2: answered all 9')

  // Feed a mocked authoritative backend response, then load report page.
  app.globalData.turnaroundV6Result = {
    code: 0, message: 'success',
    data: {
      reportType: 'turnaround_strategy_v6', diagnosticVersion: 'turnaround_strategy_v6',
      v6PrimaryActive: true, reportVersion: 'v6-report/1', reportState: 'PRIMARY',
      cards: {
        fatalInsight: { title: '致命一句话', text: 'x' },
        coreProblem: { title: '核心问题', text: 'x' },
        systemLoop: { title: '系统困局', steps: ['a'], text: 'x' },
        turnaroundPath: { title: '翻身路径', from: 'a', to: 'b', text: 'x' },
        firstAction: { title: '现在就做', action: 'a', checks: [], text: 'x' },
      },
    },
  }
  report.onLoad()
  h.eq(report.data.loading, false, 'E2E step 3: report page finished loading')
  h.ok(report.data.hasReport, 'E2E step 4: report rendered')
  h.eq(report.data.cards.length, 5, 'E2E_9Q_FLOW_PASS: five-card report rendered')

  // NO_LEGACY_ROUTE_LEAK: report page never routes to v21 / north-star
  report.onRetake()
  const retake = wx._calls.filter((c) => c.type === 'redirectTo').pop().url
  h.eq(retake, '/pages/turnaround-v6-questionnaire/turnaround-v6-questionnaire', 'retake returns to V6 9Q (no legacy leak)')
  h.ok(!wx._calls.some((c) => (c.url || '').includes('v21-cognitive-report')), 'never routes to v21-cognitive-report')
  h.ok(!wx._calls.some((c) => (c.url || '').includes('v21-questionnaire')), 'V6_TO_LEGACY_ROUTE_LEAK_COUNT = 0')
}


} // end main()

main()
  .then(() => { h.summary('R29 CLIENT CUTOVER') })
  .catch((e) => { console.error('FATAL', (e && e.stack) || e); process.exit(1) })
