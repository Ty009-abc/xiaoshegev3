'use strict'
/**
 * tests/v6/draft/rc8.4-v6-r12-wiring.test.js
 *
 * R12 — DRAFT_EDITOR_SHADOW_WIRING_PREP offline regression.
 * NO network, NO provider, NO key. Uses stubs + module spies.
 *
 * Required named checks (§9):
 *   V6_WORLDVIEW_MODEL_OVERRIDE_USED
 *   V6_DEFAULT_MODEL_IS_DEEPSEEK_FLASH
 *   AI_MODEL_PRO_NOT_USED_FOR_V6_DEFAULT
 *   DRAFT_MAX_TOKENS_IS_2400
 *   CARD01_SENTENCE_BOUNDARY_PREFERRED
 *   CARD01_NO_HALF_SENTENCE_REGRESSION
 *   CARD03_ZERO_AI_CONTRIBUTION
 *   ACTION_TYPE_AUTHORITY_PRESERVED
 *   FIELD_LEVEL_FALLBACK_WORKS
 *   WHOLE_REPORT_FALLBACK_WORKS
 *   PRIMARY_RESPONSE_UNCHANGED_IN_SHADOW
 *   NON_ALLOWLIST_ZERO_V6_CALL
 *   INVALID_INPUT_ZERO_MODEL_CALL
 *   NO_PRIMARY_ZERO_MODEL_CALL
 *   MODEL_FAILURE_PRIMARY_REQUEST_SURVIVES
 */

const assert = require('assert')
const path = require('path')
const Module = require('module')

const ROOT = path.resolve(__dirname, '../../..')
const CF = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6')
const INDEX_PATH = path.join(ROOT, 'cloudfunctions/generateAiReport/index.js')

const { diagnoseTurnaroundV6 } = require(path.join(CF, 'index.js'))
const { buildReportV6 } = require(path.join(CF, 'report/index.js'))
const editor = require(path.join(CF, 'experimental/draft/reportEditorV6.js'))
const { editReportV6, compressCard01 } = editor
const { validateDraftV6 } = require(path.join(CF, 'experimental/draft/draftValidatorV6.js'))
const { validateFinalV6 } = require(path.join(CF, 'experimental/draft/finalValidatorV6.js'))
const modelCfg = require(path.join(ROOT, 'cloudfunctions/generateAiReport/lib/config/worldviewV6Model.js'))
const F = require(path.join(ROOT, 'tests/v6/fixtures.js'))

let pass = 0, fail = 0
function t (name, fn) { try { fn(); pass++; console.log('  ok  ' + name) } catch (e) { fail++; console.log('  FAIL ' + name + ' :: ' + e.message) } }
async function ta (name, fn) { try { await fn(); pass++; console.log('  ok  ' + name) } catch (e) { fail++; console.log('  FAIL ' + name + ' :: ' + e.message) } }

const G06 = F.GOLDEN.find((g) => g.id === 'G06').answers
const G12 = F.GOLDEN.find((g) => g.id === 'G12').answers
const G14 = F.GOLDEN.find((g) => g.id === 'G14').answers
const G15 = F.GOLDEN.find((g) => g.id === 'G15').answers
const ADV_A = F.ADVERSARIAL.find((x) => x.id === 'A').answers

const GOOD = {
  draftVersion: 'turnaround_strategy_v6_worldview_draft_v1',
  insightCandidates: [
    '你以为缺的是资源，其实你缺的是一次真正开始；学过的东西一直没变成第一个真实结果。',
    '你以为问题是没钱，其实是你把准备当成了安全感，从没让市场给过你一次反馈。'
  ],
  mechanismExplanation: '你把学习当成前进，但它不产生外部反馈；越不确定就越想先想清楚，结果真实结果永远是零，压力却在累积。',
  transitionExplanation: '下一阶段的规则不是想清楚再动，而是先做一个零成本、失败也不伤现金流的最小验证。',
  actionExplanation: '所以今天该做的，是不花钱、能立刻拿到外部反馈的那一个最小动作。'
}

console.log('R12 draft/editor shadow wiring tests')

// ── §2 model config ─────────────────────────────────────────────
t('V6_DEFAULT_MODEL_IS_DEEPSEEK_FLASH', () => {
  assert.strictEqual(modelCfg.V6_DEFAULT_MODEL, 'deepseek-flash')
  assert.strictEqual(modelCfg.parseV6WorldviewModel(undefined), 'deepseek-flash')
  assert.strictEqual(modelCfg.parseV6WorldviewModel(''), 'deepseek-flash')
  assert.strictEqual(modelCfg.parseV6WorldviewModel('   '), 'deepseek-flash')
})
t('V6_WORLDVIEW_MODEL_OVERRIDE_USED', () => {
  assert.strictEqual(modelCfg.parseV6WorldviewModel('some-json-model'), 'some-json-model')
  const prev = process.env.RC84_V6_WORLDVIEW_MODEL
  process.env.RC84_V6_WORLDVIEW_MODEL = 'override-tag'
  try {
    assert.strictEqual(modelCfg.getV6WorldviewModelFromEnv(), 'override-tag')
  } finally {
    if (prev === undefined) delete process.env.RC84_V6_WORLDVIEW_MODEL; else process.env.RC84_V6_WORLDVIEW_MODEL = prev
  }
})
t('AI_MODEL_PRO_NOT_USED_FOR_V6_DEFAULT', () => {
  const prevFlash = process.env.AI_MODEL_FLASH
  const prevPro = process.env.AI_MODEL_PRO
  process.env.AI_MODEL_FLASH = 'deepseek-v4-pro'
  process.env.AI_MODEL_PRO = 'deepseek-v4-pro'
  try {
    delete process.env.RC84_V6_WORLDVIEW_MODEL
    assert.strictEqual(modelCfg.getV6WorldviewModelFromEnv(), 'deepseek-flash',
      'AI_MODEL_PRO=deepseek-v4-pro must NOT become the V6 default')
  } finally {
    if (prevFlash === undefined) delete process.env.AI_MODEL_FLASH; else process.env.AI_MODEL_FLASH = prevFlash
    if (prevPro === undefined) delete process.env.AI_MODEL_PRO; else process.env.AI_MODEL_PRO = prevPro
  }
})

// ── §3 draft budget ─────────────────────────────────────────────
t('DRAFT_MAX_TOKENS_IS_2400', () => {
  const rt = require(path.join(CF, 'experimental/draft/draftReportRuntimeV6.js'))
  assert.strictEqual(rt.DRAFT_MAX_TOKENS, 2400)
  assert.strictEqual(rt.MODEL_ATTEMPT_TIMEOUT_MS, 14000)
  assert.strictEqual(rt.TOTAL_WORLDVIEW_BUDGET_MS, 30000)
})

// ── §1 card01 sentence-boundary ─────────────────────────────────
t('CARD01_SENTENCE_BOUNDARY_PREFERRED', () => {
  // Two sentences where only the FIRST fits <=60 → keep the whole first sentence,
  // do not cut mid-clause.
  const s1 = '你以为缺的是资源，其实你缺的是一次外部反馈。'
  const s2 = '可是你一直在准备，从来没有真正让市场给过你任何一次真实回应并且一直等待更充分的时机。'
  const out = compressCard01(s1 + s2, 60)
  assert.ok([...out].length <= 60, 'output must be <= 60')
  assert.ok(out.endsWith('。'), 'must end on a complete sentence: ' + out)
  assert.strictEqual(out, s1)
})
t('CARD01_NO_HALF_SENTENCE_REGRESSION', () => {
  // Every fixture's best insight candidate, compressed, must not end on a
  // dangling connective or a comma.
  let half = 0
  const cases = []
  for (const g of F.GOLDEN) {
    const d = diagnoseTurnaroundV6(g.answers)
    const b = buildReportV6(d)
    // Use the B2 fatalInsight as a stand-in "already long" candidate + a synthetic long one.
    cases.push(b.cards.fatalInsight.text)
    cases.push('你以为' + b.cards.coreProblem.text)
  }
  for (const c of cases) {
    const out = compressCard01(c, 60)
    if (/[，,、；;：:——]$/.test(out) || /(而|只有|其实|因为|所以|于是)$/.test(out)) half++
    if ([...out].length > 60) half++
  }
  assert.strictEqual(half, 0, 'CARD01_HALF_SENTENCE_CASE_COUNT must be 0, got ' + half)
})

// ── §6 action authority + §7 card03 authority ──────────────────
t('CARD03_ZERO_AI_CONTRIBUTION + ACTION_TYPE_AUTHORITY_PRESERVED', () => {
  const d = diagnoseTurnaroundV6(G06)
  const b = buildReportV6(d)
  const dv = validateDraftV6(GOOD, d)
  const ed = editReportV6({ diagnosis: d, b2Report: b, draft: GOOD, draftVerdict: dv })
  // CARD03 identical to B2
  assert.deepStrictEqual(ed.cards.systemLoop.steps, b.cards.systemLoop.steps, 'CARD03 == deterministic B2')
  // CARD05 anchored to frozen firstActionType copy
  assert.strictEqual(ed.cards.firstAction.action, b.cards.firstAction.action, 'CARD05 action == B2 authority')
  assert.strictEqual(ed.editor.aiCallCount, 0, 'EDITOR_AI_CALL_COUNT=0')
  // Even a hostile AI actionExplanation cannot replace the frozen action.
  const hostile = Object.assign({}, GOOD, { actionExplanation: '你应该马上去借一笔钱全力投入推广。' })
  const dv2 = validateDraftV6(hostile, d)
  const ed2 = editReportV6({ diagnosis: d, b2Report: b, draft: hostile, draftVerdict: dv2 })
  assert.strictEqual(ed2.cards.firstAction.action, b.cards.firstAction.action, 'hostile AI cannot redefine the action')
})

// ── §5 fallback ─────────────────────────────────────────────────
t('FIELD_LEVEL_FALLBACK_WORKS', () => {
  const d = diagnoseTurnaroundV6(G06)
  const b = buildReportV6(d)
  const draft = Object.assign({}, GOOD, {
    mechanismExplanation: 'DIAGNOSIS says ACTION_GAP and you are in LEARNING stage.' // ontology leak
  })
  const dv = validateDraftV6(draft, d)
  assert.strictEqual(dv.valid, false, 'draft is semantically unsafe')
  const ed = editReportV6({ diagnosis: d, b2Report: b, draft, draftVerdict: dv })
  assert.ok(ed.editor.fieldsFellBack.includes('mechanismExplanation'), 'unsafe field fell back')
  assert.strictEqual(ed.cards.coreProblem.text, b.cards.coreProblem.text, 'CARD02 == B2 for the unsafe field')
  // other fields still AI
  assert.ok(ed.editor.fieldsUsed.includes('insightCandidates'), 'safe fields still used')
  const fv = validateFinalV6(ed, d)
  assert.strictEqual(fv.valid, true, 'field-level fallback yields a valid final report')
})
t('WHOLE_REPORT_FALLBACK_WORKS', () => {
  const d = diagnoseTurnaroundV6(G06)
  const b = buildReportV6(d)
  // Editor requires a B2 report; whole-report fallback is the runtime's job when
  // the draft is unusable. Prove the deterministic B2 report is always a valid,
  // fully-shaped shippable fallback.
  const wf = {
    reportVersion: b.reportVersion, reportState: b.reportState, cards: b.cards, provenance: b.provenance
  }
  const fv = validateFinalV6(wf, d)
  assert.strictEqual(fv.valid, true, 'deterministic B2 is a valid whole-report fallback')
  assert.strictEqual(wf.cards.systemLoop.steps.length, 5, 'B2 fallback has 5 loop steps')
})

// ── §4/§5 SHADOW integration via index.main (stubbed provider) ──
// Build a fresh module registry with wx-server-sdk + ai.js stubbed.
let __aiCalls = []
let __aiQueue = []
let __aiMode = 'queue'
let __openid = 'u1'
let __runtimeOut = null

const mockDb = {
  command: {},
  collection: (name) => ({
    where () { return this }, orderBy () { return this }, limit () { return this },
    get: async () => {
      if (name === 'users') return { data: [{ openid: __openid }] }
      if (name === 'user_profiles') return { data: [{ openid: __openid }] }
      return { data: [] }
    },
    add: async () => ({ _id: 'mock' }),
    doc: () => ({ get: async () => ({ data: null }), set: async () => {}, update: async () => {} })
  })
}
const mockSdk = { DYNAMIC_CURRENT_ENV: 'mock', init () {}, getWXContext: () => ({ OPENID: __openid }), database: () => mockDb }
const aiMock = {
  callAI: async (opts) => {
    __aiCalls.push(opts)
    if (__aiMode === 'fail') return { success: false, error: 'HTTP 503' }
    return __aiQueue.shift() || { success: false, error: 'EMPTY_QUEUE' }
  },
  buildReportPrompt: () => ({ systemPrompt: '', userMessage: '' }),
  buildCoachingPrompt: () => ({ systemPrompt: '', userMessage: '', personality: null }),
  buildDiagnosticPrompt: () => ({ systemPrompt: '', userMessage: '', personality: null, engineResult: { normalizedProfile: {}, constraintAnalysis: {}, allowedPaths: [], forbiddenPaths: [] } })
}
const origLoad = Module._load
Module._load = function (request) {
  if (request === 'wx-server-sdk') return mockSdk
  if (/(^|\/)ai\.js$/.test(request)) return aiMock
  if (/draftReportRuntimeV6(\.js)?$/.test(request)) {
    const real = origLoad.apply(this, arguments)
    return Object.assign({}, real, {
      runDraftReportRuntimeV6: async (a, o) => { const out = await real.runDraftReportRuntimeV6(a, o); __runtimeOut = out; return out }
    })
  }
  return origLoad.apply(this, arguments)
}

function aiContent (ok) {
  return { success: true, tokens: 10, finishReason: 'stop', content: ok ? JSON.stringify(GOOD) : 'not json {{{' }
}
let indexRef = null
async function call (answers, mode, openid, allowlist) {
  if (mode === undefined) delete process.env.RC84_V6_WORLDVIEW_MODE; else process.env.RC84_V6_WORLDVIEW_MODE = mode
  if (allowlist === undefined) delete process.env.RC84_V6_SHADOW_ALLOWLIST; else process.env.RC84_V6_SHADOW_ALLOWLIST = allowlist
  __openid = openid || 'u1'; __aiCalls = []
  return indexRef.main({ type: 'diagnostic', diagnosticVersion: 'turnaround_strategy_v6', answers }, {})
}

async function main () {
  // Purge any modules loaded before the ai.js/wx-server-sdk stub was installed,
  // so the draft adapter captures the mocked callAI (not the real provider).
  for (const k of Object.keys(require.cache)) {
    if (/generateAiReport\/(index\.js|lib\/ai\.js)$/.test(k) || /draftAdapterV6\.js$/.test(k) || /draftReportRuntimeV6\.js$/.test(k)) {
      delete require.cache[k]
    }
  }
  indexRef = require(INDEX_PATH)
  const OFF_RESP = await indexRef.main({ type: 'diagnostic', diagnosticVersion: 'turnaround_strategy_v6', answers: G06 }, {})

  await ta('PRIMARY_RESPONSE_UNCHANGED_IN_SHADOW', async () => {
    __aiQueue = [aiContent(true)]
    const r = await call(G06, 'SHADOW', 'u1', 'u1,u2')
    assert.strictEqual(JSON.stringify(r), JSON.stringify(OFF_RESP), 'SHADOW response byte-identical to OFF')
    assert.strictEqual(__aiCalls.length, 1, 'V6 did run on the side path')
    assert.strictEqual(__runtimeOut.meta.renderSource, 'ai_draft_edited')
  })
  await ta('NON_ALLOWLIST_ZERO_V6_CALL', async () => {
    __aiQueue = [aiContent(true)]
    const r = await call(G06, 'SHADOW', 'intruder', 'u1,u2')
    assert.strictEqual(__aiCalls.length, 0, 'non-allowlisted → zero V6 calls')
    assert.strictEqual(JSON.stringify(r), JSON.stringify(OFF_RESP))
  })
  await ta('INVALID_INPUT_ZERO_MODEL_CALL', async () => {
    __aiQueue = [aiContent(true)]
    const r = await call({}, 'SHADOW', 'u1', 'u1,u2')
    assert.strictEqual(__aiCalls.length, 0, 'invalid input → zero model calls')
    assert.strictEqual(__runtimeOut.meta.fallbackReason, 'INVALID_INPUT')
    assert.strictEqual(JSON.stringify(r), JSON.stringify(OFF_RESP))
  })
  await ta('NO_PRIMARY_ZERO_MODEL_CALL', async () => {
    __aiQueue = [aiContent(true)]
    const r = await call(ADV_A, 'SHADOW', 'u1', 'u1,u2')
    assert.strictEqual(__aiCalls.length, 0, 'no primary → zero model calls')
    assert.strictEqual(__runtimeOut.meta.fallbackReason, 'NO_PRIMARY')
    assert.strictEqual(JSON.stringify(r), JSON.stringify(OFF_RESP))
  })
  await ta('MODEL_FAILURE_PRIMARY_REQUEST_SURVIVES', async () => {
    __aiMode = 'fail'
    const r = await call(G06, 'SHADOW', 'u1', 'u1,u2')
    __aiMode = 'queue'
    assert.strictEqual(r.code, 0, 'request still succeeds (code 0)')
    assert.strictEqual(__runtimeOut.meta.renderSource, 'deterministic_fallback', 'model failure → deterministic fallback')
    assert.strictEqual(JSON.stringify(r), JSON.stringify(OFF_RESP), 'response unchanged')
  })

  Module._load = origLoad

  console.log(`\nR12 wiring: ${pass} passed, ${fail} failed`)
  if (fail) process.exitCode = 1
}

main().catch((e) => { console.error('R12 wiring harness error:', e); process.exitCode = 1 })
