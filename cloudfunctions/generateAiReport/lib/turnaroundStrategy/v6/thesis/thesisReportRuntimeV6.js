'use strict'
/**
 * turnaroundStrategy/v6/thesis/thesisReportRuntimeV6.js
 *
 * RC8.4 V6 R57 — SHARED-STRATEGIC-THESIS report runtime.
 *
 *   HybridProfile -> V6 B1 -> asset/proof -> compatibility
 *     -> NO_PRIMARY cross-axis scope
 *     -> DETERMINISTIC THESIS ENVELOPE
 *     -> ONE AI expression call  (thesis + five cards)
 *     -> deterministic thesis validator
 *     -> final five-card report
 *
 * FAIL-CLOSED: any envelope/AI/parse/validation failure returns the existing
 * R53 deterministic five-card report. R53 is NEVER removed
 * (DETERMINISTIC_FALLBACK_PRESERVED = YES). Never returns a partial AI output.
 *
 * MODEL_CALLS_PER_REPORT_MAX = 1. CONSUMER LAYER ONLY. No I/O of its own.
 */

const { buildReportV6 } = require('../report/reportBuilderV6.js')
const { buildNoPrimaryReportV6 } = require('../report/noPrimaryReportV6.js')
const { buildThesisEnvelopeV6 } = require('./thesisEnvelopeV6.js')
const { buildEnvelopeFallbackReport } = require('./thesisEnvelopeFallbackV6.js')
const { runThesisAdapter } = require('./thesisAdapterV6.js')
const { validateThesisV6 } = require('./thesisValidatorV6.js')
// R65 §4 — deterministic LOCAL repair for repairable copy issues only (no AI).
const { repairThesisOutput } = require('./thesisRepairV6.js')
const { getV6WorldviewModelFromEnv, V6_DEFAULT_MODEL } = require('../../../config/worldviewV6Model.js')

const RENDER_SOURCE = Object.freeze({
  AI: 'thesis_ai',
  // R68 §8/§19 — product-grade deterministic envelope fallback. Used when the AI
  // thesis is rejected/failed BUT the ThesisEnvelope itself is valid. It is NOT
  // the legacy R53 disaster fallback.
  ENVELOPE_FALLBACK: 'thesis_envelope_fallback',
  // Legacy R53 deterministic report — LAST resort, only when the envelope/report
  // construction itself is invalid.
  FALLBACK: 'deterministic_fallback'
})
// §20 — bounded creativity. Per-call; requires NO shared/global config mutation.
const THESIS_TEMPERATURE = 0.6
// R59 — final tested output budget. small enough to stay within a 60s function
// timeout, large enough for thesis + five complete cards with finish=stop.
// Real-provider 30-call study: completion_tokens avg 834 / max 1153, 0 truncation.
const THESIS_MAX_TOKENS = 1800

const STATUS = Object.freeze({
  PASS: 'PASS',
  NO_ENVELOPE: 'NO_ENVELOPE',
  NO_CALL_AI: 'NO_CALL_AI',
  MODEL_ERROR: 'MODEL_ERROR',
  INVALID_JSON: 'INVALID_JSON',
  VALIDATION_FAIL: 'VALIDATION_FAIL'
})

function fallbackResult (detReport, reason, extraMeta, envelope) {
  const baseMeta = {
    renderSource: null,
    resultCategory: reason,
    modelCalls: 0,
    validatorReasonCodes: [],
    // R65 §6 — privacy-safe observability (reason CODES only, never raw text).
    validatorBlockingReasonCodes: [],
    validatorRepairableReasonCodes: [],
    localRepairApplied: false,
    localRepairTypes: []
  }
  const meta = Object.assign(baseMeta, extraMeta || {})
  // R68 §8 — FALLBACK HIERARCHY: valid thesis_ai > THESIS_ENVELOPE_DETERMINISTIC_FALLBACK
  // (valid envelope) > legacy R53 (only when the envelope/report is invalid).
  // EVIDENCE_CONFLICT (env null by design) and a genuinely absent envelope MUST
  // still use R53 — that is the correct explicit state, not a product report.
  if (envelope && !(extraMeta && extraMeta.evidenceConflict)) {
    const built = buildEnvelopeFallbackReport(envelope, detReport)
    if (isShippableEnvelopeFallback(built)) {
      meta.renderSource = RENDER_SOURCE.ENVELOPE_FALLBACK
      meta.fallbackLayer = 'THESIS_ENVELOPE_DETERMINISTIC_FALLBACK'
      return { renderSource: RENDER_SOURCE.ENVELOPE_FALLBACK, report: built, meta: meta }
    }
  }
  meta.renderSource = RENDER_SOURCE.FALLBACK
  meta.fallbackLayer = 'R53_DISASTER_FALLBACK'
  return { renderSource: RENDER_SOURCE.FALLBACK, report: detReport, meta: meta }
}

/** A product-grade envelope fallback must be a complete five-card report. */
function isShippableEnvelopeFallback (report) {
  const c = report && report.cards
  if (!c) return false
  return !!(c.fatalInsight && c.fatalInsight.text) &&
    !!(c.coreProblem && c.coreProblem.text) &&
    !!(c.systemLoop && Array.isArray(c.systemLoop.steps) && c.systemLoop.steps.length) &&
    !!(c.turnaroundPath && c.turnaroundPath.from && c.turnaroundPath.to) &&
    !!(c.firstAction && c.firstAction.action && c.firstAction.target && c.firstAction.timebox && c.firstAction.done)
}

/** Map a VALID thesis output onto the deterministic report shape (card keys frozen). */
function mapThesisToReport (fb, output) {
  const c = fb.cards
  const o = output
  const oc = o.cards
  const st = o.strategicThesis
  const steps = oc.card03.slice()
  const insight = st.structuralMechanism || (c.systemLoop && c.systemLoop.insight) || ''

  const cards = {
    fatalInsight: { title: '致命一句话', text: oc.card01, provenance: c.fatalInsight.provenance },
    coreProblem: { title: '核心问题', text: oc.card02, provenance: c.coreProblem.provenance },
    systemLoop: {
      title: '系统困局',
      steps: steps,
      insight: insight,
      family: c.systemLoop.family,
      shape: c.systemLoop.shape,
      header: c.systemLoop.header,
      form: c.systemLoop.form,
      text: steps.join('\n'),
      provenance: c.systemLoop.provenance
    },
    turnaroundPath: {
      title: '翻身路径',
      from: oc.card04.from,
      to: oc.card04.to,
      logic: oc.card04.logic,
      display: oc.card04.to,
      worldRuleLine: (st.worldRule && st.worldRule.expression) || '',
      specificity: (c.turnaroundPath && c.turnaroundPath.specificity) || '',
      text: [oc.card04.from, oc.card04.to, oc.card04.logic].filter(Boolean).join('\n'),
      provenance: c.turnaroundPath.provenance
    },
    firstAction: {
      title: '现在就做',
      action: oc.card05.primary,
      hypothesis: (c.firstAction && c.firstAction.hypothesis) || st.actionThesis || '',
      target: oc.card05.target,
      checks: oc.card05.supporting,
      timebox: oc.card05.timebox,
      verifyWith: oc.card05.target,
      done: oc.card05.successSignal,
      decision: st.actionThesis || (c.firstAction && c.firstAction.decision) || '',
      specificity: (c.firstAction && c.firstAction.specificity) || '',
      externalSignal: (c.firstAction && c.firstAction.externalSignal) || true,
      eventPrimary: (c.firstAction && c.firstAction.eventPrimary) || true,
      text: [oc.card05.primary, (oc.card05.supporting || []).join(' / '), oc.card05.target, oc.card05.timebox, oc.card05.successSignal].filter(Boolean).join('\n'),
      provenance: c.firstAction.provenance
    }
  }

  return {
    reportVersion: fb.reportVersion,
    reportState: fb.reportState,
    cards: cards,
    strategicThesis: st,
    provenance: fb.provenance
  }
}

/**
 * Run the R57 thesis runtime.
 * @param {Object} args { diagnosis, hybridProfile, hybridContext, noPrimaryReport, fallbackReport, callAI?, forceModel?, temperature?, maxTokens?, noNetwork? }
 * @returns {Promise<{renderSource, report, meta}>}
 */
async function runThesisReportRuntimeV6 (args) {
  const a = args || {}
  const diagnosis = a.diagnosis
  const fb = a.fallbackReport || buildReportV6(diagnosis, a.hybridContext || null)

  // Deterministic fallback is ALWAYS available; INVALID_INPUT has no cards.
  if (!diagnosis || diagnosis.diagnosisState === 'INVALID_INPUT') return fallbackResult(fb, STATUS.NO_ENVELOPE)
  if (diagnosis.compatibility && diagnosis.compatibility.verdict === 'EVIDENCE_CONFLICT') {
    // §2 — EVIDENCE_CONFLICT => model calls MUST be 0.
    return fallbackResult(fb, STATUS.NO_ENVELOPE, { evidenceConflict: true })
  }

  const npReport = a.noPrimaryReport || (diagnosis.diagnosisState === 'NO_PRIMARY' ? buildNoPrimaryReportV6(Object.assign({}, diagnosis, { hybrid: a.hybridContext || null }), a.hybridContext || null) : null)
  const envelope = buildThesisEnvelopeV6({
    hybridProfile: a.hybridProfile || null,
    diagnosis: diagnosis,
    hybridContext: a.hybridContext || null,
    noPrimaryReport: npReport,
    crossAxisScope: a.crossAxisScope
  })
  if (!envelope) return fallbackResult(fb, STATUS.NO_ENVELOPE)

  if (a.noNetwork === true) return fallbackResult(fb, STATUS.NO_CALL_AI, { envelopeBuilt: true }, envelope)

  const model = a.forceModel || getV6WorldviewModelFromEnvV6()
  let res
  try {
    res = await runThesisAdapter(envelope, fb.cards, {
      callAI: a.callAI,
      forceModel: model,
      temperature: a.temperature != null ? a.temperature : THESIS_TEMPERATURE,
      maxTokens: a.maxTokens != null ? a.maxTokens : THESIS_MAX_TOKENS
    })
  } catch (e) {
    return fallbackResult(fb, STATUS.MODEL_ERROR, { envelopeBuilt: true, errorCode: (e && e.message) || 'THROW' }, envelope)
  }

  if (!res || !res.ok) {
    const cat = res && /JSON/.test(res.error || '') ? STATUS.INVALID_JSON : STATUS.MODEL_ERROR
    return fallbackResult(fb, cat, { envelopeBuilt: true, errorCode: (res && res.error) || 'AI_FAILED', modelCalls: 1 }, envelope)
  }

  let verdict = validateThesisV6(res.output, envelope)
  let output = res.output
  let localRepairApplied = false
  let localRepairTypes = []
  let initialBlocking = verdict.blockingFailures.slice()
  let initialRepairable = verdict.repairableFailures.slice()

  // R65 §4 — if the ONLY failures are REPAIRABLE, apply ONE deterministic local
  // normalisation and re-run the SAME validator. NO second AI call (§16).
  if (!verdict.valid && verdict.blockingFailures.length === 0 && verdict.repairableFailures.length > 0) {
    const repaired = repairThesisOutput(output)
    if (repaired.applied) {
      const v2 = validateThesisV6(repaired.output, envelope)
      localRepairTypes = repaired.repairTypes
      if (v2.valid) {
        output = repaired.output
        verdict = v2
        localRepairApplied = true
      } else {
        // Repair did not clear it -> keep the ORIGINAL blocking reason codes.
        verdict = v2
      }
    }
  }

  if (!verdict.valid) {
    const blocking = verdict.blockingFailures.length ? verdict.blockingFailures : initialBlocking
    const repairable = verdict.repairableFailures.length ? verdict.repairableFailures : initialRepairable
    return fallbackResult(fb, STATUS.VALIDATION_FAIL, {
      envelopeBuilt: true,
      modelCalls: 1,
      validatorReasonCodes: verdict.hardFailures,
      validatorBlockingReasonCodes: blocking,
      validatorRepairableReasonCodes: repairable,
      localRepairApplied: false,
      localRepairTypes: localRepairTypes
    }, envelope)
  }

  return {
    renderSource: RENDER_SOURCE.AI,
    report: mapThesisToReport(fb, output),
    meta: {
      renderSource: RENDER_SOURCE.AI,
      resultCategory: STATUS.PASS,
      modelCalls: 1,
      modelUsed: model,
      temperatureUsed: a.temperature != null ? a.temperature : THESIS_TEMPERATURE,
      maxTokensUsed: a.maxTokens != null ? a.maxTokens : THESIS_MAX_TOKENS,
      validatorReasonCodes: [],
      validatorBlockingReasonCodes: [],
      validatorRepairableReasonCodes: [],
      localRepairApplied: localRepairApplied,
      localRepairTypes: localRepairTypes,
      worldRuleId: output.strategicThesis.worldRule.id,
      migrationId: (envelope.allowedTargetPositions[0] || {}).id || null,
      experimentClass: envelope.experimentClass,
      envelopeBuilt: true
    }
  }
}

function getV6WorldviewModelFromEnvV6 () {
  try { return getV6WorldviewModelFromEnv() } catch (e) { return V6_DEFAULT_MODEL }
}

module.exports = {
  runThesisReportRuntimeV6,
  mapThesisToReport,
  RENDER_SOURCE,
  STATUS,
  THESIS_TEMPERATURE,
  THESIS_MAX_TOKENS
}
