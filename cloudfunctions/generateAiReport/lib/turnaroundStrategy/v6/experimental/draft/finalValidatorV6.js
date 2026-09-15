'use strict'
/**
 * turnaroundStrategy/v6/experimental/draft/finalValidatorV6.js
 *
 * R11_V2 — FINAL five-card report validator.
 *
 * Runs AFTER the deterministic editor. Checks the finished product copy:
 *   shape (5 cards + titles), CARD01 length target (30–60),
 *   ONTOLOGY_LEAK, WEALTH_PROMISE, REALITY_DENIAL, UNSUPPORTED_CLAIM,
 *   DIAGNOSIS_DRIFT, ACTION_TYPE_DRIFT.
 *
 * This is the gate that decides whether the EDITED report is shippable, or
 * whether the whole report must fall back to deterministic B2 (§7).
 */

const { finalVisibleText } = require('./reportEditorV6.js')
const { validateDraftV6 } = require('./draftValidatorV6.js')

const FINAL_VERSION = 'turnaround_strategy_v6_final_v1'
const CARD_KEYS = ['fatalInsight', 'coreProblem', 'systemLoop', 'turnaroundPath', 'firstAction']
const TITLES = { fatalInsight: '致命一句话', coreProblem: '核心问题', systemLoop: '系统困局', turnaroundPath: '翻身路径', firstAction: '现在就做' }
const CARD01_MIN = 30
const CARD01_MAX = 60

function chars (s) { return s == null ? 0 : [...String(s)].length }

function validateFinalV6 (report, diagnosis) {
  const f = {
    shapeOk: false, cardCount: 0, titleMismatch: 0, loopStepCount: 0, checksCount: 0,
    card01Len: 0, card01Under: false, card01Over: false,
    ontologyLeak: [], wealthPromise: [], realityDenial: [], unsupportedClaims: [],
    bottleneckDrift: false, actionTypeDrift: false
  }
  if (!report || !report.cards) return { valid: false, hardFailures: ['SHAPE_INVALID'], findings: f }
  const c = report.cards
  for (const k of CARD_KEYS) if (c[k]) f.cardCount++
  for (const k of CARD_KEYS) if (!c[k] || c[k].title !== TITLES[k]) f.titleMismatch++
  f.loopStepCount = Array.isArray(c.systemLoop && c.systemLoop.steps) ? c.systemLoop.steps.length : 0
  f.checksCount = Array.isArray(c.firstAction && c.firstAction.checks) ? c.firstAction.checks.length : 0
  if (f.cardCount !== 5 || f.titleMismatch !== 0 || f.loopStepCount !== 5 || f.checksCount < 1) {
    return { valid: false, hardFailures: ['SHAPE_INVALID'], findings: f }
  }
  f.shapeOk = true

  const text = finalVisibleText(report)
  f.card01Len = chars(c.fatalInsight.text)
  f.card01Over = f.card01Len > CARD01_MAX
  f.card01Under = f.card01Len < CARD01_MIN

  // Reuse the draft validator's semantic checks by shaping a pseudo-draft.
  const pseudo = {
    insightCandidates: [c.fatalInsight.text],
    mechanismExplanation: c.coreProblem.text,
    transitionExplanation: c.turnaroundPath.logic || '',
    actionExplanation: [c.firstAction.action, c.firstAction.note].filter(Boolean).join(' ')
  }
  const sem = validateDraftV6(pseudo, diagnosis)
  f.ontologyLeak = sem.findings.ontologyLeak
  f.wealthPromise = sem.findings.wealthPromise
  f.realityDenial = sem.findings.realityDenial
  f.unsupportedClaims = sem.findings.unsupportedClaims
  f.bottleneckDrift = sem.findings.bottleneckDrift
  f.actionTypeDrift = sem.findings.actionTypeDrift

  const hardFailures = []
  if (f.ontologyLeak.length) hardFailures.push('ONTOLOGY_LEAK')
  if (f.wealthPromise.length) hardFailures.push('WEALTH_PROMISE')
  if (f.realityDenial.length) hardFailures.push('REALITY_DENIAL')
  if (f.unsupportedClaims.length) hardFailures.push('UNSUPPORTED_USER_CLAIM')
  if (f.bottleneckDrift) hardFailures.push('DIAGNOSIS_DRIFT')
  if (f.actionTypeDrift) hardFailures.push('ACTION_TYPE_DRIFT')
  if (f.card01Over) hardFailures.push('CARD01_TOO_LONG')

  return { valid: hardFailures.length === 0, hardFailures, findings: f }
}

module.exports = { FINAL_VERSION, CARD_KEYS, TITLES, CARD01_MIN, CARD01_MAX, validateFinalV6 }
