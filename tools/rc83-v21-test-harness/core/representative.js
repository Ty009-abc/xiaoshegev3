'use strict'
// Representative-case validator test (P0-A3). NOT a formal 100/500 run.
// Exercises all 3 validity states + boundary + negative malformed case
// (<= 12 cases). LOCAL_DIRECT_ENGINE (db:null, no production traffic).
const { generateBaseCases, generateNegativeCases } = require('../generators')
const { runCase } = require('../core/runCase')

function pickCases() {
  const base = generateBaseCases()
  const neg = generateNegativeCases()
  const pick = (familyId, variant) => base.find((c) => c.familyId === familyId && c.variantId === variant)

  // Representative coverage:
  //   RESPONSE_VALID: F01-V00 (clean normal), F10-V00 (boundary 0/3), F06-V00 (contradictory)
  //   RESPONSE_QUALITY_LOW: F02-V00 (all_same), F04-V00 (alternating), F05-V00 (sequential)
  //   INSUFFICIENT: F03-V00 (missing pos), F03-V04 (invalid pos), F03-V06 (dup qid)
  //   Negative: N01 (missing answer), N10 (non-array)
  const reps = [
    pick('F01', 0),
    pick('F10', 0),
    pick('F06', 0),
    pick('F02', 0),
    pick('F04', 0),
    pick('F05', 0),
    pick('F03', 0),
    pick('F03', 4),
    pick('F03', 6),
    neg.find((c) => c.testCaseId === 'N01'),
    neg.find((c) => c.testCaseId === 'N10'),
  ].filter(Boolean)

  return reps
}

async function runRepresentative() {
  const cases = pickCases()
  const results = []
  for (const c of cases) {
    try {
      const r = await runCase(c)
      results.push({ testCaseId: r.testCaseId, crash: false, ...r })
    } catch (e) {
      results.push({ testCaseId: c.testCaseId, crash: true, error: (e && e.message) || String(e) })
    }
  }
  const summary = {
    total: results.length,
    pass: results.filter((r) => !r.crash && r.allValidatorsPass).length,
    fail: results.filter((r) => !r.crash && !r.allValidatorsPass).length,
    crash: results.filter((r) => r.crash).length,
    validityStatesExercised: {},
  }
  for (const r of results) {
    if (!r.crash) {
      const v = r.record.responseValidityStatus
      summary.validityStatesExercised[v] = (summary.validityStatesExercised[v] || 0) + 1
    }
  }
  return { summary, results }
}

if (require.main === module) {
  runRepresentative().then(({ summary, results }) => {
    console.log(JSON.stringify({ summary, results: results.map((r) => ({
      testCaseId: r.testCaseId,
      crash: r.crash,
      validityStatus: r.crash ? null : r.record.responseValidityStatus,
      cognitionExecuted: r.crash ? null : r.record.cognitionExecuted,
      allValidatorsPass: r.crash ? false : r.allValidatorsPass,
      failures: r.crash ? [r.error] : r.validators.filter((v) => !v.pass).map((v) => v.name + ':' + v.errors.join(';')),
    })) }, null, 2))
  }).catch((e) => { console.error(e.stack || e); process.exit(1) })
}

module.exports = { pickCases, runRepresentative }
