/**
 * tests/rc8.3-stage21-batch2.test.js
 *
 * Stage21 Batch2 (W1/W2/W10) tests:
 *   - AI authority guard (protected paths from V2.1 contract)
 *   - deterministic fallback (V2.1 adapter)
 *   - qualification runner (Q01–Q15) + mutation tests (M1–M10)
 */

var ag = require('../tools/rc83-stage21-batch2/lib/authorityGuardV21')
var fb = require('../tools/rc83-stage21-batch2/lib/fallbackAdapterV21')
var rp = require('../tools/rc83-stage21-batch2/lib/renderPipelineV21')
var qr = require('../tools/rc83-stage21-batch2/lib/qualificationRunner')
var util = require('../tools/rc83-stage21-batch2/lib/util')

var t = 0, p = 0, f = 0
function T(n, fn) { t++; try { fn(); p++ } catch (e) { f++; console.error('FAIL [' + n + ']:', e.message) } }
function eq(a, b, m) { if (a !== b) throw new Error((m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)) }
function ok(v, m) { if (!v) throw new Error((m || 'ok') + ': falsy') }
function notOk(v, m) { if (v) throw new Error((m || 'notOk') + ': truthy') }
function deepEq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || 'deepEq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)) }

// ═══════════════════════════════════════════════════════════
// W1 — Authority snapshot
// ═══════════════════════════════════════════════════════════

T('A01: snapshot contains only protected fields (no identity/secret/timestamp)', function () {
  var engine = qr.makeEngineResult()
  var snap = ag.buildAuthoritySnapshot(engine)
  var keys = Object.keys(snap).sort()
  deepEq(keys, ag.PROTECTED_PATHS.slice().sort(), 'snapshot keys = protected paths exactly')
  var json = JSON.stringify(snap)
  notOk(/openid|unionid|nickname|phone|token|secret|timestamp/i.test(json), 'snapshot must be identity/secret/timestamp-free')
})

T('A02: snapshot is deep-frozen (immutable)', function () {
  var snap = ag.buildAuthoritySnapshot(qr.makeEngineResult())
  var threw = false
  try { snap.primaryBlindSpotId = 'HACK'; } catch (e) { threw = true }
  ok(threw || snap.primaryBlindSpotId === 'DECISION_INERTIA', 'snapshot must be frozen')
})

T('A03: snapshot deterministic (canonical ordering)', function () {
  var a = ag.buildAuthoritySnapshot(qr.makeEngineResult())
  var b = ag.buildAuthoritySnapshot(qr.makeEngineResult())
  eq(util.canonicalJson(a), util.canonicalJson(b), 'deterministic snapshot')
})

T('A04: valid AI echo accepted', function () {
  var engine = qr.makeEngineResult()
  var ai = qr.makeValidAiOutput(engine)
  var r = ag.validateAuthority(engine, ai)
  eq(r.status, 'AI_RENDER_ACCEPTED')
  eq(r.violations.length, 0)
})

// ═══════════════════════════════════════════════════════════
// W1 — Authority violations (each must be rejected)
// ═══════════════════════════════════════════════════════════

T('V01: archetype swap rejected', function () {
  var e = qr.makeEngineResult(); var ai = qr.makeValidAiOutput(e)
  ai.authoritativeDiagnosis.primaryConstruct = 'RISK'
  eq(ag.validateAuthority(e, ai).status, 'AI_RENDER_REJECTED_AUTHORITY_VIOLATION')
})

T('V02: blindSpot swap rejected', function () {
  var e = qr.makeEngineResult(); var ai = qr.makeValidAiOutput(e)
  ai.authoritativeDiagnosis.primaryBlindSpotId = 'TIME_HORIZON_TRAP'
  eq(ag.validateAuthority(e, ai).status, 'AI_RENDER_REJECTED_AUTHORITY_VIOLATION')
})

T('V03: strategy (terminal status) swap rejected', function () {
  var e = qr.makeEngineResult(); var ai = qr.makeValidAiOutput(e)
  ai.authoritativeDiagnosis.cognitionTerminalStatus = 'INSUFFICIENT_EVIDENCE'
  eq(ag.validateAuthority(e, ai).status, 'AI_RENDER_REJECTED_AUTHORITY_VIOLATION')
})

T('V04: scenario (dimensionSummary) swap rejected', function () {
  var e = qr.makeEngineResult(); var ai = qr.makeValidAiOutput(e)
  ai.authoritativeDiagnosis.dimensionSummary = [{ construct: 'RISK', orientation: 'DISTORTED', state: 'STRONG', hSupport: 0, dSupport: 2, nSupport: 0 }]
  eq(ag.validateAuthority(e, ai).status, 'AI_RENDER_REJECTED_AUTHORITY_VIOLATION')
})

T('V05: protected field removed rejected', function () {
  var e = qr.makeEngineResult(); var ai = qr.makeValidAiOutput(e)
  delete ai.authoritativeDiagnosis.primaryBlindSpotId
  eq(ag.validateAuthority(e, ai).status, 'AI_RENDER_REJECTED_AUTHORITY_VIOLATION')
})

T('V06: protected field nullified rejected', function () {
  var e = qr.makeEngineResult(); var ai = qr.makeValidAiOutput(e)
  ai.authoritativeDiagnosis.primaryConstruct = null
  eq(ag.validateAuthority(e, ai).status, 'AI_RENDER_REJECTED_AUTHORITY_VIOLATION')
})

T('V07: type mutation rejected (cognitionExecuted → string)', function () {
  var e = qr.makeEngineResult(); var ai = qr.makeValidAiOutput(e)
  ai.authoritativeDiagnosis.cognitionExecuted = 'true'
  eq(ag.validateAuthority(e, ai).status, 'AI_RENDER_REJECTED_AUTHORITY_VIOLATION')
})

T('V08: nested authority mutation rejected', function () {
  var e = qr.makeEngineResult(); var ai = qr.makeValidAiOutput(e)
  ai.authoritativeDiagnosis.dimensionSummary = [{ construct: 'SYSTEMS', orientation: 'DISTORTED', state: 'STRONG', hSupport: 0, dSupport: 2, nSupport: 0 }]
  eq(ag.validateAuthority(e, ai).status, 'AI_RENDER_REJECTED_AUTHORITY_VIOLATION')
})

T('V09: semantic smuggling (extra diagnostic field) rejected', function () {
  var e = qr.makeEngineResult(); var ai = qr.makeValidAiOutput(e)
  ai.trueBlindspot = 'SYSTEM_THINKING_GAP'
  eq(ag.validateAuthority(e, ai).status, 'AI_RENDER_REJECTED_AUTHORITY_VIOLATION')
})

T('V10: non-object AI output rejected', function () {
  eq(ag.validateAuthority(qr.makeEngineResult(), 'string').status, 'AI_RENDER_REJECTED_AUTHORITY_VIOLATION')
  eq(ag.validateAuthority(qr.makeEngineResult(), null).status, 'AI_RENDER_REJECTED_AUTHORITY_VIOLATION')
  eq(ag.validateAuthority(qr.makeEngineResult(), []).status, 'AI_RENDER_REJECTED_AUTHORITY_VIOLATION')
})

// ═══════════════════════════════════════════════════════════
// W2 — Deterministic fallback
// ═══════════════════════════════════════════════════════════

T('F01: fallback renderSource is DETERMINISTIC_FALLBACK (not disguised as AI)', function () {
  var r = fb.buildFallbackV21(qr.makeEngineResult())
  eq(r.renderSource, 'DETERMINISTIC_FALLBACK')
  notOk(r.renderSource === 'AI_RENDERED', 'fallback must not be disguised as AI success')
})

T('F02: fallback preserves engine diagnosis (protected fields unchanged)', function () {
  var e = qr.makeEngineResult()
  var r = fb.buildFallbackV21(e)
  eq(r.authoritativeDiagnosis.primaryBlindSpotId, 'DECISION_INERTIA')
  eq(r.authoritativeDiagnosis.primaryConstruct, 'DECISION')
  eq(r.authoritativeDiagnosis.cognitionTerminalStatus, 'PRIMARY_ALLOWED')
})

T('F03: fallback determinism (100 runs, 0 semantic mismatch)', function () {
  var e = qr.makeEngineResult()
  var d = qr.fallbackDeterminism(e, 100)
  eq(d.mismatch, 0, 'fallback must be fully deterministic')
  eq(d.total, 100)
})

T('F04: fallback prose does not re-infer (no second diagnosis)', function () {
  var e = qr.makeEngineResult()
  var r = fb.buildFallbackV21(e)
  var json = JSON.stringify(r.record)
  // Prose must not invent a different blindspot id.
  notOk(/SYSTEM_THINKING_GAP|RISK_MODEL_DISTORTION|TIME_HORIZON_TRAP/.test(json), 'fallback prose must not invent diagnosis')
})

// ═══════════════════════════════════════════════════════════
// W1+W2 — Render pipeline (fallback triggers)
// ═══════════════════════════════════════════════════════════

T('P01: valid AI → AI_RENDERED', function () {
  var e = qr.makeEngineResult()
  var r = rp.renderV21(e, qr.makeValidAiOutput(e))
  eq(r.renderSource, 'AI_RENDERED')
})

T('P02: authority violation → fallback', function () {
  var e = qr.makeEngineResult(); var ai = qr.makeValidAiOutput(e)
  ai.authoritativeDiagnosis.primaryBlindSpotId = 'OPPORTUNITY_BLINDNESS'
  var r = rp.renderV21(e, ai)
  eq(r.renderSource, 'DETERMINISTIC_FALLBACK')
  eq(r.fallbackReason, 'AUTHORITY_VIOLATION')
})

T('P03: missing output → fallback (MISSING_AI_OUTPUT)', function () {
  var r = rp.renderV21(qr.makeEngineResult(), null)
  eq(r.renderSource, 'DETERMINISTIC_FALLBACK')
  eq(r.fallbackReason, 'MISSING_AI_OUTPUT')
})

T('P04: exception → fallback (AI_EXCEPTION)', function () {
  var r = rp.renderV21(qr.makeEngineResult(), null, { aiThrew: true })
  eq(r.renderSource, 'DETERMINISTIC_FALLBACK')
  eq(r.fallbackReason, 'AI_EXCEPTION')
})

T('P05: malformed output → fallback', function () {
  var r = rp.renderV21(qr.makeEngineResult(), 'malformed')
  eq(r.renderSource, 'DETERMINISTIC_FALLBACK')
})

// ═══════════════════════════════════════════════════════════
// W10 — Qualification matrix (Q01–Q15)
// ═══════════════════════════════════════════════════════════

T('Q01: valid AI expression → accepted', function () {
  var r = findCase('Q01')
  eq(r.renderSource, 'AI_RENDERED')
  eq(r.authorityGuardStatus, 'AI_RENDER_ACCEPTED')
})

T('Q02-Q12: mutations → reject/fallback (not AI_RENDERED)', function () {
  var rejectIds = ['Q02', 'Q03', 'Q04', 'Q05', 'Q06', 'Q07', 'Q08', 'Q09', 'Q10', 'Q11', 'Q12']
  for (var i = 0; i < rejectIds.length; i++) {
    var r = findCase(rejectIds[i])
    if (r.renderSource === 'AI_RENDERED') throw new Error(rejectIds[i] + ' was wrongly accepted')
  }
})

T('Q13: extra non-authoritative prose allowed', function () {
  var r = findCase('Q13')
  eq(r.renderSource, 'AI_RENDERED')
})

T('Q14: extra conflicting diagnostic field → not authority', function () {
  var r = findCase('Q14')
  eq(r.renderSource, 'DETERMINISTIC_FALLBACK')
})

T('Q15: fallback determinism 0 mismatch', function () {
  var r = findCase('Q15')
  eq(r.determinism.mismatch, 0)
})

function findCase(id) {
  var cases = qr.runQualificationCases()
  for (var i = 0; i < cases.length; i++) {
    if (cases[i].caseId === id) return cases[i]
  }
  throw new Error('case not found: ' + id)
}

// ═══════════════════════════════════════════════════════════
// Mutation tests M1–M10 (all must be caught)
// ═══════════════════════════════════════════════════════════

T('M1-M10: all mutations caught', function () {
  var muts = qr.runMutationTests()
  eq(muts.length, 10, '10 mutation tests')
  for (var i = 0; i < muts.length; i++) {
    if (!muts[i].caught) throw new Error('mutation not caught: ' + muts[i].mutationId + ' (' + muts[i].detail + ')')
  }
})

// ═══════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════

console.log('\n===== Stage21 Batch2 tests =====')
console.log('TOTAL=' + t + ' PASS=' + p + ' FAIL=' + f)
if (f > 0) process.exit(1)
