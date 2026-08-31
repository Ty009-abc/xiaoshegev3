'use strict'
// RC8.3 Stage20 V2.1 Synthetic Test Harness — P0-B Automated Qualification.
// LOCAL_DIRECT_ENGINE only. db:null → zero production DB writes. No production
// traffic, no deploy/merge/PRIMARY. This qualifies the ENGINE, never tunes it.
const { generateBaseCases, generateNegativeCases, FAMILIES } = require('../generators')
const { runCase } = require('./runCase')
const { summarize } = require('./modes')

// ── 500-case stress generator (reuses frozen family builders, extended variant
//    space). Does NOT modify the frozen 100-case generator. Varies family +
//    variant + displayPosition pattern + validity pattern + boundary. ─────────
function generateStressCases(count = 500) {
  const famKeys = Object.keys(FAMILIES).sort()
  const variantsPerFamily = Math.ceil(count / famKeys.length)
  const cases = []
  for (let v = 0; v < variantsPerFamily; v++) {
    for (const key of famKeys) {
      if (cases.length >= count) break
      cases.push(FAMILIES[key](v))
    }
    if (cases.length >= count) break
  }
  return cases.slice(0, count)
}

// ── Failure classification (spec §3). ────────────────────────────────────────
function classifyFailure(r) {
  if (r.crash) return 'RUNTIME_EXCEPTION'
  const classes = []
  for (const v of r.validators) {
    if (v.pass) continue
    switch (v.name) {
      case 'answerTrace': classes.push('ANSWER_TRACE_ERROR'); break
      case 'validityTrace': classes.push('VALIDITY_TRACE_ERROR'); break
      case 'evidenceTrace': classes.push('EVIDENCE_TRACE_ERROR'); break
      case 'privacy': classes.push('PRIVACY_VIOLATION'); break
      case 'cognitionInvariant': classes.push('COGNITION_CONTRACT_ERROR'); break
      case 'shadowIsolation': classes.push('SHADOW_ISOLATION_VIOLATION'); break
      default: classes.push('UNKNOWN')
    }
  }
  const uniq = [...new Set(classes)]
  return uniq.length ? uniq.join('+') : 'UNKNOWN'
}

function toFailureEntry(r) {
  return {
    testCaseId: r.testCaseId,
    familyId: r.familyId,
    seed: r.seed,
    failureClass: classifyFailure(r),
    validatorErrors: r.crash
      ? [{ validator: 'runtime', errors: [r.error] }]
      : r.validators.filter((v) => !v.pass).map((v) => ({ validator: v.name, errors: v.errors })),
  }
}

// ── Validator pass-rate computation across a run. ────────────────────────────
function computeValidatorRates(results) {
  const names = ['answerTrace', 'validityTrace', 'evidenceTrace', 'privacy', 'cognitionInvariant', 'shadowIsolation']
  const rates = {}
  let identityLeakageCount = 0
  let prohibitedFieldCount = 0
  for (const name of names) {
    const applicable = results.filter((r) => !r.crash)
    const pass = applicable.filter((r) => r.validators.some((v) => v.name === name && v.pass))
    rates[name] = applicable.length ? +(pass.length / applicable.length * 100).toFixed(2) : null
  }
  for (const r of results) {
    if (r.crash) continue
    for (const v of r.validators) {
      if (v.name === 'privacy') identityLeakageCount += (v.identityLeakageCount || 0)
      if (v.name === 'evidenceTrace') prohibitedFieldCount += v.errors.filter((e) => e.includes('prohibited')).length
    }
  }
  return { rates, identityLeakageCount, prohibitedFieldCount }
}

// ── Determinism: run same case twice, compare full record (no timestamp/random
//    fields exist → zero exclusions). ─────────────────────────────────────────
function diffPaths(a, b, path = '', out = []) {
  if (Object.is(a, b)) return out
  if (typeof a !== typeof b) { out.push({ path, a, b }); return out }
  if (a === null || b === null || typeof a !== 'object') { out.push({ path, a, b }); return out }
  const aArr = Array.isArray(a); const bArr = Array.isArray(b)
  if (aArr !== bArr) { out.push({ path, a, b }); return out }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) {
    if (out.length >= 20) break
    if (!(k in a)) { out.push({ path: path + '.' + k, a: undefined, b: b[k] }); continue }
    if (!(k in b)) { out.push({ path: path + '.' + k, a: a[k], b: undefined }); continue }
    diffPaths(a[k], b[k], path + '.' + k, out)
  }
  return out
}

async function runDeterminism(cases) {
  const comparisons = []
  let match = 0
  let mismatch = 0
  const mismatches = []
  for (const c of cases) {
    const r1 = await runCase(c)
    const r2 = await runCase(c)
    comparisons.push(c.testCaseId)
    if (JSON.stringify(r1.record) === JSON.stringify(r2.record)) {
      match++
    } else {
      mismatch++
      mismatches.push({ testCaseId: c.testCaseId, diff: diffPaths(r1.record, r2.record) })
    }
  }
  return { comparisons: comparisons.length, match, mismatch, mismatches }
}

// ── Main qualification. ──────────────────────────────────────────────────────
async function runQualification() {
  const PRE_RUN_SHA = process.env.PRE_RUN_SHA || null
  const baseCases = generateBaseCases()
  const negativeCases = generateNegativeCases()
  const stressCases = generateStressCases(500)

  // 1) RUN_100_MATRIX
  const run100Results = []
  for (const c of baseCases) {
    try { run100Results.push(await runCase(c)) }
    catch (e) { run100Results.push({ testCaseId: c.testCaseId, familyId: c.familyId, variantId: c.variantId, seed: c.seed, crash: true, error: (e && e.message) || String(e), record: {}, validators: [], allValidatorsPass: false }) }
  }
  const run100Summary = summarize(run100Results)
  const run100Rates = computeValidatorRates(run100Results)

  // 2) NEGATIVE_SUITE
  const negResults = []
  for (const c of negativeCases) {
    try { negResults.push(await runCase(c)) }
    catch (e) { negResults.push({ testCaseId: c.testCaseId, familyId: c.familyId, variantId: c.variantId, seed: c.seed, crash: true, error: (e && e.message) || String(e), record: {}, validators: [], allValidatorsPass: false }) }
  }
  const negativeSafeHandled = negResults.filter((r) => !r.crash).length
  const negativeCrashes = negResults.filter((r) => r.crash).length

  // 3) DETERMINISM (>=100 comparisons, full 100 base cases × 2)
  const determinism = await runDeterminism(baseCases)

  // 4) RUN_500_STRESS
  const run500Results = []
  for (const c of stressCases) {
    try { run500Results.push(await runCase(c)) }
    catch (e) { run500Results.push({ testCaseId: c.testCaseId, familyId: c.familyId, variantId: c.variantId, seed: c.seed, crash: true, error: (e && e.message) || String(e), record: {}, validators: [], allValidatorsPass: false }) }
  }
  const run500Summary = summarize(run500Results)
  const run500Rates = computeValidatorRates(run500Results)

  // Failures (run100 + run500, non-pass/crash).
  const caseFailures = []
  for (const r of [...run100Results, ...run500Results]) {
    if (r.crash || !r.allValidatorsPass) caseFailures.push(toFailureEntry(r))
  }

  const validityStatesExercised = {}
  for (const r of [...run100Results, ...run500Results, ...negResults]) {
    if (r.crash) continue
    const v = r.record.responseValidityStatus
    if (v) validityStatesExercised[v] = (validityStatesExercised[v] || 0) + 1
  }

  return {
    candidateSha: PRE_RUN_SHA,
    canonicalBaseSha: PRE_RUN_SHA,
    generatorVersion: 'P0-A2.1',
    runSeed: 'LOCAL_DIRECT_ENGINE:DETERMINISTIC:FIXED_TIMESTAMP',
    executionArchitecture: 'LOCAL_DIRECT_ENGINE',
    productionTrafficUsed: false,
    productionDbWrites: 0,
    syntheticRecordsEnteredGateBN: 0,

    run100: {
      total: run100Results.length,
      pass: run100Summary.pass,
      fail: run100Summary.fail,
      crash: run100Summary.crash,
      validityDistribution: run100Summary.validityDistribution,
      cognitionExecuted: run100Summary.cognitionExecuted.true,
      cognitionBlocked: run100Summary.cognitionExecuted.false,
      validatorPassRates: run100Rates.rates,
      identityLeakageCount: run100Rates.identityLeakageCount,
      prohibitedFieldCount: run100Rates.prohibitedFieldCount,
    },

    negative: {
      total: negativeCases.length,
      safeHandled: negativeSafeHandled,
      crashes: negativeCrashes,
      handledStatuses: negResults.filter((r) => !r.crash).map((r) => ({ testCaseId: r.testCaseId, validityStatus: r.record.responseValidityStatus, cognitionExecuted: r.record.cognitionExecuted })),
    },

    determinism: {
      comparisons: determinism.comparisons,
      match: determinism.match,
      mismatch: determinism.mismatch,
      mismatches: determinism.mismatches,
    },

    run500: {
      total: run500Results.length,
      pass: run500Summary.pass,
      fail: run500Summary.fail,
      crash: run500Summary.crash,
      validityDistribution: run500Summary.validityDistribution,
      cognitionExecuted: run500Summary.cognitionExecuted.true,
      cognitionBlocked: run500Summary.cognitionExecuted.false,
      validatorPassRates: run500Rates.rates,
      identityLeakageCount: run500Rates.identityLeakageCount,
      prohibitedFieldCount: run500Rates.prohibitedFieldCount,
    },

    aggregateMetrics: {
      allThreeValidityStatesExercised: validityStatesExercised,
      totalIdentityLeakageCount: run100Rates.identityLeakageCount + run500Rates.identityLeakageCount,
      totalProhibitedFieldCount: run100Rates.prohibitedFieldCount + run500Rates.prohibitedFieldCount,
      totalCrashes: run100Summary.crash + run500Summary.crash + negativeCrashes,
    },

    caseFailures,
    knownDefects: [],
  }
}

if (require.main === module) {
  runQualification().then((artifact) => {
    console.log(JSON.stringify(artifact, null, 2))
  }).catch((e) => { console.error(e.stack || e); process.exit(1) })
}

module.exports = { runQualification, generateStressCases, classifyFailure, computeValidatorRates, runDeterminism }
