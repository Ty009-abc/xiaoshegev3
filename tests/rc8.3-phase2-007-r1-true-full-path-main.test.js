/**
 * RC8.3 Phase-2 007-R1 — True Full-Path Production Entry Test
 *
 * Invokes the REAL production exports.main() path with:
 * - Module._load interception for wx-server-sdk (test-side, not production)
 * - Fake CloudBase SDK (cloud, DB, auth)
 * - Fake AI provider when needed for fallback paths
 * - Real World Model pipeline, validator, adapter — never mocked
 *
 * No production code changes. Zero production diff.
 */

var Module = require('module')
var path = require('path')
var _originalLoad = Module._load

// -----------------------------------------------------------------
// Assertion helpers
// -----------------------------------------------------------------
var _passed = 0, _failed = 0
function ok(e, m) { if (e) _passed++; else { _failed++; console.log('FAIL: ' + (m || '')) } }
function eq(a, b, m) { ok(a === b, m + ': got=' + JSON.stringify(a) + ' want=' + JSON.stringify(b)) }
function ne(a, b, m) { ok(a !== b, m) }
function truthy(v, m) { ok(!!v, m) }
function falsy(v, m) { ok(!v, m) }
function hasKey(o, k, m) { ok(o && o.hasOwnProperty(k), (m || k) + ' present') }

// Test OPENID
var TEST_OPENID = 'oZa463Yb2VY0k9Es_pGzdHFtigNo'
var UNKNOWN_OPENID = 'oUnknown0000000000000000000000'
var TEST_ENV = 'fanshex-d2g0adgv7dfbc9bdc'

// Real V4 answers
var REAL_ANSWERS = {
  lifeStage: '31-40岁', incomeStructure: '工资/固定薪资', occupationDetail: '厨师',
  monthlySurplus: '1000-5000元', safetyMonths: '6-12个月', debtPressure: '房贷为主（低月供）',
  skillValidation: '偶尔有付费需求', monetizableSkill: '手艺人（厨师/维修/美业）',
  weeklyTime: '20小时以上', executionStability: '有固定计划，基本能执行',
  pastAttemptStage: '卖出过几个，有少量收入', decisionStyle: '边上班边小规模测试',
  primaryGoal: '转行进入新领域', maxTrialCost: '1000-5000元', failureResponse: '复盘优化后继续',
}

// -----------------------------------------------------------------
// Fake DB — capture writes
// -----------------------------------------------------------------
var dbWrites = { ai_reports: [], ai_logs: [] }
var fakeDb = {
  command: {
    eq: function(v) { return { _eq: v } },
    inc: function(v) { return { _inc: v } }
  },
  collection: function(name) {
    var self = this
    return {
      where: function(q) {
        return {
          limit: function(n) {
            return {
              get: async function() {
                if (name === 'users' && q && q.openid === TEST_OPENID) return { data: [{ openid: TEST_OPENID, vip: true }] }
                if (name === 'users' && q && q.openid === UNKNOWN_OPENID) return { data: [] }
                if (name === 'user_profiles') return { data: [{ scores: {} }] }
                if (name === 'challenge_records') return { data: [] }
                // Cache lookup for ai_reports
                if (name === 'ai_reports') {
                  return {
                    orderBy: function(f, d) {
                      return {
                        limit: function(n) {
                          return { get: async function() { return { data: [] } } }
                        }
                      }
                    }
                  }
                }
                return { data: [] }
              }
            }
          }
        }
      },
      add: async function(doc) {
        dbWrites[name] = dbWrites[name] || []
        dbWrites[name].push(doc)
        if (name === 'ai_reports' && doc.data) dbWrites[name + '_data'] = dbWrites[name + '_data'] || []
        if (name === 'ai_reports' && doc.data) dbWrites[name + '_data'].push(doc.data)
        return { _id: 'fake_' + Date.now() }
      },
      doc: function(id) {
        return {
          get: async function() { return { data: {} } },
          set: async function(d) { return {} },
          update: async function(d) { return {} }
        }
      }
    }
  }
}

// -----------------------------------------------------------------
// Fake Cloud SDK
// -----------------------------------------------------------------
function makeFakeCloud(openid) {
  return {
    init: function() {},
    database: function() { return fakeDb },
    getWXContext: function() {
      return { OPENID: openid || TEST_OPENID, APPID: 'fake_appid', ENV: TEST_ENV }
    },
    DYNAMIC_CURRENT_ENV: Symbol('dynamic_env')
  }
}

// -----------------------------------------------------------------
// Fake AI module — needed for fallback paths that call legacy V4
// -----------------------------------------------------------------
var aiCalls = []
function makeFakeAI() {
  return {
    callAI: async function(opts) {
      aiCalls.push(opts)
      return { success: false, error: 'AI_MOCKED_NOT_REACHED_IN_PRIMARY_PATH', tokens: 0 }
    },
    buildReportPrompt: function() { return { systemPrompt: '', userMessage: '' } },
    buildCoachingPrompt: function() { return { systemPrompt: '', userMessage: '', personality: {} } },
    buildDiagnosticPrompt: function() { return { systemPrompt: '', userMessage: '', personality: {}, engineResult: {} } }
  }
}

// -----------------------------------------------------------------
// Set up test environment
// -----------------------------------------------------------------
process.env.RC83_WORLD_MODEL_MODE = 'SELECTIVE_PRIMARY'
process.env.RC83_WORLD_MODEL_ALLOWLIST = TEST_OPENID

// -----------------------------------------------------------------
// Install Module._load interceptor (TOP of file, before any prod require)
// -----------------------------------------------------------------
Module._load = function(request, parent, isMain) {
  // Intercept wx-server-sdk
  if (request === 'wx-server-sdk' || request.endsWith('/wx-server-sdk')) {
    return makeFakeCloud()
  }

  // Intercept AI module (fallback paths call legacy V4)
  if (request === './lib/ai.js' || request === './lib/ai' ||
      (request.includes('lib') && request.includes('ai') && (request.endsWith('.js') || !request.includes('.')))) {
    return makeFakeAI()
  }

  return _originalLoad.apply(this, arguments)
}

// -----------------------------------------------------------------
// Now require the real production module
// -----------------------------------------------------------------
var prod = require('../cloudfunctions/generateAiReport/index.js')
if (prod && typeof prod.main === 'function') console.log('[007-R1] Production exports.main loaded successfully')
else { console.error('[007-R1] FAILED to load production module'); process.exit(1) }

// -----------------------------------------------------------------
// Build event for SELECTIVE_PRIMARY diagnostic request
// -----------------------------------------------------------------
function makeEvent(overrides) {
  var e = {
    type: 'diagnostic',
    diagnosticVersion: 'world_model_v1',
    answers: REAL_ANSWERS,
    recordId: 'rc83-007-r1-' + Date.now(),
    skipCache: true,
    forceRegenerate: true,
  }
  if (overrides) Object.assign(e, overrides)
  return e
}

var context = { callbackWaitsForEmptyEventLoop: true }

// ═══════════════════════════════════════════════════════════════
// Run all
// ═══════════════════════════════════════════════════════════════
async function runAll() {

// -----------------------------------------------------------------
// SUCCESS PATH: authorized + SELECTIVE_PRIMARY
// -----------------------------------------------------------------
console.log('=== SUCCESS PATH ===')
Module._load = function(request, parent, isMain) {
  if (request === 'wx-server-sdk' || request.endsWith('/wx-server-sdk')) return makeFakeCloud(TEST_OPENID)
  if (request === './lib/ai.js' || request === './lib/ai' || (request.includes('lib') && request.includes('ai') && request.endsWith('.js'))) return makeFakeAI()
  return _originalLoad.apply(this, arguments)
}

var prod1 = require('../cloudfunctions/generateAiReport/index.js')
dbWrites = { ai_reports: [], ai_logs: [], ai_reports_data: [] }
aiCalls = []

try {
  var response = await prod1.main(makeEvent(), context)
  console.log('[007-R1] SUCCESS response code:', response.code)
  console.log('[007-R1] SUCCESS response keys:', Object.keys(response.data || {}).join(', '))
} catch (e) {
  console.error('[007-R1] SUCCESS path threw:', e.message)
  ok(false, 'SUCCESS path threw: ' + e.message)
  process.exit(1)
}

var data = response.data || {}

// ── Authorization & routing ──
ok(response.code === 0, 'code = 0, got ' + response.code)

var shadowWM = dbWrites.ai_reports_data[0] ? dbWrites.ai_reports_data[0].shadowWorldModel : null
if (shadowWM) {
  console.log('[007-R1] shadowWorldModel persisted:', JSON.stringify(shadowWM))
  eq(shadowWM.authorizationDecision, 'AUTHORIZED', 'authorizationDecision')
  eq(shadowWM.effectiveEngine, 'world_model_v1', 'effectiveEngine')
  eq(shadowWM.rolloutMode, 'SELECTIVE_PRIMARY', 'rolloutMode')
  eq(shadowWM.primaryEngine, 'world_model_v1', 'primaryEngine')
  eq(shadowWM.shadowExecuted, true, 'shadowExecuted: true (shadow also executed within WM primary flow)')
}

// ── Response contract ──
var report = data.report || {}
eq(data.engineVersion, 'world_model_v1', 'engineVersion')
eq(data.renderSource, 'wm_primary', 'renderSource')
eq(data.diagnosticVersion, 'v4', 'diagnosticVersion')
eq(data.reportType, 'diagnostic_v4', 'reportType')

// diagnosis/worldModelDiagnosis are PERSISTED to DB content.diagnosis,
// not returned as top-level client response fields (observed gap)
var persistedDiag = dbWrites.ai_reports_data[0] ? (dbWrites.ai_reports_data[0].content || {}).diagnosis : null
truthy(persistedDiag, 'diagnosis persisted to DB')
if (persistedDiag) {
  eq(persistedDiag.version, 'world_model_v1', 'persisted diagnosis.version')
  truthy(persistedDiag.cognitiveArchetype, 'persisted cognitiveArchetype')
  truthy(persistedDiag.cognitiveBlindSpot, 'persisted cognitiveBlindSpot')
  truthy(persistedDiag.worldStrategy, 'persisted worldStrategy')
}

// diagnosticSnapshot contains diagnosis in response
var snapshot = data.diagnosticSnapshot || {}
truthy(snapshot.normalizedAnswers, 'diagnosticSnapshot with normalizedAnswers in response')
truthy(snapshot.engineVersions, 'diagnosticSnapshot.engineVersions in response')

// ── Report fields from adapter ──
hasKey(report, 'headline', 'headline')
hasKey(report, 'wealthStage', 'wealthStage')
hasKey(report, 'fatalDiagnosis', 'fatalDiagnosis')
hasKey(report, 'scoreCard', 'scoreCard')
hasKey(report, 'wealthProbability', 'wealthProbability')
hasKey(report, 'potentialIndex', 'potentialIndex')
hasKey(report, 'wealthPath', 'wealthPath')
hasKey(report, 'actionPlan', 'actionPlan')
hasKey(report, 'stopDoing', 'stopDoing')
hasKey(report, 'identityUpgrade', 'identityUpgrade')
hasKey(report, 'finalStrike', 'finalStrike')

// ── NOT old 7-field skeleton ──
var hasOldLabelAndEngine = report.label !== undefined && report.engine === 'world_model_v1'
falsy(hasOldLabelAndEngine, 'report is NOT old 7-field skeleton')

// ── Cache namespace ──
var reportType = dbWrites.ai_reports_data[0] ? dbWrites.ai_reports_data[0].type : null
eq(reportType, 'diagnostic_world_model_v1', 'cacheType write intent')

// ── AI not called (WM primary skips legacy V4) ──
ok(aiCalls.length === 0, 'AI NOT called (WM primary path)')

console.log('[007-R1] SUCCESS PATH: ' + (response.code === 0 ? 'PASSED' : 'FAILED'))

// -----------------------------------------------------------------
// UNAUTHORIZED FALLBACK
// -----------------------------------------------------------------
console.log('\n=== UNAUTHORIZED FALLBACK ===')
Module._load = function(request, parent, isMain) {
  if (request === 'wx-server-sdk' || request.endsWith('/wx-server-sdk')) return makeFakeCloud(UNKNOWN_OPENID)
  if (request === './lib/ai.js' || request === './lib/ai' || (request.includes('lib') && request.includes('ai') && request.endsWith('.js'))) return makeFakeAI()
  return _originalLoad.apply(this, arguments)
}

var prod2 = require('../cloudfunctions/generateAiReport/index.js')
dbWrites = { ai_reports: [], ai_logs: [], ai_reports_data: [] }
aiCalls = []

// Invalidate require cache to get fresh module with new mock
delete require.cache[require.resolve('../cloudfunctions/generateAiReport/index.js')]
var prod2fresh = require('../cloudfunctions/generateAiReport/index.js')

try {
  var unauthResp = await prod2fresh.main(makeEvent(), context)
  console.log('[007-R1] UNAUTHORIZED response code:', unauthResp.code)

  // Unauthorized user: user query returns empty → AUTH_FAILED before V4 branch
  eq(unauthResp.code, 10002, 'unauthorized returns AUTH_FAILED')
} catch (e) {
  console.log('[007-R1] UNAUTHORIZED threw:', e.message)
  ok(false, 'UNAUTHORIZED threw: ' + e.message)
}

// -----------------------------------------------------------------
// SHADOW FALLBACK: authorized + MODE=SHADOW
// -----------------------------------------------------------------
console.log('\n=== SHADOW FALLBACK ===')
var prevMode = process.env.RC83_WORLD_MODEL_MODE
process.env.RC83_WORLD_MODEL_MODE = 'SHADOW'

Module._load = function(request, parent, isMain) {
  if (request === 'wx-server-sdk' || request.endsWith('/wx-server-sdk')) return makeFakeCloud(TEST_OPENID)
  if (request === './lib/ai.js' || request === './lib/ai' || (request.includes('lib') && request.includes('ai') && request.endsWith('.js'))) return makeFakeAI()
  return _originalLoad.apply(this, arguments)
}

// Clear require cache
Object.keys(require.cache).forEach(function(k) { delete require.cache[k] })
var prod3 = require('../cloudfunctions/generateAiReport/index.js')
dbWrites = { ai_reports: [], ai_logs: [], ai_reports_data: [] }

try {
  var shadowResp = await prod3.main(makeEvent(), context)
  console.log('[007-R1] SHADOW response code:', shadowResp.code)

  // SHADOW should have shadowWorldModel with rolloutMode=SHADOW and primaryEngine=v4
  var sShadowWM = dbWrites.ai_reports_data[0] ? dbWrites.ai_reports_data[0].shadowWorldModel : null
  if (sShadowWM) {
    eq(sShadowWM.rolloutMode, 'SHADOW', 'SHADOW rolloutMode')
    eq(sShadowWM.primaryEngine, 'v4', 'SHADOW primaryEngine=v4')
    eq(sShadowWM.authorizationDecision, 'AUTHORIZED', 'SHADOW authorized')
    eq(sShadowWM.effectiveEngine, 'world_model_v1', 'SHADOW effectiveEngine')
  }

  // Cache is diagnostic_v4 in SHADOW mode
  var sType = dbWrites.ai_reports_data[0] ? dbWrites.ai_reports_data[0].type : null
  eq(sType, 'diagnostic_v4', 'SHADOW cacheType write: diagnostic_v4')
} catch (e) {
  console.log('[007-R1] SHADOW threw:', e.message)
  ok(false, 'SHADOW threw: ' + e.message)
}

process.env.RC83_WORLD_MODEL_MODE = prevMode

// -----------------------------------------------------------------
// WM failure fallback tests (pipeline/validator/adapter boundary)
// -----------------------------------------------------------------
console.log('\n=== WM FAILURE FALLBACK (boundary) ===')

// Test that invalid pipeline produces fallback
var { runWorldModelPipeline } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/worldModelPipeline')
var { validateWorldModelOutput } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/validators')
var { adaptWorldModelToLegacyDiagnosis } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/legacyDiagnosisAdapter')

// Invalid diagnosis → validator rejects
var nullCheck = validateWorldModelOutput(null)
falsy(nullCheck.valid, 'null diagnosis rejected by validator')
ok(nullCheck.errors && nullCheck.errors.length > 0, 'validator returns errors for invalid diagnosis')

// Adapter failure
var adapterResult = adaptWorldModelToLegacyDiagnosis(null)
eq(adapterResult.adapterError, 'INVALID_WORLD_MODEL_VERSION', 'adapter fails for null')
falsy(adapterResult.legacyDiagnosisAdapter, 'no legacy adapter on null input')

// Wrong version adapter failure
var wrongVer = adaptWorldModelToLegacyDiagnosis({ version: 'v3' })
eq(wrongVer.adapterError, 'INVALID_WORLD_MODEL_VERSION', 'adapter fails for wrong version')

// -----------------------------------------------------------------
// REPORT
// -----------------------------------------------------------------
console.log('\n========================================')
console.log('RC8.3_PHASE_2_007_R1 TRUE FULL-PATH MAIN TEST')
console.log('========================================')
console.log('Production entry invoked: YES (exports.main)')
console.log('wx-server-sdk: mocked test-side via Module._load')
console.log('Real production routing: YES')
console.log('Production routing reimplemented: NO')
console.log('Success path primaryEngine:', (shadowWM ? shadowWM.primaryEngine : '?') || '?')
console.log('Total: ' + (_passed + _failed) + ' | Passed: ' + _passed + ' | Failed: ' + _failed)
console.log(_failed === 0 ? 'ALL PASSED' : 'FAILURES: ' + _failed)
console.log('========================================\n')

// Restore original loader
Module._load = _originalLoad

process.exit(_failed > 0 ? 1 : 0)
}

runAll().catch(function(e) {
  console.error('[007-R1] Fatal:', e.message)
  console.error(e.stack)
  process.exit(1)
})
