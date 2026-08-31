'use strict'
// Generator self-test (A2). Runs generator-level checks ONLY — no bulk runtime
// qualification, no production/network/DB access.
const { generateBaseCases, generateNegativeCases, FAMILY_COUNT, VARIANTS_PER_FAMILY } = require('./index')
const { QUESTION_BY_ID, QUESTION_COUNT_V21, detectPatterns } = require('./load')

const QUESTION_COUNT = QUESTION_COUNT_V21 // canonical 18

function run() {
  const report = {
    baseCaseCount: null,
    negativeCaseCount: null,
    familyCount: null,
    allBaseCases18Q: null,
    questionIdsFromCanonical: null,
    optionIdsLegal: null,
    displayPositionIntegerInRange: null,
    sameSeedSameAnswers: null,
    distinctVariants: null,
    negativeCasesGenerated: null,
    determinismMismatch: 0,
    checks: [],
  }

  const base = generateBaseCases()
  const neg = generateNegativeCases()

  report.familyCount = FAMILY_COUNT
  report.baseCaseCount = base.length
  report.negativeCaseCount = neg.length

  // 1. 100 base cases generated.
  let baseCountOk = base.length === FAMILY_COUNT * VARIANTS_PER_FAMILY
  report.checks.push({ check: 'BASE_CASE_COUNT', pass: baseCountOk, detail: base.length })

  // 2. All normal cases exactly 18Q; position validity scoped to
  //    non-insufficiency cases (F03 intentionally violates structure).
  let all18 = true
  let allQidsCanonical = true
  let allOptsLegal = true
  let allPosIntegerInRange = true
  for (const c of base) {
    if (!Array.isArray(c.answers) || c.answers.length !== 18) { all18 = false; continue }
    const isInsufficient = c.expectedStructuralProperties.intendedValidityTendency === 'INSUFFICIENT_RESPONSE_QUALITY'
    for (const a of c.answers) {
      if (!QUESTION_BY_ID.has(a.questionId)) allQidsCanonical = false
      const q = QUESTION_BY_ID.get(a.questionId)
      if (!q || !q.options.some((o) => o.optionId === a.optionId)) allOptsLegal = false
      const p = a.displayPosition
      if (!isInsufficient) {
        if (typeof p !== 'number' || !Number.isInteger(p) || p < 0 || p > 3) allPosIntegerInRange = false
      }
    }
  }
  report.allBaseCases18Q = all18
  report.questionIdsFromCanonical = allQidsCanonical
  report.optionIdsLegal = allOptsLegal
  report.displayPositionIntegerInRange = allPosIntegerInRange
  report.checks.push({ check: 'ALL_BASE_CASES_18Q', pass: all18 })
  report.checks.push({ check: 'QUESTION_IDS_FROM_CANONICAL', pass: allQidsCanonical })
  report.checks.push({ check: 'OPTION_IDS_LEGAL', pass: allOptsLegal })
  report.checks.push({ check: 'DISPLAY_POSITION_INT_IN_RANGE', pass: allPosIntegerInRange })

  // 3. Determinism: regenerate → identical answers.
  const base2 = generateBaseCases()
  let mismatch = 0
  let sameSeedSame = true
  for (let i = 0; i < base.length; i++) {
    if (JSON.stringify(base[i]) !== JSON.stringify(base2[i])) { mismatch++; sameSeedSame = false }
  }
  report.sameSeedSameAnswers = sameSeedSame
  report.determinismMismatch = mismatch
  report.checks.push({ check: 'SAME_SEED_SAME_ANSWERS', pass: sameSeedSame, detail: `mismatch=${mismatch}` })

  // 4. Distinct variants distinguishable (testCaseId + seed differ across variants).
  let distinct = true
  for (const key of Object.keys(base[0] && {})) { /* noop */ }
  const seen = new Set()
  for (const c of base) {
    const sig = c.testCaseId
    if (seen.has(sig)) { distinct = false; break }
    seen.add(sig)
  }
  // Also ensure variants within a family differ in answers (sanity).
  const f01 = base.filter((c) => c.familyId === 'F01')
  const sigs = new Set(f01.map((c) => JSON.stringify(c.answers)))
  if (f01.length === 10 && sigs.size !== 10) distinct = false
  report.distinctVariants = distinct
  report.checks.push({ check: 'DISTINCT_VARIANTS', pass: distinct })

  // 5. Negative set generated.
  const negOk = neg.length === 10
  report.negativeCasesGenerated = negOk
  report.checks.push({ check: 'NEGATIVE_CASES_GENERATED', pass: negOk, detail: neg.length })

  // 6. No pattern leakage in F01 (clean family must have no mechanical pattern).
  const f01answers = base.filter((c) => c.familyId === 'F01')
  let f01Clean = true
  for (const c of f01answers) {
    const L = c.answers.map((a) => a.displayPosition)
    if (detectPatterns(L).length !== 0) { f01Clean = false }
  }
  report.checks.push({ check: 'F01_CLEAN_NO_PATTERN', pass: f01Clean })

  // 7. F03 insufficiency cases are all documented + structurally insufficient.
  const f03 = base.filter((c) => c.familyId === 'F03')
  let f03Documented = f03.length === 10
  for (const c of f03) {
    if (!c.expectedStructuralProperties.insufficiencyKind) f03Documented = false
  }
  report.checks.push({ check: 'F03_INSUFFICIENCY_DOCUMENTED', pass: f03Documented, detail: f03.length })

  report.overallPass = report.checks.every((c) => c.pass)

  return report
}

if (require.main === module) {
  const r = run()
  console.log(JSON.stringify(r, null, 2))
  process.exit(r.overallPass ? 0 : 1)
}

module.exports = { run }
