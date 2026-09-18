'use strict'
/**
 * turnaroundStrategy/v6/hybrid/modelRealityMismatchV6.js
 *
 * RC8.4 V6 R86-C — MODEL ↔ REALITY MISMATCH (deterministic, NO LLM).
 *
 * Compares the user's WORLD MODEL (how they reason, worldModelV1) against the
 * REALITY/GAME context (what their situation actually rewards) and emits a SET
 * OF CODES + EVIDENCE. It NEVER emits a verdict about the person.
 *
 * Mirrors `hybridCompatibilityV6`'s neutral-signal pattern: output = codes,
 * not judgement. A mismatch means 「你把一套在 X 场景有效的模型用到了 Y 场景」,
 * never 「你的认知是错的」.
 *
 * AUTHORITY (frozen — R86-B1 §6/§19):
 *   - A reality fact is the COMPARISON OPERAND, never the model authority.
 *   - Every code requires BOTH a WORLD_MODEL evidence side AND a REALITY/GAME
 *     side. Reality-only or model-only input can NEVER fire a code (except the
 *     aligned case which requires a defined model and no other code).
 *   - Each code documents its PROHIBITED shortcut (never fire from income /
 *     occupation / pricingAuthority alone).
 *
 * BOUNDARY: pure deterministic. No I/O. No AI. No network. No persistence.
 */

const MISMATCH_VERSION = 'r86c_model_reality_mismatch_v1'

const CODES = Object.freeze([
  'LABOR_LINEARITY_TRAP',
  'CERTAINTY_SEEKING_TRAP',
  'SINGLE_CAUSE_TRAP',
  'RULE_BLINDNESS_TRAP',
  'ANECDOTE_EVIDENCE_TRAP',
  'MODEL_REALITY_ALIGNED'
])

// ── helper: read a world-axis state ──────────────────────────────────────────
function axisState (wm, axis) {
  const a = wm && wm.axes && wm.axes[axis]
  return (a && a.state) || 'UNKNOWN'
}
function axisEvidence (wm, axis) {
  const a = wm && wm.axes && wm.axes[axis]
  if (!a) return []
  const prim = (a.primaryEvidence || []).slice()
  const sup = (a.supportingEvidence || []).slice()
  return prim.concat(sup)
}

// ── helper: read reality/game facts (comparison operands only) ───────────────
function gmValue (gm, dim) {
  // gameModelV6 exposes FLAT fields: gm.<dim> = { value, sourceEvidence, confidence }
  const d = gm && gm[dim]
  if (d && typeof d === 'object') return d.value || 'UNKNOWN'
  return 'UNKNOWN'
}
function rawValue (raw, key) { return (raw && raw[key]) || null }

/**
 * Compute the deterministic mismatch set.
 * @param {Object} args { worldModel, raw, gameModel, realEconomyModel, pricingPower }
 * @returns {{version, codes:string[], codeCount, primaryCode, evidence, aligned}}
 */
function computeModelRealityMismatchV6 (args) {
  const a = args || {}
  const wm = a.worldModel || null
  const raw = a.raw || {}
  const gm = a.gameModel || null
  const ppm = a.pricingPower || null
  const em = a.realEconomyModel || null

  const evidence = {}
  const codes = []

  const labor = axisState(wm, 'LABOR')
  const prob = axisState(wm, 'PROBABILITY')
  const sys = axisState(wm, 'SYSTEM')
  const rule = axisState(wm, 'RULE')
  const evid = axisState(wm, 'EVIDENCE')

  const leverageState = gmValue(gm, 'leverageState')
  const ruleOwner = gmValue(gm, 'ruleOwner')
  const marketProofState = gmValue(gm, 'marketProofState')
  const gameType = gmValue(gm, 'gameType')
  const priceRaw = rawValue(raw, 'pricingAuthority')
  const skillValidation = rawValue(raw, 'skillValidation')

  // ── #1 LABOR_LINEARITY_TRAP ────────────────────────────────────────────────
  // requires laborModel=TIME_LINEAR (OBSERVED, S6) AND leverageState=TIME_BOUND.
  // PROHIBITED: firing from incomeStructure alone; from external pricing alone.
  if (labor === 'TIME_LINEAR' && leverageState === 'TIME_BOUND') {
    codes.push('LABOR_LINEARITY_TRAP')
    evidence.LABOR_LINEARITY_TRAP = {
      model: axisEvidence(wm, 'LABOR'),
      reality: [{ source: 'gameModel.leverageState=' + leverageState, class: 'DERIVED' }],
      note: '把「投入时间就有回报」用在了一个时间绑定、价值无法沉淀的局里'
    }
  }

  // ── #2 CERTAINTY_SEEKING_TRAP ──────────────────────────────────────────────
  // requires probabilityModel=CERTAINTY_SEEKING AND evidenceModel in
  // {PRAISE_BASED, LUCK_DISMISS, UNREFLECTIVE} (both cognitive) AND outcome not
  // yet validated (marketProofState in {NO_PROOF, FREE_ONLY}).
  // PROHIBITED: firing from a single safetyMonths fear; moralising caution.
  if (prob === 'CERTAINTY_SEEKING' &&
      (evid === 'PRAISE_BASED' || evid === 'LUCK_DISMISS' || evid === 'UNREFLECTIVE') &&
      (marketProofState === 'NO_PROOF' || marketProofState === 'FREE_ONLY')) {
    codes.push('CERTAINTY_SEEKING_TRAP')
    evidence.CERTAINTY_SEEKING_TRAP = {
      model: axisEvidence(wm, 'PROBABILITY').concat(axisEvidence(wm, 'EVIDENCE')),
      reality: [{ source: 'gameModel.marketProofState=' + marketProofState, class: 'DERIVED' }],
      note: '要先确定才行动，而判断「成了」的标准又依赖感觉/运气，于是永远等不到确定'
    }
  }

  // ── #3 SINGLE_CAUSE_TRAP ───────────────────────────────────────────────────
  // requires systemModel=PERSON_ATTRIBUTION AND ruleOwner != USER.
  // PROHIBITED: firing from occupation; asserting the person is "wrong".
  if (sys === 'PERSON_ATTRIBUTION' && ruleOwner && ruleOwner !== 'USER') {
    codes.push('SINGLE_CAUSE_TRAP')
    evidence.SINGLE_CAUSE_TRAP = {
      model: axisEvidence(wm, 'SYSTEM'),
      reality: [{ source: 'gameModel.ruleOwner=' + ruleOwner, class: 'DERIVED' }],
      note: '把反复出现的结果归到「某个人不行」，而规则与激励其实攥在别人手里'
    }
  }

  // ── #4 RULE_BLINDNESS_TRAP ─────────────────────────────────────────────────
  // requires ruleModel=EFFORT_DEFAULT AND pricingAuthority external.
  // PROHIBITED: pricingAuthority as the sole trigger; firing when ruleModel absent.
  if (rule === 'EFFORT_DEFAULT' &&
      (priceRaw === 'PRICE_EMPLOYER' || priceRaw === 'PRICE_PLATFORM' || priceRaw === 'PRICE_CLIENT')) {
    codes.push('RULE_BLINDNESS_TRAP')
    evidence.RULE_BLINDNESS_TRAP = {
      model: axisEvidence(wm, 'RULE'),
      reality: [{ source: 'pricingAuthority=' + priceRaw, class: 'OBSERVED' }, { source: 'gameModel.gameType=' + gameType, class: 'DERIVED' }],
      note: '默认「努力就是解法」，但这份收入的价格根本不由自己定'
    }
  }

  // ── #5 ANECDOTE_EVIDENCE_TRAP ──────────────────────────────────────────────
  // requires evidenceModel in {PRAISE_BASED, LUCK_DISMISS} AND reality proof
  // exists (skillValidation >= PROOF_PAID_ONCE).
  // PROHIBITED: firing from skillValidation alone; claiming the user "got lucky".
  if ((evid === 'PRAISE_BASED' || evid === 'LUCK_DISMISS') &&
      (skillValidation === 'PROOF_PAID_ONCE' || skillValidation === 'PROOF_OCCASIONAL' || skillValidation === 'PROOF_STABLE')) {
    codes.push('ANECDOTE_EVIDENCE_TRAP')
    evidence.ANECDOTE_EVIDENCE_TRAP = {
      model: axisEvidence(wm, 'EVIDENCE'),
      reality: [{ source: 'skillValidation=' + skillValidation, class: 'OBSERVED' }],
      note: '手里已经有能被市场付费的真凭据，但判断标准还停在「别人怎么说」或「运气」'
    }
  }

  // ── #6 MODEL_REALITY_ALIGNED ───────────────────────────────────────────────
  // no other code fires (and at least one axis is defined).
  const anyDefined = !!(wm && wm.axes && ['LABOR', 'PROBABILITY', 'SYSTEM', 'RULE', 'EVIDENCE'].some((x) => axisState(wm, x) !== 'UNKNOWN'))
  const aligned = codes.length === 0 && anyDefined
  if (aligned) {
    codes.push('MODEL_REALITY_ALIGNED')
    evidence.MODEL_REALITY_ALIGNED = {
      model: [],
      reality: [],
      note: '在当前证据下，模型与现实没有出现结构性错配（这不是表扬，只是没有命中错配）'
    }
  }

  return {
    version: MISMATCH_VERSION,
    codes: codes,
    codeCount: codes.length,
    primaryCode: codes.length ? codes[0] : null,
    aligned: aligned,
    evidence: evidence,
    realityDirectAuthorityCount: 0
  }
}

/**
 * Render mismatch codes as human-readable prompt lines (deterministic).
 */
function renderMismatchLines (mm) {
  const m = mm || null
  if (!m || !m.codes || !m.codes.length) return []
  const lines = []
  lines.push('模型-现实错配码：' + m.codes.join(' / '))
  for (const c of m.codes) {
    const e = m.evidence && m.evidence[c]
    if (e && e.note) lines.push('- ' + c + '：' + e.note)
  }
  lines.push('约束：错配描述的是「一套模型被用到了不合适的场景」，不是「这个人的认知是错的」；现实事实只是对照物，不构成对某个轴的判定。')
  return lines
}

module.exports = {
  MISMATCH_VERSION,
  CODES,
  computeModelRealityMismatchV6,
  renderMismatchLines
}
