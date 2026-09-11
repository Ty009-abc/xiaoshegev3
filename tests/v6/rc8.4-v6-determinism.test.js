'use strict'
/**
 * tests/v6/rc8.4-v6-determinism.test.js
 *
 * Determinism: same fixtures, repeated runs -> identical semantic output.
 * No timestamps / random ids in compared output.
 */

const h = require('./_harness.js')
const { GOLDEN, ADVERSARIAL } = require('./fixtures.js')
const { diagnoseTurnaroundV6 } = require('../../cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6/index.js')

h.section('RC8.4 V6 — determinism')

// Stable serialization: strip nothing (output already carries no timestamps).
function semantic (r) {
  return JSON.stringify(r)
}

const all = GOLDEN.map(g => g.answers).concat(ADVERSARIAL.map(c => c.answers))
let deterministic = true

for (let i = 0; i < all.length; i++) {
  const a = semantic(diagnoseTurnaroundV6(all[i]))
  const b = semantic(diagnoseTurnaroundV6(all[i]))
  const c = semantic(diagnoseTurnaroundV6(all[i]))
  if (!(a === b && b === c)) {
    deterministic = false
    h.ok(false, `fixture #${i} non-deterministic across 3 runs`)
  }
}
h.ok(deterministic, 'all fixtures deterministic across repeated runs')

// Key-order independence: object key insertion order must not change result.
{
  const src = GOLDEN[0].answers
  const reordered = {}
  for (const k of Object.keys(src).reverse()) reordered[k] = src[k]
  h.eq(
    diagnoseTurnaroundV6(reordered).primaryBottleneck,
    diagnoseTurnaroundV6(src).primaryBottleneck,
    'key-order independence'
  )
}

h.summary('DETERMINISM')
console.log(`\nDETERMINISTIC_OUTPUT = ${deterministic ? 'YES' : 'NO'}`)
module.exports = { deterministic }
