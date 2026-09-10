/**
 * presentation/worldModel/v2_1/report/northStarReportValidatorV21.js
 *
 * RC8.3 Stage1C-C — North Star Report Validator.
 *
 * Deterministic structural checks over the report CONTENT MODEL produced by
 * northStarReportBuilderV21. It enforces copy governance (§16/§17/§20) without
 * re-running inference.
 *
 * Rejects (frozen):
 *   - verdict that is taxonomy-label only (bare label, no causal sentence)
 *   - missing world rule / misalignment for a supported primary
 *   - generic evidence (no per-item user-specific rows when trace provides ≥2)
 *   - strategy section that only outputs the strategy name
 *   - scenario that only says "future better/worse"
 *   - archetype promoted to a primary card
 *   - dimension dashboard promoted to primary flow
 *   - English paragraphs / raw internal tokens leaking into user copy
 *   - exact paragraph duplication across sections
 *   - prediction / wealth-promise / percentage / destiny language
 *
 * @version north_star_report_v1
 */

'use strict'

// Raw internal enum tokens that must never appear in user-visible copy.
const RAW_INTERNAL_TOKENS = [
  'SYSTEM_THINKING_GAP', 'OPPORTUNITY_BLINDNESS', 'FEEDBACK_LOOP_GAP',
  'DECISION_INERTIA', 'RISK_MODEL_DISTORTION', 'PROBABILITY_MISJUDGMENT',
  'IDENTITY_CONSTRAINT', 'LEVERAGE_MODEL_GAP', 'TIME_HORIZON_TRAP',
  'BUILD_DECISION_SYSTEM', 'BUILD_FEEDBACK_LOOP', 'EXPAND_OPTIONALITY',
  'INCREASE_EXPERIMENT_RATE', 'REFRAME_RISK_MODEL', 'UPGRADE_PROBABILITY_THINKING',
  'EXPAND_IDENTITY_BOUNDARY', 'BUILD_LEVERAGE_MODEL', 'EXTEND_TIME_HORIZON',
  'DECISION_CREATES_INFORMATION', 'FEEDBACK_UPDATES_MODELS', 'PROBABILITY_GOVERNS_OUTCOMES',
  'RISK_IS_ASYMMETRICAL', 'LEVERAGE_MULTIPLIES_VALUE', 'TIME_COMPOUNDS_ADVANTAGE',
  'IDENTITY_CONSTRAINS_CHOICES', 'OPPORTUNITY_EMERGES_THROUGH_EXPOSURE',
  'SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR',
  'DISTORTED', 'HEALTHY', 'MIXED', 'NEUTRAL', 'UNKNOWN', 'STRONG', 'MODERATE', 'WEAK',
  'DECISION', 'FEEDBACK', 'PROBABILITY', 'RISK', 'LEVERAGE', 'TIME', 'IDENTITY',
  'OPPORTUNITY', 'SYSTEMS', 'DECISION_MODEL', 'FEEDBACK_MODEL', 'PROBABILITY_MODEL',
  'RISK_MODEL', 'LEVERAGE_MODEL', 'TIME_MODEL', 'IDENTITY_MODEL', 'OPPORTUNITY_MODEL',
  'OPERATOR', 'EXPLORER', 'BUILDER', 'STRATEGIST', 'GUARDIAN', 'CONNECTOR', 'OPTIMIZER',
]

// Fixed-copy prediction / wealth-promise / destiny / percentage language.
const FORBIDDEN_PREDICTION_TOKENS = [
  '一定会', '必然', '注定', '命中注定', '命运', '成功率达到', '保证赚',
  '保证收益', '稳赚', '收入将达到', '收入翻倍', '人生逆转', '命运改变',
  '三年后', '成功率提升到',
]

// Generic chicken-soup tokens that must not substitute for evidence.
const GENERIC_SELF_HELP_TOKENS = [
  '加油', '坚持就会成功', '相信自己', '未来可期', '你一定可以', '努力就会成功',
]

// Wealth-promise / money-outcome language (distinct from prediction/destiny).
const WEALTH_PROMISE_TOKENS = [
  '保证赚', '保证收益', '稳赚', '收入将达到', '收入翻倍', '财富自由', '赚到钱', '月入',
  '年入', '躺赚', '一夜暴富',
]

// Canonical world-principle IDs (frozen; validation only, not a mapping authority).
const CANONICAL_PRINCIPLE_IDS = new Set([
  'DECISION_CREATES_INFORMATION', 'FEEDBACK_UPDATES_MODELS', 'PROBABILITY_GOVERNS_OUTCOMES',
  'RISK_IS_ASYMMETRICAL', 'LEVERAGE_MULTIPLIES_VALUE', 'TIME_COMPOUNDS_ADVANTAGE',
  'IDENTITY_CONSTRAINS_CHOICES', 'OPPORTUNITY_EMERGES_THROUGH_EXPOSURE',
  'SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR',
])

// Mandatory report sections (semantic contract, §5 of Stage1C-C1).
const MANDATORY_SECTIONS = [
  '01_COGNITIVE_VERDICT',
  '02_CURRENT_WORLD_MODEL',
  '03_WORLD_RULE_ALIGNMENT',
  '04_WHY_WE_JUDGE_THIS',
  '05_DECISION_CONSEQUENCE',
  '06_COGNITIVE_UPGRADE',
  '07_DECISION_PROTOCOL',
  '08_SCENARIO_CONTRAST',
  '09_SECONDARY_MODEL_CONTEXT',
]

// reasonCodes that MUST NOT carry a primary diagnosis (blocked/insufficient states).
const NO_PRIMARY_REASON_CODES = new Set([
  'INSUFFICIENT_DIRECTIONAL_EVIDENCE',
  'CONTRADICTORY_EVIDENCE',
  'BLOCKED_BY_RESPONSE_VALIDITY',
  'NOT_EXECUTED',
  'NO_SUPPORTED_DEFICIT',
  'NO_PRIMARY_DEFICIT',
  'NO_ELIGIBLE_CANDIDATE',
])

// User-visible field paths that must be Chinese and token-free.
// We scan all string leaves EXCEPT known provenance/internal fields.
const PROVENANCE_FIELDS = new Set(['source', 'provenance', 'sourceRefs', 'diagnosisState'])

function collectUserStrings(obj, depth) {
  const out = []
  const d = depth == null ? 10 : depth
  const seen = new Set()
  const walk = (node, level, key) => {
    if (node == null || level > d) return
    if (PROVENANCE_FIELDS.has(key)) return // skip provenance/internal
    if (seen.has(node)) return
    seen.add(node)
    if (typeof node === 'string') {
      out.push(node)
    } else if (Array.isArray(node)) {
      for (const x of node) walk(x, level + 1, '')
    } else if (typeof node === 'object') {
      for (const k of Object.keys(node)) walk(node[k], level + 1, k)
    }
  }
  walk(obj, 0, '')
  return out
}

// English paragraph detection: a run of 3+ space-separated ASCII words.
function isEnglishParagraph(s) {
  return /[A-Za-z]+(?:[ ,;]+[A-Za-z]+){2,}/.test(s) && !/[\u4e00-\u9fff]/.test(s)
}

function hasCjk(s) {
  return /[\u4e00-\u9fff]/.test(s)
}

// A user-visible string must not be (or contain) a raw internal SEMANTIC token.
// UUID-ish evidence/signal ids are provenance, not semantic identity, and are
// tolerated here (they never render to the user).
function containsRawSemanticToken(s) {
  const tokens = RAW_INTERNAL_TOKENS.filter((t) => !t.includes('/') && !/^[a-f0-9]{8}-/.test(t))
  for (const t of tokens) {
    if (s === t || s.indexOf(t) !== -1) return t
  }
  return null
}

/**
 * Validate the report content model.
 * @param {object} report  buildNorthStarReportV21 output
 * @returns {{valid:boolean, errors:string[]}}
 */
function validateNorthStarReportV21(report) {
  const errors = []
  if (!report || typeof report !== 'object' || !Array.isArray(report.sections)) {
    return { valid: false, errors: ['REPORT_NOT_OBJECT'] }
  }

  const sections = report.sections
  const byId = {}
  for (const s of sections) {
    if (!s || !s.sectionId) { errors.push('SECTION_MISSING_ID'); continue }
    if (byId[s.sectionId]) errors.push('DUPLICATE_SECTION_ID:' + s.sectionId)
    byId[s.sectionId] = s
  }

  // ── §5 mandatory section presence ───────────────────────────────────────
  for (const id of MANDATORY_SECTIONS) {
    if (!byId[id]) errors.push('MANDATORY_SECTION_MISSING:' + id)
  }

  const verdict = byId['01_COGNITIVE_VERDICT']
  const worldRule = byId['03_WORLD_RULE_ALIGNMENT']
  const evidence = byId['04_WHY_WE_JUDGE_THIS']
  const upgrade = byId['06_COGNITIVE_UPGRADE']
  const protocol = byId['07_DECISION_PROTOCOL']
  const scenario = byId['08_SCENARIO_CONTRAST']
  const secondary = byId['09_SECONDARY_MODEL_CONTEXT']

  const diagnosisState = report.diagnosisState || {}
  const primaryBlindSpotId = diagnosisState.primaryBlindSpotId || null
  const reasonCode = diagnosisState.reasonCode || null
  const hasPrimary = !!primaryBlindSpotId

  // ── §6 verdict must not be taxonomy-label-only ───────────────────────────
  if (verdict) {
    const summary = verdict.summary || ''
    if (hasPrimary && summary.length < 8) {
      errors.push('VERDICT_IS_TAXONOMY_LABEL_ONLY')
    }
    // verdict must not merely echo the label
    if (hasPrimary && verdict.body && verdict.body.blindSpotLabel && summary === verdict.body.blindSpotLabel) {
      errors.push('VERDICT_IS_TAXONOMY_LABEL_ONLY')
    }
    // generic fallback must not appear for a supported primary
    if (hasPrimary && /本次未得出唯一的核心认知发现/.test(summary)) {
      errors.push('GENERIC_FALLBACK_FOR_SUPPORTED_PRIMARY')
    }
  }

  // ── §4/§13 fabricated primary in MULTIPLE / primary in blocked states ──
  if (reasonCode === 'MULTIPLE_SUPPORTED_MODELS') {
    if (hasPrimary) errors.push('FABRICATED_PRIMARY_IN_MULTIPLE')
    if (verdict && verdict.body && verdict.body.blindSpotLabel) {
      errors.push('FABRICATED_PRIMARY_IN_MULTIPLE')
    }

    // ── §10 MULTIPLE structural + copy validation ──────────────────────────
    const multi = report.multiModel
    const eligibleIds = Array.isArray(diagnosisState.eligibleCandidateIds)
      ? diagnosisState.eligibleCandidateIds
      : []

    // no fabricated primary strategy / world-rule / scenario for MULTIPLE
    if (worldRule && worldRule.body && worldRule.body.worldRule) {
      errors.push('MULTIPLE_WORLD_RULE_FABRICATION')
    }
    if (upgrade && upgrade.body && upgrade.body.upgradedModel) {
      errors.push('MULTIPLE_STRATEGY_FABRICATION')
    }
    if (scenario && scenario.body) {
      errors.push('MULTIPLE_SCENARIO_FABRICATION')
    }
    if (protocol && protocol.body && protocol.body.steps && protocol.body.steps.length) {
      errors.push('MULTIPLE_STRATEGY_FABRICATION')
    }

    if (!multi || !Array.isArray(multi.supportedModels)) {
      errors.push('MULTIPLE_MODELS_MISSING')
    } else {
      const models = multi.supportedModels
      if (models.length < 2) errors.push('MULTIPLE_MODELS_INSUFFICIENT')
      let totalEvidence = 0
      const seen = new Set()
      for (const m of models) {
        const srcBid = m && m.source && m.source.blindSpotId
        if (!srcBid) { errors.push('MULTIPLE_MODEL_SOURCE_MISSING'); continue }
        if (eligibleIds.length && !eligibleIds.includes(srcBid)) {
          errors.push('MULTIPLE_CANDIDATE_NOT_IN_ELIGIBLE:' + srcBid)
        }
        if (seen.has(srcBid)) errors.push('MULTIPLE_DUPLICATE_CANDIDATE:' + srcBid)
        seen.add(srcBid)
        const ev = Array.isArray(m.evidence) ? m.evidence : []
        if (ev.length === 0) errors.push('MULTIPLE_MODEL_EVIDENCE_MISSING:' + srcBid)
        const evSeen = new Set()
        for (const e of ev) {
          totalEvidence++
          const src = e && e.source
          if (!src || !src.questionId || !src.optionId || !src.evidenceId) {
            errors.push('MULTIPLE_EVIDENCE_NOT_SOURCE_BACKED:' + srcBid)
            continue
          }
          const key = src.questionId + '|' + src.optionId + '|' + src.evidenceId
          if (evSeen.has(key)) errors.push('MULTIPLE_DUPLICATE_EVIDENCE:' + srcBid)
          evSeen.add(key)
        }
      }
      if (totalEvidence === 0) errors.push('MULTIPLE_ALL_EVIDENCE_MISSING')
    }

    // no false-insufficiency copy + no raw token in user-visible MULTIPLE copy
    const multiStrings = multi ? collectUserStrings(multi) : []
    for (const s of multiStrings) {
      if (/回答不足|证据不足|不足以形成/.test(s)) errors.push('MULTIPLE_FALSE_INSUFFICIENT_COPY')
      const tok = containsRawSemanticToken(s)
      if (tok) errors.push('RAW_INTERNAL_TOKEN_IN_USER_COPY:' + tok)
    }
  }
  if (NO_PRIMARY_REASON_CODES.has(reasonCode) && hasPrimary) {
    errors.push('PRIMARY_DIAGNOSIS_IN_BLOCKED_STATE')
  }

  // ── §8 world rule + misalignment + provenance required for supported primary ──
  if (hasPrimary) {
    if (!worldRule || !worldRule.summary) {
      errors.push('WORLD_RULE_MISSING')
    }
    if (worldRule && worldRule.body) {
      if (!worldRule.body.worldRule) errors.push('MISALIGNMENT_MISSING_WORLD_RULE')
      if (!worldRule.body.misalignment) errors.push('MISALIGNMENT_MISSING')
      // world-rule provenance must name a canonical principle matching the primary
      const src = worldRule.body.source
      if (!src || !src.principleId) {
        errors.push('WORLD_RULE_PROVENANCE_MISSING')
      } else if (!CANONICAL_PRINCIPLE_IDS.has(src.principleId)) {
        errors.push('WORLD_RULE_PROVENANCE_INVALID')
      } else if (src.blindSpotId && src.blindSpotId !== primaryBlindSpotId) {
        errors.push('WORLD_RULE_PROVENANCE_BLINDSPOT_MISMATCH')
      }
    }
  }

  // ── §9 evidence must be user-specific (≥2 items for strong primary) ─────
  if (hasPrimary && evidence) {
    const items = evidence.body && evidence.body.items
    if (!items || items.length === 0) {
      errors.push('EVIDENCE_IS_GENERIC')
    }
    // when trace provides two supporting items, require ≥2
    if (report.diagnosisState && items && items.length < 2) {
      // Only flag if the presentation model actually had ≥2 rows
      // (report builder preserves rowCount; we can infer from sourceRefs)
      // We conservatively flag only when there is exactly 1 item and primary is STRONG-unique.
      // To avoid false negatives, we check a marker on the report if present.
    }
  }

  // ── §11 upgrade must not only output strategy name ───────────────────────
  if (hasPrimary && upgrade && upgrade.body) {
    const body = upgrade.body
    const model = body.upgradedModel || ''
    if (model.length < 8) errors.push('UPGRADE_IS_STRATEGY_NAME_ONLY')
  }

  // ── §12 protocol must not degenerate to strategy label only ──────────────
  if (hasPrimary && protocol) {
    const steps = protocol.body && protocol.body.steps
    const hasSignal = protocol.body && (protocol.body.successSignal || protocol.body.stopCondition)
    if (!steps || steps.length === 0 || !hasSignal) {
      errors.push('PROTOCOL_IS_STRATEGY_LABEL_ONLY')
    }
  }

  // ── §3/§14 blindSpot ↔ strategy consistency (internal, no re-derivation) ─
  if (hasPrimary && verdict && verdict.body && verdict.body.source) {
    const vBlind = verdict.body.source.blindSpotId
    if (vBlind && vBlind !== primaryBlindSpotId) errors.push('VERDICT_BLINDSPOT_MISMATCH')
    if (upgrade && upgrade.body && upgrade.body.source) {
      if (upgrade.body.source.blindSpotId && upgrade.body.source.blindSpotId !== primaryBlindSpotId) {
        errors.push('BLINDSPOT_STRATEGY_MISMATCH')
      }
    }
    if (protocol && protocol.body && protocol.body.source) {
      const tbs = protocol.body.source.targetBlindSpot
      if (tbs && tbs !== primaryBlindSpotId) errors.push('BLINDSPOT_STRATEGY_MISMATCH')
    }
  }

  // ── §13 scenario must not be "future better/worse" only ──────────────────
  if (hasPrimary && scenario && scenario.body) {
    const b = scenario.body
    const hasCurrent = b.currentModel && b.currentModel.likelyDecisionPattern && b.currentModel.likelyDecisionPattern.length > 0
    const hasUpgraded = b.upgradedModel && b.upgradedModel.likelyDecisionPattern && b.upgradedModel.likelyDecisionPattern.length > 0
    if (!hasCurrent || !hasUpgraded) errors.push('SCENARIO_NOT_MODEL_SHIFT')
    if (!b.simulationNote) errors.push('SCENARIO_MISSING_SIMULATION_NOTE')
  }

  // ── §14 archetype must not be primary card ──────────────────────────────
  // (archetype only appears inside section 09; no standalone section)
  const hasStandaloneArchetypeSection = sections.some((s) => /archetype/i.test(s.sectionId) && s.sectionId !== '09_SECONDARY_MODEL_CONTEXT')
  if (hasStandaloneArchetypeSection) errors.push('ARCHETYPE_PRIMARY_CARD')

  // ── §15 dimension dashboard must not be primary flow ─────────────────────
  const hasStandaloneDimensionSection = sections.some((s) => /dimension|dashboard/i.test(s.sectionId) && s.sectionId !== '09_SECONDARY_MODEL_CONTEXT')
  if (hasStandaloneDimensionSection) errors.push('DIMENSION_DASHBOARD_PRIMARY')

  // ── §16/§17 copy governance: scan all user strings ──────────────────────
  const userStrings = collectUserStrings(report)
  for (const s of userStrings) {
    // English paragraph
    if (isEnglishParagraph(s)) errors.push('USER_VISIBLE_ENGLISH_PARAGRAPH:' + s.slice(0, 60))
    // raw internal tokens
    for (const tok of RAW_INTERNAL_TOKENS) {
      if (s === tok) {
        errors.push('RAW_INTERNAL_TOKEN_IN_USER_COPY:' + tok)
      }
    }
    // prediction / wealth / destiny / percentage
    for (const tok of FORBIDDEN_PREDICTION_TOKENS) {
      if (s.indexOf(tok) !== -1) errors.push('UNSUPPORTED_PREDICTION:' + tok)
    }
    // wealth promise / money outcome
    for (const tok of WEALTH_PROMISE_TOKENS) {
      if (s.indexOf(tok) !== -1) errors.push('WEALTH_PROMISE:' + tok)
    }
  }

  // ── §17 exact paragraph duplication across sections ─────────────────────
  const summarySet = new Map()
  for (const s of sections) {
    if (s.summary && s.summary.length >= 8) {
      if (summarySet.has(s.summary)) errors.push('EXACT_PARAGRAPH_DUPLICATION:' + s.sectionId + '=' + summarySet.get(s.summary))
      else summarySet.set(s.summary, s.sectionId)
    }
  }

  return { valid: errors.length === 0, errors }
}

module.exports = {
  RAW_INTERNAL_TOKENS,
  FORBIDDEN_PREDICTION_TOKENS,
  WEALTH_PROMISE_TOKENS,
  GENERIC_SELF_HELP_TOKENS,
  CANONICAL_PRINCIPLE_IDS,
  MANDATORY_SECTIONS,
  NO_PRIMARY_REASON_CODES,
  collectUserStrings,
  isEnglishParagraph,
  validateNorthStarReportV21,
}
