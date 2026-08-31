/**
 * tools/rc83-stage21-batch4/lib/smokeProtocol.js
 *
 * W11 — Real-Device Minimum Smoke Protocol (machine-readable).
 *
 * Defines the MINIMUM release-gate smoke protocol for the RC8.3 candidate on a
 * REAL WeChat device in a REAL identity context. This module builds the
 * protocol object ONLY — it NEVER executes smoke. No raw OPENID is stored.
 *
 * It explicitly does NOT fabricate Tier-0 contracts (cognitiveArchetype /
 * worldStrategy / scenarioSimulation) that are not present in the canonical
 * V2.1 contract.
 */

'use strict'

var PROTOCOL_VERSION = '1.0.0'

var ALLOWED_RESULT_STATES = ['PASS', 'FAIL', 'NOT_RUN', 'BLOCKED', 'NOT_APPLICABLE']

// Minimum real-device smoke count: release minimum vs statistical confidence.
var MINIMUM_REAL_DEVICE_SMOKE_COUNT = 1
var RELEASE_RECOMMENDED_SMOKE_COUNT = 3

// S1..S12 — minimum smoke scope. Each step carries: id, description, resultState,
// evidenceFields (what to capture WITHOUT raw OPENID), stopOnFail.
var REQUIRED_STEPS = [
  { id: 'S1', name: 'APP_OPENS', description: 'Mini-program opens on real WeChat runtime without crash', resultState: 'NOT_RUN', evidenceFields: ['appId', 'runtimeVersion', 'launchOk'], stopOnFail: true },
  { id: 'S2', name: 'DIAGNOSTIC_ENTRY_REACHABLE', description: 'Diagnostic entry is reachable from home/navigation', resultState: 'NOT_RUN', evidenceFields: ['entryPath', 'reachable'], stopOnFail: true },
  { id: 'S3', name: 'QUESTIONNAIRE_COMPLETES', description: '18Q V2.1 questionnaire completes end-to-end on device', resultState: 'NOT_RUN', evidenceFields: ['questionCount', 'completedCount'], stopOnFail: true },
  { id: 'S4', name: 'REQUEST_PAYLOAD_SHAPE', description: 'Request payload shape matches V2.1 contract (diagnosticVersion present)', resultState: 'NOT_RUN', evidenceFields: ['payloadShapeValid', 'diagnosticVersionPresent'], stopOnFail: true },
  { id: 'S5', name: 'V21_SHADOW_INVOCATION', description: 'V2.1 SHADOW invocation succeeds (no PRIMARY)', resultState: 'NOT_RUN', evidenceFields: ['invokeOk', 'mode', 'expectedMode'], stopOnFail: true },
  { id: 'S6', name: 'RESPONSE_VALIDITY_RETURNED', description: 'responseValidity is returned by the shadow path', resultState: 'NOT_RUN', evidenceFields: ['responseValidityPresent', 'verdict'], stopOnFail: true },
  { id: 'S7', name: 'NO_UNEXPECTED_V21_DIAGNOSIS_LEAK', description: 'No unexpected user-visible V2.1 diagnosis content leaks (shadow-only)', resultState: 'NOT_RUN', evidenceFields: ['leakObserved', 'allowedContentOnly'], stopOnFail: true },
  { id: 'S8', name: 'REPORT_PAGE_RENDERS_ALLOWED_CONTENT', description: 'Report page renders expected allowed content', resultState: 'NOT_RUN', evidenceFields: ['rendered', 'allowedContentOnly'], stopOnFail: true },
  { id: 'S9', name: 'HISTORY_REPORT_PERSISTENCE', description: 'History/report persistence + readback path works (only if current product behavior)', resultState: 'NOT_APPLICABLE', evidenceFields: ['readbackOk'], stopOnFail: false },
  { id: 'S10', name: 'SHARE_POSTER_ENTRY', description: 'Share/poster entry does not crash (only if currently supported)', resultState: 'NOT_APPLICABLE', evidenceFields: ['entryOk'], stopOnFail: false },
  { id: 'S11', name: 'FALLBACK_PATH_NO_CRASH', description: 'Fallback path does not crash (only where safely triggerable)', resultState: 'NOT_APPLICABLE', evidenceFields: ['fallbackOk'], stopOnFail: false },
  { id: 'S12', name: 'LEGACY_BUSINESS_ENTRY_REACHABLE', description: 'Legacy business-critical entry remains reachable', resultState: 'NOT_RUN', evidenceFields: ['entryReachable'], stopOnFail: true },
]

// STOP conditions: any of these -> SMOKE_RESULT = FAIL/BLOCKED (never "force pass").
var STOP_CONDITIONS = [
  'UNEXPECTED_USER_VISIBLE_SHADOW_CONTENT',
  'RUNTIME_CRASH',
  'WRONG_DIAGNOSTIC_VERSION',
  'WRONG_ENVIRONMENT',
  'UNEXPECTED_DB_WRITE_SHAPE',
  'IDENTITY_LEAKAGE',
  'PRIMARY_MODE_OBSERVED',
  'SELECTIVE_PRIMARY_MODE_OBSERVED',
  'CANDIDATE_SHA_MISMATCH',
]

// Field that must NOT appear in any smoke evidence/artifact.
var FORBIDDEN_IDENTITY_FIELDS = ['OPENID', 'openid', 'unionid', 'phone', 'nickname', 'avatar', 'fullAuthToken']

function buildRealDeviceSmokeProtocol(opts) {
  opts = opts || {}
  return {
    artifactType: 'REAL_DEVICE_SMOKE_PROTOCOL',
    protocolVersion: PROTOCOL_VERSION,
    candidateSha: opts.candidateSha || '',
    appId: opts.appId || 'NOT_PROVIDED', // never a secret
    environmentId: opts.environmentId || 'NOT_PROVIDED',
    requiredSteps: REQUIRED_STEPS.map(function (s) { return Object.assign({}, s) }),
    allowedResultStates: ALLOWED_RESULT_STATES.slice(),
    evidenceFields: ['stepId', 'resultState', 'observedMode', 'diagnosticVersion', 'timestampsOmitted'],
    exclusionFromGateB: true,
    releaseSmokeEvidence: true,
    minimumRealDeviceSmokeCount: MINIMUM_REAL_DEVICE_SMOKE_COUNT,
    releaseRecommendedSmokeCount: RELEASE_RECOMMENDED_SMOKE_COUNT,
    stopConditions: STOP_CONDITIONS.slice(),
    forbiddenIdentityFields: FORBIDDEN_IDENTITY_FIELDS.slice(),
    deviceRequirement: {
      realWechatRuntime: true,
      realDevice: true,
      realOpenidContext: true,
      preflightAllowed: ['tcb fn invoke (preflight only)', 'local mock', 'synthetic harness'],
      preflightNotCountedAsRealDeviceSmoke: true,
    },
    resultStateRules: {
      NOT_RUN_CANNOT_BECOME_PASS: true,
      BLOCKED_CANNOT_BECOME_PASS: true,
    },
    expectedProductWriteDeclared: false, // implementation phase must NOT create production writes
    unexpectedWriteSeparateFromExpectedWrite: true,
    fabricatedTier0Contracts: false,
    tier0ExcludedFields: [],
  }
}

module.exports = {
  PROTOCOL_VERSION: PROTOCOL_VERSION,
  ALLOWED_RESULT_STATES: ALLOWED_RESULT_STATES,
  MINIMUM_REAL_DEVICE_SMOKE_COUNT: MINIMUM_REAL_DEVICE_SMOKE_COUNT,
  RELEASE_RECOMMENDED_SMOKE_COUNT: RELEASE_RECOMMENDED_SMOKE_COUNT,
  REQUIRED_STEPS: REQUIRED_STEPS,
  STOP_CONDITIONS: STOP_CONDITIONS,
  FORBIDDEN_IDENTITY_FIELDS: FORBIDDEN_IDENTITY_FIELDS,
  buildRealDeviceSmokeProtocol: buildRealDeviceSmokeProtocol,
}
