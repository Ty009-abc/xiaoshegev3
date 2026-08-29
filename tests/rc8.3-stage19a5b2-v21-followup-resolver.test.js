/**
 * RC8.3 Stage19A5B-2 — V2.1 Follow-up Resolver Acceptance Tests
 *
 * Validates the A5A FOLLOW_UP_REQUIRED → positive discrimination →
 * PRIMARY_ALLOWED (or INSUFFICIENT_EVIDENCE) terminal resolution.
 *
 * Authority: docs/adr/ADR-RC8.3-STAGE19-A5-UNCERTAINTY-PRIMARY-SELECTION-CONTRACT.md
 *   — A5.1 §A5.1-5 (§6 FROZEN) / §A5.1-6 (§7) / A5.1-R1.
 *
 * NOTE on fixture-list transposition: the task §14 fixture list items 7–8 read
 * "ID-OPP A→ID, B→OPP", but the authoritative ADR §A5.1 组4 table (and the
 * already-published frozen bank) state A→OPPORTUNITY_BLINDNESS, B→IDENTITY_CONSTRAINT.
 * The resolver reuses the frozen bank, so it is ADR-consistent. Tests assert the
 * ADR-correct mapping (A→OPP, B→ID); the fixture-list text is treated as a typo.
 *
 * Uses `node --test`.
 *
 * @version world_model_v2_1
 */

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const {
  normalizeEvidenceV21,
  extractSignalsV21,
  computeDimensionsV21,
  buildBlindSpotCandidatesV21,
  decidePrimaryV21,
  PRIMARY_STATUS_SET_V21,
} = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/index.js')

const bank = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/followUpBankV21.js')
const resolver = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/followUpDiscriminatorV21.js')
const { CONSTRUCT_TO_BLINDSPOT_V21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/blindSpotCandidateEngineV21.js')

const V21_DIR = path.join(__dirname, '../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1')

// ── helpers ────────────────────────────────────────────────────────────────
function decideOf(answers) {
  const norm = normalizeEvidenceV21(answers)
  const dims = computeDimensionsV21(norm)
  const { candidates, contractViolations } = buildBlindSpotCandidatesV21(dims)
  return decidePrimaryV21({ candidates, contractViolations })
}

function fullChain(answers) {
  const norm = normalizeEvidenceV21(answers)
  const signals = extractSignalsV21(norm)
  const dims = computeDimensionsV21(norm)
  const cands = buildBlindSpotCandidatesV21(dims)
  const decision = decidePrimaryV21(cands)
  return { norm, signals, dims, cands, decision }
}

// Frozen D+D answer pairs per construct (two independent supporting base Qs).
const DD = {
  DECISION: [{ questionId: 'SC_DEC_01', optionId: 'B' }, { questionId: 'SC_DEC_02', optionId: 'C' }],
  FEEDBACK: [{ questionId: 'SC_FB_01', optionId: 'B' }, { questionId: 'SC_FB_02', optionId: 'B' }],
  PROBABILITY: [{ questionId: 'SC_PROB_01', optionId: 'B' }, { questionId: 'SC_PROB_02', optionId: 'B' }],
  RISK: [{ questionId: 'SC_RISK_01', optionId: 'B' }, { questionId: 'SC_RISK_02', optionId: 'B' }],
  LEVERAGE: [{ questionId: 'SC_LEV_01', optionId: 'A' }, { questionId: 'SC_LEV_02', optionId: 'A' }],
  TIME: [{ questionId: 'SC_TIME_01', optionId: 'A' }, { questionId: 'SC_TIME_02', optionId: 'B' }],
  IDENTITY: [{ questionId: 'SC_ID_01', optionId: 'B' }, { questionId: 'SC_ID_02', optionId: 'A' }],
  OPPORTUNITY: [{ questionId: 'SC_OPP_01', optionId: 'B' }, { questionId: 'SC_OPP_02', optionId: 'C' }],
  SYSTEMS: [{ questionId: 'SC_SYS_01', optionId: 'B' }, { questionId: 'SC_SYS_02', optionId: 'B' }],
}

function followupDecision(pairConstructs) {
  const answers = pairConstructs.flatMap((c) => DD[c])
  return decideOf(answers)
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

// Expected frozen option→construct primary (ADR §A5.1 组2–5).
const EXPECTED_OPTION_PRIMARY = {
  FU_DEC_FB: { A: 'DECISION', B: 'FEEDBACK' },
  FU_PROB_RISK: { A: 'PROBABILITY', B: 'RISK' },
  FU_RISK_TIME: { A: 'RISK', B: 'TIME' },
  FU_ID_OPP: { A: 'OPPORTUNITY', B: 'IDENTITY' },
  FU_TIME_SYS: { A: 'TIME', B: 'SYSTEMS' },
}
const PAIR_BY_ID = {
  FU_DEC_FB: ['DECISION', 'FEEDBACK'],
  FU_PROB_RISK: ['PROBABILITY', 'RISK'],
  FU_RISK_TIME: ['RISK', 'TIME'],
  FU_ID_OPP: ['IDENTITY', 'OPPORTUNITY'],
  FU_TIME_SYS: ['TIME', 'SYSTEMS'],
}

function resolveForOption(followupId, optionId) {
  const pair = PAIR_BY_ID[followupId]
  const decision = followupDecision(pair)
  assert.strictEqual(decision.status, 'FOLLOW_UP_REQUIRED', `${followupId} must be FOLLOW_UP_REQUIRED`)
  return resolver.resolveFollowUpV21(decision, { followupId, optionId })
}

// ── 1–10. ALL 10 OPTIONS RESOLVE TO INTENDED CONSTRUCT PRIMARY ────────────
test('1–10. all 10 frozen options resolve to intended construct primary', () => {
  for (const [followupId, byOption] of Object.entries(EXPECTED_OPTION_PRIMARY)) {
    for (const [optionId, construct] of Object.entries(byOption)) {
      const r = resolveForOption(followupId, optionId)
      assert.strictEqual(r.status, 'PRIMARY_ALLOWED', `${followupId}:${optionId} must allow primary`)
      assert.strictEqual(r.primaryConstruct, construct, `${followupId}:${optionId} → ${construct}`)
      assert.strictEqual(r.primaryBlindSpotId, CONSTRUCT_TO_BLINDSPOT_V21[construct])
      assert.strictEqual(r.discriminatingEvidence.direction, 'D')
      assert.strictEqual(r.discriminatingEvidence.construct, construct)
    }
  }
})

// ── 11. reversed pair → same result ───────────────────────────────────────
test('11. reversed pair gives same result (order invariant)', () => {
  const dFwd = followupDecision(['DECISION', 'FEEDBACK'])
  const dRev = followupDecision(['FEEDBACK', 'DECISION'])
  assert.strictEqual(dFwd.status, 'FOLLOW_UP_REQUIRED')
  assert.strictEqual(dRev.status, 'FOLLOW_UP_REQUIRED')
  const rf = resolver.resolveFollowUpV21(dFwd, { followupId: 'FU_DEC_FB', optionId: 'A' })
  const rr = resolver.resolveFollowUpV21(dRev, { followupId: 'FU_DEC_FB', optionId: 'A' })
  assert.strictEqual(rf.primaryConstruct, rr.primaryConstruct)
  assert.strictEqual(rf.primaryBlindSpotId, rr.primaryBlindSpotId)
})

// ── 12–14. structural / unknown / missing pair rejected ───────────────────
test('12. structural-only pair rejected (via A5A never yields FOLLOW_UP_REQUIRED)', () => {
  // DECISION+PROBABILITY is structural-only → INSUFFICIENT_EVIDENCE, never follow-up.
  const d = followupDecision(['DECISION', 'PROBABILITY'])
  assert.strictEqual(d.status, 'INSUFFICIENT_EVIDENCE')
})

test('13. unknown pair rejected at selector (PAIR_REJECTED)', () => {
  const fake = { status: 'FOLLOW_UP_REQUIRED', followupPair: ['DECISION', 'RISK'] }
  const r = resolver.resolveFollowUpV21(fake, { followupId: 'FU_DEC_FB', optionId: 'A' })
  assert.strictEqual(r.status, 'INVALID_INPUT')
  assert.strictEqual(r.reasonCode, resolver.REASON.PAIR_REJECTED)
})

test('14. missing pair rejected', () => {
  const fake = { status: 'FOLLOW_UP_REQUIRED', followupPair: null }
  const r = resolver.resolveFollowUpV21(fake, { followupId: 'FU_DEC_FB', optionId: 'A' })
  assert.strictEqual(r.status, 'INVALID_INPUT')
  const fake2 = { status: 'FOLLOW_UP_REQUIRED' }
  const r2 = resolver.resolveFollowUpV21(fake2, { followupId: 'FU_DEC_FB', optionId: 'A' })
  assert.strictEqual(r2.status, 'INVALID_INPUT')
})

// ── 15–17. non-FOLLOW_UP_REQUIRED A5A input rejected ──────────────────────
test('15–17. PRIMARY_ALLOWED / NO_PRIMARY_DEFICIT / INSUFFICIENT_EVIDENCE rejected', () => {
  const primaryAllowed = { status: 'PRIMARY_ALLOWED', followupPair: ['DECISION', 'FEEDBACK'] }
  const noDeficit = { status: 'NO_PRIMARY_DEFICIT', followupPair: ['DECISION', 'FEEDBACK'] }
  const insufficient = { status: 'INSUFFICIENT_EVIDENCE', followupPair: ['DECISION', 'FEEDBACK'] }
  for (const d of [primaryAllowed, noDeficit, insufficient]) {
    const r = resolver.resolveFollowUpV21(d, { followupId: 'FU_DEC_FB', optionId: 'A' })
    assert.strictEqual(r.status, 'INVALID_INPUT')
    assert.strictEqual(r.reasonCode, resolver.REASON.A5A_GATE_REJECTED)
  }
})

// ── 18–22. answer validation rejections ───────────────────────────────────
test('18. wrong followupId rejected', () => {
  const decision = followupDecision(['DECISION', 'FEEDBACK'])
  const r = resolver.resolveFollowUpV21(decision, { followupId: 'FU_PROB_RISK', optionId: 'A' })
  assert.strictEqual(r.status, 'INVALID_INPUT')
  assert.strictEqual(r.reasonCode, resolver.REASON.CROSS_PAIR_OPTION)
})

test('19. wrong optionId rejected', () => {
  const decision = followupDecision(['DECISION', 'FEEDBACK'])
  const r = resolver.resolveFollowUpV21(decision, { followupId: 'FU_DEC_FB', optionId: 'Z' })
  assert.strictEqual(r.status, 'INVALID_INPUT')
  assert.strictEqual(r.reasonCode, resolver.REASON.UNKNOWN_OPTION)
})

test('20. cross-pair option rejected', () => {
  const decision = followupDecision(['DECISION', 'FEEDBACK'])
  // 'B' is valid for FU_DEC_FB, but we pass a followupId from another pair.
  const r = resolver.resolveFollowUpV21(decision, { followupId: 'FU_RISK_TIME', optionId: 'B' })
  assert.strictEqual(r.status, 'INVALID_INPUT')
  assert.strictEqual(r.reasonCode, resolver.REASON.CROSS_PAIR_OPTION)
})

test('21. missing answer rejected', () => {
  const decision = followupDecision(['DECISION', 'FEEDBACK'])
  const r = resolver.resolveFollowUpV21(decision, undefined)
  assert.strictEqual(r.status, 'INVALID_INPUT')
  assert.strictEqual(r.reasonCode, resolver.REASON.MISSING_ANSWER)
  const r2 = resolver.resolveFollowUpV21(decision, {})
  assert.strictEqual(r2.status, 'INVALID_INPUT')
})

test('22. malformed A5A decision rejected', () => {
  const r = resolver.resolveFollowUpV21(null, { followupId: 'FU_DEC_FB', optionId: 'A' })
  assert.strictEqual(r.status, 'INVALID_INPUT')
  assert.strictEqual(r.reasonCode, resolver.REASON.MALFORMED_A5A)
  const r2 = resolver.resolveFollowUpV21('nope', { followupId: 'FU_DEC_FB', optionId: 'A' })
  assert.strictEqual(r2.status, 'INVALID_INPUT')
  const r3 = resolver.resolveFollowUpV21({ status: 'FOLLOW_UP_REQUIRED', followupPair: ['DECISION'] }, { followupId: 'FU_DEC_FB', optionId: 'A' })
  assert.strictEqual(r3.status, 'INVALID_INPUT')
})

// ── 23. discriminated construct belongs to original pair ──────────────────
test('23. discriminated construct belongs to original pair', () => {
  for (const [followupId, byOption] of Object.entries(EXPECTED_OPTION_PRIMARY)) {
    const pair = PAIR_BY_ID[followupId]
    for (const [optionId, construct] of Object.entries(byOption)) {
      assert.ok(pair.includes(construct), `${construct} must belong to pair ${pair.join(',')}`)
    }
  }
})

// ── 24. final status only PRIMARY_ALLOWED / INSUFFICIENT_EVIDENCE ─────────
test('24. resolver terminal statuses are exactly PRIMARY_ALLOWED | INSUFFICIENT_EVIDENCE | INVALID_INPUT', () => {
  assert.deepStrictEqual(resolver.RESOLUTION_STATUS_SET_V21, ['PRIMARY_ALLOWED', 'INSUFFICIENT_EVIDENCE'])
  // INVALID_INPUT is validation semantics, not a primary resolution status.
  for (const [followupId, byOption] of Object.entries(EXPECTED_OPTION_PRIMARY)) {
    for (const optionId of Object.keys(byOption)) {
      const r = resolveForOption(followupId, optionId)
      assert.ok(['PRIMARY_ALLOWED', 'INSUFFICIENT_EVIDENCE'].includes(r.status) || r.status === 'INVALID_INPUT')
    }
  }
})

// ── 25–29. base eligibility immutability ──────────────────────────────────
test('25–29. resolver does not mutate A5A decision or base layers', () => {
  const decision = followupDecision(['DECISION', 'FEEDBACK'])
  const before = JSON.stringify(decision)
  const r = resolver.resolveFollowUpV21(decision, { followupId: 'FU_DEC_FB', optionId: 'A' })
  assert.strictEqual(r.status, 'PRIMARY_ALLOWED')
  assert.strictEqual(JSON.stringify(decision), before, 'A5A decision must remain unchanged')

  // resolver module must not require/call base-layer functions.
  const src = stripComments(fs.readFileSync(path.join(V21_DIR, 'followUpDiscriminatorV21.js'), 'utf8'))
  for (const forbidden of ['normalizeEvidenceV21', 'extractSignalsV21', 'computeDimensionsV21', 'buildBlindSpotCandidatesV21', 'decidePrimaryV21']) {
    assert.strictEqual(src.includes(forbidden), false, `resolver must not call ${forbidden}`)
  }
})

test('26–28. follow-up cannot promote D+missing / D+N / MIXED (base-only rule preserved)', () => {
  // Source-level: resolver has no base-support write path.
  const src = stripComments(fs.readFileSync(path.join(V21_DIR, 'followUpDiscriminatorV21.js'), 'utf8'))
  for (const tok of ['supportingQuestionIds.push', 'counterQuestionIds.push', 'dSupportQuestionIds', 'hSupportQuestionIds', 'addD', 'promote', 'repair']) {
    assert.strictEqual(src.includes(tok), false, `resolver must not mutate base support (${tok})`)
  }
})

// ── 30. one round only ────────────────────────────────────────────────────
test('30. one round only: no second-round / recursion paths', () => {
  assert.strictEqual(resolver.MAX_FOLLOWUP_ROUNDS, 1)
  assert.strictEqual(resolver.CURRENT_QUESTIONS_PER_PAIR, 1)
  assert.strictEqual(resolver.SECOND_ROUND_PATHS, 0)
  const src = stripComments(fs.readFileSync(path.join(V21_DIR, 'followUpDiscriminatorV21.js'), 'utf8'))
  assert.strictEqual(src.includes('resolveFollowUpV21(') && src.includes('resolveFollowUpV21(a5aDecision') === false, false)
  assert.strictEqual(/function resolveFollowUpV21[\s\S]*resolveFollowUpV21\(/.test(src), false, 'no self-recursion')
})

// ── 31–36. numeric / ranking prohibition (source-level) ───────────────────
test('31–36. no numeric score / ranking / ID_OFFSET / ontology priority / D-H / pseudo-probability', () => {
  const src = stripComments(fs.readFileSync(path.join(V21_DIR, 'followUpDiscriminatorV21.js'), 'utf8'))
  const banned = [
    'Math.random', 'Math.max', 'Math.min',
    'score', 'confidence', 'probability',
    'weight', 'severity', 'separation', 'gap', 'threshold',
    'rank', 'sort(', 'argmax', 'argmin', 'top',
    'ID_OFFSET', 'idOffset',
    'ontology priority', 'ontologyPriority',
    'D_MINUS_H', 'dMinusH', '- h', '- d',
    'tournament', 'nearest',
  ]
  for (const tok of banned) {
    assert.strictEqual(src.includes(tok), false, `resolver must not reference "${tok}"`)
  }
})

// ── 37. traceability complete ─────────────────────────────────────────────
test('37. traceability complete (A5A → pair → followupId → optionId → evidence → construct → D → primary → blindspot)', () => {
  const decision = followupDecision(['DECISION', 'FEEDBACK'])
  const r = resolver.resolveFollowUpV21(decision, { followupId: 'FU_DEC_FB', optionId: 'A' })
  assert.strictEqual(r.status, 'PRIMARY_ALLOWED')
  const steps = r.trace.map((t) => t.step)
  for (const expected of ['A5A_INPUT_GATE', 'FOLLOWUP_PAIR', 'FOLLOWUP_SELECTED', 'DEDICATED_EVIDENCE', 'PRIMARY_RESOLVED']) {
    assert.ok(steps.includes(expected), `trace must include ${expected}`)
  }
  const ev = r.trace.find((t) => t.step === 'DEDICATED_EVIDENCE')
  assert.strictEqual(ev.direction, 'D')
  assert.strictEqual(ev.construct, 'DECISION')
  assert.strictEqual(r.primaryBlindSpotId, 'DECISION_INERTIA')
  assert.strictEqual(r.discriminatingEvidence.evidenceId, 'FU_DEC_FB_CERTAINTY_GATE')
})

// ── 38–39. order invariance ───────────────────────────────────────────────
test('38. pair order invariant (all 5 pairs)', () => {
  for (const [followupId, pair] of Object.entries(PAIR_BY_ID)) {
    const d1 = followupDecision(pair)
    const d2 = followupDecision([pair[1], pair[0]])
    const r1 = resolver.resolveFollowUpV21(d1, { followupId, optionId: 'A' })
    const r2 = resolver.resolveFollowUpV21(d2, { followupId, optionId: 'A' })
    assert.strictEqual(r1.primaryConstruct, r2.primaryConstruct, `${followupId} order invariant`)
  }
})

test('39. answer-definition order invariant', () => {
  // The answer object field order does not matter.
  const decision = followupDecision(['DECISION', 'FEEDBACK'])
  const r1 = resolver.resolveFollowUpV21(decision, { followupId: 'FU_DEC_FB', optionId: 'A' })
  const r2 = resolver.resolveFollowUpV21(decision, { optionId: 'A', followupId: 'FU_DEC_FB' })
  assert.strictEqual(r1.primaryConstruct, r2.primaryConstruct)
  assert.strictEqual(r1.primaryBlindSpotId, r2.primaryBlindSpotId)
})

// ── 40. positive discrimination required ──────────────────────────────────
test('40. positive discrimination required (H-based complement forbidden)', () => {
  assert.strictEqual(resolver.NOT_A_DOES_NOT_IMPLY_B, true)
  assert.strictEqual(resolver.FOLLOWUP_RESOLUTION_REQUIRES_POSITIVE_DISCRIMINATION, true)
  // No evidence in the bank is H; resolver only accepts D.
  for (const e of bank.FOLLOWUP_EVIDENCE_V21) {
    assert.strictEqual(e.direction, 'D')
  }
  // Response validity is NOT implemented here (R3B owns it).
  assert.strictEqual(resolver.RESPONSE_VALIDITY_DEPENDENCY, 'NOT_IMPLEMENTED')
})

// ── FULL CHAIN ────────────────────────────────────────────────────────────
test('full chain: answers → … → FOLLOW_UP_REQUIRED → follow-up → PRIMARY_ALLOWED', () => {
  const { cands, decision } = fullChain([...DD.RISK, ...DD.TIME])
  assert.strictEqual(decision.status, 'FOLLOW_UP_REQUIRED')
  // snapshot base eligibility before follow-up
  const eligibleBefore = [...decision.eligibleCandidateIds].sort()
  const pair = decision.followupPair
  const question = bank.selectFollowUpV21(pair)
  assert.strictEqual(question.followupId, 'FU_RISK_TIME')

  const r = resolver.resolveFollowUpV21(decision, { followupId: 'FU_RISK_TIME', optionId: 'B' })
  assert.strictEqual(r.status, 'PRIMARY_ALLOWED')
  assert.strictEqual(r.primaryConstruct, 'TIME')
  assert.strictEqual(r.primaryBlindSpotId, 'TIME_HORIZON_TRAP')

  // base eligibility immutability: decision unchanged after resolve
  const eligibleAfter = [...decision.eligibleCandidateIds].sort()
  assert.deepStrictEqual(eligibleAfter, eligibleBefore, 'base eligibility must be immutable')
  assert.strictEqual(decision.status, 'FOLLOW_UP_REQUIRED', 'decision status unchanged (no in-place mutation)')
})

test('full chain: DECISION+FEEDBACK → option B → FEEDBACK primary (trace complete)', () => {
  const { decision } = fullChain([...DD.DECISION, ...DD.FEEDBACK])
  assert.strictEqual(decision.status, 'FOLLOW_UP_REQUIRED')
  const r = resolver.resolveFollowUpV21(decision, { followupId: 'FU_DEC_FB', optionId: 'B' })
  assert.strictEqual(r.status, 'PRIMARY_ALLOWED')
  assert.strictEqual(r.primaryConstruct, 'FEEDBACK')
  assert.strictEqual(r.primaryBlindSpotId, 'FEEDBACK_LOOP_GAP')
})
