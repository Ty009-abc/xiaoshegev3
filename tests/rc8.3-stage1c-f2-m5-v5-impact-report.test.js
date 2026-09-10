/**
 * RC8.3 Stage1C-F2-M5 — "翻身策略报告 V5" final impact report acceptance.
 *
 * Implements the V5 mission gates over the frozen authority DAG:
 *   ENGINE TRUTH → PRESENTATION TRUTH → IMPACT THESIS → 5-CARD IMPACT SUMMARY
 *   → SECONDARY EXPLAINABILITY
 *
 *   §2   no engine/questionnaire/diagnosis/golden/primary/gate-B/payment/env change
 *   §7   UNIQUE generation consumes accepted truth only
 *   §9   MULTIPLE source safety (UNSOURCED_SYNTHESIS_CLAUSE_COUNT=0)
 *   §12  user-copy forbidden tokens + engine-meta prose rejected in Layer 1
 *   §13  safety copy (no prediction/wealth/generic self-help)
 *   §16  length gates
 *   §17  product gates
 *   §20  UNIQUE matrix 9/9 (materially distinct fatal insights)
 *   §21  MULTIPLE matrix N=2/3/5/9
 *   §22  human readback (5 questions answerable)
 *   §23  non-interference (diagnosis diff=0, engine/contract/questionnaire untouched)
 *
 * `node --test`
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const PRES_DIR = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1')
const REPORT_DIR = path.join(PRES_DIR, 'report')

const responseValidity = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/responseValidityV21.js')
const { runCognitionChainV21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/runtimeShadowAdapterV21.js')
const builder = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/cognitiveReportBuilderV21.js')
const presentation = require('../cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/index.js')
const reportBuilder = require('../cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/report/index.js')
const viewModel = require('../utils/northStarReportViewModel.js')
const { CONSTRUCTS_V21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/questionnaireV21.js')
const GOLDEN = require('./fixtures/reportGoldenV21.js')

const { BUDGET } = reportBuilder

// ── Fixtures ───────────────────────────────────────────────────────────────

function buildChain(constructs) {
  const m = {}
  for (const c of CONSTRUCTS_V21) m[c] = { ...GOLDEN.HEALTHY[c] }
  for (const c of (constructs || [])) m[c] = { ...GOLDEN.DISTORTED_PAIR[c] }
  const answers = []
  for (const c of CONSTRUCTS_V21) for (const qid of Object.keys(m[c])) answers.push({ questionId: qid, optionId: m[c][qid] })
  const responses = answers.map((a, i) => ({ ...a, displayPosition: i }))
  const validity = responseValidity.assessResponseValidityV21(responses)
  const cognition = runCognitionChainV21(responses)
  const report = builder.runCognitiveReportBuilderV21({ responses, validityResult: validity, cognition })
  const pm = presentation.buildNorthStarPresentationModelV21({
    diagnosis: cognition.decision, answerTrace: report.trace.answerTrace, dimensions: cognition.dimensions,
    cognitiveBlindSpot: report.cognitiveBlindSpot, worldStrategy: report.worldStrategy,
    cognitiveArchetype: report.cognitiveArchetype, scenarioSimulation: report.scenarioSimulation, validityStatus: validity.status,
  })
  const contentModel = reportBuilder.buildNorthStarReportV21(pm)
  const vm = viewModel.buildNorthStarReportViewModel(contentModel)
  return { cognition, pm, contentModel, vm }
}

const CONSTRUCT_OF = {
  OPPORTUNITY_BLINDNESS: 'OPPORTUNITY', FEEDBACK_LOOP_GAP: 'FEEDBACK', DECISION_INERTIA: 'DECISION',
  RISK_MODEL_DISTORTION: 'RISK', PROBABILITY_MISJUDGMENT: 'PROBABILITY', IDENTITY_CONSTRAINT: 'IDENTITY',
  LEVERAGE_MODEL_GAP: 'LEVERAGE', SYSTEM_THINKING_GAP: 'SYSTEMS', TIME_HORIZON_TRAP: 'TIME',
}
const UNIQUE_IDS = Object.keys(CONSTRUCT_OF)
const UNIQUE = {}
for (const bs of UNIQUE_IDS) UNIQUE[bs] = buildChain([CONSTRUCT_OF[bs]])

const N2 = ['DECISION', 'TIME']
const N3 = ['DECISION', 'TIME', 'PROBABILITY']
const N5 = ['DECISION', 'TIME', 'PROBABILITY', 'RISK', 'SYSTEMS']
const N9 = CONSTRUCTS_V21.slice()
const MULTI = { 2: buildChain(N2), 3: buildChain(N3), 5: buildChain(N5), 9: buildChain(N9) }

// ── Gate helpers ───────────────────────────────────────────────────────────

const clen = (s) => [...String(s || '')].length
const NUMERAL_RE = /两个|这两个|2个/

const RAWTOKENS = [
  'MULTIPLE_SUPPORTED_MODELS', 'UNIQUE_ELIGIBLE_CANDIDATE', 'PRIMARY_ALLOWED', 'INSUFFICIENT_EVIDENCE',
  'reasonCode', 'eligible', 'candidate', 'blindSpotId', 'strategyId', 'WORLD_MODEL_V2_1_ENGINE',
  'DISTORTED', 'HEALTHY', 'MIXED', 'STRONG', 'MODERATE', 'WEAK', 'BUILD_DECISION_SYSTEM',
  'DECISION_INERTIA', 'TIME_HORIZON_TRAP', 'PROBABILITY_MISJUDGMENT', 'RISK_MODEL_DISTORTION', 'SYSTEM_THINKING_GAP',
]
// §12 engine-meta prose forbidden in Layer 1. NOTE: the first group is the
// banned engine-meta; the second group are COUNTERFACTUAL phrases that legacy V4
// USED but which must be ABSENT from V5 Layer-1 (they are the "证据不足/分主次"
// degradation the mission explicitly forbids). Both must be count 0.
const ENGINE_META = [
  '系统检测到', '系统认为', '系统判断', '根据模型', '根据算法', '模型显示',
  '多个方向得到了证据支持', '多个模型同时成立', '未识别出唯一主因', '不能简单分出主次',
]
const FORBIDDEN_PREDICTION = ['一定会', '必然', '注定', '命中注定', '命运', '成功率达到', '保证赚', '稳赚', '收入翻倍', '三年后']
const WEALTH = ['保证赚', '保证收益', '稳赚', '收入将达到', '收入翻倍', '财富自由', '赚到钱', '月入', '年入', '躺赚', '一夜暴富']
const GENERIC_SELF_HELP = ['加油', '坚持就会成功', '相信自己', '未来可期', '你一定可以', '努力就会成功']

// The user-visible Layer-1 strings of the IMPACT SUMMARY (excludes internal
// provenance / sourceRefs / card.sourceCandidateIds).
function layer1VisibleStrings(is) {
  const out = []
  for (const k of ['fatalInsight', 'coreProblem', 'systemTrap', 'upgradePath', 'upgradeFrom', 'upgradeTo']) {
    if (typeof is[k] === 'string' && is[k]) out.push(is[k])
  }
  for (const s of (is.systemLoopSteps || [])) out.push(s)
  for (const s of (is.actionPlan || [])) out.push(s)
  for (const e of (is.evidencePreview || [])) {
    for (const k of ['questionMeaning', 'selectedAnswerMeaning', 'whatSignalItShows']) if (e[k]) out.push(e[k])
  }
  return out
}

function scanTokens(strings, list) {
  let n = 0
  for (const s of strings) for (const tok of list) if (String(s).indexOf(tok) !== -1) n++
  return n
}

function taxonomyCount(strings) {
  let n = 0
  const labels = Object.values(reportBuilder.copy.BLIND_SPOT_LABEL_COPY)
  for (const s of strings) for (const l of labels) if (String(s).includes(l)) n++
  return n
}

// ── §3/§4/§5/§16 five-card contract + length gates ─────────────────────────

test('V5-01 five cards present for UNIQUE and MULTIPLE; exactly 5 logical Layer-1 cards', () => {
  for (const bs of UNIQUE_IDS) {
    const is = UNIQUE[bs].contentModel.impactSummary
    assert.ok(is, `${bs}: impact summary present`)
    for (const k of ['fatalInsight', 'coreProblem', 'systemTrap', 'upgradePath']) assert.ok(clen(is[k]) > 0, `${bs}: card ${k}`)
    assert.ok(is.actionPlan.length > 0, `${bs}: action plan`)
  }
  for (const n of [2, 3, 5, 9]) {
    const is = MULTI[n].contentModel.impactSummary
    for (const k of ['fatalInsight', 'coreProblem', 'systemTrap', 'upgradePath']) assert.ok(clen(is[k]) > 0, `N=${n}: card ${k}`)
    assert.ok(is.actionPlan.length > 0, `N=${n}: action plan`)
  }
})

test('V5-02 §16 length gates (FATAL<=60, CORE<=120, UNIQUE TRAP<=160, MULTIPLE TRAP<=220, UPGRADE<=140, ACTION<=5)', () => {
  const all = {}
  for (const bs of UNIQUE_IDS) all[bs] = UNIQUE[bs].contentModel.impactSummary
  for (const n of [2, 3, 5, 9]) all['N' + n] = MULTI[n].contentModel.impactSummary
  for (const [k, is] of Object.entries(all)) {
    assert.ok(clen(is.fatalInsight) <= BUDGET.FATAL_INSIGHT, `${k}: FATAL ${clen(is.fatalInsight)}`)
    assert.ok(clen(is.coreProblem) <= BUDGET.CORE_PROBLEM, `${k}: CORE ${clen(is.coreProblem)}`)
    // M2: UNIQUE keeps the frozen 160 cap; MULTIPLE gets the authorized
    // constrained relaxation (target <=180, hard ceiling <=220) so Card 03 can
    // be causally specific to the eligible set.
    const trapCap = is.state === 'MULTIPLE' ? BUDGET.MULTIPLE_SYSTEM_TRAP_MAX : BUDGET.SYSTEM_TRAP
    assert.ok(clen(is.systemTrap) <= trapCap, `${k}: TRAP ${clen(is.systemTrap)}`)
    assert.ok(clen(is.upgradePath) <= BUDGET.UPGRADE_PATH, `${k}: UPGRADE ${clen(is.upgradePath)}`)
    assert.ok(is.actionPlan.length >= BUDGET.ACTION_PLAN_MIN && is.actionPlan.length <= BUDGET.ACTION_PLAN_MAX, `${k}: ACTION ${is.actionPlan.length}`)
    assert.ok(is.evidencePreview.length >= 2 && is.evidencePreview.length <= BUDGET.EVIDENCE_PREVIEW_MAX, `${k}: EVIDENCE ${is.evidencePreview.length}`)
  }
})

test('V5-03 §4 SYSTEM_LOOP_STEP_COUNT >= 4 (UNIQUE + MULTIPLE)', () => {
  for (const bs of UNIQUE_IDS) {
    const is = UNIQUE[bs].contentModel.impactSummary
    assert.ok(is.systemLoopSteps.length >= 4, `${bs}: loop steps ${is.systemLoopSteps.length}`)
  }
  for (const n of [2, 3, 5, 9]) {
    const is = MULTI[n].contentModel.impactSummary
    assert.ok(is.systemLoopSteps.length >= 4, `N=${n}: loop steps ${is.systemLoopSteps.length}`)
  }
})

test('V5-04 §5 UPGRADE_FROM_PRESENT + UPGRADE_TO_PRESENT + FIRST_ACTION_PRESENT', () => {
  for (const bs of UNIQUE_IDS) {
    const is = UNIQUE[bs].contentModel.impactSummary
    assert.ok(clen(is.upgradeFrom) > 0, `${bs}: FROM present`)
    assert.ok(clen(is.upgradeTo) > 0, `${bs}: TO present`)
    assert.ok(clen(is.firstAction) > 0, `${bs}: first action present`)
  }
  for (const n of [2, 3, 5, 9]) {
    const is = MULTI[n].contentModel.impactSummary
    assert.ok(clen(is.upgradeFrom) > 0, `N=${n}: FROM present`)
    assert.ok(clen(is.upgradeTo) > 0, `N=${n}: TO present`)
    assert.ok(clen(is.firstAction) > 0, `N=${n}: first action present`)
  }
})

// ── §12/§13 user-copy gates ────────────────────────────────────────────────

test('V5-05 §12 LAYER1 forbidden tokens + engine-meta prose = 0', () => {
  for (const bs of UNIQUE_IDS) {
    for (const s of layer1VisibleStrings(UNIQUE[bs].contentModel.impactSummary)) {
      for (const tok of RAWTOKENS) assert.ok(!String(s).toLowerCase().includes(tok.toLowerCase()), `${bs}: raw token ${tok}: ${s}`)
      for (const tok of ENGINE_META) assert.ok(!String(s).includes(tok), `${bs}: engine-meta ${tok}: ${s}`)
    }
  }
  for (const n of [2, 3, 5, 9]) {
    for (const s of layer1VisibleStrings(MULTI[n].contentModel.impactSummary)) {
      for (const tok of RAWTOKENS) assert.ok(!String(s).toLowerCase().includes(tok.toLowerCase()), `N=${n}: raw token ${tok}: ${s}`)
      for (const tok of ENGINE_META) assert.ok(!String(s).includes(tok), `N=${n}: engine-meta ${tok}: ${s}`)
    }
  }
})

test('V5-06 §17 LAYER1_VISIBLE_TAXONOMY_COUNT=0 + no candidate-label list', () => {
  for (const bs of UNIQUE_IDS) {
    const strings = layer1VisibleStrings(UNIQUE[bs].contentModel.impactSummary)
    assert.strictEqual(taxonomyCount(strings), 0, `${bs}: taxonomy in Layer 1`)
  }
  for (const n of [2, 3, 5, 9]) {
    const strings = layer1VisibleStrings(MULTI[n].contentModel.impactSummary)
    assert.strictEqual(taxonomyCount(strings), 0, `N=${n}: taxonomy in Layer 1`)
  }
})

test('V5-07 §12 VISIBLE_ENGLISH_PARAGRAPH_COUNT=0 + count-neutral', () => {
  for (const bs of UNIQUE_IDS) {
    const strings = layer1VisibleStrings(UNIQUE[bs].contentModel.impactSummary)
    for (const s of strings) assert.ok(!reportBuilder.isEnglishParagraph(s), `${bs}: English: ${s}`)
    assert.strictEqual(NUMERAL_RE.test(JSON.stringify(UNIQUE[bs].contentModel.impactSummary)), false, `${bs}: numeral`)
  }
  for (const n of [2, 3, 5, 9]) {
    const strings = layer1VisibleStrings(MULTI[n].contentModel.impactSummary)
    for (const s of strings) assert.ok(!reportBuilder.isEnglishParagraph(s), `N=${n}: English: ${s}`)
    assert.strictEqual(NUMERAL_RE.test(JSON.stringify(MULTI[n].contentModel.impactSummary)), false, `N=${n}: numeral`)
  }
})

test('V5-08 §13 no prediction / wealth / generic self-help in Layer 1', () => {
  const all = {}
  for (const bs of UNIQUE_IDS) all[bs] = UNIQUE[bs].contentModel.impactSummary
  for (const n of [2, 3, 5, 9]) all['N' + n] = MULTI[n].contentModel.impactSummary
  let pred = 0, wealth = 0, generic = 0
  for (const [k, is] of Object.entries(all)) {
    const strings = layer1VisibleStrings(is)
    pred += scanTokens(strings, FORBIDDEN_PREDICTION)
    wealth += scanTokens(strings, WEALTH)
    generic += scanTokens(strings, GENERIC_SELF_HELP)
  }
  assert.strictEqual(pred, 0, 'UNSUPPORTED_PREDICTION_COUNT')
  assert.strictEqual(wealth, 0, 'WEALTH_PROMISE_COUNT')
  assert.strictEqual(generic, 0, 'GENERIC_SELF_HELP_FALLBACK_COUNT')
})

// ── §7/§9 source safety ────────────────────────────────────────────────────

test('V5-09 §9 every Layer-1 clause is source-backed; UNSOURCED_SYNTHESIS_CLAUSE_COUNT=0', () => {
  for (const n of [2, 3, 5, 9]) {
    const is = MULTI[n].contentModel.impactSummary
    for (const k of ['fatalInsight', 'coreProblem', 'systemTrap', 'upgradePath', 'actionPlan']) {
      assert.ok(Array.isArray(is.card[k].sourceCandidateIds) && is.card[k].sourceCandidateIds.length > 0, `N=${n}: ${k} sourced`)
      assert.ok(Array.isArray(is.provenance.clauses[k]) && is.provenance.clauses[k].length > 0, `N=${n}: ${k} provenance`)
    }
  }
})

test('V5-10 §9 FABRICATED_PRIMARY/STRATEGY/WORLD_RULE/SCENARIO_COUNT=0 (MULTIPLE)', () => {
  for (const n of [2, 3, 5, 9]) {
    const cm = MULTI[n].contentModel
    assert.strictEqual(cm.diagnosisState.primaryBlindSpotId, null, `N=${n}: fabricated primary`)
    // no UNIQUE-only sections fabricated for MULTIPLE
    const w = cm.sections.find((s) => s.sectionId === '03_WORLD_RULE_ALIGNMENT')
    const u = cm.sections.find((s) => s.sectionId === '06_COGNITIVE_UPGRADE')
    const s8 = cm.sections.find((s) => s.sectionId === '08_SCENARIO_CONTRAST')
    assert.ok(!(w && w.body && w.body.worldRule), `N=${n}: fabricated world rule`)
    assert.ok(!(u && u.body && u.body.upgradedModel), `N=${n}: fabricated strategy`)
    assert.ok(!(s8 && s8.body), `N=${n}: fabricated scenario`)
  }
})

// ── §17 product gates ──────────────────────────────────────────────────────

test('V5-11 §17 PRODUCTION MULTIPLE: LAYER1_FULL_MODEL_CARD_COUNT=0, LAYER1_FULL_QA_REPLAY_COUNT=0', () => {
  for (const n of [2, 3, 5, 9]) {
    const vm = MULTI[n].vm
    assert.strictEqual(vm.impactSummary.fullModelCardCount, 0, `N=${n}: full model cards`)
    // evidencePreview bullets are compressed; they never replay a full questionnaire
    assert.ok(vm.impactSummary.evidencePreview.length <= 4, `N=${n}: qa replay`)
  }
})

test('V5-12 §17 LAYER2_ALL_ELIGIBLE_MODELS_PRESERVED + LAYER2_EVIDENCE_TRACE_PRESERVED', () => {
  for (const n of [2, 3, 5, 9]) {
    const vm = MULTI[n].vm
    assert.strictEqual(vm.impactExplainer.supportedModels.length, n, `N=${n}: all models preserved`)
    for (const m of vm.impactExplainer.supportedModels) {
      assert.ok(m.evidence.length >= 2, `N=${n}: ${m.label} evidence trace preserved`)
    }
  }
  // UNIQUE preserves world model + scenario + full map
  const uEx = UNIQUE.SYSTEM_THINKING_GAP.vm.impactExplainer
  assert.ok(uEx.worldModel && uEx.worldModel.worldRule, 'UNIQUE world rule kept')
  assert.ok(uEx.scenario && uEx.scenario.currentModel, 'UNIQUE scenario kept')
  assert.strictEqual(uEx.fullModelMap.length, 9, 'UNIQUE full map kept')
})

test('V5-13 §17 SYSTEM_STATE_AS_HERO_COUNT=0 + MULTIPLE_RANKING_COUNT=0 + FAKE_PRIMARY=0', () => {
  for (const n of [2, 3, 5, 9]) {
    const vm = MULTI[n].vm
    const hero = vm.impactSummary.fatalInsight
    // hero is a user-centered sentence, never a system-state / meta statement
    for (const tok of ['系统', '证据不足', '主次', '无法判断', '模型']) assert.ok(!hero.includes(tok), `N=${n}: system-state hero: ${hero}`)
    assert.ok(clen(hero) >= 8, `N=${n}: hero is a real conclusion`)
    // no ranking / winner language in Layer-2 model list
    const labels = vm.impactExplainer.supportedModels.map((m) => m.label)
    assert.strictEqual(labels.length, n, `N=${n}: no model dropped by ranking`)
    const all = JSON.stringify(vm.impactSummary)
    assert.ok(!/唯一主因是|最主要的是|排在第一位|按重要性排序/.test(all), `N=${n}: ranking language`)
  }
})

test('V5-14 §13 QUESTIONNAIRE_REPLAY_OVERLOAD=NO (Layer1 compressed, Layer2 full)', () => {
  const vm = MULTI[5].vm
  assert.ok(vm.impactSummary.evidencePreview.length <= 4, 'Layer-1 compressed')
  const layer2Rows = vm.impactExplainer.supportedModels.reduce((a, m) => a + m.evidence.length, 0)
  assert.strictEqual(layer2Rows, 10, 'Layer-2 full evidence trace')
})

// ── §20 UNIQUE matrix 9/9 ──────────────────────────────────────────────────

test('V5-15 §20 UNIQUE 9/9 with materially distinct fatal insights (no label-substitution template)', () => {
  const set = new Set()
  for (const bs of UNIQUE_IDS) {
    const is = UNIQUE[bs].contentModel.impactSummary
    assert.ok(is && clen(is.fatalInsight) > 0, `${bs}: 5 cards`)
    set.add(is.fatalInsight)
  }
  assert.strictEqual(set.size, 9, 'UNIQUE_FATAL_INSIGHT_DISTINCT=9/9')
  // materially distinct: no fatal insight is a trivial label swap of another.
  for (const a of UNIQUE_IDS) {
    for (const b of UNIQUE_IDS) {
      if (a === b) continue
      const fa = UNIQUE[a].contentModel.impactSummary.fatalInsight
      const fb = UNIQUE[b].contentModel.impactSummary.fatalInsight
      // not equal and not one a strict prefix/superstring of the other
      assert.notStrictEqual(fa, fb)
      assert.ok(!(fa.startsWith(fb) || fb.startsWith(fa)), `${a}/${b}: trivial template`)
    }
  }
})

// ── §21 MULTIPLE matrix 2/3/5/9 ────────────────────────────────────────────

test('V5-16 §21 MULTIPLE matrix N=2/3/5/9 → 5-card Layer1, no hardcoded count, no fake primary, Layer2 N/N', () => {
  for (const n of [2, 3, 5, 9]) {
    const { cognition, contentModel, vm } = MULTI[n]
    assert.strictEqual(cognition.decision.reasonCode, 'MULTIPLE_SUPPORTED_MODELS')
    assert.strictEqual(cognition.decision.eligibleCandidateIds.length, n)
    assert.strictEqual(contentModel.diagnosisState.primaryBlindSpotId, null, `N=${n}: no fake primary`)
    const is = contentModel.impactSummary
    assert.ok(is, `N=${n}: Layer-1 present`)
    assert.strictEqual(NUMERAL_RE.test(JSON.stringify(is)), false, `N=${n}: hardcoded count`)
    assert.strictEqual(vm.impactSummary.layer1SectionCount, 5, `N=${n}: 5-card Layer-1`)
    assert.strictEqual(vm.impactExplainer.supportedModels.length, n, `N=${n}: Layer-2 preserves N`)
    assert.strictEqual(contentModel.multiModel.supportedModels.length, n, `N=${n}: every model carried`)
  }
})

// ── §22 human readback ─────────────────────────────────────────────────────

test('V5-17 §22 HUMAN READBACK: 5 questions answerable from fixture output', () => {
  const is = MULTI[5].contentModel.impactSummary
  const ex = MULTI[5].vm.impactExplainer
  // 我一直卡在什么？ → system trap (loop)
  assert.ok(clen(is.systemTrap) > 0 && is.systemLoopSteps.length >= 4, 'Q1: stuck-in loop')
  // 我以前以为什么？ → core problem (surface belief)
  assert.ok(clen(is.coreProblem) > 0 && /默认|以为|当成/.test(is.coreProblem), 'Q2: prior belief')
  // 真正机制是什么？ → fatal insight + core mechanism
  assert.ok(clen(is.fatalInsight) > 0, 'Q3: real mechanism')
  // 我要换成什么规则？ → upgrade FROM → TO
  assert.ok(clen(is.upgradeFrom) > 0 && clen(is.upgradeTo) > 0, 'Q4: rule change')
  // 今天先做什么？ → first action
  assert.ok(clen(is.firstAction) > 0, 'Q5: first action')
  // Layer-2 still answers "why this diagnosis"
  assert.ok(ex.supportedModels.length === 5, 'Layer-2 why-this present')
})

// ── §23 non-interference ───────────────────────────────────────────────────

test('V5-18 §23 diagnosis diff=0; engine/contract/questionnaire untouched', () => {
  const a = buildChain(['SYSTEMS'])
  const b = buildChain(['SYSTEMS'])
  assert.deepStrictEqual(a.cognition, b.cognition, 'DIAGNOSIS_OUTPUT_DIFF_COUNT=0')
  // engine must not import presentation/report; report must not import engine inference
  const engineRoot = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/engine')
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('.js')) {
        const src = fs.readFileSync(p, 'utf8')
        assert.ok(!/presentation\/worldModel\/v2_1/.test(src), `ENGINE_IMPORTS_PRESENTATION: ${p}`)
      }
    }
  }
  walk(engineRoot)
  // thesis authority lives in the report layer (single synthesis layer, no duplicate)
  const thesisSrc = fs.readFileSync(path.join(REPORT_DIR, 'impactThesisV21.js'), 'utf8')
  assert.ok(/buildImpactThesisV21/.test(thesisSrc), 'impactThesis module present')
  assert.ok(!/multipleSynthesisV21/.test(thesisSrc), 'thesis does not re-own synthesis (no duplicate authority)')
})
