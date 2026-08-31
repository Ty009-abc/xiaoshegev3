'use strict'
// 10 families × 10 variants = 100 base cases. Deterministic.
// `expectedStructuralProperties` describes ONLY input-shaping tendencies
// (validity tendency / completeness / repetition / position / contradiction /
// evidence strength). NO post-hoc diagnosis label, NO hard-coded blindspot.
const { hashSeed, mulberry32, rangeInt } = require('./rng')
const { QUESTION_BY_ID, QUESTION_ORDER, EVIDENCE_BY_ID, optionMeta } = require('./load')
const {
  variedPositions, constantPositions, alternatingPositions,
  sequentialPositions, boundaryPositions,
} = require('./positions')

const QUESTION_COUNT = 18

// Build a full 18-tuple answers array from a per-question option chooser and a
// position sequence. Answers are built in canonical question order; the
// displayPosition is an explicit input value at generation time.
function buildAnswers(optionChooser, positions) {
  return QUESTION_ORDER.map((qid, i) => {
    const q = QUESTION_BY_ID.get(qid)
    return {
      questionId: qid,
      optionId: optionChooser(q, i),
      displayPosition: positions[i],
    }
  })
}

// Option choosers ──────────────────────────────────────────────────────────
// "Healthy/neutral" pick: index-driven across valid options.
function chooseHealthy(q, i) {
  const opts = q.options
  return opts[i % opts.length].optionId
}

// Pick option whose evidence direction matches `dir` (H/D/N); fallback first.
function chooseByDirection(q, dir) {
  const opts = q.options
  for (const o of opts) {
    const m = optionMeta(q, o.optionId)
    if (m && m.direction === dir) return o.optionId
  }
  return opts[0].optionId
}

// Pick option whose construct differs from the question's own construct
// (impossible → fallback). Used to simulate competing/foreign signals.
// NOTE: options are inherently tied to their question construct, so this
// returns a within-question option; "competing constructs" is expressed by
// cycling directional bias across questions instead.
function chooseMixed(q, i) {
  // Alternate H-lean vs D-lean to create competing semantic tendencies.
  return i % 2 === 0 ? chooseByDirection(q, 'H') : chooseByDirection(q, 'D')
}

// Weak evidence: prefer options whose evidence refs are fewer (all options have
// exactly 1 ref here, so this degrades gracefully to index-driven selection).
function chooseWeak(q, i) {
  const opts = q.options
  let best = opts[0]
  let bestCount = Infinity
  for (const o of opts) {
    const refs = (o.semanticPropositionRefs || []).length
    if (refs < bestCount) { bestCount = refs; best = o }
  }
  return best.optionId
}

// Family builder: seed = F{familyId}:{variantId}.
function family(familyId, buildFn) {
  return function (variantId) {
    const seedStr = `F${familyId}:${variantId}`
    const seed = hashSeed(seedStr)
    const rng = mulberry32(seed)
    const { answers, expected } = buildFn(rng, variantId)
    return {
      testCaseId: `F${familyId}-V${String(variantId).padStart(2, '0')}`,
      familyId: `F${familyId}`,
      variantId,
      seed: seedStr,
      seedUint32: seed,
      answers,
      expectedStructuralProperties: expected,
    }
  }
}

const FAMILIES = {
  // F01 CLEAN_HIGH_VALIDITY — complete, varied positions, no pattern.
  F01: family('01', (rng) => ({
    answers: buildAnswers(chooseHealthy, variedPositions(rng)),
    expected: {
      intendedValidityTendency: 'RESPONSE_VALID',
      completeness: 'COMPLETE_18',
      repetitionPattern: 'NONE',
      positionPattern: 'VARIED_NO_PATTERN',
      contradictionPattern: 'NONE',
      evidenceStrengthTendency: 'MIXED',
    },
  })),

  // F02 LOW_VALIDITY — all_same position → RESPONSE_QUALITY_LOW.
  F02: family('02', (rng, v) => ({
    answers: buildAnswers(chooseHealthy, constantPositions(v % 4)),
    expected: {
      intendedValidityTendency: 'RESPONSE_QUALITY_LOW',
      completeness: 'COMPLETE_18',
      repetitionPattern: 'POSITION_ALL_SAME',
      positionPattern: 'CONSTANT',
      contradictionPattern: 'NONE',
      evidenceStrengthTendency: 'MIXED',
    },
  })),

  // F03 INSUFFICIENT_RESPONSE_QUALITY — structural insufficiency.
  F03: family('03', (rng, v) => {
    const answers = buildAnswers(chooseHealthy, variedPositions(rng))
    const expected = {
      intendedValidityTendency: 'INSUFFICIENT_RESPONSE_QUALITY',
      completeness: 'COMPLETE_18',
      repetitionPattern: 'NONE',
      positionPattern: 'VARIED_NO_PATTERN',
      contradictionPattern: 'NONE',
      evidenceStrengthTendency: 'MIXED',
    }
    if (v <= 2) {
      const idx = [0, 9, 17][v]
      delete answers[idx].displayPosition
      expected.insufficiencyKind = 'MISSING_DISPLAY_POSITION'
    } else if (v <= 5) {
      const idx = [0, 5, 10][v - 3]
      answers[idx].displayPosition = [9, -1, 4][v - 3]
      expected.insufficiencyKind = 'INVALID_DISPLAY_POSITION'
    } else if (v <= 7) {
      const [src, dst] = v === 6 ? [1, 0] : [10, 9]
      answers[dst].questionId = answers[src].questionId
      expected.insufficiencyKind = 'DUPLICATE_QUESTION_ID'
    } else if (v === 8) {
      delete answers[3].displayPosition
      expected.insufficiencyKind = 'MISSING_DISPLAY_POSITION'
    } else {
      answers[7].displayPosition = 3.5
      expected.insufficiencyKind = 'INVALID_DISPLAY_POSITION'
    }
    return { answers, expected }
  }),

  // F04 REPETITIVE_RESPONSE_PATTERN — alternating position → LOW.
  F04: family('04', (rng, v) => {
    const a = v % 4
    const b = (a + 1) % 4
    return {
      answers: buildAnswers(chooseHealthy, alternatingPositions(a, b)),
      expected: {
        intendedValidityTendency: 'RESPONSE_QUALITY_LOW',
        completeness: 'COMPLETE_18',
        repetitionPattern: 'POSITION_ALTERNATING',
        positionPattern: 'ALTERNATING',
        contradictionPattern: 'NONE',
        evidenceStrengthTendency: 'MIXED',
      },
    }
  }),

  // F05 POSITION_CONCENTRATION — sequential 0,1,2,3 → LOW.
  F05: family('05', () => ({
    answers: buildAnswers(chooseHealthy, sequentialPositions()),
    expected: {
      intendedValidityTendency: 'RESPONSE_QUALITY_LOW',
      completeness: 'COMPLETE_18',
      repetitionPattern: 'POSITION_SEQUENTIAL',
      positionPattern: 'SEQUENTIAL',
      contradictionPattern: 'NONE',
      evidenceStrengthTendency: 'MIXED',
    },
  })),

  // F06 CONTRADICTORY_RESPONSE_PATTERN — semantically mixed (H vs D) but
  // structurally valid positions → RESPONSE_VALID.
  F06: family('06', (rng) => ({
    answers: buildAnswers(chooseMixed, variedPositions(rng)),
    expected: {
      intendedValidityTendency: 'RESPONSE_VALID',
      completeness: 'COMPLETE_18',
      repetitionPattern: 'NONE',
      positionPattern: 'VARIED_NO_PATTERN',
      contradictionPattern: 'SEMANTIC_H_VS_D_MIXED',
      evidenceStrengthTendency: 'MIXED',
    },
  })),

  // F07 STRONG_SINGLE_CONSTRUCT — bias toward H-direction evidence (healthy
  // semantic tendency), varied positions → RESPONSE_VALID.
  F07: family('07', (rng) => ({
    answers: buildAnswers((q) => chooseByDirection(q, 'H'), variedPositions(rng)),
    expected: {
      intendedValidityTendency: 'RESPONSE_VALID',
      completeness: 'COMPLETE_18',
      repetitionPattern: 'NONE',
      positionPattern: 'VARIED_NO_PATTERN',
      contradictionPattern: 'NONE',
      evidenceStrengthTendency: 'STRONG_HEALTHY_LEAN',
    },
  })),

  // F08 COMPETING_CONSTRUCTS — cycle H/D/N directional bias across questions,
  // varied positions → RESPONSE_VALID.
  F08: family('08', (rng) => ({
    answers: buildAnswers((q, i) => {
      const dirs = ['H', 'D', 'N']
      return chooseByDirection(q, dirs[i % dirs.length])
    }, variedPositions(rng)),
    expected: {
      intendedValidityTendency: 'RESPONSE_VALID',
      completeness: 'COMPLETE_18',
      repetitionPattern: 'NONE',
      positionPattern: 'VARIED_NO_PATTERN',
      contradictionPattern: 'CROSS_DIRECTION_MIXED',
      evidenceStrengthTendency: 'MIXED',
    },
  })),

  // F09 WEAK_EVIDENCE — minimal-ref options (all options have 1 ref here, so
  // this produces a stable low-variance selection), varied positions.
  F09: family('09', (rng) => ({
    answers: buildAnswers(chooseWeak, variedPositions(rng)),
    expected: {
      intendedValidityTendency: 'RESPONSE_VALID',
      completeness: 'COMPLETE_18',
      repetitionPattern: 'NONE',
      positionPattern: 'VARIED_NO_PATTERN',
      contradictionPattern: 'NONE',
      evidenceStrengthTendency: 'WEAK_OR_MINIMAL',
    },
  })),

  // F10 BOUNDARY_ADVERSARIAL — edge positions (0/3 only), no pattern.
  F10: family('10', (rng) => ({
    answers: buildAnswers(chooseHealthy, boundaryPositions(rng)),
    expected: {
      intendedValidityTendency: 'RESPONSE_VALID',
      completeness: 'COMPLETE_18',
      repetitionPattern: 'NONE',
      positionPattern: 'BOUNDARY_0_3_ONLY_NO_PATTERN',
      contradictionPattern: 'NONE',
      evidenceStrengthTendency: 'MIXED',
    },
  })),
}

function generateBaseCases() {
  const cases = []
  for (const key of Object.keys(FAMILIES).sort()) {
    for (let v = 0; v < 10; v++) cases.push(FAMILIES[key](v))
  }
  return cases
}

module.exports = { FAMILIES, generateBaseCases, QUESTION_COUNT, buildAnswers }
