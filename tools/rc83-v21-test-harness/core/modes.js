'use strict'
// Run modes (P0-A3). run-1 is the only mode required to work now; the others
// (run-100 / determinism / negative / stress) are wired to the same runner but
// are NEVER auto-executed on load (bulk auto-run on load = NO).
const { generateBaseCases, generateNegativeCases } = require('../generators')
const { runCase } = require('./runCase')

function summarize(results) {
  const s = {
    total: results.length,
    pass: results.filter((r) => !r.crash && r.allValidatorsPass).length,
    fail: results.filter((r) => !r.crash && !r.allValidatorsPass).length,
    crash: results.filter((r) => r.crash).length,
    validityDistribution: {},
    cognitionExecuted: { true: 0, false: 0 },
    privacyViolations: 0,
    prohibitedFields: 0,
  }
  for (const r of results) {
    if (r.crash) continue
    const v = r.record.responseValidityStatus
    s.validityDistribution[v] = (s.validityDistribution[v] || 0) + 1
    s.cognitionExecuted[r.record.cognitionExecuted ? 'true' : 'false']++
    for (const val of r.validators) {
      if (val.name === 'privacy' && !val.pass) s.privacyViolations++
      if (val.name === 'evidenceTrace') s.prohibitedFields += val.errors.filter((e) => e.includes('prohibited')).length
    }
  }
  return s
}

function toRow(r) {
  return {
    testCaseId: r.testCaseId,
    familyId: r.familyId,
    seed: r.seed,
    answers: r.answers || null,
    actualValidity: r.crash ? null : r.record.responseValidityStatus,
    cognitionExecuted: r.crash ? null : r.record.cognitionExecuted,
    allValidatorsPass: r.crash ? false : r.allValidatorsPass,
    validatorErrors: r.crash ? [r.error] : r.validators.filter((v) => !v.pass).map((v) => v.name + ':' + v.errors.join(';')),
    crash: r.crash,
  }
}

async function modeRunOne() {
  const c = generateBaseCases()[0]
  const r = await runCase(c)
  return { mode: 'run-1', summary: summarize([r]), rows: [toRow(r)] }
}

async function modeRun100() {
  const cases = generateBaseCases()
  const results = []
  for (const c of cases) results.push(await runCase(c))
  return { mode: 'run-100', summary: summarize(results), rows: results.map(toRow) }
}

async function modeDeterminism() {
  // Regenerate twice → identical inputs; re-run one case twice → identical record.
  const a = generateBaseCases()
  const b = generateBaseCases()
  let inputMismatch = 0
  for (let i = 0; i < a.length; i++) {
    if (JSON.stringify(a[i].answers) !== JSON.stringify(b[i].answers)) inputMismatch++
  }
  const r1 = await runCase(a[0])
  const r2 = await runCase(a[0])
  const recordIdentical = JSON.stringify(r1.record) === JSON.stringify(r2.record)
  return {
    mode: 'determinism',
    summary: {
      total: 2,
      pass: (inputMismatch === 0 && recordIdentical) ? 2 : 0,
      fail: (inputMismatch === 0 && recordIdentical) ? 0 : 2,
      crash: 0,
      determinismViolations: inputMismatch + (recordIdentical ? 0 : 1),
    },
    detail: { inputRegenerationMismatch: inputMismatch, sameInputSameRecord: recordIdentical },
  }
}

async function modeNegative() {
  const cases = generateNegativeCases()
  const results = []
  for (const c of cases) results.push(await runCase(c))
  return { mode: 'negative', summary: summarize(results), rows: results.map(toRow) }
}

async function modeStress(count = 500) {
  const cases = generateBaseCases()
  const results = []
  const total = Math.max(0, Math.floor(count))
  for (let i = 0; i < total; i++) {
    const c = cases[i % cases.length]
    try { results.push(await runCase(c)) }
    catch (e) { results.push({ testCaseId: c.testCaseId, crash: true, error: (e && e.message) || String(e), record: {}, userVisible: false, validators: [], allValidatorsPass: false }) }
  }
  return { mode: 'stress:' + total, summary: summarize(results), rows: results.slice(0, 100).map(toRow) }
}

module.exports = { modeRunOne, modeRun100, modeDeterminism, modeNegative, modeStress, summarize, toRow }
