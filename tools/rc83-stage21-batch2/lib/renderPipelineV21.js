/**
 * tools/rc83-stage21-batch2/lib/renderPipelineV21.js
 *
 * W1+W2 combined — the V2.1 AI expression render pipeline (synthetic only).
 *
 * Deterministically simulates the AI-expression boundary WITHOUT calling any
 * real AI API:
 *
 *   engineResult → authoritySnapshot
 *        ↓
 *   syntheticAiRenderer(engineResult) → aiOutput   (injected)
 *        ↓
 *   validateAuthority(engineResult, aiOutput)
 *        ├─ ACCEPTED  → { renderSource: AI_RENDERED, expression: aiOutput }
 *        └─ REJECTED  → { renderSource: DETERMINISTIC_FALLBACK,
 *                         expression: fallback record, fallbackReason }
 *
 * Fallback triggers (frozen §9): authority violation, malformed output,
 * missing output, invalid schema, exception (all represented as REJECTED or
 * by the caller simulating an exception → fallback path).
 *
 * This is LOCAL_DIRECT / synthetic. No production access. No real AI.
 */

'use strict'

var authorityGuard = require('./authorityGuardV21')
var fallback = require('./fallbackAdapterV21')

/**
 * Render through the AI-expression boundary.
 *
 * @param {object} engineResult   V2.1 engine conclusion
 * @param {*} aiOutput            AI-produced output (object | null | string | threw)
 * @param {object} [opts]
 *   - opts.aiThrew  {boolean} simulate an AI exception/timeout
 * @returns {object}
 *   { renderSource, authorityGuardStatus, fallbackReason, expression,
 *     protectedFieldCount, violationPaths }
 */
function renderV21(engineResult, aiOutput, opts) {
  opts = opts || {}

  if (opts.aiThrew === true) {
    var fb1 = fallback.buildFallbackV21(engineResult)
    return {
      renderSource: authorityGuard.RENDER_SOURCE.DETERMINISTIC_FALLBACK,
      authorityGuardStatus: 'AI_RENDER_REJECTED_AUTHORITY_VIOLATION',
      fallbackReason: 'AI_EXCEPTION',
      expression: fb1.record,
      protectedFieldCount: authorityGuard.PROTECTED_PATHS.length,
      violationPaths: [],
    }
  }

  // Missing output (undefined / null) → fallback.
  if (aiOutput === undefined || aiOutput === null) {
    var fb2 = fallback.buildFallbackV21(engineResult)
    return {
      renderSource: authorityGuard.RENDER_SOURCE.DETERMINISTIC_FALLBACK,
      authorityGuardStatus: 'AI_RENDER_REJECTED_AUTHORITY_VIOLATION',
      fallbackReason: 'MISSING_AI_OUTPUT',
      expression: fb2.record,
      protectedFieldCount: authorityGuard.PROTECTED_PATHS.length,
      violationPaths: [],
    }
  }

  var result = authorityGuard.validateAuthority(engineResult, aiOutput)

  if (result.status === 'AI_RENDER_ACCEPTED') {
    return {
      renderSource: authorityGuard.RENDER_SOURCE.AI_RENDERED,
      authorityGuardStatus: 'AI_RENDER_ACCEPTED',
      fallbackReason: null,
      expression: aiOutput,
      protectedFieldCount: result.protectedFieldCount,
      violationPaths: [],
    }
  }

  // Rejected → deterministic fallback (never partial accept).
  var fb3 = fallback.buildFallbackV21(engineResult)
  return {
    renderSource: authorityGuard.RENDER_SOURCE.DETERMINISTIC_FALLBACK,
    authorityGuardStatus: 'AI_RENDER_REJECTED_AUTHORITY_VIOLATION',
    fallbackReason: 'AUTHORITY_VIOLATION',
    expression: fb3.record,
    protectedFieldCount: result.protectedFieldCount,
    violationPaths: result.violations.map(function (v) { return v.path }),
  }
}

module.exports = {
  renderV21: renderV21,
}
