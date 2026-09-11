'use strict'
/**
 * turnaroundStrategy/v6/profileBuilderV6.js
 *
 * Builds the canonical V6 profile from raw 9Q answers.
 * Accepts semantic option ids OR canonical Chinese option text.
 * Does NOT infer missing answers; missing/malformed options are reported.
 */

const {
  canonicalQid,
  resolveOption,
  ID_TO_GROUP
} = require('./questionnaireContractV6.js')
const { mapExecutionStage } = require('./executionStageV6.js')

// Required 9 questions in canonical order.
const REQUIRED_QIDS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9']

/**
 * @param {Object} raw answers keyed by Q1..Q9 or semantic keys, values =
 *   optionId or canonical text. Optional `occupation` free text under Q2.
 * @returns {{profile:Object|null, valid:boolean, missing:string[],
 *   malformed:string[], unresolved:string[]}}
 */
function buildProfileV6 (raw) {
  // Top-level representation must be a plain object. null / undefined /
  // number / string / boolean / array are a malformed submission -> INVALID_INPUT
  // (fail-closed), NEVER a valid NO_PRIMARY.
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { profile: null, valid: false, missing: [], malformed: ['INPUT_NOT_OBJECT'], unresolved: [] }
  }

  const input = raw
  const resolved = {}
  const missing = []
  const unresolved = []

  for (const qid of REQUIRED_QIDS) {
    const key = canonicalQid(qid)
    // find a value under qid, semantic key, or ... nothing else. No inference.
    let value
    if (Object.prototype.hasOwnProperty.call(input, qid)) value = input[qid]
    // also allow semantic key form via questionnaireContractV6
    const { KEY_TO_ID } = require('./questionnaireContractV6.js')
    if (value === undefined) {
      for (const k of Object.keys(KEY_TO_ID)) {
        if (KEY_TO_ID[k] === qid && Object.prototype.hasOwnProperty.call(input, k)) {
          value = input[k]
          break
        }
      }
    }
    if (value === undefined || value === null || value === '') {
      missing.push(qid)
      resolved[qid] = null
      continue
    }
    const optId = resolveOption(qid, value)
    if (!optId) {
      unresolved.push(qid)
      resolved[qid] = null
      continue
    }
    resolved[qid] = optId
  }

  if (missing.length || unresolved.length) {
    return { profile: null, valid: false, missing, malformed: [], unresolved }
  }

  const stageInfo = mapExecutionStage(resolved.Q6)

  const profile = {
    reality: {
      ageStage: resolved.Q1,
      incomeMode: resolved.Q2,
      monthlySurplus: resolved.Q3,
      occupation: typeof input.occupation === 'string' ? input.occupation : null
    },
    desiredChange: {
      primaryProblem: resolved.Q4
    },
    userBelief: {
      perceivedRootCause: resolved.Q5
    },
    executionStage: {
      currentStage: stageInfo.stage
    },
    behavior: {
      uncertaintyResponse: resolved.Q7,
      timeAllocation: resolved.Q8,
      noResultResponse: resolved.Q9
    },
    // internal raw optionId lookup for downstream rules/trace
    _optionIds: resolved
  }

  return { profile, valid: true, missing: [], malformed: [], unresolved: [] }
}

module.exports = { buildProfileV6, REQUIRED_QIDS }
