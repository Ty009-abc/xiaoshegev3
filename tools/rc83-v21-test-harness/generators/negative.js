'use strict'
// Negative case generator (N01–N10). Independent set, NOT part of the 100-case
// denominator. Each negative case shapes a malformed payload to probe input
// handling boundaries. NO production effect.
const { generateBaseCases } = require('./families')

// Deterministic "healthy" 18-tuple reference (F01-V00) as a clone base.
function healthyBase() {
  const base = generateBaseCases()[0]
  return base.answers.map((a) => ({ ...a }))
}

function generateNegativeCases() {
  const H = healthyBase()
  const out = []

  function push(id, kind, payload, note) {
    out.push({
      testCaseId: id,
      familyId: 'NEGATIVE',
      variantId: kind,
      seed: `NEGATIVE:${kind}`,
      answers: payload,
      expectedStructuralProperties: { negativeKind: kind, note },
    })
  }

  // N01 missing answer — 17 of 18 entries.
  push('N01', 'missing_answer', H.slice(0, 17), 'one answer omitted')

  // N02 duplicate questionId.
  {
    const a = H.map((x) => ({ ...x }))
    a[1].questionId = a[0].questionId
    push('N02', 'duplicate_questionId', a, 'two entries share a questionId')
  }

  // N03 unknown questionId.
  {
    const a = H.map((x) => ({ ...x }))
    a[2].questionId = 'SC_UNKNOWN_99'
    push('N03', 'unknown_questionId', a, 'questionId not in canonical set')
  }

  // N04 unknown optionId.
  {
    const a = H.map((x) => ({ ...x }))
    a[3].optionId = 'Z'
    push('N04', 'unknown_optionId', a, 'optionId not a legal option')
  }

  // N05 missing displayPosition (single).
  {
    const a = H.map((x) => ({ ...x }))
    delete a[4].displayPosition
    push('N05', 'missing_displayPosition', a, 'one entry lacks displayPosition')
  }

  // N06 invalid displayPosition.
  {
    const a = H.map((x) => ({ ...x }))
    a[5].displayPosition = 99
    push('N06', 'invalid_displayPosition', a, 'displayPosition out of range')
  }

  // N07 malformed answer entry (non-object).
  {
    const a = H.map((x) => ({ ...x }))
    a[6] = 'garbage-entry'
    push('N07', 'malformed_answer_entry', a, 'entry is a primitive, not object')
  }

  // N08 empty answers.
  push('N08', 'empty_answers', [], 'zero answers')

  // N09 extra answer (19 tuples, with duplicate qid).
  {
    const a = H.map((x) => ({ ...x }))
    a.push({ questionId: 'SC_DEC_01', optionId: 'B', displayPosition: 1 })
    push('N09', 'extra_answer', a, '19 entries incl. duplicate questionId')
  }

  // N10 non-array payload.
  push('N10', 'non_array_payload', { questionId: 'SC_DEC_01' }, 'payload is an object, not array')

  return out
}

module.exports = { generateNegativeCases }
