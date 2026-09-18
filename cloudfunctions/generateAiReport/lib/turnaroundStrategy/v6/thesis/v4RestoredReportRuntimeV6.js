'use strict'
/**
 * turnaroundStrategy/v6/thesis/v4RestoredReportRuntimeV6.js
 *
 * RC8.4 V6 R70 — V4-RESTORED report runtime (ONE PROFILE → ONE THESIS → ONE CALL).
 *
 *   HybridProfile -> V6 B1 (evidence/context only) -> V4-restored payload
 *     -> ONE high-freedom model call (thesis + five cards)
 *     -> MINIMAL hard-ban validator (fabrication / guarantee / illegal ONLY)
 *     -> final five-card report
 *
 * FALLBACK HIERARCHY (preserved from R68, §14):
 *   1. v4_restored (AI output passing minimal hard bans)
 *   2. thesis_envelope_fallback (R68) — provider failure / invalid JSON / missing
 *      required output OR a minimal hard-ban violation
 *   3. deterministic_fallback (legacy R53) — only when the envelope/report is
 *      itself invalid (disaster only)
 *
 * A bold / opinionated / commercially imaginative but TRUTHFUL report is NEVER
 * sent to fallback. Lexical / keyword / world-rule-id / migration-id / style
 * gates are ABSENT from this path.
 *
 * MODEL_CALLS_PER_REPORT_MAX = 1. CONSUMER LAYER ONLY. No I/O of its own.
 */

const { buildReportV6 } = require('../report/reportBuilderV6.js')
const { buildNoPrimaryReportV6 } = require('../report/noPrimaryReportV6.js')
const { buildThesisEnvelopeV6 } = require('./thesisEnvelopeV6.js')
const { buildEnvelopeFallbackReport } = require('./thesisEnvelopeFallbackV6.js')
const { buildV4RestoredPayload } = require('./v4RestoredContextV6.js')
const { runV4RestoredAdapter } = require('./v4RestoredAdapterV6.js')
const { validateV4Restored } = require('./v4RestoredValidatorV6.js')
const { compressVisibleCards } = require('./v4RestoredCompressV6.js')
const { guardVisibleCards } = require('./v4RestoredCopyGuardV6.js')
const { getV6WorldviewModelFromEnv, V6_DEFAULT_MODEL } = require('../../../config/worldviewV6Model.js')

const RENDER_SOURCE = Object.freeze({
  AI: 'v4_restored',
  ENVELOPE_FALLBACK: 'thesis_envelope_fallback',
  FALLBACK: 'deterministic_fallback'
})

const STATUS = Object.freeze({
  PASS: 'PASS',
  NO_ENVELOPE: 'NO_ENVELOPE',
  NO_CALL_AI: 'NO_CALL_AI',
  MODEL_ERROR: 'MODEL_ERROR',
  INVALID_JSON: 'INVALID_JSON',
  VALIDATION_FAIL: 'VALIDATION_FAIL'
})

// §18 — bounded creativity, per-call only (no global config mutation).
const V4R_TEMPERATURE = 0.7
const V4R_MAX_TOKENS = 2200

function fallbackResult (detReport, reason, extraMeta, envelope) {
  const meta = Object.assign({
    renderSource: null,
    resultCategory: reason,
    modelCalls: 0,
    hardBanReasonCodes: [],
    telemetryReasonCodes: []
  }, extraMeta || {})
  // §14 — preserve the R68 product-grade envelope fallback before legacy R53.
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

function isShippableEnvelopeFallback (report) {
  const c = report && report.cards
  if (!c) return false
  return !!(c.fatalInsight && c.fatalInsight.text) &&
    !!(c.coreProblem && c.coreProblem.text) &&
    !!(c.systemLoop && Array.isArray(c.systemLoop.steps) && c.systemLoop.steps.length) &&
    !!(c.turnaroundPath && c.turnaroundPath.from && c.turnaroundPath.to) &&
    !!(c.firstAction && c.firstAction.action && c.firstAction.target && c.firstAction.timebox && c.firstAction.done)
}

/**
 * R84-A §14 — derive a Chinese MICRO-HEADING for each card05 action from the
 * final (post-guard) action string. "定产品：把能力…" -> {title:'定产品', text:'把能力…'}.
 * A string WITHOUT a short leading heading yields {title:'', text:<whole>} so the
 * client can fall back to a neutral label. Deterministic; no invention.
 */
function parseActionItems (actions) {
  const list = Array.isArray(actions) ? actions : []
  return list.map((raw) => {
    const s = String(raw == null ? '' : raw).trim()
    if (!s) return { title: '', text: '' }
    const m = s.match(/^([^：:]{1,8})[：:]\s*(.+)$/)
    if (m) return { title: m[1].trim(), text: m[2].trim() }
    return { title: '', text: s }
  })
}

/**
 * R84-C §14/§15/§11 — build the deterministic personality screen context from the
 * HybridProfile + hybridContext. Uses ONLY the user's own evidence (proof level,
 * income structure, skill type, occupation, primary problem, self-belief). No
 * inference, no invention, no I/O.
 */
function buildPersonalityCtx (hybridProfile, hybridContext) {
  const hp = hybridProfile || {}
  const hc = hybridContext || {}
  const reality = hp.reality || {}
  const asset = hp.asset || {}
  const desired = hp.desiredChange || {}
  const belief = hp.belief || {}
  return {
    hasPaidProof: hc.marketValidated === true,
    proofLevel: hc.assetState || null,
    incomeStructure: reality.incomeStructure || null,
    skillType: asset.type || null,
    occupationDetail: reality.occupation || null,
    primaryProblem: desired.primaryProblem || null,
    selfBelief: belief.perceivedRootCause || null
  }
}

/**
 * R84-D §3–§6 — build the deterministic causal-GROUNDING context from the
 * HybridProfile. Uses ONLY the user's own answered evidence (debt pressure, self
 * belief, income structure, paid proof). No inference, no invention, no I/O.
 * `debtPressure` is the AUTHORITATIVE financial instrument signal: a mortgage is
 * only ever a fixed cash-flow constraint, never a safety net.
 */
function buildGroundingCtx (hybridProfile, hybridContext) {
  const hp = hybridProfile || {}
  const hc = hybridContext || {}
  const reality = hp.reality || {}
  const belief = hp.belief || {}
  return {
    debtPressure: reality.debtPressure || null,
    incomeStructure: reality.incomeStructure || null,
    safetyMonths: reality.safetyMonths || null,
    monthlySurplus: reality.monthlySurplus || null,
    selfBelief: belief.perceivedRootCause || null,
    hasPaidProof: hc.marketValidated === true,
    proofLevel: hc.assetState || null
  }
}

/**
 * Map a VALID V4-restored output onto the frozen deterministic report shape.
 *
 * R75 — the USER-VISIBLE card values are compressed (deterministic, post-thesis,
 * no second model call). `strategicThesis` keeps its full depth; the frozen card
 * FIELD NAMES are preserved so the client view model + presentation-authority
 * contract are unchanged. The structured compressed layer is also exposed as
 * `report.visibleCards` and `cards.<x>.visible`.
 */
function mapV4RestoredToReport (fb, output, hybridProfile, hybridContext) {
  const c = fb.cards
  const o = output
  const st = o.strategicThesis
  const oc = o.cards
  const ct = st.commercialThesis || {}
  const c4steps = oc.card04.steps || []

  // R75 — deterministic user-visible compression (AFTER thesis formation).
  // R84-A — deterministic DEFECT-ONLY copy guard (horizon / exact price /
  // FROM-TO / validation standard / duplicate conclusion). SAFE REPAIR only;
  // no new claims, no second model call.
  // R84-C — the SAME guard screen also enforces the one-person-one-contradiction
  // personality invariants (paid-proof hallucination / fake personality /
  // generic card) when a profile context is supplied.
  const cmpRaw = compressVisibleCards(o)
  // R84-C — only screen when a REAL profile context is available. A legacy
  // 2-arg call (no profile) stays byte-identical: an empty context would treat
  // "unknown" as "unpaid" and mis-flag paid claims.
  const personalityCtx = (hybridProfile || hybridContext) ? buildPersonalityCtx(hybridProfile, hybridContext) : null
  // R84-D — the causal-grounding screen shares the same REAL-profile gate.
  const groundingCtx = (hybridProfile || hybridContext) ? buildGroundingCtx(hybridProfile, hybridContext) : null
  const guard = guardVisibleCards(cmpRaw, st, personalityCtx, groundingCtx)
  const cmp = guard.cmp
  const steps = cmp.card03.steps.length ? cmp.card03.steps : oc.card03.slice().slice(0, 3)
  const insight = cmp.card03.rule || st.systemTrap || (c.systemLoop && c.systemLoop.insight) || ''
  const card05ActionItems = parseActionItems(cmp.card05.actions)

  const cards = {
    fatalInsight: { title: '致命一句话', text: cmp.card01 || oc.card01, provenance: c.fatalInsight.provenance },
    coreProblem: { title: '核心问题', text: cmp.card02 || oc.card02, provenance: c.coreProblem.provenance },
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
      from: cmp.card04.from || oc.card04.from,
      to: cmp.card04.to || oc.card04.to,
      logic: c4steps.join(' / ') || (c.turnaroundPath && c.turnaroundPath.logic) || '',
      display: cmp.card04.to || oc.card04.to,
      worldRuleLine: cmp.card04.rule || st.worldRule || '',
      specificity: (c.turnaroundPath && c.turnaroundPath.specificity) || '',
      steps: c4steps,
      text: [cmp.card04.from || oc.card04.from, cmp.card04.to || oc.card04.to].concat(c4steps).filter(Boolean).join('\n'),
      provenance: c.turnaroundPath.provenance
    },
    firstAction: {
      title: '现在就做',
      action: cmp.card05.goal || oc.card05.objective || oc.card05.primary,
      hypothesis: ct.objective || (c.firstAction && c.firstAction.hypothesis) || '',
      target: '',
      checks: [],
      timebox: '',
      verifyWith: '',
      done: cmp.card05.acceptance || oc.card05.successSignal,
      decision: '',
      specificity: (c.firstAction && c.firstAction.specificity) || '',
      externalSignal: (c.firstAction && c.firstAction.externalSignal) || true,
      eventPrimary: (c.firstAction && c.firstAction.eventPrimary) || true,
      objective: cmp.card05.goal || oc.card05.objective || oc.card05.primary,
      actions: cmp.card05.actions,
      actionItems: card05ActionItems,
      successSignal: cmp.card05.acceptance || oc.card05.successSignal,
      // R75 — structured visible layer (client renders goal + ACTION 1/2/3 + 验收标准).
      // R84-A — actions carry Chinese micro-headings (actionItems); the numeric
      // "ACTION n" label is a FALLBACK only, never the primary presentation.
      visible: { goal: cmp.card05.goal, actions: cmp.card05.actions, actionItems: card05ActionItems, acceptance: cmp.card05.acceptance },
      commercialThesis: ct,
      text: [cmp.card05.goal, cmp.card05.actions.join(' / '), cmp.card05.acceptance].filter(Boolean).join('\n'),
      provenance: c.firstAction.provenance
    }
  }

  return {
    reportVersion: fb.reportVersion,
    reportState: fb.reportState,
    cards: cards,
    // R75 — the compressed user-visible layer. strategicThesis keeps full depth.
    visibleCards: {
      card01: cmp.card01,
      card02: cmp.card02,
      card03: { steps: cmp.card03.steps, rule: cmp.card03.rule },
      card04: cmp.card04,
      card05: Object.assign({}, cmp.card05, { actionItems: card05ActionItems })
    },
    visibleStats: Object.assign({}, cmp.stats, { r84aGuard: guard.counts, r84aRepaired: guard.repaired, r84cGuard: (guard.r84c && guard.r84c.counts) || null, r84cRepaired: (guard.r84c && guard.r84c.repaired) || null, r84cSignals: (guard.r84c && guard.r84c.signals) || [], r84dGuard: (guard.r84d && guard.r84d.counts) || null, r84dRepaired: (guard.r84d && guard.r84d.repaired) || null, r84dAudit: (guard.r84d && guard.r84d.audit) || [] }),
    strategicThesis: st,
    commercialThesis: ct,
    provenance: fb.provenance
  }
}

/**
 * Run the R70 V4-restored runtime.
 * @param {Object} args { diagnosis, hybridProfile, hybridContext, noPrimaryReport, fallbackReport, callAI?, forceModel?, temperature?, maxTokens?, noNetwork? }
 * @returns {Promise<{renderSource, report, meta}>}
 */
async function runV4RestoredReportRuntimeV6 (args) {
  const a = args || {}
  const diagnosis = a.diagnosis
  const fb = a.fallbackReport || buildReportV6(diagnosis, a.hybridContext || null)

  if (!diagnosis || diagnosis.diagnosisState === 'INVALID_INPUT') return fallbackResult(fb, STATUS.NO_ENVELOPE)
  if (diagnosis.compatibility && diagnosis.compatibility.verdict === 'EVIDENCE_CONFLICT') {
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

  const payload = buildV4RestoredPayload(a.hybridProfile || null, diagnosis, a.hybridContext || null)

  if (a.noNetwork === true) return fallbackResult(fb, STATUS.NO_CALL_AI, { envelopeBuilt: !!envelope }, envelope)

  const model = a.forceModel || getV6WorldviewModelFromEnvV6()
  let res
  try {
    res = await runV4RestoredAdapter(payload, {
      callAI: a.callAI,
      forceModel: model,
      temperature: a.temperature != null ? a.temperature : V4R_TEMPERATURE,
      maxTokens: a.maxTokens != null ? a.maxTokens : V4R_MAX_TOKENS
    })
  } catch (e) {
    return fallbackResult(fb, STATUS.MODEL_ERROR, { modelCalls: 1, errorCode: (e && e.message) || 'THROW' }, envelope)
  }

  if (!res || !res.ok) {
    const cat = res && /JSON/.test(res.error || '') ? STATUS.INVALID_JSON : STATUS.MODEL_ERROR
    return fallbackResult(fb, cat, { modelCalls: 1, errorCode: (res && res.error) || 'AI_FAILED' }, envelope)
  }

  const verdict = validateV4Restored(res.output, payload)
  if (!verdict.valid) {
    // ONLY a minimal hard-ban violation (fabrication / guarantee / illegal) or a
    // missing required output sends the report to fallback (§4 / §14).
    return fallbackResult(fb, STATUS.VALIDATION_FAIL, {
      modelCalls: 1,
      hardBanReasonCodes: verdict.blocking,
      telemetryReasonCodes: verdict.telemetry
    }, envelope)
  }

  return {
    renderSource: RENDER_SOURCE.AI,
    report: mapV4RestoredToReport(fb, res.output, a.hybridProfile || null, a.hybridContext || null),
    meta: {
      renderSource: RENDER_SOURCE.AI,
      resultCategory: STATUS.PASS,
      modelCalls: 1,
      modelUsed: model,
      temperatureUsed: a.temperature != null ? a.temperature : V4R_TEMPERATURE,
      maxTokensUsed: a.maxTokens != null ? a.maxTokens : V4R_MAX_TOKENS,
      hardBanReasonCodes: [],
      telemetryReasonCodes: verdict.telemetry,
      envelopeBuilt: !!envelope,
      migrationId: null,
      experimentClass: envelope ? envelope.experimentClass : null
    }
  }
}

function getV6WorldviewModelFromEnvV6 () {
  try { return getV6WorldviewModelFromEnv() } catch (e) { return V6_DEFAULT_MODEL }
}

module.exports = {
  runV4RestoredReportRuntimeV6,
  mapV4RestoredToReport,
  parseActionItems,
  buildPersonalityCtx,
  buildGroundingCtx,
  RENDER_SOURCE,
  STATUS,
  V4R_TEMPERATURE,
  V4R_MAX_TOKENS
}
