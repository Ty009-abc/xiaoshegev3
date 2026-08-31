'use strict'
// Case runner (P0-A3). Wraps the REAL production runtime shadow adapter with
// db:null → zero production DB writes. LOCAL_DIRECT_ENGINE only.
const MANIFEST = require('./manifest')
const adapter = require(MANIFEST.runtimeAdapterPath)
const { runAllValidators } = require('../validators')

const FIXED_TIMESTAMP_MS = 1700000000000
const ANONYMOUS_OPENID = 'harness-anon'

async function runCase(testCase) {
  const requestId = 'harness:' + testCase.testCaseId
  const out = await adapter.runRuntimeShadowV21({
    event: { answers: testCase.answers, reportId: requestId },
    openid: ANONYMOUS_OPENID,
    ts: FIXED_TIMESTAMP_MS,
    db: null, // <-- no production DB; persistence branch skipped
  })
  const validators = runAllValidators(out.record, testCase.answers, out.userVisible)
  return {
    testCaseId: testCase.testCaseId,
    familyId: testCase.familyId,
    variantId: testCase.variantId,
    seed: testCase.seed,
    answers: testCase.answers, // {questionId,optionId,displayPosition} — no identity
    record: out.record,
    userVisible: out.userVisible,
    validators,
    allValidatorsPass: validators.every((v) => v.pass),
  }
}

module.exports = { runCase, FIXED_TIMESTAMP_MS, ANONYMOUS_OPENID }
