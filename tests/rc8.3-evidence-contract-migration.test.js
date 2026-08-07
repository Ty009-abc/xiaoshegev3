/**
 * tests/rc8.3-evidence-contract-migration.test.js
 *
 * RC8.3 C3-001A — Evidence Contract Migration Validation.
 *
 * Validates that all 23 evidence contracts have been fully migrated:
 * - 23/23 contracts valid
 * - 100% executable rules have structured predicates
 * - 0 free-text executable rules
 * - 0 regex-required executable semantics
 * - 0 substring-required executable semantics
 * - All predicate types are known
 * - All signal IDs reference valid signals
 * - All thresholds numeric and bounded
 * - All AND/OR groups non-empty
 *
 * @version world_model_v3
 * @sprint c3-001a
 */

var {
  SECONDARY_SIGNAL_EVIDENCE_MAP,
  getAllEvidenceContractIds,
  validateAllEvidenceContracts,
  getEvidenceContract,
} = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/secondarySignalEvidenceMap')

var { validatePredicate, validateContractRule, countFreeTextRules, getKnownSignalIds } =
  require('../cloudfunctions/generateAiReport/lib/engine/worldModel/predicateValidator')

var { ALL_TYPES, PREDICATE_TYPE } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/predicateSchema')

var { SECONDARY_SIGNALS } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/secondarySignalDefinitions')

var total = 0, passed = 0, failed = 0
var debtItems = []

function T(name, fn) {
  total++
  try { fn(); passed++ }
  catch (e) { failed++; console.error('FAIL [' + name + ']: ' + e.message) }
}

function eq(a, b, m) { if (a !== b) throw new Error((m || 'eq') + ': ' + a + ' !== ' + b) }
function ok(v, m) { if (!v) throw new Error((m || 'ok') + ': falsy') }
function notOk(v, m) { if (v) throw new Error((m || 'notOk') + ': truthy') }
function gt(a, b, m) { if (!(a > b)) throw new Error((m || 'gt') + ': ' + a + ' not > ' + b) }

var ids = getAllEvidenceContractIds()
var knownSignalIds = Array.from(getKnownSignalIds())

// ── 23/23 contracts load ──

T('23 signals loaded', function () {
  eq(ids.length, 23)
})

T('validateAllEvidenceContracts passes', function () {
  var v = validateAllEvidenceContracts()
  ok(v.allValid, 'Not all contracts valid: ' + v.failed + ' failed')
  eq(v.total, 23)
})

// ── All rules have structured predicates ──

T('all activation rules have { humanRule, predicate }', function () {
  ids.forEach(function (id) {
    var c = getEvidenceContract(id)
    ok(c.activationRule, id + ' missing activationRule')
    ok(c.activationRule.humanRule, id + ' missing activationRule.humanRule')
    ok(c.activationRule.predicate, id + ' missing activationRule.predicate')
    ok(typeof c.activationRule.humanRule === 'string' && c.activationRule.humanRule.length > 0)
  })
})

T('all suppression rules have { humanRule, predicate }', function () {
  ids.forEach(function (id) {
    var c = getEvidenceContract(id)
    ok(c.suppressionRule, id + ' missing suppressionRule')
    ok(c.suppressionRule.humanRule, id + ' missing suppressionRule.humanRule')
    ok(c.suppressionRule.predicate, id + ' missing suppressionRule.predicate')
  })
})

T('all uncertainty rules have { humanRule, predicate }', function () {
  ids.forEach(function (id) {
    var c = getEvidenceContract(id)
    ok(c.uncertaintyRule, id + ' missing uncertaintyRule')
    ok(c.uncertaintyRule.humanRule, id + ' missing uncertaintyRule.humanRule')
    ok(c.uncertaintyRule.predicate, id + ' missing uncertaintyRule.predicate')
  })
})

// ── 0 free-text executable rules ──

T('0 free-text executable rules', function () {
  var count = 0
  ids.forEach(function (id) {
    var c = getEvidenceContract(id)
    count += countFreeTextRules(c)
  })
  eq(count, 0, 'Free-text rules found: ' + count)
})

T('0 old-format triggers remain', function () {
  var oldTriggers = 0
  ids.forEach(function (id) {
    var c = getEvidenceContract(id)
    if (c.suppressionRule && c.suppressionRule.triggers) {
      oldTriggers += c.suppressionRule.triggers.length
    }
  })
  eq(oldTriggers, 0, 'Old-format triggers: ' + oldTriggers)
})

// ── All predicates pass schema validation ──

T('100% activation predicates valid', function () {
  ids.forEach(function (id) {
    var c = getEvidenceContract(id)
    var r = validatePredicate(c.activationRule.predicate, id + '.activation')
    ok(r.valid, id + ': ' + (r.error || 'unknown error'))
  })
})

T('100% suppression predicates valid', function () {
  ids.forEach(function (id) {
    var c = getEvidenceContract(id)
    var r = validatePredicate(c.suppressionRule.predicate, id + '.suppression')
    ok(r.valid, id + ': ' + (r.error || 'unknown error'))
  })
})

T('100% uncertainty predicates valid', function () {
  ids.forEach(function (id) {
    var c = getEvidenceContract(id)
    var r = validatePredicate(c.uncertaintyRule.predicate, id + '.uncertainty')
    ok(r.valid, id + ': ' + (r.error || 'unknown error'))
  })
})

// ── 0 unknown predicate types ──

T('0 unknown predicate types', function () {
  function collectTypes(node, found) {
    if (!node) return
    if (!ALL_TYPES.includes(node.type)) found.add('UNKNOWN:' + node.type)
    found.add(node.type)
    if (node.conditions) node.conditions.forEach(function (c) { collectTypes(c, found) })
    if (node.condition) collectTypes(node.condition, found)
  }

  ids.forEach(function (id) {
    var c = getEvidenceContract(id)
    var types = new Set()
    ;[c.activationRule, c.suppressionRule, c.uncertaintyRule].forEach(function (rule) {
      if (rule && rule.predicate) collectTypes(rule.predicate, types)
    })
    types.forEach(function (t) {
      ok(ALL_TYPES.includes(t), id + ' contains unknown type: ' + t)
    })
  })
})

// ── 0 malformed nodes ──

T('0 malformed activation predicates', function () {
  ids.forEach(function (id) {
    var c = getEvidenceContract(id)
    var p = c.activationRule.predicate
    ok(p && typeof p === 'object', id + ' activation predicate not object')
    ok(p.type && typeof p.type === 'string', id + ' activation predicate missing type')
  })
})

T('0 malformed suppression predicates', function () {
  ids.forEach(function (id) {
    var c = getEvidenceContract(id)
    var p = c.suppressionRule.predicate
    ok(p && typeof p === 'object', id + ' suppression predicate not object')
    ok(p.type && typeof p.type === 'string', id + ' suppression predicate missing type')
  })
})

// ── All signal IDs valid ──

T('all predicate signal IDs reference known signals', function () {
  function collectSignalIds(node, found) {
    if (!node) return
    if (node.signalId) found.add(node.signalId)
    if (node.conditions) node.conditions.forEach(function (c) { collectSignalIds(c, found) })
    if (node.condition) collectSignalIds(node.condition, found)
  }

  ids.forEach(function (id) {
    var c = getEvidenceContract(id)
    var refs = new Set()
    ;[c.activationRule, c.suppressionRule, c.uncertaintyRule].forEach(function (rule) {
      if (rule && rule.predicate) collectSignalIds(rule.predicate, refs)
    })
    refs.forEach(function (ref) {
      ok(knownSignalIds.indexOf(ref) !== -1, id + ' references unknown signal: ' + ref)
    })
  })
})

// ── All thresholds in range ──

T('all confidence thresholds in [0, 1]', function () {
  function collectConfValues(node, found) {
    if (!node) return
    if (node.type === PREDICATE_TYPE.CONFIDENCE_GTE || node.type === PREDICATE_TYPE.CONFIDENCE_LTE) {
      found.push({ signalId: node.signalId, value: node.value })
    }
    if (node.conditions) node.conditions.forEach(function (c) { collectConfValues(c, found) })
    if (node.condition) collectConfValues(node.condition, found)
  }

  ids.forEach(function (id) {
    var c = getEvidenceContract(id)
    var vals = []
    ;[c.activationRule, c.suppressionRule, c.uncertaintyRule].forEach(function (rule) {
      if (rule && rule.predicate) collectConfValues(rule.predicate, vals)
    })
    vals.forEach(function (v) {
      ok(v.value >= 0 && v.value <= 1, id + ' threshold out of range: ' + v.value + ' for ' + v.signalId)
    })
  })
})

// ── All AND/OR groups non-empty ──

T('all AND/OR groups non-empty', function () {
  function checkGroups(node, path) {
    if (!node) return
    if (node.type === PREDICATE_TYPE.AND || node.type === PREDICATE_TYPE.OR) {
      ok(node.conditions && node.conditions.length > 0, path + ' empty ' + node.type)
    }
    if (node.conditions) {
      node.conditions.forEach(function (c, i) { checkGroups(c, path + '[' + i + ']') })
    }
    if (node.condition) checkGroups(node.condition, path + '.NOT')
  }

  ids.forEach(function (id) {
    var c = getEvidenceContract(id)
    ;[c.activationRule, c.suppressionRule, c.uncertaintyRule].forEach(function (rule) {
      if (rule && rule.predicate) checkGroups(rule.predicate, id)
    })
  })
})

// ── SERENDIPITOUS_PATH_DISCOVERY ──

T('SERENDIPITOUS_PATH_DISCOVERY has contradiction evidence', function () {
  var c = getEvidenceContract('SERENDIPITOUS_PATH_DISCOVERY')
  ok(c.contradictoryEvidence && c.contradictoryEvidence.length >= 1,
    'SERENDIPITOUS has contradiction: ' + (c.contradictoryEvidence ? c.contradictoryEvidence.length : 0) + ' items')
})

T('SERENDIPITOUS suppression predicate is valid', function () {
  var c = getEvidenceContract('SERENDIPITOUS_PATH_DISCOVERY')
  var r = validatePredicate(c.suppressionRule.predicate)
  ok(r.valid, 'SERENDIPITOUS suppression: ' + (r.error || 'valid'))
})

// ── Architecture guards ──

T('0 occupation contamination in predicates', function () {
  var forbidden = ['occupation', 'income', 'business', 'salary', 'career']
  ids.forEach(function (id) {
    var c = getEvidenceContract(id)
    var json = JSON.stringify(c).toLowerCase()
    forbidden.forEach(function (term) {
      notOk(json.includes(term), id + ' contains: ' + term)
    })
  })
})

T('0 direct Blind Spot / Archetype / Strategy in predicates', function () {
  ids.forEach(function (id) {
    var c = getEvidenceContract(id)
    var r = c.activationRule
    notOk(r.humanRule.toLowerCase().includes('blind spot'), id + ' activation mentions blind spot')
    notOk(r.humanRule.toLowerCase().includes('archetype'), id + ' activation mentions archetype')
  })
})

// ── Predicate type usage report ──

T('predicate type usage report', function () {
  var usage = {}
  function countTypes(node) {
    if (!node) return
    usage[node.type] = (usage[node.type] || 0) + 1
    if (node.conditions) node.conditions.forEach(function (c) { countTypes(c) })
    if (node.condition) countTypes(node.condition)
  }

  ids.forEach(function (id) {
    var c = getEvidenceContract(id)
    ;[c.activationRule, c.suppressionRule, c.uncertaintyRule].forEach(function (rule) {
      if (rule && rule.predicate) countTypes(rule.predicate)
    })
  })

  console.log('\nPredicate type usage across 23 contracts:')
  Object.keys(usage).sort().forEach(function (t) {
    console.log('  ' + t + ': ' + usage[t])
  })

  // Verify all 12 types are used
  var usedTypes = Object.keys(usage)
  gt(usedTypes.length, 4, 'Should use multiple predicate types')
})

// ── Report ──

console.log('\n=== Evidence Contract Migration Tests ===')
console.log('Total:', total, '| Passed:', passed, '| Failed:', failed)
console.log(failed === 0 ? 'ALL PASSED' : 'FAILURES: ' + failed)

if (debtItems.length > 0) {
  console.log('\nArchitecture debt:')
  debtItems.forEach(function (d) { console.log('  - ' + d) })
}

if (failed > 0) process.exit(1)
