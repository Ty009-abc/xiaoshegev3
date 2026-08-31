/**
 * tools/rc83-stage21-batch2/lib/fallbackAdapterV21.js
 *
 * W2 — Deterministic AI Fallback (V2.1 adapter).
 *
 * Investigated reference (read-only, from canonical `0874254`):
 *   `generateFallbackReport(baseContract)` in
 *   `cloudfunctions/generateAiReport/lib/prompt-v4/reportGuardV4.js`
 *     → deep-copies baseContract.report, marks `_renderSource='rule_fallback'`,
 *       no AI, no randomness, no Date.now semantic effect.
 *   Classification (frozen plan §4): REUSABLE_WITH_ADAPTER (V4 report shape;
 *   V2.1 immutable fields not explicitly represented).
 *
 * This module is the V2.1 fallback adapter: it carries the V2.1 engine
 * snapshot fields UNCHANGED and applies the same deterministic no-AI copy
 * semantics. It does NOT re-infer, does NOT call a second diagnostic model,
 * does NOT change protected fields, does NOT produce random/temporal
 * diagnostics, and marks renderSource machine-readably so fallback is NEVER
 * disguised as AI success.
 *
 * FALLBACK INVARIANTS (frozen §9): preserve engine diagnosis; no re-inference;
 * no second model; protected fields unchanged; no random diagnosis; no
 * time-dependent semantic variation.
 */

'use strict'

var authorityGuard = require('./authorityGuardV21')
var util = require('./util')

// ── Default deterministic expression (AI-free) ──
// NOTE: this produces only human-readable prose that EXPRESSES the engine
// decision. It performs no diagnosis of its own; every concrete diagnostic
// fact below is derived from the passed-in engine conclusion, not recomputed.
function buildFallbackProse(engineResult) {
  var status = engineResult.cognitionTerminalStatus || 'NOT_EXECUTED'
  var primary = engineResult.primaryBlindSpotId
  var construct = engineResult.primaryConstruct

  var headline = 'AI 表达不可用，已切换为确定性回退渲染（诊断结论未改变）。'
  var summary
  switch (status) {
    case 'PRIMARY_ALLOWED':
      summary = '系统主诊断结论：' + primary + '（' + construct + '）。此结论来自诊断引擎，非 AI 推断。'
      break
    case 'FOLLOW_UP_REQUIRED':
      summary = '系统判定需补充信息以区分候选盲点，主诊断结论待定。此结论来自诊断引擎。'
      break
    case 'NO_PRIMARY_DEFICIT':
      summary = '系统未发现明确主盲点缺陷。此结论来自诊断引擎。'
      break
    case 'INSUFFICIENT_EVIDENCE':
      summary = '当前证据不足以给出主诊断结论。此结论来自诊断引擎。'
      break
    default:
      summary = '诊断未执行或证据不足。此结论来自诊断引擎。'
      break
  }

  return {
    headline: headline,
    summary: summary,
    explanation: '本次未使用 AI 生成表达，采用确定性回退文案。诊断语义字段保持与诊断引擎输出一致。',
    narrative: null,
    actionWording: null,
    humanReadableCopy: null,
  }
}

/**
 * Produce the deterministic fallback expression for a V2.1 engine result.
 *
 * The protected authoritative fields are copied verbatim (deep-frozen) from
 * the engine result; prose is deterministic; renderSource is explicit.
 *
 * @param {object} engineResult  V2.1 engine conclusion
 * @returns {object} { renderSource, authoritativeDiagnosis, prose, record }
 *   `record` is the full fallback output (authoritative block + prose +
 *   renderSource), ready for a downstream report contract.
 */
function buildFallbackV21(engineResult) {
  if (!engineResult || typeof engineResult !== 'object') {
    throw new Error('buildFallbackV21: engineResult must be an object')
  }
  var snapshot = authorityGuard.buildAuthoritySnapshot(engineResult)
  var prose = buildFallbackProse(engineResult)

  var record = {
    renderSource: authorityGuard.RENDER_SOURCE.DETERMINISTIC_FALLBACK,
    authoritativeDiagnosis: snapshot,
  }
  // Merge prose fields at top level (deterministic, string|null only).
  var proseKeys = Object.keys(prose)
  for (var i = 0; i < proseKeys.length; i++) {
    record[proseKeys[i]] = prose[proseKeys[i]]
  }

  return {
    renderSource: record.renderSource,
    authoritativeDiagnosis: snapshot,
    prose: prose,
    record: record,
  }
}

module.exports = {
  buildFallbackV21: buildFallbackV21,
  buildFallbackProse: buildFallbackProse,
}
