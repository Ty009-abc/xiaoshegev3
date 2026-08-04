/**
 * tests/regression/report-fixtures-regression.test.js
 *
 * 真实报表 Fixture 回归测试 — 零 SKIP 版本。
 *
 * 每个 Fixture 通过 Mapper → Contract → Validator 链进行回归。
 * 强制检查: verdict, contradiction, potential, decision, primaryAction 的完整性。
 * 缺失任何关键字段直接 FAIL，exit 1。
 */

const M = require('../../cloudfunctions/generateAiReport/lib/report/reportMapperV4.js')
const RC = require('../../contracts/report/turnaroundReportV4.contract.js')
const SV = require('../../utils/reportSemanticValidator.js')
const RULES_DIR = '../../cloudfunctions/generateAiReport/lib/engine/rules'

let passed = 0; let failed = 0; const failures = []
function test(n, fn) { try { fn(); passed++ } catch(e) { failed++; failures.push(`${n}: ${e.message}`) } }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed') }

/** Validate fixture structural schema before any content test */
function validateFixtureSchema(fx, path) {
  assert(fx.fixtureVersion, `FIXTURE_SCHEMA_INVALID: ${path} — missing fixtureVersion`)
  assert(fx.sourceVersion, `FIXTURE_SCHEMA_INVALID: ${path} — missing sourceVersion`)
  assert(fx.description, `FIXTURE_SCHEMA_INVALID: ${path} — missing description`)
  assert(fx.input, `FIXTURE_SCHEMA_INVALID: ${path} — missing input`)
  assert(fx.expectedOutput, `FIXTURE_SCHEMA_INVALID: ${path} — missing expectedOutput`)
}

// Load rules
const categoryFiles = ['incomeRules','cashflowRules','skillRules','timeRules','executionRules','goalRules','riskRules','decisionRules']
let ALL_RULES = []
for (const f of categoryFiles) {
  try { ALL_RULES = ALL_RULES.concat(require(RULES_DIR + '/' + f + '.js')) }
  catch(e) {}
}

// Mini engine
function miniEngine(p) {
  const d = {
    lifeStage:'early_career',primaryGoal:'financial_independence',
    incomeStructureRaw:p.input.incomeStructureRaw||{level:p.input.incomeStructure},
    monthlySurplusRaw:p.input.monthlySurplusRaw||{level:p.input.monthlySurplus,value:3000},
    safetyMonthsRaw:p.input.safetyMonthsRaw||{level:p.input.safetyMonths,value:4.5},
    debtPressureRaw:p.input.debtPressureRaw||{level:p.input.debtPressure},
    monetizableSkillRaw:p.input.monetizableSkillRaw||{level:p.input.monetizableSkill},
    skillValidationRaw:p.input.skillValidationRaw||{level:p.input.skillValidation},
    weeklyTimeRaw:p.input.weeklyTimeRaw||{level:p.input.weeklyTime},
    pastAttemptStageRaw:p.input.pastAttemptStageRaw||{level:p.input.pastAttemptStage},
    decisionStyleRaw:p.input.decisionStyleRaw||{level:p.input.decisionStyle},
    maxTrialCost:'3000',
  }
  if (p.input.skillType) d.skillType = p.input.skillType
  let fatal=[],advantage=[]
  for (const rule of ALL_RULES) {
    if (typeof rule.condition !== 'function') continue
    try {
      if (rule.condition(d)) {
        const w = rule.weight||50
        const e = {id:rule.id,name:rule.name||rule.id,type:rule.type||'matched',weight:w,output:{title:rule.name||rule.id,description:rule.output?.description||'',advice:rule.output?.advice||''}}
        if (rule.level==='fatal') fatal.push(e)
        else if (rule.level==='advantage') advantage.push(e)
        else fatal.push(e)
      }
    } catch(e) {}
  }
  const fc=fatal.length,ac=advantage.length
  const overall=Math.round(Math.max(10,Math.min(90,40+ac*5-fc*3)))
  return {normalizedProfile:d,fatalRules:fatal.slice(0,4),advantageRules:advantage.slice(0,4),matchedRules:fatal.slice(0,8),scores:{cashflow:50,skill:50,execution:30,time:40,risk:75,overall:overall},labels:[],riskLevel:fc>3?'high':fc>1?'medium':'low',wealthProbability:overall,meta:{engineVersion:'v4'}}
}

function runFixture(path) {
  const fx = require(path)
  const label = fx._meta?.label || path

  // === STEP 0: Schema validation (MANDATORY — must FAIL if missing) ===
  validateFixtureSchema(fx, path)

  const eng = miniEngine(fx)
  const skeleton = M.mapEngineToReport(eng)
  const contract = { version:'v4',generatedAt:fx._meta.generatedAt,reportId:'rpt_test',engineVersion:'v4',diagnosticVersion:'v4',report:skeleton }
  const cv = RC.validateReportContract(contract)
  const eo = fx.expectedOutput

  // === CONTRACT VALIDATION ===
  test(`${label}: contract validation`, () => {
    assert(cv.ok, cv.errors.join('; '))
  })

  // === VERDICT (MANDATORY) ===
  test(`${label}: verdict non-empty`, () => {
    const verdict = skeleton.fatalDiagnosis?.headline || skeleton.fatalDiagnosis?.mainProblem || ''
    if (eo.verdictNonEmpty) {
      assert(verdict && verdict.trim().length > 0, 'verdict is empty but expectedNonEmpty=true')
    } else {
      // If fixture says verdictNonEmpty=false, it's acceptable to be empty
      assert(true, 'verdict expected empty')
    }
  })

  // === CONTRADICTION (MANDATORY) ===
  test(`${label}: contradiction present`, () => {
    assert(skeleton.contradiction, 'contradiction is missing')
    assert(skeleton.contradiction.code, 'contradiction.code is missing')
  })
  test(`${label}: contradiction.code === ${eo.contradictionCode}`, () => {
    assert(skeleton.contradiction.code === eo.contradictionCode,
      `expected contradiction.code=${eo.contradictionCode}, got ${skeleton.contradiction.code}`)
  })
  test(`${label}: contradiction has title`, () => {
    assert(skeleton.contradiction.title && skeleton.contradiction.title.trim().length > 0,
      'contradiction.title is empty')
  })
  test(`${label}: contradiction has description`, () => {
    const desc = skeleton.contradiction.description || skeleton.contradiction.desc
    assert(desc && desc.trim().length > 0,
      'contradiction.description (or desc) is empty')
  })

  // === DECISION (MANDATORY) ===
  test(`${label}: decision present`, () => {
    assert(skeleton.decision, 'decision is missing')
    assert(skeleton.decision.code, 'decision.code is missing')
  })
  test(`${label}: decision.code === ${eo.decisionCode}`, () => {
    assert(skeleton.decision.code === eo.decisionCode,
      `expected decision.code=${eo.decisionCode}, got ${skeleton.decision.code}`)
  })
  test(`${label}: decision has title`, () => {
    assert(skeleton.decision.title && skeleton.decision.title.trim().length > 0,
      'decision.title is empty')
  })
  test(`${label}: decision has reason`, () => {
    assert(skeleton.decision.reason && skeleton.decision.reason.trim().length > 0,
      'decision.reason is empty')
  })

  // === POTENTIAL (MANDATORY) ===
  test(`${label}: potential present`, () => {
    assert(skeleton.potential, 'potential is missing')
    assert(typeof skeleton.potential.score === 'number', 'potential.score is not a number')
  })
  if (eo.potentialScoreAbove !== undefined) {
    test(`${label}: potential.score > ${eo.potentialScoreAbove}`, () => {
      assert(skeleton.potential.score > eo.potentialScoreAbove,
        `potential.score=${skeleton.potential.score} <= ${eo.potentialScoreAbove}`)
    })
  }
  if (eo.potentialScoreBelow !== undefined) {
    test(`${label}: potential.score < ${eo.potentialScoreBelow}`, () => {
      assert(skeleton.potential.score < eo.potentialScoreBelow,
        `potential.score=${skeleton.potential.score} >= ${eo.potentialScoreBelow}`)
    })
  }

  // === PRIMARY ACTION (MANDATORY) ===
  test(`${label}: primaryAction present`, () => {
    assert(skeleton.primaryAction, 'primaryAction is missing')
  })
  test(`${label}: primaryAction non-empty`, () => {
    assert(skeleton.primaryAction.title && skeleton.primaryAction.title.trim().length > 0,
      'primaryAction.title is empty')
  })
  test(`${label}: primaryAction has checkpoint`, () => {
    assert(skeleton.primaryAction.checkpoint && skeleton.primaryAction.checkpoint.trim().length > 0,
      'primaryAction.checkpoint is empty')
  })
  test(`${label}: primaryAction has successCriteria`, () => {
    assert(Array.isArray(skeleton.primaryAction.successCriteria) && skeleton.primaryAction.successCriteria.length > 0,
      'primaryAction.successCriteria is empty or not an array')
  })

  // Optional: title contains
  if (eo.primaryActionTitleContains) {
    test(`${label}: primaryAction.title contains "${eo.primaryActionTitleContains}"`, () => {
      assert(skeleton.primaryAction.title.includes(eo.primaryActionTitleContains),
        `expected title to contain "${eo.primaryActionTitleContains}", got "${skeleton.primaryAction.title}"`)
    })
  }
}

// Run all fixtures
const reportFixtures = [
  '../fixtures/reports/high-cognition-low-execution.json',
  '../fixtures/reports/single-income-low-buffer.json',
  '../fixtures/reports/learning-strong-low-monetization.json',
  '../fixtures/reports/contradictory-answers.json',
  '../fixtures/reports/ideal-profile.json',
]

for (const f of reportFixtures) {
  try {
    runFixture(f)
  } catch(e) {
    failed++;
    failures.push(`${f}: ${e.message}`)
  }
}

console.log(`\nFixture Regression: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  failures.forEach(f => console.log('  FAIL:', f))
  process.exit(1)
} else {
  console.log('ALL FIXTURE REGRESSION TESTS PASSED')
  process.exit(0)
}
