/**
 * RC8.3 Stage19A1 — V2.1 Static Semantic Contract Acceptance Tests
 *
 * Validates the frozen world_model_v2_1 STATIC contract tables only:
 *   A. counts: 18 questions / 9 constructs / 65 option propositions / 48 evidence
 *   B. uniqueness: questionId / evidenceId unique
 *   C. reference validity: supportingOptionIds / counterOptionIds / sourceQuestionIds
 *   D. construct coverage: every construct in questionnaire AND evidence catalog
 *   E. authority traceability: >= 9 questionId → optionId → proposition → evidenceId traces
 *   F. forbidden content: displayPosition = 0, legacy wealth fields = 0
 *   G. derived metadata unresolved accounting
 *
 * Uses the repo's existing test runner: `node --test`.
 *
 * @version world_model_v2_1
 */

const test = require('node:test')
const assert = require('node:assert')

const {
  QUESTIONNAIRE_VERSION_V21,
  QUESTION_COUNT_V21,
  CONSTRUCT_COUNT_V21,
  OPTION_PROPOSITION_COUNT_V21,
  CONSTRUCTS_V21,
  QUESTIONS_V21,
  ATOMIC_EVIDENCE_COUNT_V21,
  EVIDENCE_CATALOG_V21,
} = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/index.js')

// ── A. FROZEN CONSTANTS ────────────────────────────────────────────────────
test('A. frozen version + counts', () => {
  assert.strictEqual(QUESTIONNAIRE_VERSION_V21, 'world_model_v2_1')
  assert.strictEqual(QUESTION_COUNT_V21, 18)
  assert.strictEqual(CONSTRUCT_COUNT_V21, 9)
  assert.strictEqual(OPTION_PROPOSITION_COUNT_V21, 65)
  assert.strictEqual(ATOMIC_EVIDENCE_COUNT_V21, 48)

  // structural (object) validation, not text counting
  assert.strictEqual(QUESTIONS_V21.length, 18)
  assert.strictEqual(CONSTRUCTS_V21.length, 9)
  assert.strictEqual(EVIDENCE_CATALOG_V21.length, 48)

  const flatOptions = QUESTIONS_V21.flatMap((q) => q.options)
  assert.strictEqual(flatOptions.length, 65)
})

// ── B. UNIQUENESS ──────────────────────────────────────────────────────────
test('B. questionId and evidenceId unique', () => {
  const qids = QUESTIONS_V21.map((q) => q.questionId)
  assert.strictEqual(new Set(qids).size, qids.length, 'questionId must be unique')

  const eids = EVIDENCE_CATALOG_V21.map((e) => e.evidenceId)
  assert.strictEqual(new Set(eids).size, eids.length, 'evidenceId must be unique')
})

// ── C. SHAPE + REFERENCE VALIDITY ──────────────────────────────────────────
test('C. question shape (questionId/construct/prompt/options; no displayPosition)', () => {
  const validOptionIds = new Set()
  const validQuestionIds = new Set(QUESTIONS_V21.map((q) => q.questionId))

  for (const q of QUESTIONS_V21) {
    assert.ok(typeof q.questionId === 'string' && q.questionId.length > 0)
    assert.ok(CONSTRUCTS_V21.includes(q.construct), `construct ${q.construct} not in CONSTRUCTS_V21`)
    assert.ok(typeof q.prompt === 'string' && q.prompt.length > 0)
    assert.ok(Array.isArray(q.options) && q.options.length >= 2)
    assert.ok(!('displayPosition' in q), `question ${q.questionId} must not carry displayPosition`)

    for (const o of q.options) {
      assert.ok(typeof o.optionId === 'string' && o.optionId.length > 0)
      assert.ok(typeof o.text === 'string' && o.text.length > 0)
      assert.ok(Array.isArray(o.semanticPropositionRefs) && o.semanticPropositionRefs.length >= 1)
      assert.ok(!('displayPosition' in o), `option ${q.questionId}:${o.optionId} must not carry displayPosition`)

      // every semanticPropositionRef must be a real evidenceId
      for (const ref of o.semanticPropositionRefs) {
        assert.ok(
          EVIDENCE_CATALOG_V21.some((e) => e.evidenceId === ref),
          `semanticPropositionRef ${ref} (from ${q.questionId}:${o.optionId}) is not a real evidenceId`
        )
      }

      validOptionIds.add(`${q.questionId}:${o.optionId}`)
    }
  }

  // evidence shape
  for (const e of EVIDENCE_CATALOG_V21) {
    assert.ok(typeof e.evidenceId === 'string' && e.evidenceId.length > 0)
    assert.ok(CONSTRUCTS_V21.includes(e.construct), `evidence ${e.evidenceId} construct invalid`)
    assert.ok(['H', 'D', 'N'].includes(e.direction), `evidence ${e.evidenceId} direction invalid`)
    assert.ok(typeof e.semanticProposition === 'string' && e.semanticProposition.length > 0)

    // H/N evidence: distortionType must be null
    if (e.direction === 'H' || e.direction === 'N') {
      assert.strictEqual(e.distortionType, null, `H/N evidence ${e.evidenceId} distortionType must be null`)
    } else {
      assert.ok(typeof e.distortionType === 'string' && e.distortionType.length > 0,
        `D evidence ${e.evidenceId} must have a distortionType`)
    }

    // reference validity
    for (const optRef of (e.supportingOptionIds || [])) {
      assert.ok(validOptionIds.has(optRef), `supportingOptionIds ${optRef} (evidence ${e.evidenceId}) not a real optionId`)
    }
    for (const optRef of (e.counterOptionIds || [])) {
      assert.ok(validOptionIds.has(optRef), `counterOptionIds ${optRef} (evidence ${e.evidenceId}) not a real optionId`)
    }
    for (const qid of (e.sourceQuestionIds || [])) {
      assert.ok(validQuestionIds.has(qid), `sourceQuestionIds ${qid} (evidence ${e.evidenceId}) not a real questionId`)
    }
  }
})

// ── D. CONSTRUCT COVERAGE ──────────────────────────────────────────────────
test('D. all 9 constructs covered in questionnaire AND evidence', () => {
  const qConstructs = new Set(QUESTIONS_V21.map((q) => q.construct))
  const eConstructs = new Set(EVIDENCE_CATALOG_V21.map((e) => e.construct))

  for (const c of CONSTRUCTS_V21) {
    assert.ok(qConstructs.has(c), `construct ${c} missing from questionnaire`)
    assert.ok(eConstructs.has(c), `construct ${c} missing from evidence catalog`)
  }
})

// ── E. AUTHORITY TRACEABILITY (>= 9 traces, >=1 per construct) ─────────────
test('E. authority traceability: questionId → optionId → proposition → evidenceId', () => {
  const traces = []
  for (const c of CONSTRUCTS_V21) {
    const q = QUESTIONS_V21.find((qq) => qq.construct === c)
    assert.ok(q, `no questionnaire item for ${c}`)
    const opt = q.options[0]
    const ref = opt.semanticPropositionRefs[0]
    const ev = EVIDENCE_CATALOG_V21.find((e) => e.evidenceId === ref)
    assert.ok(ev, `evidence ${ref} missing`)
    assert.strictEqual(ev.construct, c, `trace construct mismatch for ${ref}`)
    traces.push({ questionId: q.questionId, optionId: opt.optionId, proposition: ev.semanticProposition, evidenceId: ev.evidenceId })
  }
  assert.ok(traces.length >= 9, `expected >=9 traces, got ${traces.length}`)
})

// ── F. FORBIDDEN CONTENT ───────────────────────────────────────────────────
test('F. forbidden content: displayPosition=0, legacy wealth fields=0', () => {
  const qs = JSON.stringify(QUESTIONS_V21)
  const es = JSON.stringify(EVIDENCE_CATALOG_V21)

  assert.strictEqual(countOccurrences(qs, 'displayPosition'), 0)
  assert.strictEqual(countOccurrences(es, 'displayPosition'), 0)

  for (const banned of ['wealthProbability', 'wealthPath', 'scoreCard', 'potentialIndex']) {
    assert.strictEqual(countOccurrences(qs, banned), 0, `${banned} leaked into questionnaire`)
    assert.strictEqual(countOccurrences(es, banned), 0, `${banned} leaked into evidence`)
  }

  // forbidden inference/runtime concepts must not be implemented as exports.
  // Stage19A4 candidate-container APIs are explicitly authorized (narrow allowlist);
  // primary/ranking/follow-up/strategy/report semantics remain forbidden.
  const idx = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/index.js')
  const violations = forbiddenExportViolations(Object.keys(idx))
  assert.deepStrictEqual(violations, [], `forbidden export(s): ${violations.join(', ')}`)
})

test('F2. regression-gate self-test: authorized A4 exports pass, forbidden semantics rejected', () => {
  // AUTHORIZED_A4_EXPORTS_PASS
  for (const key of ['buildBlindSpotCandidatesV21', 'resolveBlindSpotStatusV21']) {
    assert.ok(AUTHORIZED_EXPORTS_V21.has(key), `${key} must be authorized`)
    assert.deepStrictEqual(forbiddenExportViolations([key]), [], `${key} must not be flagged`)
  }
  // forbidden semantics still rejected (isolated probes, not real exports)
  const probes = [
    'buildPrimaryBlindSpotV21',
    'rankBlindSpotCandidatesV21',
    'selectPrimaryBlindSpotV21',
    'buildStrategyV21',
    'buildReportV21',
    'selectFollowUpV21',
    'secondaryBlindSpotV21',
    'tieBreakBlindSpotsV21',
  ]
  for (const key of probes) {
    assert.strictEqual(forbiddenExportViolations([key]).length, 1, `${key} must be rejected`)
  }
})

// ── G. DERIVED METADATA UNRESOLVED ACCOUNTING ──────────────────────────────
test('G. derived metadata unresolved accounting', () => {
  const unresolved = []
  for (const e of EVIDENCE_CATALOG_V21) {
    for (const field of ['counterOptionIds', 'strengthClass', 'nearNeighborRelations']) {
      const v = e[field]
      const isUnresolved = v === null || (Array.isArray(v) && v.length === 0)
      if (isUnresolved) unresolved.push(`${e.evidenceId}:${field}`)
    }
  }
  // Every evidence legitimately lacks a per-evidence counter mapping / strength /
  // nearNeighbor in authority → all 48 × 3 fields are unresolved. That is CORRECT
  // per contract (must not be fabricated). Assert nothing non-empty was invented.
  assert.strictEqual(unresolved.length, 48 * 3,
    `expected all derived metadata fields unresolved (not fabricated); got ${unresolved.length}`)
})

// ── helpers ────────────────────────────────────────────────────────────────
// Narrow allowlist: A4 candidate-container APIs (explicit, NOT a broad exemption).
const AUTHORIZED_EXPORTS_V21 = new Set([
  'buildBlindSpotCandidatesV21',
  'resolveBlindSpotStatusV21',
])

// Forbidden export semantics (normalized to lowercase alphanumeric for matching).
const FORBIDDEN_EXPORT_TOKENS = [
  'responsevalidity',
  'followup',
  'strategy',
  'report',
  'primaryblindspot',
  'secondaryblindspot',
  'rankblindspot',
  'rankcandidates',
  'topcandidate',
  'bestcandidate',
  'selectprimary',
  'argmax',
  'tiebreak',
  'tiebreaker',
]

function normalizeKey(key) {
  return String(key).toLowerCase().replace(/[^a-z0-9]/g, '')
}

function forbiddenExportViolations(exportKeys) {
  const violations = []
  for (const key of exportKeys) {
    if (AUTHORIZED_EXPORTS_V21.has(key)) continue
    const k = normalizeKey(key)
    for (const tok of FORBIDDEN_EXPORT_TOKENS) {
      if (k.includes(tok)) {
        violations.push(key)
        break
      }
    }
  }
  return violations
}

function countOccurrences(haystack, needle) {
  if (typeof haystack !== 'string') return 0
  let count = 0
  let idx = haystack.indexOf(needle)
  while (idx !== -1) {
    count += 1
    idx = haystack.indexOf(needle, idx + 1)
  }
  return count
}
