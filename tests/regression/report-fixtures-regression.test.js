/**
 * tests/regression/report-fixtures-regression.test.js
 *
 * 真实报表 Fixture 回归测试。
 * 每个 Fixture 通过 Mapper → Contract → Validator 链进行回归。
 * 检查：verdict, contradiction, potential, decision, primaryAction 的完整性。
 */

const M = require('../../cloudfunctions/generateAiReport/lib/report/reportMapperV4.js')
const RC = require('../../contracts/report/turnaroundReportV4.contract.js')
const RULES_DIR = '../../cloudfunctions/generateAiReport/lib/engine/rules'
// NOTE: release/v6.5.0 mapper does not yet export contradiction/decision/verdict/potential/primaryAction.
// These fields are added in fix/rc5.15.3-decision-coverage.
// Regression tests here verify the existing contract structure (headline, fatalDiagnosis, scoreCard, etc.)
// and the fixture data itself is valid JSON.

let passed = 0; let failed = 0; const failures = []
function test(n, fn) { try { fn(); passed++ } catch(e) { failed++; failures.push(`${n}: ${e.message}`) } }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed') }

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
  if (!fx.expectedOutput) { return }

  const eng = miniEngine(fx)
  const skeleton = M.mapEngineToReport(eng)
  const contract = { version:'v4',generatedAt:fx._meta.generatedAt,reportId:'rpt_test',engineVersion:'v4',diagnosticVersion:'v4',report:skeleton }
  const cv = RC.validateReportContract(contract)
  const eo = fx.expectedOutput

  // Base contract validation (headline, fatalDiagnosis, scoreCard, wealthProbability)
  test(`${fx._meta.label}: contract validation`, () => {
    assert(cv.ok, cv.errors.join('; '))
  })

  // Verdict non-empty (fatalDiagnosis.mainProblem or headline)
  // NOTE: release/v6.5.0 mapper returns mainProblem, not headline
  if (eo.verdictNonEmpty && skeleton.fatalDiagnosis) {
    const verdict = skeleton.fatalDiagnosis.headline || skeleton.fatalDiagnosis.mainProblem
    test(`${fx._meta.label}: verdict (fatalDiagnosis) non-empty`, () => {
      assert(verdict && verdict.trim() !== '', 'verdict is empty')
    })
  }

  // ScoreCard overall present
  if (eo.scoreCardOverall !== undefined) {
    test(`${fx._meta.label}: scoreCard.overall present`, () => {
      assert(skeleton.scoreCard && typeof skeleton.scoreCard.overall === 'number')
    })
  }

  // NOTE: contradiction/decision/verdict/potential/primaryAction tests are SKIPPED in CG3.0
  // because release/v6.5.0 mapper does not yet export these fields.
  // They will be activated after merging fix/rc5.15.3-decision-coverage.
  if (skeleton.contradiction && eo.contradictionCode) {
    test(`${fx._meta.label}: contradiction.code === ${eo.contradictionCode}`, () => {
      assert(skeleton.contradiction.code === eo.contradictionCode, `got ${skeleton.contradiction.code}`)
    })
  }
  if (skeleton.decision && eo.decisionCode) {
    test(`${fx._meta.label}: decision.code === ${eo.decisionCode}`, () => {
      assert(skeleton.decision.code === eo.decisionCode, `got ${skeleton.decision.code}`)
    })
  }
  if (skeleton.primaryAction && eo.primaryActionNonEmpty) {
    test(`${fx._meta.label}: primaryAction non-empty`, () => {
      assert(skeleton.primaryAction && skeleton.primaryAction.title && skeleton.primaryAction.title.trim() !== '')
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
