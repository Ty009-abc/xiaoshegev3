'use strict'
// Deterministic displayPosition generator. Positions are REAL input values
// (never derived from optionId). Same seed → same sequence. Covers normal
// permutations, concentration, and edge patterns.
const { rangeInt } = require('./rng')
const { detectPatterns } = require('./load')

const SEQ = [0, 1, 2, 3] // sequential reference (canonical)

// A deterministic position sequence that avoids all mechanical patterns.
// Tries seeded permutations first, falls back to a known-clean fixed sequence.
function variedPositions(rng) {
  for (let attempt = 0; attempt < 2000; attempt++) {
    const L = []
    for (let i = 0; i < 18; i++) L.push(rangeInt(rng, 4))
    if (detectPatterns(L).length === 0) return L
  }
  // Deterministic fallback (no pattern by construction).
  return [0, 1, 2, 0, 1, 3, 0, 2, 1, 3, 0, 1, 2, 3, 0, 2, 1, 0]
}

// Uniform fixed position (triggers all_same when n≥1).
function constantPositions(pos) {
  return new Array(18).fill(pos)
}

// Alternating two positions (triggers alternating when n≥4, |distinct|==2).
function alternatingPositions(a, b) {
  const L = []
  for (let i = 0; i < 18; i++) L.push(i % 2 === 0 ? a : b)
  return L
}

// Sequential 0,1,2,3 cycle (triggers sequential when n≥4).
function sequentialPositions() {
  const L = []
  for (let i = 0; i < 18; i++) L.push(SEQ[i % 4])
  return L
}

// Boundary edge positions: only 0 and 3. Even variants keep a clean 0/3 mix
// that does NOT trigger a pattern; odd variants also avoid patterns.
function boundaryPositions(rng) {
  for (let attempt = 0; attempt < 2000; attempt++) {
    const L = []
    for (let i = 0; i < 18; i++) L.push(rangeInt(rng, 2) === 0 ? 0 : 3)
    if (detectPatterns(L).length === 0) return L
  }
  return [0, 3, 0, 3, 3, 0, 3, 0, 0, 3, 3, 0, 0, 3, 3, 0, 3, 0]
}

module.exports = {
  variedPositions,
  constantPositions,
  alternatingPositions,
  sequentialPositions,
  boundaryPositions,
}
