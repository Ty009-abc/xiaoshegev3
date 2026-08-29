/**
 * RC8.3 Stage19A5B-1 — V2.1 Follow-up Discriminator Bank Acceptance Tests
 *
 * Validates the frozen 5 follow-up discriminator questions, the 10 dedicated
 * atomic follow-up evidence items, the order-invariant pair → selector, and
 * the structural (followupId + optionId + pair) tuple validation.
 *
 * Authority: docs/adr/ADR-RC8.3-STAGE19-A5-UNCERTAINTY-PRIMARY-SELECTION-CONTRACT.md
 *   — A5.1 (§A5.1-4/§A5.1-6) + A5.1-R1 (§A5.1-R1-3/§A5.1-R1-4/§A5.1-R1-8).
 *
 * A5B-1 owns contract data + selector ONLY. It MUST NOT resolve a primary.
 *
 * Uses `node --test`.
 *
 * @version world_model_v2_1
 */

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')

const bank = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/followUpBankV21.js')
const { EVIDENCE_CATALOG_V21 } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/evidenceCatalogV21.js')
const a5a = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/primaryDecisionEngineV21.js')

const V21_DIR = path.join(__dirname, '../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1')

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

// ── 1–4. FROZEN COUNTS ─────────────────────────────────────────────────────
test('1–4. frozen counts: pairs=5, questions=5, options=10, evidence=10', () => {
  assert.strictEqual(bank.FOLLOWUP_PAIR_COUNT, 5)
  assert.strictEqual(bank.FOLLOWUP_QUESTION_COUNT, 5)
  assert.strictEqual(bank.FOLLOWUP_OPTION_COUNT, 10)
  assert.strictEqual(bank.FOLLOWUP_ATOMIC_EVIDENCE_COUNT, 10)

  assert.strictEqual(bank.FOLLOWUP_PAIRS_V21.length, 5)
  assert.strictEqual(bank.FOLLOWUP_QUESTIONS_V21.length, 5)
  assert.strictEqual(bank.FOLLOWUP_EVIDENCE_V21.length, 10)
  assert.strictEqual(
    bank.FOLLOWUP_QUESTIONS_V21.reduce((n, q) => n + q.options.length, 0),
    10,
    'total options must be 10'
  )
})

test('frozen 5 pair identities (order-invariant set)', () => {
  const pairs = bank.FOLLOWUP_PAIRS_V21.map((p) => {
    const [a, b] = [p.constructA, p.constructB].sort()
    return `${a}-${b}`
  }).sort()
  assert.deepStrictEqual(pairs, [
    'DECISION-FEEDBACK',
    'IDENTITY-OPPORTUNITY',
    'PROBABILITY-RISK',
    'RISK-TIME',
    'SYSTEMS-TIME',
  ])
})

// ── 5–10. SELECTOR (relevant pairs + order invariance) ────────────────────
test('5. DECISION↔FEEDBACK selector works', () => {
  const q = bank.selectFollowUpV21(['DECISION', 'FEEDBACK'])
  assert.strictEqual(q.followupId, 'FU_DEC_FB')
  assert.strictEqual(q.options.length, 2)
})

test('6. reversed FEEDBACK+DECISION gives same question (order invariant)', () => {
  const a = bank.selectFollowUpV21(['DECISION', 'FEEDBACK'])
  const b = bank.selectFollowUpV21(['FEEDBACK', 'DECISION'])
  assert.strictEqual(a.followupId, b.followupId)
  assert.deepStrictEqual(a, b)
})

test('7. PROBABILITY↔RISK works', () => {
  assert.strictEqual(bank.selectFollowUpV21(['PROBABILITY', 'RISK']).followupId, 'FU_PROB_RISK')
})

test('8. RISK↔TIME works', () => {
  assert.strictEqual(bank.selectFollowUpV21(['RISK', 'TIME']).followupId, 'FU_RISK_TIME')
})

test('9. IDENTITY↔OPPORTUNITY works', () => {
  assert.strictEqual(bank.selectFollowUpV21(['IDENTITY', 'OPPORTUNITY']).followupId, 'FU_ID_OPP')
})

test('10. TIME↔SYSTEMS works', () => {
  assert.strictEqual(bank.selectFollowUpV21(['TIME', 'SYSTEMS']).followupId, 'FU_TIME_SYS')
})

// ── 11–16. SELECTOR REJECTIONS (structural / unknown / malformed) ─────────
test('11–14. structural-only pairs rejected', () => {
  assert.strictEqual(bank.selectFollowUpV21(['DECISION', 'PROBABILITY']), null)
  assert.strictEqual(bank.selectFollowUpV21(['FEEDBACK', 'SYSTEMS']), null)
  assert.strictEqual(bank.selectFollowUpV21(['LEVERAGE', 'TIME']), null)
  assert.strictEqual(bank.selectFollowUpV21(['LEVERAGE', 'OPPORTUNITY']), null)
  // also reversed
  assert.strictEqual(bank.selectFollowUpV21(['PROBABILITY', 'DECISION']), null)
  assert.strictEqual(bank.selectFollowUpV21(['SYSTEMS', 'FEEDBACK']), null)
  assert.strictEqual(bank.selectFollowUpV21(['TIME', 'LEVERAGE']), null)
  assert.strictEqual(bank.selectFollowUpV21(['OPPORTUNITY', 'LEVERAGE']), null)
})

test('15. unknown pair rejected', () => {
  assert.strictEqual(bank.selectFollowUpV21(['DECISION', 'RISK']), null)
  assert.strictEqual(bank.selectFollowUpV21(['LEVERAGE', 'SYSTEMS']), null)
  assert.strictEqual(bank.selectFollowUpV21(['FEEDBACK', 'IDENTITY']), null)
})

test('16. missing / malformed pair rejected', () => {
  assert.strictEqual(bank.selectFollowUpV21(undefined), null)
  assert.strictEqual(bank.selectFollowUpV21(null), null)
  assert.strictEqual(bank.selectFollowUpV21([]), null)
  assert.strictEqual(bank.selectFollowUpV21(['DECISION']), null)
  assert.strictEqual(bank.selectFollowUpV21(['DECISION', 'FEEDBACK', 'RISK']), null)
  assert.strictEqual(bank.selectFollowUpV21('DECISION,FEEDBACK'), null)
  assert.strictEqual(bank.selectFollowUpV21({}), null)
  assert.strictEqual(bank.selectFollowUpV21({ constructA: 'DECISION' }), null)
  assert.strictEqual(bank.isFollowUpPairV21(['DECISION', 'PROBABILITY']), false)
  assert.strictEqual(bank.isFollowUpPairV21(['DECISION', 'FEEDBACK']), true)
})

// ── 17–19. ALL FOLLOW-UP EVIDENCE DIRECTION = D ───────────────────────────
test('17–19. all 10 evidence direction D, zero H, zero N', () => {
  const d = bank.FOLLOWUP_EVIDENCE_V21.filter((e) => e.direction === 'D').length
  const h = bank.FOLLOWUP_EVIDENCE_V21.filter((e) => e.direction === 'H').length
  const n = bank.FOLLOWUP_EVIDENCE_V21.filter((e) => e.direction === 'N').length
  assert.strictEqual(d, 10)
  assert.strictEqual(h, 0)
  assert.strictEqual(n, 0)
})

// ── 20. BASE EVIDENCE COLLISION = 0 ───────────────────────────────────────
test('20. no follow-up evidenceId collides with base evidenceCatalogV21', () => {
  const baseIds = new Set(EVIDENCE_CATALOG_V21.map((e) => e.evidenceId))
  const collisions = bank.FOLLOWUP_EVIDENCE_V21.filter((e) => baseIds.has(e.evidenceId))
  assert.strictEqual(collisions.length, 0, `collisions: ${collisions.map((c) => c.evidenceId)}`)
  assert.strictEqual(bank.FOLLOWUP_NAMESPACE_V21, 'DEDICATED_V2_1_FOLLOWUP_EVIDENCE')
})

// ── 21–22. OPTION↔EVIDENCE & EVIDENCE↔CONSTRUCT BIJECTION ─────────────────
test('21. each option maps exactly 1 evidence; each evidenceId referenced exactly once', () => {
  const evidenceIds = bank.FOLLOWUP_QUESTIONS_V21.flatMap((q) => q.options.map((o) => o.evidenceId))
  assert.strictEqual(evidenceIds.length, 10)
  assert.strictEqual(new Set(evidenceIds).size, 10, 'no duplicate evidenceId across options')

  for (const q of bank.FOLLOWUP_QUESTIONS_V21) {
    for (const o of q.options) {
      assert.ok(bank.FOLLOWUP_EVIDENCE_BY_ID.has(o.evidenceId), `option refs unknown evidence ${o.evidenceId}`)
    }
  }
})

test('22. each evidence maps exactly 1 construct (single-construct atomicity)', () => {
  for (const e of bank.FOLLOWUP_EVIDENCE_V21) {
    assert.ok(typeof e.construct === 'string' && e.construct.length > 0)
    // atomic: no dual-construct field present
    assert.ok(!('constructB' in e), `evidence ${e.evidenceId} must be single-construct`)
    assert.ok(!('counterConstruct' in e))
  }
  const byEvidence = new Map(bank.FOLLOWUP_EVIDENCE_V21.map((e) => [e.evidenceId, e.construct]))
  assert.strictEqual(byEvidence.size, 10)
})

// ── 23–25. BIDIRECTIONAL DISCRIMINATION ───────────────────────────────────
test('23. all five pairs have bidirectional discrimination (one option → A, one → B)', () => {
  for (const q of bank.FOLLOWUP_QUESTIONS_V21) {
    const targets = q.options.map((o) => {
      const ev = bank.FOLLOWUP_EVIDENCE_BY_ID.get(o.evidenceId)
      return ev.construct
    }).sort()
    const expected = [q.constructA, q.constructB].sort()
    assert.deepStrictEqual(targets, expected, `${q.followupId} must discriminate both constructs`)
  }
})

test('24–25. resolving-A option count = 5, resolving-B option count = 5', () => {
  let resolvingA = 0
  let resolvingB = 0
  for (const q of bank.FOLLOWUP_QUESTIONS_V21) {
    for (const o of q.options) {
      const ev = bank.FOLLOWUP_EVIDENCE_BY_ID.get(o.evidenceId)
      if (ev.construct === q.constructA) resolvingA += 1
      else if (ev.construct === q.constructB) resolvingB += 1
    }
  }
  assert.strictEqual(resolvingA, 5)
  assert.strictEqual(resolvingB, 5)
})

// ── 26–28. TUPLE VALIDATION ───────────────────────────────────────────────
test('26. cross-pair option rejected (no cross-pair tuple leakage)', () => {
  // Every (followupId, optionId) tuple resolves ONLY to an evidence whose
  // sourceFollowupId === followupId. An option letter that also exists in
  // another pair can never resolve to the other pair's evidence.
  const ev = bank.resolveFollowUpEvidenceV21('FU_PROB_RISK', 'A')
  assert.ok(ev)
  assert.strictEqual(ev.sourceFollowupId, 'FU_PROB_RISK')
  assert.strictEqual(ev.evidenceId, 'FU_PROB_RISK_PROB_FOCUS')
  assert.notStrictEqual(ev.evidenceId, 'FU_DEC_FB_CERTAINTY_GATE')

  // 'B' in FU_TIME_SYS resolves to SYSTEMS evidence, never another pair's.
  const ev2 = bank.resolveFollowUpEvidenceV21('FU_TIME_SYS', 'B')
  assert.strictEqual(ev2.sourceFollowupId, 'FU_TIME_SYS')
  assert.strictEqual(ev2.evidenceId, 'FU_TIME_SYS_PERSON')

  // Global invariant: each evidence is reachable ONLY via its own (followupId, optionId).
  for (const e of bank.FOLLOWUP_EVIDENCE_V21) {
    for (const q of bank.FOLLOWUP_QUESTIONS_V21) {
      for (const o of q.options) {
        const r = bank.resolveFollowUpEvidenceV21(q.followupId, o.optionId)
        assert.strictEqual(r.sourceFollowupId, q.followupId, 'tuple must stay in its own followup')
        assert.strictEqual(r.optionId, o.optionId)
      }
    }
  }
  // A given evidence is reachable under exactly one followupId.
  const reachableBy = new Map()
  for (const e of bank.FOLLOWUP_EVIDENCE_V21) {
    for (const q of bank.FOLLOWUP_QUESTIONS_V21) {
      for (const o of q.options) {
        const r = bank.resolveFollowUpEvidenceV21(q.followupId, o.optionId)
        if (r.evidenceId === e.evidenceId) {
          reachableBy.set(e.evidenceId, (reachableBy.get(e.evidenceId) || 0) + 1)
        }
      }
    }
  }
  for (const e of bank.FOLLOWUP_EVIDENCE_V21) {
    assert.strictEqual(reachableBy.get(e.evidenceId), 1, `${e.evidenceId} must be reachable from exactly one tuple`)
  }
})

test('26b. valid tuple resolves to its own evidence', () => {
  assert.strictEqual(
    bank.resolveFollowUpEvidenceV21('FU_DEC_FB', 'A').evidenceId,
    'FU_DEC_FB_CERTAINTY_GATE'
  )
  assert.strictEqual(bank.isValidFollowUpTupleV21('FU_DEC_FB', 'A'), true)
})

test('27. wrong / unknown followupId rejected', () => {
  assert.strictEqual(bank.resolveFollowUpEvidenceV21('FU_NOPE', 'A'), null)
  assert.strictEqual(bank.isValidFollowUpTupleV21('FU_NOPE', 'A'), false)
  assert.strictEqual(bank.resolveFollowUpEvidenceV21('FU_DEC_FB', 'Z'), null)
})

test('28. unknown option rejected', () => {
  assert.strictEqual(bank.resolveFollowUpEvidenceV21('FU_DEC_FB', 'Z'), null)
  assert.strictEqual(bank.resolveFollowUpEvidenceV21('FU_DEC_FB', ''), null)
  assert.strictEqual(bank.resolveFollowUpEvidenceV21('FU_DEC_FB', null), null)
  assert.strictEqual(bank.resolveFollowUpEvidenceV21(null, 'A'), null)
})

// ── 29–30. ORDER INVARIANCE ───────────────────────────────────────────────
test('29. option serialization order invariant (definition arrays are stable)', () => {
  const ids1 = bank.FOLLOWUP_QUESTIONS_V21.map((q) => q.followupId).join(',')
  const ids2 = bank.FOLLOWUP_QUESTIONS_V21.map((q) => q.followupId).join(',')
  assert.strictEqual(ids1, ids2)
  // selector result does not depend on input array order
  assert.strictEqual(
    bank.selectFollowUpV21(['DECISION', 'FEEDBACK']).followupId,
    bank.selectFollowUpV21(['FEEDBACK', 'DECISION']).followupId
  )
})

test('30. pair order invariant (A+B == B+A) for all 5 pairs', () => {
  for (const p of bank.FOLLOWUP_PAIRS_V21) {
    const a = bank.selectFollowUpV21([p.constructA, p.constructB])
    const b = bank.selectFollowUpV21([p.constructB, p.constructA])
    assert.strictEqual(a.followupId, b.followupId)
    assert.deepStrictEqual(a, b)
  }
})

// ── 31–34. PROHIBITION (source-level) ─────────────────────────────────────
test('31. no complement inference path / metadata', () => {
  assert.strictEqual(bank.NOT_A_DOES_NOT_IMPLY_B, true)
  const code = stripComments(fs.readFileSync(path.join(V21_DIR, 'followUpBankV21.js'), 'utf8'))
  assert.strictEqual(code.includes('impliesOther'), false)
  assert.strictEqual(code.includes('complement'), false)
  assert.strictEqual(code.includes('otherConstruct'), false)
  assert.strictEqual(code.includes('absence'), false)
  // no evidence item carries a "implies the other construct" field
  for (const e of bank.FOLLOWUP_EVIDENCE_V21) {
    assert.ok(!('implies' in e))
    assert.ok(!('resolvesOther' in e))
  }
})

test('32. no numeric score path', () => {
  const code = stripComments(fs.readFileSync(path.join(V21_DIR, 'followUpBankV21.js'), 'utf8'))
  for (const tok of ['score', 'confidence', 'probability', 'severity', 'separation', 'gap', 'weight', 'Math.random', 'D_MINUS_H']) {
    assert.strictEqual(code.includes(tok), false, `must not reference "${tok}"`)
  }
})

test('33. no ID_OFFSET path', () => {
  const code = stripComments(fs.readFileSync(path.join(V21_DIR, 'followUpBankV21.js'), 'utf8'))
  assert.strictEqual(code.includes('ID_OFFSET'), false)
  assert.strictEqual(code.includes('idOffset'), false)
  assert.strictEqual(code.includes('argmax'), false)
})

test('34. no ontology-priority / ranking path', () => {
  const code = stripComments(fs.readFileSync(path.join(V21_DIR, 'followUpBankV21.js'), 'utf8'))
  assert.strictEqual(code.includes('ontology priority'), false)
  assert.strictEqual(code.includes('ontologyPriority'), false)
  assert.strictEqual(code.includes('rank'), false)
  assert.strictEqual(code.includes('tournament'), false)
})

// ── CONSISTENCY WITH A5A FROZEN EDGE SET (same authority) ─────────────────
test('consistency: bank pairs == A5A FOLLOWUP_RELEVANT_EDGE_SET', () => {
  const bankPairs = bank.FOLLOWUP_PAIRS_V21
    .map((p) => [p.constructA, p.constructB].sort().join('\u0000'))
    .sort()
  const a5aPairs = a5a.FOLLOWUP_RELEVANT_EDGE_SET
    .map(([a, b]) => [a, b].sort().join('\u0000'))
    .sort()
  assert.deepStrictEqual(bankPairs, a5aPairs)
})

test('consistency: bank structural set == A5A STRUCTURAL_NEIGHBOR_EDGE_SET (absent from bank)', () => {
  for (const [a, b] of a5a.STRUCTURAL_NEIGHBOR_EDGE_SET) {
    assert.strictEqual(bank.isFollowUpPairV21([a, b]), false, `${a}-${b} must not be a follow-up pair`)
  }
})
