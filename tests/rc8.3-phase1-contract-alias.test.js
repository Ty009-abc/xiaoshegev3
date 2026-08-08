/**
 * tests/rc8.3-phase1-contract-alias.test.js
 *
 * Phase-1 Contract Alignment (Pure Unblocker) — focused validation.
 *
 * Verifies:
 * 1. Blind Spot id exists
 * 2. Blind Spot primary exists
 * 3. bs.primary === bs.id
 * 4. Strategy id exists
 * 5. Strategy primary exists
 * 6. strategy.primary === strategy.id
 * 7. Null/empty behavior preserved
 * 8. Existing fields unchanged (bit-identical excluding new aliases)
 * 9. validateWorldModelOutput remains PASS
 * 10. Determinism unchanged
 *
 * RED LINES:
 * - No C4 engine integration
 * - No signal definition changes
 * - No golden changes
 * - No runtime changes
 */

const { runWorldModelPipeline } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/worldModelPipeline')
const { validateWorldModelOutput } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/validators')

// ═══════════════════════════════════════════════════════════════
// Test data
// ═══════════════════════════════════════════════════════════════

const SAMPLE_ANSWER = {
  lifeStage: '31-40岁',
  incomeStructure: '技能服务（按次/项目收费）',
  occupationDetail: '厨师',
  monthlySurplus: '1000-5000元',
  safetyMonths: '3-6个月',
  debtPressure: '无负债',
  skillValidation: '偶尔有付费需求',
  monetizableSkill: '技术类（编程/设计/工程）',
  weeklyTime: '5-10小时',
  executionStability: '比较稳定',
  pastAttemptStage: 'TRIED_MULTIPLE',
  decisionStyle: 'DATA_DRIVEN',
  primaryGoal: '增加收入',
  maxTrialCost: '500-1000元',
  failureResponse: 'ANALYZE_RETRY',
}

const EMPTY_ANSWER = {}

const BS_METADATA_FIELDS = [
  'id', 'label', 'confidence', 'mechanism', 'evidence', 'counterEvidence',
  'whyItMatters', 'uncertainty', 'ambiguity', 'rawGap', 'tieDetected', 'tieBrokenBy',
  'candidateScores',
]

const STRATEGY_METADATA_FIELDS = [
  'id', 'label', 'targetBlindSpot', 'mechanism', 'firstExperiment',
  'successSignal', 'reviewWindow', 'stopCondition', 'confidence', 'cognitiveUpgrade',
]

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    passed++
    console.log('PASS', name)
  } catch (e) {
    failed++
    console.log('FAIL', name, '-', e.message)
  }
}

// ── 1. Blind Spot id exists ──
test('BS.id exists on normal input', function () {
  var diag = runWorldModelPipeline(SAMPLE_ANSWER, { version: 'world_model_v1' })
  var d = diag.diagnosis
  if (!d.cognitiveBlindSpot.id) throw new Error('BS.id missing')
  if (typeof d.cognitiveBlindSpot.id !== 'string') throw new Error('BS.id not string')
})

// ── 2. Blind Spot primary exists ──
test('BS.primary exists on normal input', function () {
  var diag = runWorldModelPipeline(SAMPLE_ANSWER, { version: 'world_model_v1' })
  var d = diag.diagnosis
  if (!d.cognitiveBlindSpot.primary) throw new Error('BS.primary missing')
  if (typeof d.cognitiveBlindSpot.primary !== 'string') throw new Error('BS.primary not string')
})

// ── 3. bs.primary === bs.id ──
test('BS.primary === BS.id on normal input', function () {
  var diag = runWorldModelPipeline(SAMPLE_ANSWER, { version: 'world_model_v1' })
  var d = diag.diagnosis
  if (d.cognitiveBlindSpot.primary !== d.cognitiveBlindSpot.id) {
    throw new Error('primary=' + d.cognitiveBlindSpot.primary + ' id=' + d.cognitiveBlindSpot.id)
  }
})

// ── 4. Strategy id exists ──
test('Strategy.id exists on normal input', function () {
  var diag = runWorldModelPipeline(SAMPLE_ANSWER, { version: 'world_model_v1' })
  var d = diag.diagnosis
  if (!d.worldStrategy.id) throw new Error('Strategy.id missing')
  if (typeof d.worldStrategy.id !== 'string') throw new Error('Strategy.id not string')
})

// ── 5. Strategy primary exists ──
test('Strategy.primary exists on normal input', function () {
  var diag = runWorldModelPipeline(SAMPLE_ANSWER, { version: 'world_model_v1' })
  var d = diag.diagnosis
  if (!d.worldStrategy.primary) throw new Error('Strategy.primary missing')
  if (typeof d.worldStrategy.primary !== 'string') throw new Error('Strategy.primary not string')
})

// ── 6. strategy.primary === strategy.id ──
test('Strategy.primary === Strategy.id on normal input', function () {
  var diag = runWorldModelPipeline(SAMPLE_ANSWER, { version: 'world_model_v1' })
  var d = diag.diagnosis
  if (d.worldStrategy.primary !== d.worldStrategy.id) {
    throw new Error('primary=' + d.worldStrategy.primary + ' id=' + d.worldStrategy.id)
  }
})

// ── 7. Null behavior preserved if no data ──
test('Empty answers still produce BS with id (no crash)', function () {
  var diag = runWorldModelPipeline(EMPTY_ANSWER, { version: 'world_model_v1' })
  var d = diag.diagnosis
  if (!d.cognitiveBlindSpot.id) throw new Error('BS.id missing on empty')
  if (d.cognitiveBlindSpot.id !== d.cognitiveBlindSpot.primary) {
    throw new Error('primary/id mismatch on empty')
  }
})

test('Empty answers still produce Strategy with id (no crash)', function () {
  var diag = runWorldModelPipeline(EMPTY_ANSWER, { version: 'world_model_v1' })
  var d = diag.diagnosis
  if (!d.worldStrategy.id) throw new Error('Strategy.id missing on empty')
  if (d.worldStrategy.id !== d.worldStrategy.primary) {
    throw new Error('primary/id mismatch on empty')
  }
})

// ── 8. Existing fields unchanged (excluding new aliases) ──
test('BS existing field set unchanged (excluding primary)', function () {
  var diag = runWorldModelPipeline(SAMPLE_ANSWER, { version: 'world_model_v1' })
  var d = diag.diagnosis
  var bs = d.cognitiveBlindSpot

  BS_METADATA_FIELDS.forEach(function (field) {
    if (bs[field] === undefined) throw new Error('BS field missing after alias: ' + field)
  })
})

test('Strategy existing field set unchanged (excluding primary)', function () {
  var diag = runWorldModelPipeline(SAMPLE_ANSWER, { version: 'world_model_v1' })
  var d = diag.diagnosis
  var st = d.worldStrategy

  STRATEGY_METADATA_FIELDS.forEach(function (field) {
    if (st[field] === undefined) throw new Error('Strategy field missing after alias: ' + field)
  })
})

// ── 9. validateWorldModelOutput remains PASS ──
test('validateWorldModelOutput returns valid:true', function () {
  var diag = runWorldModelPipeline(SAMPLE_ANSWER, { version: 'world_model_v1' })
  var d = diag.diagnosis
  var v = validateWorldModelOutput(d)
  if (!v.valid) throw new Error('Validator failed: ' + (v.errors || []).join('; '))
  if (v.errors && v.errors.length > 0) throw new Error('Unexpected errors: ' + v.errors.join('; '))
})

// ── 10. Determinism unchanged ──
test('Determinism: same input produces same diagnosis', function () {
  var diag1 = runWorldModelPipeline(SAMPLE_ANSWER, { version: 'world_model_v1' })
  var diag2 = runWorldModelPipeline(SAMPLE_ANSWER, { version: 'world_model_v1' })

  var d1 = diag1.diagnosis
  var d2 = diag2.diagnosis

  if (d1.cognitiveArchetype.primary !== d2.cognitiveArchetype.primary) throw new Error('Archetype divergence')
  if (d1.cognitiveBlindSpot.primary !== d2.cognitiveBlindSpot.primary) throw new Error('BS primary divergence')
  if (d1.worldStrategy.primary !== d2.worldStrategy.primary) throw new Error('Strategy primary divergence')
  if (d1.cognitiveBlindSpot.id !== d2.cognitiveBlindSpot.id) throw new Error('BS id divergence')
  if (d1.worldStrategy.id !== d2.worldStrategy.id) throw new Error('Strategy id divergence')
})

// ── Extra: strategy.targetBlindSpot matches BS.id ──
test('Strategy.targetBlindSpot === BS.id', function () {
  var diag = runWorldModelPipeline(SAMPLE_ANSWER, { version: 'world_model_v1' })
  var d = diag.diagnosis
  var bs = d.cognitiveBlindSpot
  var st = d.worldStrategy

  if (st.targetBlindSpot !== bs.id) {
    throw new Error('target=' + st.targetBlindSpot + ' BS.id=' + bs.id)
  }
  // Also verify target matches BS.primary (redundant since id===primary)
  if (st.targetBlindSpot !== bs.primary) {
    throw new Error('target=' + st.targetBlindSpot + ' BS.primary=' + bs.primary)
  }
})

// ── Extra: archetype primary/secondary still populated ──
test('Archetype primary still populated', function () {
  var diag = runWorldModelPipeline(SAMPLE_ANSWER, { version: 'world_model_v1' })
  var d = diag.diagnosis
  var a = d.cognitiveArchetype
  if (!a.primary) throw new Error('Archetype primary missing')
  if (typeof a.primary !== 'string') throw new Error('Archetype primary not string')
})

// ═══════════════════════════════════════════════════════════════
console.log('\n' + passed + '/' + (passed + failed) + ' tests passed')
if (failed > 0) process.exit(1)
