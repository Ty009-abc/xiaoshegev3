/**
 * tools/rc83-stage21-batch2/lib/util.js
 *
 * Minimal deterministic utilities for the Batch2 authority/fallback tooling.
 *
 * Self-contained (no Batch1 dependency): canonical JSON serialization with
 * recursive key ordering, and deep immutable comparison. Identity-free,
 * secret-free, timestamp-free by construction (only JSON-serializable values).
 */

'use strict'

// Deterministic canonical JSON: recursively sort object keys.
function canonicalJson(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value === undefined ? null : value)
  }
  if (Array.isArray(value)) {
    var arr = []
    for (var i = 0; i < value.length; i++) arr.push(canonicalJson(value[i]))
    return '[' + arr.join(',') + ']'
  }
  var keys = Object.keys(value).sort()
  var parts = []
  for (var j = 0; j < keys.length; j++) {
    var k = keys[j]
    parts.push(JSON.stringify(k) + ':' + canonicalJson(value[k]))
  }
  return '{' + parts.join(',') + '}'
}

// Deep immutable equality via canonical serialization (order-insensitive for objects).
function deepEqual(a, b) {
  return canonicalJson(a) === canonicalJson(b)
}

// Mutable deep copy (JSON-safe): strips functions, preserves plain data.
function deepCopy(value) {
  return JSON.parse(JSON.stringify(value))
}

// Deep frozen copy (JSON-safe): strips functions, preserves plain data.
function deepFreezeCopy(value) {
  var copy = JSON.parse(JSON.stringify(value))
  return freezeRecursive(copy)
}

function freezeRecursive(v) {
  if (v !== null && typeof v === 'object') {
    if (Array.isArray(v)) {
      for (var i = 0; i < v.length; i++) freezeRecursive(v[i])
    } else {
      var keys = Object.keys(v)
      for (var j = 0; j < keys.length; j++) freezeRecursive(v[keys[j]])
    }
    Object.freeze(v)
  }
  return v
}

module.exports = {
  canonicalJson: canonicalJson,
  deepEqual: deepEqual,
  deepCopy: deepCopy,
  deepFreezeCopy: deepFreezeCopy,
}
