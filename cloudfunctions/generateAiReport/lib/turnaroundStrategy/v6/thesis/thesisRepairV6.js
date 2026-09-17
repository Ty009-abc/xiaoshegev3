'use strict'
/**
 * turnaroundStrategy/v6/thesis/thesisRepairV6.js
 *
 * RC8.4 V6 R65 — DETERMINISTIC LOCAL REPAIR (repairable copy issues only).
 *
 * PURPOSE
 *   A single lexical intensifier (e.g. 永远) must never discard an otherwise
 *   strong, in-envelope thesis. For REPAIRABLE issues only, this module performs
 *   ONE deterministic local normalisation of the raw draft, in-process, so the
 *   caller can re-run the SAME deterministic validator.
 *
 * HARD RULES (R65 §4/§5/§16)
 *   - NO second AI call. NO provider. NO network. Pure string normalisation.
 *   - The repair may ONLY reduce repairable lexical intensity.
 *   - It may NOT change the thesis, world rule, migration, experiment, facts,
 *     evidence, or strategic direction (LOCAL_REPAIR_STRATEGY_MUTATION_COUNT=0):
 *     worldRule.id, strategicMigration.from/to, and the fact set are never
 *     touched.
 *   - Replacements are CHAR-LENGTH PRESERVING (2→2 / 3→3) so card word budgets
 *     are not perturbed.
 *   - Negated forms (不一定 / 未必 / 不必然 / 被肯定) are never rewritten.
 *
 * CONSUMER LAYER ONLY. Deterministic. No AI. No I/O.
 */

const { normalizeThesisOutput } = require('./thesisAdapterV6.js')

// Ordered equal-length normalisations. Negation-aware lookbehind.
//  永远 → 很难 · 一定 → 往往 · 必然 → 通常 · 肯定 → 多半 · 注定 → 往往 · 迟早 → 最终
const REPAIR_RULES = [
  { type: 'ABSOLUTE_TO_HEDGE', src: '(?<![不未])永远', to: '很难' },
  { type: 'ABSOLUTE_TO_HEDGE', src: '(?<![不未])一定', to: '往往' },
  { type: 'ABSOLUTE_TO_HEDGE', src: '(?<![不未])必然', to: '通常' },
  { type: 'ABSOLUTE_TO_HEDGE', src: '(?<![不未被])肯定', to: '多半' },
  { type: 'ABSOLUTE_TO_HEDGE', src: '(?<![不未])注定', to: '往往' },
  { type: 'ABSOLUTE_TO_HEDGE', src: '(?<![不未])迟早', to: '最终' }
]

/** Apply every repair rule to one string; record distinct repair types. */
function repairString (s, types) {
  if (typeof s !== 'string' || s === '') return s
  let out = s
  for (const r of REPAIR_RULES) {
    const re = new RegExp(r.src, 'g')
    const next = out.replace(re, r.to)
    if (next !== out) {
      out = next
      if (types.indexOf(r.type) === -1) types.push(r.type)
    }
  }
  return out
}

/**
 * Deterministically repair a normalised thesis output.
 * Returns a NEW output object; the input is not mutated.
 * @param {Object} output raw/normalised thesis output
 * @returns {{output:Object, repairTypes:string[], applied:boolean}}
 */
function repairThesisOutput (output) {
  const o = normalizeThesisOutput(output)
  const types = []
  const st = o.strategicThesis
  st.identityInterpretation = repairString(st.identityInterpretation, types)
  st.coreContradiction = repairString(st.coreContradiction, types)
  st.structuralMechanism = repairString(st.structuralMechanism, types)
  // worldRule.id is STRATEGY — never touched. Only the free-text expression.
  st.worldRule.expression = repairString(st.worldRule.expression, types)
  st.strategicMigration.logic = repairString(st.strategicMigration.logic, types)
  st.commercialHypothesis = repairString(st.commercialHypothesis, types)
  st.actionThesis = repairString(st.actionThesis, types)

  const c = o.cards
  c.card01 = repairString(c.card01, types)
  c.card02 = repairString(c.card02, types)
  c.card03 = c.card03.map((x) => repairString(x, types))
  c.card04.from = repairString(c.card04.from, types)
  c.card04.to = repairString(c.card04.to, types)
  c.card04.logic = repairString(c.card04.logic, types)
  c.card05.primary = repairString(c.card05.primary, types)
  c.card05.supporting = c.card05.supporting.map((x) => repairString(x, types))
  c.card05.target = repairString(c.card05.target, types)
  c.card05.timebox = repairString(c.card05.timebox, types)
  c.card05.successSignal = repairString(c.card05.successSignal, types)

  return { output: o, repairTypes: types, applied: types.length > 0 }
}

module.exports = { repairThesisOutput, repairString, REPAIR_RULES }
