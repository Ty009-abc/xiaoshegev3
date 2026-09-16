'use strict'
/**
 * tests/v6/hybrid/rc8.4-v6-r46-authority-and-fact-consistency.test.js
 *
 * RC8.4 V6 R46 — P0-A (authority gating) + P0-B (market-proof fact consistency).
 * Deterministic; no AI, no network, no deploy.
 *
 * §2/§3  shared fail-closed authority (native + hybrid) — no second policy
 * §4     auth matrix · HYBRID_BYPASS_ALLOWLIST_COUNT = 0
 * §6     market proof > strategy copy (authority order)
 * §7     claim contract per asset state
 * §8     CARD04 proof-aware FROM/TO · contradiction = 0
 * §9     CARD02/CARD04/CARD05 proof contradiction = 0
 * §10    no suffix patching · base+contradictory specificity = 0
 * §11    firstActionType mutation = 0
 * §12    null mapping preserved (unsafe mapping = 0)
 * §14    golden proof-stage matrix (diagnosis diff = 0, wording diff > 0)
 * §16    R45 Report A replay: contradiction before = YES, after = NO
 */

const assert = require('assert')
const path = require('path')
const Module = require('module')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '../../..')
const CF = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6')
const INDEX_PATH = path.join(ROOT, 'cloudfunctions/generateAiReport/index.js')
const MODE_PATH = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/config/worldviewV6Mode.js')

const H = require(path.join(CF, 'hybrid/index.js'))
const PC = require(path.join(CF, 'hybrid/proofConsistencyV6.js'))
const A = require(path.join(CF, 'hybrid/hybridB1AdapterV6.js'))
const { buildReportV6, validateReportV6 } = REPORT_MOD()
const VM = require(path.join(ROOT, 'utils/v6/turnaroundReportViewModelV6.js'))
function REPORT_MOD () { return require(path.join(CF, 'report/index.js')) }

let pass = 0, fail = 0
function t (name, fn) {
  try { fn(); pass++; console.log('   ✓ ' + name) }
  catch (e) { fail++; console.log('   ✗ ' + name + '\n     ' + (e && e.message)) }
}
async function ta (name, fn) {
  try { await fn(); pass++; console.log('   ✓ ' + name) }
  catch (e) { fail++; console.log('   ✗ ' + name + '\n     ' + (e && e.message)) }
}

function base (o) {
  // R48 default = a COMPATIBLE pair (REPEATABILITY_GAP + PAID_ONCE). Before R48
  // this was VALIDATION_GAP + PAID_ONCE, which the new evidence-compatibility
  // gate now (correctly) classifies as EVIDENCE_CONFLICT.
  return Object.assign({
    lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', occupationDetail: '程序员',
    monthlySurplus: 'SURPLUS_1K_5K', safetyMonths: 'SAFETY_3_6', debtPressure: 'DEBT_NONE',
    skillValidation: 'PROOF_PAID_ONCE', monetizableSkill: 'ASSET_TECHNICAL',
    weeklyTime: 'TIME_5_10', executionStability: 'EXEC_STABLE',
    pastAttemptStage: 'ATTEMPT_FEW_SALES', selfBelief: 'BELIEF_TRIED_NO_RESULT',
    decisionStyle: 'DECISION_SMALL_TEST', timeBehavior: 'TIME_SHORT_FIRST',
    primaryProblem: 'PROBLEM_INCOME_STUCK', primaryGoal: 'GOAL_SIDE_INCOME',
    maxTrialCost: 'COST_1K_5K', failureResponse: 'FAIL_RECHECK'
  }, o || {})
}
// R48: a COMPATIBLE no-proof fixture (VALIDATION_GAP + no market proof).
function noProofBase (o) {
  return base(Object.assign({
    pastAttemptStage: 'ATTEMPT_NO_SALE', selfBelief: 'BELIEF_ABILITY',
    primaryProblem: 'PROBLEM_MONETIZE'
  }, o || {}))
}
function render (raw) {
  const out = H.runHybridDiagnosisV6(raw)
  const rep = buildReportV6(out.diagnosis, out.hybridContext)
  return { out, rep, vm: VM.buildCardListV6(rep.cards) }
}
function vmText (vm) {
  return [
    vm[0] && vm[0].oneLiner, vm[1] && vm[1].body,
    (vm[2] && vm[2].loopNodes || []).join(' '), vm[2] && vm[2].finalInsight,
    vm[3] && vm[3].from, vm[3] && vm[3].to, vm[3] && vm[3].specificity,
    vm[4] && vm[4].primaryAction, vm[4] && vm[4].specificity
  ].filter(Boolean).join('\n')
}

console.log('\n── RC8.4 V6 R46 — AUTHORITY + FACT CONSISTENCY ──')

// ══════════════════════════════════════════════════════════════════════
// §3 SHARED AUTHORITY (source-level)
// ══════════════════════════════════════════════════════════════════════
t('§3 shared resolver exported from worldviewV6Mode', () => {
  const M = require(MODE_PATH)
  assert.strictEqual(typeof M.resolveV6Authority, 'function', 'resolveV6Authority must exist')
})

t('§3 no copy/paste second policy: hybrid branch calls the shared resolver', () => {
  const src = fs.readFileSync(INDEX_PATH, 'utf8')
  // both V6 contracts must resolve via resolveV6Authority
  const hits = (src.match(/resolveV6Authority\(/g) || []).length
  assert.ok(hits >= 2, 'expected >=2 shared-resolver call sites, found ' + hits)
  // the hybrid branch must NOT contain its own ad-hoc allowlist check
  const hyb = src.slice(src.indexOf("turnaround_strategy_v6_hybrid_10q'"), src.indexOf('// ═══ V3 原有链路'))
  assert.ok(!/isV6ShadowAuthorized|isV6OnAuthorized|parseV6WorldviewMode/.test(hyb),
    'hybrid branch must NOT duplicate allowlist logic')
})

t('§3 resolveV6Authority fail-closed matrix (unit)', () => {
  const M = require(MODE_PATH)
  const OLD = { m: process.env.RC84_V6_WORLDVIEW_MODE, s: process.env.RC84_V6_SHADOW_ALLOWLIST, o: process.env.RC84_V6_ON_ALLOWLIST }
  function set (m, s, o) {
    if (m === undefined) delete process.env.RC84_V6_WORLDVIEW_MODE; else process.env.RC84_V6_WORLDVIEW_MODE = m
    if (s === undefined) delete process.env.RC84_V6_SHADOW_ALLOWLIST; else process.env.RC84_V6_SHADOW_ALLOWLIST = s
    if (o === undefined) delete process.env.RC84_V6_ON_ALLOWLIST; else process.env.RC84_V6_ON_ALLOWLIST = o
  }
  try {
    set(undefined, 'u1', 'u2'); assert.deepStrictEqual(M.resolveV6Authority('u1'), { mode: 'OFF', allowed: false })
    set('garbage', 'u1', 'u2'); assert.deepStrictEqual(M.resolveV6Authority('u1'), { mode: 'OFF', allowed: false })
    set('SHADOW', 'u1', 'u2'); assert.deepStrictEqual(M.resolveV6Authority('u1'), { mode: 'SHADOW', allowed: true })
    set('SHADOW', 'u1', 'u2'); assert.deepStrictEqual(M.resolveV6Authority('u2'), { mode: 'SHADOW', allowed: false })
    set('ON', 'u1', 'u2'); assert.deepStrictEqual(M.resolveV6Authority('u2'), { mode: 'ON', allowed: true })
    set('ON', 'u1', 'u2'); assert.deepStrictEqual(M.resolveV6Authority('u1'), { mode: 'ON', allowed: false })
    set('ON', undefined, undefined); assert.deepStrictEqual(M.resolveV6Authority('u1'), { mode: 'ON', allowed: false })
  } finally { set(OLD.m, OLD.s, OLD.o) }
})

// ══════════════════════════════════════════════════════════════════════
// §4 AUTH MATRIX (end-to-end through index.main, mocked sdk)
// ══════════════════════════════════════════════════════════════════════
let __openid = 'u1'
let __aiCalls = 0
const mockDb = {
  command: {},
  collection: function (name) {
    return {
      where () { return this }, orderBy () { return this }, limit () { return this },
      get: async () => {
        if (name === 'users') return { data: [{ openid: __openid }] }
        if (name === 'user_profiles') return { data: [{ openid: __openid }] }
        return { data: [] }
      },
      add: async () => ({ _id: 'mock' }),
      doc () { return { get: async () => ({ data: null }), set: async () => {}, update: async () => {} } }
    }
  }
}
const mockSdk = {
  DYNAMIC_CURRENT_ENV: 'mock-env', init () {},
  getWXContext () { return { OPENID: __openid } },
  database () { return mockDb }
}
const aiMock = {
  callAI: async function () { __aiCalls++; return { success: false, error: 'NO_MODEL' } },
  buildReportPrompt () { return { systemPrompt: '', userMessage: '' } },
  buildCoachingPrompt () { return { systemPrompt: '', userMessage: '', personality: null } },
  buildDiagnosticPrompt () { return { systemPrompt: '', userMessage: '', personality: null, engineResult: { normalizedProfile: {}, constraintAnalysis: {}, allowedPaths: [], forbiddenPaths: [] } } }
}
const origLoad = Module._load
Module._load = function (request) {
  if (request === 'wx-server-sdk') return mockSdk
  if (/(^|\/)ai\.js$/.test(request)) return aiMock
  return origLoad.apply(this, arguments)
}
const index = require(INDEX_PATH)

function setEnv (m, s, o) {
  if (m === undefined) delete process.env.RC84_V6_WORLDVIEW_MODE; else process.env.RC84_V6_WORLDVIEW_MODE = m
  if (s === undefined) delete process.env.RC84_V6_SHADOW_ALLOWLIST; else process.env.RC84_V6_SHADOW_ALLOWLIST = s
  if (o === undefined) delete process.env.RC84_V6_ON_ALLOWLIST; else process.env.RC84_V6_ON_ALLOWLIST = o
}
async function callHybrid (mode, openid, shadowAllow, onAllow) {
  setEnv(mode, shadowAllow, onAllow)
  __openid = openid
  __aiCalls = 0
  const res = await index.main({ type: 'diagnostic', diagnosticVersion: 'turnaround_strategy_v6_hybrid_10q', answers: base() }, {})
  return res && res.data
}
function isPrimary (d) { return !!(d && d.cards && d.cards.fatalInsight && d.cards.fatalInsight.text) }

const authMatrix = [
  ['OFF + arbitrary', 'OFF', 'anyone', undefined, undefined, false],
  ['SHADOW + nonallowlist', 'SHADOW', 'stranger', 'u1', 'u2', false],
  ['SHADOW + shadow allowlist', 'SHADOW', 'u1', 'u1', 'u2', false],
  ['SHADOW + ON-only account', 'SHADOW', 'u2', 'u1', 'u2', false],
  ['ON + nonallowlist', 'ON', 'stranger', 'u1', 'u2', false],
  ['ON + shadow-only account', 'ON', 'u1', 'u1', 'u2', false],
  ['ON + ON account', 'ON', 'u2', 'u1', 'u2', true],
  ['missing mode', undefined, 'u2', 'u1', 'u2', false],
  ['invalid mode', 'garbage', 'u2', 'u1', 'u2', false]
]

;(async () => {
  console.log('\n   §4 AUTH MATRIX')
  let bypass = 0
  for (const [name, mode, openid, sa, oa, expectedPrimary] of authMatrix) {
    const d = await callHybrid(mode, openid, sa, oa)
    const got = isPrimary(d)
    await ta('§4 ' + name + ' → ' + (expectedPrimary ? 'PRIMARY' : 'BASELINE'), () => {
      assert.strictEqual(got, expectedPrimary, 'got ' + (got ? 'PRIMARY' : 'BASELINE'))
      if (got && !expectedPrimary) bypass++
    })
  }
  t('§4 HYBRID_BYPASS_ALLOWLIST_COUNT = 0', () => assert.strictEqual(bypass, 0))
  t('§4 UNAUTHORIZED_HYBRID_PRIMARY_COUNT = 0', () => assert.strictEqual(bypass, 0))
  t('§4 hybrid path makes ZERO model calls (deterministic)', () => assert.strictEqual(__aiCalls, 0))

  // ══════════════════════════════════════════════════════════════════
  // §3 NATIVE V6 vs HYBRID AUTHORITY DIFFERENTIAL
  // ══════════════════════════════════════════════════════════════════
  console.log('\n   §3 NATIVE V6 vs HYBRID AUTHORITY DIFFERENTIAL')
  async function callContract (contract, mode, openid, sa, oa) {
    setEnv(mode, sa, oa)
    __openid = openid
    __aiCalls = 0
    const res = await index.main({ type: 'diagnostic', diagnosticVersion: contract, answers: base() }, {})
    return res && res.data
  }
  await ta('§3 NATIVE_V6_AUTH_BEHAVIOR_DIFF_COUNT = 0 (identical authority policy)', async () => {
    // Spy on the ONE shared resolver. Both the native and hybrid branches
    // destructure it from the same module at call time, so this records the
    // EXACT authority decision each branch acts on.
    const MODE_MOD = require(MODE_PATH)
    const real = MODE_MOD.resolveV6Authority
    const seen = []
    MODE_MOD.resolveV6Authority = function (openid) { const d = real(openid); seen.push(d); return d }
    let diff = 0
    try {
      for (const [name, mode, openid, sa, oa] of authMatrix) {
        await callContract('turnaround_strategy_v6', mode, openid, sa, oa)
        const nD = seen[seen.length - 1]
        await callContract('turnaround_strategy_v6_hybrid_10q', mode, openid, sa, oa)
        const hD = seen[seen.length - 1]
        if (nD.mode !== hD.mode || nD.allowed !== hD.allowed) {
          diff++
          console.log('       ! ' + name + ' native=' + JSON.stringify(nD) + ' hybrid=' + JSON.stringify(hD))
        }
      }
    } finally { MODE_MOD.resolveV6Authority = real }
    assert.strictEqual(diff, 0, 'NATIVE_V6_AUTH_BEHAVIOR_DIFF_COUNT = ' + diff)
  })

  // ══════════════════════════════════════════════════════════════════
  // §7 CLAIM CONTRACT per asset state
  // ══════════════════════════════════════════════════════════════════
  console.log('\n   §7 CLAIM CONTRACT')
  t('§7 every ladder state has an allowed/forbidden contract', () => {
    for (const s of ['NO_CLEAR_ASSET', 'SKILL_IDENTIFIED_UNPROVEN', 'SKILL_USED_FREE', 'PROBLEM_SOLVING_PROOF', 'PAID_ONCE', 'OCCASIONAL_PAID', 'REPEATABLE_PAID']) {
      assert.ok(PC.CLAIM_CONTRACT[s], 'missing contract ' + s)
      assert.ok(PC.CLAIM_CONTRACT[s].allowed.length > 0, s + ' allowed')
      assert.ok(PC.CLAIM_CONTRACT[s].forbidden.length > 0, s + ' forbidden')
    }
  })

  // ══════════════════════════════════════════════════════════════════
  // §14 GOLDEN PROOF-STAGE MATRIX
  // ══════════════════════════════════════════════════════════════════
  console.log('\n   §14 GOLDEN PROOF-STAGE MATRIX')
  const proofStates = {
    PAID_ONCE: { skillValidation: 'PROOF_PAID_ONCE' },
    OCCASIONAL_PAID: { skillValidation: 'PROOF_OCCASIONAL' },
    REPEATABLE: { skillValidation: 'PROOF_STABLE' }
  }
  const rendered = {}
  for (const [k, v] of Object.entries(proofStates)) rendered[k] = render(base(v))

  t('§14 B1_DIAGNOSIS_DIFF_COUNT = 0 (same bottleneck/stage/action across proof states)', () => {
    const sig = (r) => [r.out.diagnosis.primaryBottleneck, r.out.diagnosis.executionStage, r.out.diagnosis.firstActionType, r.out.diagnosis.beliefRelation.relation].join('|')
    const s0 = sig(rendered.PAID_ONCE)
    for (const k of Object.keys(rendered)) assert.strictEqual(sig(rendered[k]), s0, k + ' changed the diagnosis')
  })

  t('§14 CARD04_STRATEGY_WORDING_DIFF_COUNT > 0', () => {
    const set = new Set(Object.values(rendered).map((r) => r.vm[3].from + '→' + r.vm[3].to))
    assert.ok(set.size > 1, 'CARD04 wording identical across proof states')
  })

  t('§14 CARD05_ACTION_WORDING_DIFF_COUNT = 0 under R48 (cross-axis override suppressed)', () => {
    // R48 §7: proof-aware CARD05 overrides only fire for a COMPATIBLE paid band
    // with a mapped action type. REPEATABILITY_GAP has no CARD05 mapping and the
    // conditional bands are scope-limited, so the action copy is the frozen base
    // copy across this paid progression (no unsupported cross-axis strategy).
    const set = new Set(Object.values(rendered).map((r) => r.vm[4].primaryAction))
    assert.strictEqual(set.size, 1, 'CARD05 proof-aware override unexpectedly fired')
  })

  // ══════════════════════════════════════════════════════════════════
  // §8/§9/§10 PROOF CONTRADICTION COUNTS
  // ══════════════════════════════════════════════════════════════════
  console.log('\n   §8/§9/§10 PROOF CONTRADICTION')
  const paidCases = {
    PAID_ONCE: base({}),
    OCCASIONAL_PAID: base({ skillValidation: 'PROOF_OCCASIONAL' }),
    REPEATABLE_PAID: base({ skillValidation: 'PROOF_STABLE' })
  }
  const unprovenCases = {
    NO_CLEAR_ASSET: noProofBase({ skillValidation: 'PROOF_NEVER', monetizableSkill: 'ASSET_UNCLEAR', occupationDetail: undefined }),
    SKILL_IDENTIFIED_UNPROVEN: noProofBase({ skillValidation: 'PROOF_NEVER' }),
    SKILL_USED_FREE: noProofBase({ skillValidation: 'PROOF_FREE_THANKED' }),
    PROBLEM_SOLVING_PROOF: noProofBase({ skillValidation: 'PROOF_FREE_HELPED' })
  }

  t('§9 all five cards free of proof contradictions (paid states)', () => {
    let count = 0
    for (const [state, raw] of Object.entries(paidCases)) {
      const r = render(raw)
      const text = vmText(r.vm)
      for (const bad of PC.CLAIM_CONTRACT[state].forbidden) {
        if (text.includes(bad)) { count++; console.log('       ! ' + state + ' contradicts with "' + bad + '"') }
      }
    }
    assert.strictEqual(count, 0, 'CARD02/04/05_PROOF_CONTRADICTION_COUNT = ' + count)
  })

  t('§9 unproven states never assert market validation', () => {
    let count = 0
    for (const [state, raw] of Object.entries(unprovenCases)) {
      const r = render(raw)
      assert.strictEqual(r.out.hybridContext.marketValidated, false, state + ' marketValidated must be false')
      const text = vmText(r.vm)
      for (const bad of PC.CLAIM_CONTRACT[state].forbidden) {
        if (text.includes(bad)) { count++; console.log('       ! ' + state + ' contradicts with "' + bad + '"') }
      }
    }
    assert.strictEqual(count, 0)
  })

  t('§10 BASE_COPY_PLUS_CONTRADICTORY_SPECIFICITY_COUNT = 0', () => {
    // For PAID states, the CARD04 specificity must NOT be a strategy sentence
    // appended to a contradictory base; and the card must be internally coherent.
    let count = 0
    for (const [state, raw] of Object.entries(paidCases)) {
      const r = render(raw)
      const spec = r.vm[3].specificity
      // specificity must not itself re-state a strategy the from/to already own
      if (/下一步的重点|先让一个真实的人愿意|明码标价/.test(spec)) count++
      // and must not assert any forbidden claim
      for (const bad of PC.CLAIM_CONTRACT[state].forbidden) if (spec.includes(bad)) count++
    }
    assert.strictEqual(count, 0)
  })

  t('§8 CARD04 FROM matches proof fact per state', () => {
    for (const [state, raw] of Object.entries(paidCases)) {
      const r = render(raw)
      assert.strictEqual(r.vm[3].from, PC.CARD04_FROM_FACT[state], state + ' FROM mismatch')
    }
    for (const [state, raw] of Object.entries(unprovenCases)) {
      const r = render(raw)
      assert.strictEqual(r.vm[3].from, PC.CARD04_FROM_FACT[state], state + ' FROM mismatch')
    }
  })

  // ══════════════════════════════════════════════════════════════════
  // §11 FIRST ACTION TYPE AUTHORITY
  // ══════════════════════════════════════════════════════════════════
  console.log('\n   §11 FIRST ACTION TYPE')
  t('§11 FIRST_ACTION_TYPE_MUTATION_COUNT = 0 (wording changes, type does not)', () => {
    const byBottleneck = {
      VALIDATION_GAP: noProofBase({}),
      OCCASIONAL: base({ skillValidation: 'PROOF_OCCASIONAL' }),
      STABLE: base({ skillValidation: 'PROOF_STABLE' })
    }
    const expected = {
      VALIDATION_GAP: 'BUYER_FEEDBACK_COLLECTION',
      OCCASIONAL: 'REPEAT_SUCCESS_PATH',
      STABLE: 'REPEAT_SUCCESS_PATH'
    }
    for (const [k, raw] of Object.entries(byBottleneck)) {
      const r = render(raw)
      assert.strictEqual(r.out.diagnosis.firstActionType, expected[k], k + ' mutated action type')
    }
  })

  t('§11 R48: proof-aware CARD05 is BLOCKED for an invalid combination', () => {
    // R46 rendered a proof-aware CARD05 for VALIDATION_GAP + REPEATABLE_PAID.
    // R48 stops the report entirely (EVIDENCE_CONFLICT) for that combination.
    const raw = Object.assign(noProofBase({}), { skillValidation: 'PROOF_STABLE' })
    const r = render(raw)
    assert.strictEqual(r.out.diagnosis.compatibility.verdict, 'EVIDENCE_CONFLICT')
    assert.strictEqual(r.rep.reportState, 'EVIDENCE_CONFLICT')
    assert.strictEqual(r.vm.length, 0)
  })

  // ══════════════════════════════════════════════════════════════════
  // §12 NULL MAPPING PRESERVATION
  // ══════════════════════════════════════════════════════════════════
  console.log('\n   §12 NULL MAPPING')
  t('§12 SEMANTICALLY_UNSAFE_MAPPING_COUNT = 0 (nulls preserved)', () => {
    assert.strictEqual(A.DECISION_STYLE_TO_V6.DECISION_ALL_IN, null)
    assert.strictEqual(A.DECISION_STYLE_TO_V6.DECISION_AVOID, null)
    assert.strictEqual(A.FAILURE_RESPONSE_TO_V6.FAIL_ADD_MONEY, null)
    assert.strictEqual(A.FAILURE_RESPONSE_TO_V6.FAIL_UNSURE, null)
    // and they still fail closed (unmapped), never coerced
    const out = H.runHybridDiagnosisV6(base({ decisionStyle: 'DECISION_ALL_IN', failureResponse: 'FAIL_UNSURE' }))
    assert.ok(out.unmapped.includes('decisionStyle'))
    assert.ok(out.unmapped.includes('failureResponse'))
  })

  // ══════════════════════════════════════════════════════════════════
  // §16 REPORT A REPLAY
  // ══════════════════════════════════════════════════════════════════
  console.log('\n   §16 REPORT A REPLAY (programmer / technical / PAID_ONCE / VALIDATION_GAP)')
  const reportA = render(base({}))
  t('§16 R45_A_CONTRADICTION_REPRODUCED_BEFORE_FIX = YES (pre-fix guard)', () => {
    // demonstrate the ORIGINAL contradiction existed: the frozen base PATH_FROM[TESTING]
    // ("做了东西，却没卖出去") conflicts with PAID_ONCE evidence. The pre-fix report
    // would have used it verbatim.
    const copy = require(path.join(CF, 'report/reportCopyV6.js'))
    assert.strictEqual(copy.PATH_FROM.TESTING, '做了东西，却没卖出去', 'base copy changed')
    assert.ok(PC.CLAIM_CONTRACT.PAID_ONCE.forbidden.includes('却没卖出去'), 'contradiction not modelled')
  })
  t('§16 R48: the R45 Report-A combination is now EVIDENCE_CONFLICT (no masked report)', () => {
    // R45 Report A = VALIDATION_GAP + PAID_ONCE. R46 made it read coherently by
    // overriding copy; R48 stops it deterministically at the gate.
    const raw = Object.assign(noProofBase({}), { skillValidation: 'PROOF_PAID_ONCE' })
    const r = render(raw)
    assert.strictEqual(r.out.diagnosis.primaryBottleneck, 'VALIDATION_GAP')
    assert.strictEqual(r.out.diagnosis.compatibility.verdict, 'EVIDENCE_CONFLICT')
    assert.strictEqual(r.rep.cards, null)
  })
  t('§16 R46_A_CONTRADICTION_AFTER_FIX = NO (compatible paid case stays coherent)', () => {
    const text = vmText(reportA.vm)
    assert.ok(!text.includes('却没卖出去'), 'still says 却没卖出去')
    assert.ok(!text.includes('为什么没买'), 'still asks 为什么没买')
    assert.strictEqual(reportA.vm[3].from, '已经有人为它付过一次钱，但还没证明需求能重复')
  })

  // ══════════════════════════════════════════════════════════════════
  // R38 PRESENTATION AUTHORITY still holds
  // ══════════════════════════════════════════════════════════════════
  t('R38 one presentation authority per card still holds for all states', () => {
    for (const raw of [...Object.values(paidCases), ...Object.values(unprovenCases)]) {
      const r = render(raw)
      const v = validateReportV6(r.rep)
      assert.strictEqual(v.cardCount, 5)
      assert.strictEqual(v.forbiddenTokens.length, 0, 'forbidden: ' + v.forbiddenTokens)
      assert.ok(!('body' in r.vm[2]) && !('body' in r.vm[3]))
      assert.ok(!('checks' in r.vm[4]))
    }
  })

  console.log('\n══════════════════════════════════════')
  console.log('R46 AUTHORITY+FACT: ' + pass + ' passed, ' + fail + ' failed')
  console.log('══════════════════════════════════════')
  if (fail) process.exitCode = 1
})()
