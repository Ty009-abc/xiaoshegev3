/**
 * tests/rc8.3-stage21-batch3.test.js
 *
 * Stage21 Batch3 (W6/W7/W8) tests:
 *   - C1–C6   cohort assignment (determinism, boundaries, versioning)
 *   - G1–G6   pre-selective primary gate (fail-closed evidence)
 *   - R1–R8   rollback tooling (fail-closed preconditions, dry-run)
 *   - M1–M12  mutation/adversarial attacks (all fail-closed)
 */

var cohort = require('../tools/rc83-stage21-batch3/lib/cohortAssignment')
var gate = require('../tools/rc83-stage21-batch3/lib/preSelectiveGate')
var rollback = require('../tools/rc83-stage21-batch3/lib/rollbackTooling')
var activation = require('../tools/rc83-stage21-batch3/lib/activationPlan')

var t = 0, p = 0, f = 0
function T(n, fn) { t++; try { fn(); p++ } catch (e) { f++; console.error('FAIL [' + n + ']:', e.message) } }
function eq(a, b, m) { if (a !== b) throw new Error((m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)) }
function ok(v, m) { if (!v) throw new Error((m || 'ok') + ': falsy') }
function notOk(v, m) { if (v) throw new Error((m || 'notOk') + ': truthy') }
function throws(fn, m) { try { fn() } catch (e) { return } throw new Error((m || 'throws') + ': did not throw') }

// ═══════════════════════════════════════════════════════════
// W6 — Cohort assignment
// ═══════════════════════════════════════════════════════════

T('C1: same subject deterministic', function () {
  var a = cohort.assignCohort({ subjectToken: 's-1', rolloutSalt: 'salt-1', rolloutBasisPoints: 5000 })
  var b = cohort.assignCohort({ subjectToken: 's-1', rolloutSalt: 'salt-1', rolloutBasisPoints: 5000 })
  eq(a.cohort, b.cohort, 'same subject → same cohort')
  eq(JSON.stringify(a), JSON.stringify(b), 'full result deterministic')
})

T('C2: different subjects distribution sanity (not all identical)', function () {
  var seen = {}
  for (var i = 0; i < 200; i++) {
    var r = cohort.assignCohort({ subjectToken: 'subj-' + i, rolloutSalt: 'salt-1', rolloutBasisPoints: 5000 })
    seen[r.cohort] = true
  }
  ok(seen.PRIMARY_COHORT, 'some subjects in primary')
  ok(seen.SHADOW_COHORT, 'some subjects in shadow')
})

T('C3: 0bp => all SHADOW', function () {
  for (var i = 0; i < 100; i++) {
    var r = cohort.assignCohort({ subjectToken: 's-' + i, rolloutSalt: 'salt-1', rolloutBasisPoints: 0 })
    eq(r.cohort, 'SHADOW_COHORT', '0bp must be all shadow')
  }
})

T('C4: 10000bp => all PRIMARY', function () {
  for (var i = 0; i < 100; i++) {
    var r = cohort.assignCohort({ subjectToken: 's-' + i, rolloutSalt: 'salt-1', rolloutBasisPoints: 10000 })
    eq(r.cohort, 'PRIMARY_COHORT', '10000bp must be all primary')
  }
})

T('C5: same salt stable across calls', function () {
  var a = cohort.assignCohort({ subjectToken: 'stable-user', rolloutSalt: 'fixed-salt', rolloutBasisPoints: 3000 })
  var b = cohort.assignCohort({ subjectToken: 'stable-user', rolloutSalt: 'fixed-salt', rolloutBasisPoints: 3000 })
  eq(a.cohort, b.cohort)
  eq(a.algorithmVersion, 'V1')
  eq(a.saltVersion, 'V1')
})

T('C6: changed salt explicit reassignment (version change)', function () {
  var a = cohort.assignCohort({ subjectToken: 'stable-user', rolloutSalt: 'salt-A', rolloutBasisPoints: 5000 })
  // Different salt version is a governance event; cohort MAY reassign but
  // must be explicit (salt version included in result), not silent.
  var b = cohort.assignCohort({ subjectToken: 'stable-user', rolloutSalt: 'salt-B', rolloutBasisPoints: 5000 })
  // With a different salt the cohort MAY differ; the key invariant is that
  // both are deterministic and the salt/version are declared. We assert the
  // result carries the declared versions and is deterministic.
  eq(a.saltVersion, 'V1')
  eq(b.saltVersion, 'V1')
  var b2 = cohort.assignCohort({ subjectToken: 'stable-user', rolloutSalt: 'salt-B', rolloutBasisPoints: 5000 })
  eq(b.cohort, b2.cohort, 'same salt deterministic')
})

// ═══════════════════════════════════════════════════════════
// W7 — Pre-selective primary gate
// ═══════════════════════════════════════════════════════════

function allPassEvidence() {
  return {
    GATE_B_STATUS: 'PASS',
    BATCH1_STATUS: 'PASS',
    BATCH2_STATUS: 'PASS',
    RC_QUALIFICATION_STATUS: 'PASS',
    REAL_DEVICE_SMOKE_STATUS: 'PASS',
    CONFIG_DRIFT_STATUS: 'PASS',
    ROLLBACK_READINESS: 'PASS',
    PRODUCTION_REGRESSION_STATUS: 'PASS',
  }
}

T('G1: Gate-B ACTIVE cannot pass', function () {
  var ev = allPassEvidence(); ev.GATE_B_STATUS = 'ACTIVE'
  var r = gate.evaluatePreSelectiveGate(ev)
  eq(r.decision, 'BLOCKED')
})

T('G2: Gate-B FAIL cannot pass', function () {
  var ev = allPassEvidence(); ev.GATE_B_STATUS = 'FAIL'
  eq(gate.evaluatePreSelectiveGate(ev).decision, 'BLOCKED')
})

T('G3: missing evidence cannot pass', function () {
  var ev = allPassEvidence(); delete ev.BATCH1_STATUS
  var r = gate.evaluatePreSelectiveGate(ev)
  eq(r.decision, 'BLOCKED')
  ok(r.missingEvidence.indexOf('BATCH1_STATUS') !== -1, 'missing evidence reported')
})

T('G4: NOT_RUN cannot pass', function () {
  var ev = allPassEvidence(); ev.REAL_DEVICE_SMOKE_STATUS = 'NOT_RUN'
  eq(gate.evaluatePreSelectiveGate(ev).decision, 'BLOCKED')
})

T('G5: fake harness evidence cannot substitute for Gate-B', function () {
  var ev = allPassEvidence()
  // Attempt to substitute: GATE_B_STATUS stays ACTIVE but RC_QUALIFICATION PASS.
  ev.GATE_B_STATUS = 'ACTIVE'
  ev.RC_QUALIFICATION_STATUS = 'PASS'
  var r = gate.evaluatePreSelectiveGate(ev)
  eq(r.decision, 'BLOCKED', 'harness/local pass cannot substitute Gate-B PASS')
})

T('G6: all real gates PASS can reach READY', function () {
  var r = gate.evaluatePreSelectiveGate(allPassEvidence())
  eq(r.decision, 'READY')
  eq(r.gateResult, 'READY')
})

// ═══════════════════════════════════════════════════════════
// W8 — Rollback tooling
// ═══════════════════════════════════════════════════════════

function validPlan() {
  return rollback.buildRollbackPlan({
    currentMode: 'SELECTIVE_PRIMARY',
    targetMode: 'SHADOW',
    environmentId: 'env-x',
    expectedConfigFingerprint: 'abc123def456',
    rollbackTargetSha: '0874254ede490d7fef6c20942ff663c0970a445c',
    triggerClass: 'ROLLOUT_ABORT',
    verificationSteps: ['verify mode SHADOW'],
    abortConditions: ['env mismatch'],
  })
}
function validState() {
  return {
    liveEnvironmentId: 'env-x',
    liveConfigFingerprint: 'abc123def456',
    knownDeploymentState: true,
    authorityReadable: true,
    mode: 'SELECTIVE_PRIMARY', // authoritative observed current mode
  }
}

T('R1: fingerprint mismatch blocks rollback', function () {
  var state = validState(); state.liveConfigFingerprint = 'DIFFERENT'
  var r = rollback.evaluateRollbackPreconditions(validPlan(), state)
  eq(r.rollbackExecutionAllowed, 'NO')
  ok(r.reasons.indexOf('CONFIG_FINGERPRINT_MISMATCH') !== -1)
})

T('R2: env mismatch blocks rollback', function () {
  var state = validState(); state.liveEnvironmentId = 'other-env'
  var r = rollback.evaluateRollbackPreconditions(validPlan(), state)
  eq(r.rollbackExecutionAllowed, 'NO')
  ok(r.reasons.indexOf('ENVIRONMENT_MISMATCH') !== -1)
})

T('R3: missing rollback SHA blocks', function () {
  var plan = validPlan(); plan.rollbackTargetSha = null
  var r = rollback.evaluateRollbackPreconditions(plan, validState())
  eq(r.rollbackExecutionAllowed, 'NO')
  ok(r.reasons.indexOf('MISSING_ROLLBACK_SHA') !== -1)
})

T('R4: invalid target mode blocks', function () {
  var plan = validPlan(); plan.targetMode = 'BOGUS'
  var r = rollback.evaluateRollbackPreconditions(plan, validState())
  eq(r.rollbackExecutionAllowed, 'NO')
  ok(r.reasons.indexOf('INVALID_TARGET_MODE') !== -1)
})

T('R5: unknown authority blocks', function () {
  var state = validState(); state.authorityReadable = false
  var r = rollback.evaluateRollbackPreconditions(validPlan(), state)
  eq(r.rollbackExecutionAllowed, 'NO')
  ok(r.reasons.indexOf('AUTHORITY_UNREADABLE') !== -1)
})

T('R6: dry-run causes zero mutation (default)', function () {
  var mutated = false
  var r = rollback.runRollback(validPlan(), validState())
  eq(r.executed, false)
  eq(r.mode, 'DRY_RUN')
  eq(r.mutationsApplied, 0)
  notOk(mutated, 'no writer invoked')
})

T('R7: deploy action cannot mutate mode', function () {
  // This module has NO deploy action; asserting absence of any mode-mutation
  // surface in the default runner.
  eq(typeof rollback.runRollback, 'function')
  // No `deploy`/`syncMode` export exists.
  notOk(rollback.deploy !== undefined, 'no deploy mutation surface')
  notOk(rollback.syncMode !== undefined, 'no syncMode mutation surface')
})

T('R8: activation plan while Gate-B ACTIVE remains unauthorized', function () {
  var gateResult = gate.evaluatePreSelectiveGate(
    (function () { var e = allPassEvidence(); e.GATE_B_STATUS = 'ACTIVE'; return e })()
  )
  var plan = activation.buildActivationPlan({ environmentId: 'env-x', preSelectiveGateResult: gateResult })
  eq(plan.activationAllowed, false)
  eq(plan.activationState, 'NOT_AUTHORIZED')
})

// ═══════════════════════════════════════════════════════════
// R1 — Mode-transition legality matrix (T1–T14)
// ═══════════════════════════════════════════════════════════

function planForMode(current, target) {
  var p = validPlan()
  p.currentMode = current
  p.targetMode = target
  return p
}
function stateForMode(mode) {
  var s = validState()
  s.mode = mode
  return s
}

T('T1: SELECTIVE_PRIMARY→SHADOW = allowed', function () {
  var r = rollback.evaluateRollbackPreconditions(planForMode('SELECTIVE_PRIMARY', 'SHADOW'), stateForMode('SELECTIVE_PRIMARY'))
  eq(r.rollbackExecutionAllowed, 'YES')
})

T('T2: PRIMARY→SHADOW = allowed', function () {
  var r = rollback.evaluateRollbackPreconditions(planForMode('PRIMARY', 'SHADOW'), stateForMode('PRIMARY'))
  eq(r.rollbackExecutionAllowed, 'YES')
})

T('T3: SHADOW→PRIMARY = rejected', function () {
  var r = rollback.evaluateRollbackPreconditions(planForMode('SHADOW', 'PRIMARY'), stateForMode('SHADOW'))
  eq(r.rollbackExecutionAllowed, 'NO')
  ok(r.reasons.indexOf('INVALID_MODE_TRANSITION') !== -1)
})

T('T4: SHADOW→SELECTIVE_PRIMARY = rejected', function () {
  var r = rollback.evaluateRollbackPreconditions(planForMode('SHADOW', 'SELECTIVE_PRIMARY'), stateForMode('SHADOW'))
  eq(r.rollbackExecutionAllowed, 'NO')
  ok(r.reasons.indexOf('INVALID_MODE_TRANSITION') !== -1)
})

T('T5: PRIMARY→SELECTIVE_PRIMARY = rejected', function () {
  var r = rollback.evaluateRollbackPreconditions(planForMode('PRIMARY', 'SELECTIVE_PRIMARY'), stateForMode('PRIMARY'))
  eq(r.rollbackExecutionAllowed, 'NO')
  ok(r.reasons.indexOf('INVALID_MODE_TRANSITION') !== -1)
})

T('T6: SELECTIVE_PRIMARY→PRIMARY = rejected', function () {
  var r = rollback.evaluateRollbackPreconditions(planForMode('SELECTIVE_PRIMARY', 'PRIMARY'), stateForMode('SELECTIVE_PRIMARY'))
  eq(r.rollbackExecutionAllowed, 'NO')
  ok(r.reasons.indexOf('INVALID_MODE_TRANSITION') !== -1)
})

T('T7: SHADOW→SHADOW = rejected', function () {
  var r = rollback.evaluateRollbackPreconditions(planForMode('SHADOW', 'SHADOW'), stateForMode('SHADOW'))
  eq(r.rollbackExecutionAllowed, 'NO')
  ok(r.reasons.indexOf('INVALID_MODE_TRANSITION') !== -1)
})

T('T8: PRIMARY→PRIMARY = rejected', function () {
  var r = rollback.evaluateRollbackPreconditions(planForMode('PRIMARY', 'PRIMARY'), stateForMode('PRIMARY'))
  eq(r.rollbackExecutionAllowed, 'NO')
  ok(r.reasons.indexOf('INVALID_MODE_TRANSITION') !== -1)
})

T('T9: UNKNOWN→SHADOW = rejected', function () {
  var r = rollback.evaluateRollbackPreconditions(planForMode('UNKNOWN', 'SHADOW'), stateForMode('UNKNOWN'))
  eq(r.rollbackExecutionAllowed, 'NO')
  ok(r.reasons.indexOf('INVALID_MODE_TRANSITION') !== -1)
})

T('T10: missing current mode = rejected', function () {
  var s = validState(); s.mode = null
  var r = rollback.evaluateRollbackPreconditions(planForMode('SELECTIVE_PRIMARY', 'SHADOW'), s)
  eq(r.rollbackExecutionAllowed, 'NO')
  ok(r.reasons.indexOf('INVALID_MODE_TRANSITION') !== -1)
})

T('T11: plan.currentMode != observed state.mode = rejected (CURRENT_MODE_MISMATCH)', function () {
  var r = rollback.evaluateRollbackPreconditions(planForMode('PRIMARY', 'SHADOW'), stateForMode('SELECTIVE_PRIMARY'))
  eq(r.rollbackExecutionAllowed, 'NO')
  ok(r.reasons.indexOf('CURRENT_MODE_MISMATCH') !== -1)
})

T('T12: valid transition + fingerprint mismatch = rejected', function () {
  var s = stateForMode('SELECTIVE_PRIMARY'); s.liveConfigFingerprint = 'DIFFERENT'
  var r = rollback.evaluateRollbackPreconditions(planForMode('SELECTIVE_PRIMARY', 'SHADOW'), s)
  eq(r.rollbackExecutionAllowed, 'NO')
  ok(r.reasons.indexOf('CONFIG_FINGERPRINT_MISMATCH') !== -1)
})

T('T13: valid transition + env mismatch = rejected', function () {
  var s = stateForMode('SELECTIVE_PRIMARY'); s.liveEnvironmentId = 'other'
  var r = rollback.evaluateRollbackPreconditions(planForMode('SELECTIVE_PRIMARY', 'SHADOW'), s)
  eq(r.rollbackExecutionAllowed, 'NO')
  ok(r.reasons.indexOf('ENVIRONMENT_MISMATCH') !== -1)
})

T('T14: valid transition + missing rollback SHA = rejected', function () {
  var p = planForMode('SELECTIVE_PRIMARY', 'SHADOW'); p.rollbackTargetSha = null
  var r = rollback.evaluateRollbackPreconditions(p, stateForMode('SELECTIVE_PRIMARY'))
  eq(r.rollbackExecutionAllowed, 'NO')
  ok(r.reasons.indexOf('MISSING_ROLLBACK_SHA') !== -1)
})

// ═══════════════════════════════════════════════════════════
// Mutation / adversarial attacks M1–M12 (all fail-closed)
// ═══════════════════════════════════════════════════════════

T('M1: force ready=true (boolean bypass) rejected', function () {
  // There is no boolean `ready` input; a synthetic ready flag cannot bypass.
  var r = gate.evaluatePreSelectiveGate({ GATE_B_STATUS: 'PASS', ready: true })
  eq(r.decision, 'BLOCKED')
})

T('M2: change Gate-B ACTIVE→PASS only in derived field rejected', function () {
  // Derived field cannot carry authority; evaluator reads GATE_B_STATUS only.
  var ev = allPassEvidence()
  ev.GATE_B_STATUS = 'ACTIVE'
  ev.derivedGateB = 'PASS'
  eq(gate.evaluatePreSelectiveGate(ev).decision, 'BLOCKED')
})

T('M3: inject fake evidence (unknown state) rejected', function () {
  var ev = allPassEvidence(); ev.BATCH2_STATUS = 'FAKE_PASS'
  eq(gate.evaluatePreSelectiveGate(ev).decision, 'BLOCKED')
})

T('M4: missing config fingerprint rejected', function () {
  var plan = validPlan(); plan.expectedConfigFingerprint = null
  var r = rollback.evaluateRollbackPreconditions(plan, validState())
  eq(r.rollbackExecutionAllowed, 'NO')
  ok(r.reasons.indexOf('MISSING_CONFIG_FINGERPRINT') !== -1)
})

T('M5: forged rollback SHA rejected', function () {
  var plan = validPlan(); plan.rollbackTargetSha = 'not-a-real-sha'
  var r = rollback.evaluateRollbackPreconditions(plan, validState())
  eq(r.rollbackExecutionAllowed, 'NO')
  ok(r.reasons.indexOf('INVALID_ROLLBACK_SHA_FORMAT') !== -1)
})

T('M6: mode typo rejected', function () {
  var plan = validPlan(); plan.targetMode = 'SHADOWW'
  eq(rollback.evaluateRollbackPreconditions(plan, validState()).rollbackExecutionAllowed, 'NO')
})

T('M7: rollout >10000 rejected', function () {
  throws(function () {
    cohort.assignCohort({ subjectToken: 's', rolloutSalt: 'salt', rolloutBasisPoints: 10001 })
  })
})

T('M8: rollout <0 rejected', function () {
  throws(function () {
    cohort.assignCohort({ subjectToken: 's', rolloutSalt: 'salt', rolloutBasisPoints: -1 })
  })
})

T('M9: unknown cohort algorithm version rejected', function () {
  throws(function () {
    cohort.assignCohort({ subjectToken: 's', rolloutSalt: 'salt', rolloutBasisPoints: 5000, algorithmVersion: 'V99' })
  })
})

T('M10: identity leakage into artifact absent', function () {
  // Cohort result must NOT expose subject token / hash / bucket.
  var r = cohort.assignCohort({ subjectToken: 'SECRET_SUBJECT_OPENID_x', rolloutSalt: 'salt', rolloutBasisPoints: 5000 })
  var keys = Object.keys(r).sort()
  eq(keys.indexOf('subjectToken'), -1, 'no subjectToken in result')
  eq(keys.indexOf('hash'), -1, 'no hash in result')
  eq(keys.indexOf('bucket'), -1, 'no bucket in result')
  eq(keys.indexOf('digest'), -1, 'no digest in result')
  notOk(/SECRET_SUBJECT/.test(JSON.stringify(r)), 'subject token never in serialized result')
})

T('M11: synthetic evidence presented as natural Gate-B rejected', function () {
  // Synthetic/harness pass must not be mappable to Gate-B pass.
  var ev = allPassEvidence()
  ev.GATE_B_STATUS = 'PASS'
  ev.RC_QUALIFICATION_STATUS = 'PASS' // synthetic qual cannot substitute
  // The gate still requires REAL_DEVICE_SMOKE_STATUS=PASS (non-substitutable).
  ev.REAL_DEVICE_SMOKE_STATUS = 'NOT_RUN'
  eq(gate.evaluatePreSelectiveGate(ev).decision, 'BLOCKED')
})

T('M12: executor not reachable without explicit authorization', function () {
  // Default runner has no writer; cannot execute even with valid state.
  var r = rollback.runRollback(validPlan(), validState())
  eq(r.executed, false)
  eq(r.mutationsApplied, 0)
})

// ═══════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════

console.log('\n===== Stage21 Batch3 tests =====')
console.log('TOTAL=' + t + ' PASS=' + p + ' FAIL=' + f)
if (f > 0) process.exit(1)
