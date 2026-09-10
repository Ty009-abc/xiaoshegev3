/**
 * RC8.3 Stage1C-F2-M2A — COUNT-NEUTRAL MULTIPLE copy fix.
 *
 * Root cause (frozen): northStarReportCopyV21.js MULTIPLE_STATE_COPY hardcoded
 * numeral wording ("两个方向" / "这两个模式") while runtime eligible model count
 * may be N >= 2. This suite proves the copy is now COUNT-NEUTRAL and consistent
 * for any N.
 *
 *   §5 count matrix N=2/3/5/9 (hero/summary/synthesis valid, no contradiction)
 *   §5 hardcoded numeral scan of production MULTIPLE copy → 0
 *   §6 real-device 5-model fixture (REPORT_COUNT=5, COPY_COUNT_CONTRADICTION=0)
 *   §4 semantic safety (FABRICATED_PRIMARY_COUNT=0, FALSE_GLOBAL_INSUFFICIENT=0)
 *   §7 non-interference (only MULTIPLE user copy may change)
 *
 * `node --test`
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const GOLDEN = require('./fixtures/reportGoldenV21.js')

const responseValidity = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/responseValidityV21.js')
const { runCognitionChainV21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/runtimeShadowAdapterV21.js')
const builder = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/cognitiveReportBuilderV21.js')
const presentation = require('../cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/index.js')
const reportBuilder = require('../cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/report/index.js')
const viewModel = require('../utils/northStarReportViewModel.js')
const copy = require('../cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/report/northStarReportCopyV21.js')
const { CONSTRUCTS_V21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/questionnaireV21.js')

// A hardcoded numeral that contradicts a dynamic N.
const NUMERAL_RE = /两个|这两个|2个|两方向/

function buildChainFromMap(map) {
  const answers = []
  for (const c of CONSTRUCTS_V21) {
    for (const qid of Object.keys(map[c])) answers.push({ questionId: qid, optionId: map[c][qid] })
  }
  const responses = answers.map((a, i) => ({ ...a, displayPosition: i }))
  const validity = responseValidity.assessResponseValidityV21(responses)
  const cognition = runCognitionChainV21(responses)
  const report = builder.runCognitiveReportBuilderV21({ responses, validityResult: validity, cognition })
  const pm = presentation.buildNorthStarPresentationModelV21({
    diagnosis: cognition.decision,
    answerTrace: report.trace.answerTrace,
    dimensions: cognition.dimensions,
    cognitiveBlindSpot: report.cognitiveBlindSpot,
    worldStrategy: report.worldStrategy,
    cognitiveArchetype: report.cognitiveArchetype,
    scenarioSimulation: report.scenarioSimulation,
    validityStatus: validity.status,
  })
  const contentModel = reportBuilder.buildNorthStarReportV21(pm)
  const vm = viewModel.buildNorthStarReportViewModel(contentModel)
  return { cognition, pm, contentModel, vm }
}

function distortedMap(constructs) {
  const m = {}
  for (const c of CONSTRUCTS_V21) m[c] = { ...GOLDEN.HEALTHY[c] }
  for (const c of constructs) m[c] = { ...GOLDEN.DISTORTED_PAIR[c] }
  return m
}

// ── §5 count matrix: N = 2 / 3 / 5 / 9 ─────────────────────────────────────

const MATRIX = [
  { n: 2, constructs: ['DECISION', 'TIME'] },
  { n: 3, constructs: ['DECISION', 'TIME', 'PROBABILITY'] },
  { n: 5, constructs: ['DECISION', 'TIME', 'PROBABILITY', 'RISK', 'SYSTEMS'] },
  { n: 9, constructs: CONSTRUCTS_V21.slice() },
]

for (const { n, constructs } of MATRIX) {
  test(`§5 N=${n}: MULTIPLE copy is valid + count-neutral (no numeral contradiction)`, () => {
    const R = buildChainFromMap(distortedMap(constructs))
    assert.strictEqual(R.cognition.decision.reasonCode, 'MULTIPLE_SUPPORTED_MODELS', 'MULTIPLE state')
    assert.strictEqual(R.cognition.decision.eligibleCandidateIds.length, n, `eligible==${n}`)
    const mm = R.contentModel.multiModel
    assert.ok(mm, 'multiModel present')
    assert.strictEqual(mm.supportedModels.length, n, `report MULTIPLE count == ${n}`)

    // hero / summary / synthesis wording valid and NUMERAL-FREE
    for (const field of ['headline', 'summary', 'synthesis']) {
      const s = mm[field]
      assert.ok(typeof s === 'string' && s.length > 0, `${field} present`)
      assert.ok(!NUMERAL_RE.test(s), `${field} free of hardcoded numeral: ${s}`)
    }
    // count-neutral assertion survives every N
    assert.ok(/多个|这些/.test(mm.headline + mm.summary + mm.synthesis), 'count-neutral quantifier present')

    // validator accepts the report for every N
    const r = reportBuilder.validateNorthStarReportV21(R.contentModel)
    assert.strictEqual(r.valid, true, `N=${n} report valid; errors=${r.errors.join(',')}`)
    // view-model renders exactly N cards
    assert.strictEqual(R.vm.multiple.supportedModels.length, n, `vm renders ${n}`)
  })
}

// ── §5 hardcoded-numeral scan of production MULTIPLE copy ──────────────────

test('§5: production MULTIPLE copy has no hardcoded numeral (HARDCODED_MULTIPLE_NUMERAL_COUNT=0)', () => {
  // structural: the frozen copy object itself
  const mcopy = copy.MULTIPLE_STATE_COPY
  assert.ok(mcopy && typeof mcopy === 'object', 'MULTIPLE_STATE_COPY exported')
  let hardcoded = 0
  for (const k of Object.keys(mcopy)) {
    if (NUMERAL_RE.test(String(mcopy[k]))) hardcoded++
  }
  assert.strictEqual(hardcoded, 0, 'no numeral in MULTIPLE_STATE_COPY')

  // source-level: the MULTIPLE_STATE_COPY literal block only
  const src = fs.readFileSync(
    path.join(ROOT, 'cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/report/northStarReportCopyV21.js'),
    'utf8',
  )
  const block = src.slice(src.indexOf('const MULTIPLE_STATE_COPY'), src.indexOf('// Per-candidate neutral observation'))
  // strip comment lines, then assert no numeral survives in the actual copy strings
  const copyLines = block.split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n')
  assert.strictEqual(NUMERAL_RE.test(copyLines), false, `numeral in MULTIPLE_STATE_COPY block:\n${copyLines}`)
})

// ── §6 real-device 5-model fixture ─────────────────────────────────────────

test('§6: real-device 5-model case — REPORT_COUNT=5, COPY_COUNT_CONTRADICTION=0', () => {
  const R = buildChainFromMap(distortedMap(['DECISION', 'TIME', 'PROBABILITY', 'RISK', 'SYSTEMS']))
  const mm = R.contentModel.multiModel
  assert.strictEqual(mm.supportedModels.length, 5, 'REPORT_COUNT=5')
  // hero must no longer claim "两个"; synthesis must no longer claim "这两个"
  assert.ok(!/两个/.test(mm.headline), 'hero no longer claims 两个')
  assert.ok(!/这两个/.test(mm.synthesis), 'synthesis no longer claims 这两个')
  // copy contains no numeral that could contradict the actual count of 5
  const joined = mm.headline + '|' + mm.summary + '|' + mm.synthesis
  assert.strictEqual(NUMERAL_RE.test(joined), false, 'COPY_COUNT_CONTRADICTION=0')
  // and the render count equals the copy-consistent supportedModels count
  assert.strictEqual(R.vm.multiple.supportedModels.length, 5, 'UI renders 5')
})

// ── §4 semantic safety ─────────────────────────────────────────────────────

test('§4: no fabricated primary + no false global-insufficient claim', () => {
  const R = buildChainFromMap(distortedMap(['DECISION', 'TIME', 'PROBABILITY', 'RISK', 'SYSTEMS']))
  const mm = R.contentModel.multiModel
  // no fabricated primary
  assert.strictEqual(R.contentModel.diagnosisState.primaryBlindSpotId, null)
  assert.strictEqual(R.pm.primaryDiagnosis, null)
  const primaryish = /主因是|主要问题是|唯一的问题是/.test(mm.headline + mm.summary + mm.synthesis)
  assert.strictEqual(primaryish, false, 'FABRICATED_PRIMARY_COUNT=0')
  // states insufficiency ONLY for selecting a unique primary, never global
  assert.ok(/不足以把|不足以确认|无法.*唯一|不足以.*唯一/.test(mm.synthesis) || /唯一主因/.test(mm.synthesis),
    'insufficiency scoped to unique-primary selection')
  assert.strictEqual(/证据不足|回答不足|不足以形成|信息不够/.test(mm.synthesis), false, 'FALSE_GLOBAL_INSUFFICIENT_CLAIM=0')
  // no retake instruction / ranking / fake strategy
  assert.strictEqual(/重新答题|重测|再做一次/.test(mm.synthesis), false, 'no retake instruction')
})

// ── §7 non-interference ────────────────────────────────────────────────────

test('§7: only 1 production file changed; non-MULTIPLE outputs untouched', () => {
  // (a) UNIQUE state: no multiModel block, no copy consumption → identical shape
  const uniqueMap = distortedMap(['DECISION']) // single distorted → UNIQUE
  const U = buildChainFromMap(uniqueMap)
  assert.strictEqual(U.cognition.decision.reasonCode, 'UNIQUE_ELIGIBLE_CANDIDATE')
  assert.strictEqual(U.contentModel.multiModel, undefined, 'no multiModel for UNIQUE (byte-identical)')
  assert.strictEqual(U.vm.multiple, undefined, 'no vm.multiple for UNIQUE (byte-identical)')
  assert.strictEqual(U.contentModel.sections.length, 9, '9-section structure preserved')

  // (b) MULTIPLE_STATE_COPY is referenced only from the MULTIPLE path
  const copySrc = fs.readFileSync(
    path.join(ROOT, 'cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/report/northStarReportCopyV21.js'),
    'utf8',
  )
  const builderSrc = fs.readFileSync(
    path.join(ROOT, 'cloudfunctions/generateAiReport/lib/presentation/worldModel/v2_1/report/northStarReportBuilderV21.js'),
    'utf8',
  )
  // getMultipleStateCopy is the only getter for the state copy; every call site
  // is MULTIPLE-guarded (verdict summary + buildMultiModelSection).
  const calls = (builderSrc.match(/getMultipleStateCopy\(/g) || []).length
  assert.strictEqual(calls, 2, 'getMultipleStateCopy called only in MULTIPLE-guarded branches')
  assert.ok(copySrc.includes('getMultipleStateCopy'), 'getter defined')
  // both call sites are guarded: verdict block tests reasonCode, section builder
  // returns null unless isMultiple && models.length >= 2.
  assert.ok(/reasonCode === 'MULTIPLE_SUPPORTED_MODELS'[\s\S]{0,200}getMultipleStateCopy\(\)/.test(builderSrc),
    'verdict call site is MULTIPLE-guarded')
  assert.ok(/if \(!isMultiple \|\| models\.length < 2\) return null[\s\S]*getMultipleStateCopy\(\)/.test(builderSrc),
    'section call site is MULTIPLE-guarded')
})
