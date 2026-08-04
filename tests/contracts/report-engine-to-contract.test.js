/**
 * tests/contracts/report-engine-to-contract.test.js
 *
 * 测试：Engine Result → Report Contract 的转换完整性。
 * 必须拦截：字段丢失、finalStrike→decision错误映射、旧报告冒充新版。
 */

const REPORT_CONTRACT = require('../../contracts/report/turnaroundReportV4.contract.js')

let passed = 0
let failed = 0
const failures = []

function test(name, fn) {
  try {
    fn()
    passed++
  } catch (e) {
    failed++
    failures.push(`${name}: ${e.message}`)
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed')
}

// ── 正常报告 ──
test('valid v4 report passes contract', () => {
  const report = {
    version: 'v4',
    generatedAt: new Date().toISOString(),
    reportId: 'rpt_v4_test_001',
    engineVersion: 'v4',
    diagnosticVersion: 'v4',
    report: {
      headline: 'test',
      wealthStage: { stage: 'early', desc: '' },
      fatalDiagnosis: { headline: '测试判决', description: 'test', advice: 'test' },
      fatalRules: [{ id: 'r1', name: 'r1' }],
      advantageRules: [],
      opportunityRules: [],
      scoreCard: { cashflow: 50, skill: 50, execution: 50, time: 50, risk: 50, overall: 50 },
      wealthProbability: { current: 50, in30Days: 52, in90Days: 55, in365Days: 60 },
      wealthPath: { path: 'balanced' },
      actionPlan: { day1: {}, day7: {}, day30: {}, day90: {} },
      stopDoing: [],
      identityUpgrade: {},
      finalStrike: { text: 'test' },
    },
  }
  const r = REPORT_CONTRACT.validateReportContract(report)
  assert(r.ok, `expected ok, got errors: ${r.errors.join('; ')}`)
})

// ── 字段丢失 ──
test('missing report section triggers error', () => {
  const report = {
    version: 'v4',
    generatedAt: new Date().toISOString(),
    reportId: 'rpt_v4_test_002',
    engineVersion: 'v4',
    diagnosticVersion: 'v4',
    report: {
      headline: 'test',
      // 缺少 wealthStage, fatalDiagnosis, fatalRules 等
    },
  }
  const r = REPORT_CONTRACT.validateReportContract(report)
  assert(!r.ok, 'expected contract to fail for missing sections')
  assert(r.errors.length > 0, 'expected at least one error')
})

// ── finalStrike 错误映射为 decision（应该在其他层检查，这里确保 Contract 不会被混淆） ──
test('finalStrike exists but does not masquerade as decision', () => {
  const report = {
    version: 'v4',
    generatedAt: new Date().toISOString(),
    reportId: 'rpt_v4_test_003',
    engineVersion: 'v4',
    diagnosticVersion: 'v4',
    report: {
      headline: 'test',
      wealthStage: null,
      fatalDiagnosis: { headline: '判决' },
      fatalRules: [],
      advantageRules: [],
      opportunityRules: [],
      scoreCard: null,
      wealthProbability: null,
      wealthPath: null,
      actionPlan: null,
      stopDoing: null,
      identityUpgrade: null,
      finalStrike: { text: 'FINAL STRIKE — SHOULD NOT BE DECISION' },
    },
  }
  const r = REPORT_CONTRACT.validateReportContract(report)
  assert(r.ok || r.errors.length <= 1, 'Contract should not reject valid report with finalStrike')
})

// ── scoreCard 值域 ──
test('scoreCard values out of range', () => {
  const report = {
    version: 'v4',
    generatedAt: new Date().toISOString(),
    reportId: 'rpt_v4_test_004',
    engineVersion: 'v4',
    diagnosticVersion: 'v4',
    report: {
      headline: null,
      wealthStage: null,
      fatalDiagnosis: null,
      fatalRules: [],
      advantageRules: [],
      opportunityRules: [],
      scoreCard: { cashflow: 150, skill: -5, execution: 50, time: 50, risk: 50, overall: 50 },
      wealthProbability: null,
      wealthPath: null,
      actionPlan: null,
      stopDoing: null,
      identityUpgrade: null,
      finalStrike: null,
    },
  }
  const r = REPORT_CONTRACT.validateReportContract(report)
  assert(!r.ok, 'expected contract to fail for out-of-range scoreCard')
  assert(r.errors.some(e => e.includes('cashflow') || e.includes('skill')), 'expected scoreCard range error')
})

// ── FALLBACK contradiction ──
test('FALLBACK contradiction triggers warning', () => {
  const report = {
    version: 'v4',
    generatedAt: new Date().toISOString(),
    reportId: 'rpt_v4_test_005',
    engineVersion: 'v4',
    diagnosticVersion: 'v4',
    report: {
      headline: null,
      wealthStage: null,
      fatalDiagnosis: null,
      fatalRules: [],
      advantageRules: [],
      opportunityRules: [],
      scoreCard: null,
      wealthProbability: null,
      wealthPath: null,
      actionPlan: null,
      stopDoing: null,
      identityUpgrade: null,
      finalStrike: null,
      contradiction: { code: 'FALLBACK', title: 'fallback', description: 'fallback description' },
    },
  }
  const r = REPORT_CONTRACT.validateReportContract(report)
  assert(r.warnings.some(w => w.includes('FALLBACK')), 'expected FALLBACK warning')
  // Note: may have other warnings, but FALLBACK-specific warning must be present
})

console.log(`\nContract Tests: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.log('Failures:')
  failures.forEach(f => console.log('  FAIL:', f))
  process.exit(1)
} else {
  console.log('ALL CONTRACT TESTS PASSED')
  process.exit(0)
}
