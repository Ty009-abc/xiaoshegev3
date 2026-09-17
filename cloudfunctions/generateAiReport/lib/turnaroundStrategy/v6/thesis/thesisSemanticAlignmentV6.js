'use strict'
/**
 * turnaroundStrategy/v6/thesis/thesisSemanticAlignmentV6.js
 *
 * RC8.4 V6 R68 §3–§6 — STRUCTURED SEMANTIC STRATEGY ALIGNMENT.
 *
 * REPLACES the former lexical authority for strategy alignment. Previously a
 * semantically-valid LINK_TEST could be rejected merely because the prose did
 * not contain literal trigger words (连接 / 用得上 / 目标方向 / 这条路).
 *
 * NEW AUTHORITY ORDER (§4):
 *   ThesisEnvelope  ->  strategicThesis structured fields  ->  experimentClass /
 *   migrationId.  Prose keyword presence is NO LONGER a blocking authority.
 *
 * The AI output contract (§3) may carry machine-readable fields:
 *   strategicThesis.strategicMigration.id
 *   strategicThesis.commercialHypothesis.class
 *   strategicThesis.actionThesis.experimentClass
 * When present they are authoritative; when absent the rule stays tolerant
 * (never blocks on prose alone). Regex survives ONLY as a diagnostic hint for
 * detecting a real scale/overreach move when no structured id is supplied.
 *
 * Deterministic. No AI. No I/O. No network.
 */

// Scale/overreach signals (asset-scale moves that are NOT allowed under UNPROVEN).
// R68 §16 — broadened so a prose-only overreach (no structured id) is still caught.
// Negation is handled by assertedScaleSignal() (a negated / warned-against move is
// NOT overreach: e.g. “下一步不是扩大这项能力” / “不要急着扩大”).
const SCALE_SIGNAL = /扩大|放大|复制|系统化|标准化|规模化|多接|接更多|做成方法|照搬|重复做|设为主攻|主攻方向|再找1个同类|固定成标准|固定下来|照着走|写成一步步|批量复制|全面铺开|做大做强/
// Negation / conditional / contrast cues that DECLARE the scale move is NOT the
// plan (e.g. “不要急着扩大” / “如果直接扩大就会失败” / “与其扩大不如先验证”).
// Sentence-boundary aware; checked on the up-to-6 chars before the token.
const SCALE_NEG_CUE = /不|别|没|未|勿|无需|而非|非但|如果|若|一旦|与其|避免|急着|贸然|轻易|盲目/

/**
 * True only when a scale move is ASSERTED (not negated / warned against).
 * Scans each SCALE token and inspects the up-to-6 chars immediately before it;
 * a negation cue there (with no sentence boundary between) voids that occurrence.
 */
function assertedScaleSignal (text) {
  const s = text == null ? '' : String(text)
  const re = new RegExp(SCALE_SIGNAL.source, 'g')
  let m
  while ((m = re.exec(s))) {
    let pre = s.slice(Math.max(0, m.index - 6), m.index)
    const b = Math.max(pre.lastIndexOf('。'), pre.lastIndexOf('！'), pre.lastIndexOf('？'), pre.lastIndexOf('；'), pre.lastIndexOf('\n'), pre.lastIndexOf('，'))
    if (b >= 0) pre = pre.slice(b + 1)
    if (SCALE_NEG_CUE.test(pre)) continue // negated occurrence -> not overreach
    return true
  }
  return false
}
// Link-test signals (diagnostic hint only).
const LINK_SIGNAL = /(连接|连不连|连得上|连不上|用得上|用不上|用得到|用不到|能不能用|是否相关|有没有[^。！？\n]{0,4}关系|同一条|同一个问题|同一个方向|目标方向|当前目标|眼下)/

// Reasoning codes emitted by the structured alignment check.
const ALIGNMENT_CODES = [
  'MIGRATION_OUTSIDE_ENVELOPE',
  'CARD04_MIGRATION_ID_MISMATCH',
  'CARD05_EXPERIMENT_CLASS_MISMATCH',
  'COMMERCIAL_HYPOTHESIS_OUTSIDE_ENVELOPE',
  'UNPROVEN_PATH_OVERREACH'
]

/**
 * Classify the migration semantics.
 * Structured id (when present) is AUTHORITATIVE; text keywords are a hint.
 * @returns {{kind:'SCALE'|'LINK'|'ONE_STEP'|'OUTSIDE'|'UNKNOWN', id:string|null, source:'STRUCTURED'|'INFERRED'}}
 */
function classifyMigrationSemantics (output, env) {
  const o = output || {}
  const st = o.strategicThesis || {}
  const mg = st.strategicMigration || {}
  const c4 = (o.cards && o.cards.card04) || {}
  const allowed = ((env && env.allowedTargetPositions) || []).map((m) => m.id)
  const blob = [mg.from, mg.to, mg.logic, c4.from, c4.to, c4.logic].filter(Boolean).join(' ')

  // §16 — a REAL, ASSERTED asset-scale move in the visible migration copy is a
  // genuine overreach even when a non-scale structured id was supplied. A merely
  // negated move (“下一步不是扩大”) is NOT overreach (semantically valid LINK_TEST).
  if (assertedScaleSignal(blob)) return { kind: 'SCALE', id: mg.id || null, source: mg.id ? 'STRUCTURED' : 'INFERRED' }

  // 1) STRUCTURED id is authoritative.
  if (mg.id) {
    if (allowed.length && allowed.indexOf(mg.id) === -1) return { kind: 'OUTSIDE', id: mg.id, source: 'STRUCTURED' }
    if (/SCALE|SYSTEMAT|REPEAT|LEVERAGE|EXPAND/.test(mg.id)) return { kind: 'SCALE', id: mg.id, source: 'STRUCTURED' }
    if (/LINK/.test(mg.id)) return { kind: 'LINK', id: mg.id, source: 'STRUCTURED' }
    return { kind: 'ONE_STEP', id: mg.id, source: 'STRUCTURED' }
  }

  // 2) INFERRED from text (hint only — never the sole authority for a pass).
  if (!blob) return { kind: 'UNKNOWN', id: null, source: 'INFERRED' }
  if (LINK_SIGNAL.test(blob)) return { kind: 'LINK', id: null, source: 'INFERRED' }
  return { kind: 'UNKNOWN', id: null, source: 'INFERRED' }
}

/**
 * Validate the strategic alignment from STRUCTURED envelope fields.
 * Structured fields present  => authoritative comparison.
 * Structured fields absent    => tolerant (no prose-only block).
 * @returns {{aligned:boolean, violations:string[], migrationKind:string,
 *   migrationIdSource:string, experimentClassSource:string, commercialClassSource:string}}
 */
function validateEnvelopeAlignment (output, env) {
  const o = output || {}
  const e = env || {}
  const st = o.strategicThesis || {}
  const allowedIds = (e.allowedTargetPositions || []).map((m) => m.id)
  const expectedMig = allowedIds[0] || null
  const expectedExp = e.experimentClass || null
  const allowedHyp = e.allowedStrategyHypotheses || []

  const violations = []
  const out = {
    aligned: true,
    violations: violations,
    migrationKind: null,
    migrationIdSource: 'ABSENT',
    experimentClassSource: 'ABSENT',
    commercialClassSource: 'ABSENT'
  }

  // ── structured migration id (authority when present) ──
  const mgId = st.strategicMigration && st.strategicMigration.id
  if (mgId) {
    out.migrationIdSource = 'STRUCTURED'
    if (allowedIds.length && allowedIds.indexOf(mgId) === -1) {
      violations.push('MIGRATION_OUTSIDE_ENVELOPE')
    } else if (expectedMig && mgId !== expectedMig && e.crossAxisScope === 'UNPROVEN') {
      violations.push('CARD04_MIGRATION_ID_MISMATCH')
    }
  }

  // ── structured experiment class (authority when present) ──
  const atExp = st.actionThesis && st.actionThesis.experimentClass
  if (atExp) {
    out.experimentClassSource = 'STRUCTURED'
    if (expectedExp && atExp !== expectedExp) violations.push('CARD05_EXPERIMENT_CLASS_MISMATCH')
  }

  // ── structured commercial hypothesis class (authority when present) ──
  const chCls = st.commercialHypothesis && st.commercialHypothesis.class
  if (chCls) {
    out.commercialClassSource = 'STRUCTURED'
    if (allowedHyp.length && allowedHyp.indexOf(chCls) === -1) violations.push('COMMERCIAL_HYPOTHESIS_OUTSIDE_ENVELOPE')
  }

  // ── migration semantics (true overreach) ──
  const sem = classifyMigrationSemantics(o, e)
  out.migrationKind = sem.kind
  if (e.diagnosisState === 'NO_PRIMARY' && e.crossAxisScope === 'UNPROVEN' && sem.kind === 'SCALE') {
    violations.push('UNPROVEN_PATH_OVERREACH')
  }

  out.aligned = violations.length === 0
  return out
}

module.exports = {
  validateEnvelopeAlignment,
  classifyMigrationSemantics,
  assertedScaleSignal,
  ALIGNMENT_CODES,
  SCALE_SIGNAL,
  LINK_SIGNAL
}
