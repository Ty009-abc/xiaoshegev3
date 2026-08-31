'use strict'
// Trace validators (P0-A3). Read-only. No mutation of records or inference.
//
// displayPosition canonical domain (from responseValidityV21.js):
//   {0,1,2,3} 0-based integer (isValidDisplayPosition: >=0 && <=3). 0 is legal;
//   0 is the start; max is fixed at 3. NOT dynamic by option count at the
//   server validity gate (client-side validateAnswers is per-option-count, but
//   the runtime gate is the server authority and is fixed 0-3).

const ANSWER_TRACE_FIELDS = ['questionId', 'optionId', 'displayPosition']
const VALIDITY_TRACE_TOP_FIELDS = ['status', 'reasons', 'counts', 'observedSignals']
const EVIDENCE_TRACE_FIELDS = ['evidenceId', 'direction', 'distortionType', 'matchedQuestionIds', 'matchedOptionIds']

const VALIDITY_STATUS_SET = ['RESPONSE_VALID', 'RESPONSE_QUALITY_LOW', 'INSUFFICIENT_RESPONSE_QUALITY']

// Exact runtime `counts` keys (from assessResponseValidityV21). No invented `n`.
const VALIDITY_COUNTS_KEYS = [
  'totalEntries', 'answered', 'malformedEntries', 'distinctQuestions',
  'duplicateQuestionCount', 'positionValidCount', 'positionMissingCount',
  'positionInvalidCount', 'distinctPositions',
]

// Prohibited in evidenceTrace (derivable / scoring leakage).
const PROHIBITED_EVIDENCE_FIELDS = [
  'semanticProposition', 'construct', 'sourceQuestionIds',
  'score', 'probability', 'confidence', 'severity', 'weight',
]

// Identity keys that must never appear in any trace (recursive scan).
const IDENTITY_KEYS = [
  'openid', 'unionid', 'nickname', 'phone', 'mobile',
  'avatar', 'profile', 'userId', 'email',
]

function sortedKeys(obj) {
  return Object.keys(obj || {}).sort()
}

// ── Answer trace validator ─────────────────────────────────────────────────
// The answerTrace contract (R0/R1) is a VERBATIM copy of submitted tuples —
// duplicates/missing answers are mirrored faithfully, NOT corrected. So this
// validator enforces: (a) exact 3-field row shape, (b) no identity leakage,
// (c) verbatim match vs input (questionId/optionId/displayPosition, in order).
// It does NOT require 18 rows or unique questionIds (those are input-level
// concerns already handled by the client + validity gate). Never rebuilds position.
function validateAnswerTrace(record, inputAnswers) {
  const r = { name: 'answerTrace', pass: true, errors: [] }
  const at = record && record.answerTrace
  if (!Array.isArray(at)) { r.pass = false; r.errors.push('answerTrace missing/not array'); return r }

  for (let i = 0; i < at.length; i++) {
    const row = at[i]
    if (!row || typeof row !== 'object' || Array.isArray(row)) { r.pass = false; r.errors.push('row[' + i + '] not object'); continue }
    const keys = sortedKeys(row)
    const expect = [...ANSWER_TRACE_FIELDS].sort()
    if (JSON.stringify(keys) !== JSON.stringify(expect)) {
      r.pass = false
      r.errors.push('row[' + i + '] field-set ' + JSON.stringify(keys) + ' != ' + JSON.stringify(expect))
    }
    for (const k of IDENTITY_KEYS) if (k in row) { r.pass = false; r.errors.push('identity field ' + k + ' in answerTrace row') }
  }

  // Input vs persisted comparison: verbatim mirror (in order). Only compare
  // object entries (negative/malformed non-object inputs are skipped).
  if (Array.isArray(inputAnswers)) {
    const objInput = inputAnswers.filter((a) => a && typeof a === 'object' && !Array.isArray(a))
    if (objInput.length !== at.length) {
      r.pass = false
      r.errors.push('input object-entries ' + objInput.length + ' != answerTrace ' + at.length)
    } else {
      for (let i = 0; i < objInput.length; i++) {
        const a = objInput[i]
        const t = at[i]
        if (a.questionId !== t.questionId) { r.pass = false; r.errors.push('questionId mismatch @' + i + ': ' + a.questionId + ' vs ' + t.questionId) }
        if (a.optionId !== t.optionId) { r.pass = false; r.errors.push('optionId mismatch @' + i + ': ' + a.optionId + ' vs ' + t.optionId) }
        if (a.displayPosition !== t.displayPosition) { r.pass = false; r.errors.push('displayPosition mismatch @' + i + ': ' + a.displayPosition + ' vs ' + t.displayPosition) }
      }
    }
  }
  return r
}

// ── Validity trace validator ───────────────────────────────────────────────
function validateValidityTrace(record) {
  const r = { name: 'validityTrace', pass: true, errors: [] }
  const vt = record && record.validityTrace
  if (!vt || typeof vt !== 'object' || Array.isArray(vt)) { r.pass = false; r.errors.push('validityTrace missing/not object'); return r }

  const keys = sortedKeys(vt)
  const expect = [...VALIDITY_TRACE_TOP_FIELDS].sort()
  if (JSON.stringify(keys) !== JSON.stringify(expect)) {
    r.pass = false
    r.errors.push('validityTrace top fields ' + JSON.stringify(keys) + ' != ' + JSON.stringify(expect))
  }
  if (!VALIDITY_STATUS_SET.includes(vt.status)) {
    r.pass = false
    r.errors.push('validityTrace.status ' + vt.status + ' not in canonical set')
  }
  if (vt.status !== record.responseValidityStatus) {
    r.pass = false
    r.errors.push('validityTrace.status ' + vt.status + ' != record.responseValidityStatus ' + record.responseValidityStatus)
  }
  // counts exact schema (9 runtime keys, no invented `n`).
  const counts = vt.counts
  if (!counts || typeof counts !== 'object' || Array.isArray(counts)) {
    r.pass = false
    r.errors.push('validityTrace.counts missing/not object')
  } else {
    const ckeys = sortedKeys(counts)
    const cexpect = [...VALIDITY_COUNTS_KEYS].sort()
    if (JSON.stringify(ckeys) !== JSON.stringify(cexpect)) {
      r.pass = false
      r.errors.push('counts keys ' + JSON.stringify(ckeys) + ' != ' + JSON.stringify(cexpect))
    }
    if ('n' in counts) { r.pass = false; r.errors.push('counts has invented field "n"') }
  }
  return r
}

// ── Evidence trace validator ───────────────────────────────────────────────
function validateEvidenceTrace(record) {
  const r = { name: 'evidenceTrace', pass: true, errors: [] }
  const et = record && record.evidenceTrace
  if (record.cognitionExecuted === true) {
    if (!Array.isArray(et)) { r.pass = false; r.errors.push('cognitionExecuted=true but evidenceTrace not array'); return r }
    // Length is an observation, NOT contract — never assert a fixed length.
    r.count = et.length
    for (let i = 0; i < et.length; i++) {
      const row = et[i]
      if (!row || typeof row !== 'object' || Array.isArray(row)) { r.pass = false; r.errors.push('evidence[' + i + '] not object'); continue }
      const keys = sortedKeys(row)
      const expect = [...EVIDENCE_TRACE_FIELDS].sort()
      if (JSON.stringify(keys) !== JSON.stringify(expect)) {
        r.pass = false
        r.errors.push('evidence[' + i + '] field-set ' + JSON.stringify(keys) + ' != ' + JSON.stringify(expect))
      }
      for (const p of PROHIBITED_EVIDENCE_FIELDS) {
        if (p in row) { r.pass = false; r.errors.push('evidence[' + i + '] prohibited field ' + p) }
      }
    }
  } else {
    if (et !== null && et !== undefined) {
      r.pass = false
      r.errors.push('cognitionExecuted=false but evidenceTrace present (must be null)')
    }
  }
  return r
}

// ── Privacy validator ──────────────────────────────────────────────────────
// Recursively scan answerTrace / validityTrace / evidenceTrace for identity keys.
function collectIdentityLeaks(node, path, out) {
  if (node === null || node === undefined) return
  if (Array.isArray(node)) { for (let i = 0; i < node.length; i++) collectIdentityLeaks(node[i], path + '[' + i + ']', out); return }
  if (typeof node === 'object') {
    for (const k of Object.keys(node)) {
      const lk = k.toLowerCase()
      for (const idk of IDENTITY_KEYS) {
        if (lk === idk.toLowerCase()) out.push(path + '.' + k)
      }
      collectIdentityLeaks(node[k], path + '.' + k, out)
    }
  }
}

function validatePrivacy(record) {
  const r = { name: 'privacy', pass: true, errors: [], identityLeakageCount: 0 }
  const leaks = []
  for (const field of ['answerTrace', 'validityTrace', 'evidenceTrace']) {
    collectIdentityLeaks(record && record[field], field, leaks)
  }
  r.identityLeakageCount = leaks.length
  if (leaks.length > 0) { r.pass = false; r.errors = leaks.map((l) => 'identity leakage at ' + l) }
  return r
}

// ── Cognition invariant validator ──────────────────────────────────────────
function validateCognitionInvariant(record) {
  const r = { name: 'cognitionInvariant', pass: true, errors: [] }
  const status = record && record.responseValidityStatus
  const executed = record && record.cognitionExecuted
  const terminal = record && record.cognitionTerminalStatus

  if (status === 'RESPONSE_VALID' && executed !== true) {
    r.pass = false; r.errors.push('RESPONSE_VALID but cognitionExecuted=' + executed)
  }
  if ((status === 'RESPONSE_QUALITY_LOW' || status === 'INSUFFICIENT_RESPONSE_QUALITY') && executed !== false) {
    r.pass = false; r.errors.push(status + ' but cognitionExecuted=' + executed)
  }
  if (executed === false) {
    // Non-valid → NOT_EXECUTED terminal + blocked evidenceTrace.
    if (terminal !== 'NOT_EXECUTED') { r.pass = false; r.errors.push('cognition blocked but terminal=' + terminal + ' (expect NOT_EXECUTED)') }
    if (record.evidenceTrace !== null && record.evidenceTrace !== undefined) {
      r.pass = false; r.errors.push('cognition blocked but evidenceTrace present')
    }
  }
  return r
}

// ── Shadow isolation validator ─────────────────────────────────────────────
const LEGACY_FIELDS = ['renderSource', 'wealth', 'cashflow', 'destinySimulator', 'legacyReport', 'v1Report', 'v2Report']
function validateShadowIsolation(record, userVisible) {
  const r = { name: 'shadowIsolation', pass: true, errors: [] }
  if (userVisible !== false) { r.pass = false; r.errors.push('userVisible != false (got ' + userVisible + ')') }
  // No legacy/primary routing fields in the shadow record.
  if (record && typeof record === 'object') {
    for (const f of LEGACY_FIELDS) {
      if (f in record) { r.pass = false; r.errors.push('legacy field ' + f + ' present in shadow record') }
    }
  }
  return r
}

function runAllValidators(record, inputAnswers, userVisible) {
  return [
    validateAnswerTrace(record, inputAnswers),
    validateValidityTrace(record),
    validateEvidenceTrace(record),
    validatePrivacy(record),
    validateCognitionInvariant(record),
    validateShadowIsolation(record, userVisible),
  ]
}

module.exports = {
  ANSWER_TRACE_FIELDS,
  VALIDITY_TRACE_TOP_FIELDS,
  EVIDENCE_TRACE_FIELDS,
  VALIDITY_STATUS_SET,
  VALIDITY_COUNTS_KEYS,
  PROHIBITED_EVIDENCE_FIELDS,
  IDENTITY_KEYS,
  validateAnswerTrace,
  validateValidityTrace,
  validateEvidenceTrace,
  validatePrivacy,
  validateCognitionInvariant,
  validateShadowIsolation,
  runAllValidators,
}
