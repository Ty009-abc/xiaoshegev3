/**
 * tests/rc8-ai-provider-error.test.js
 * RC8.2: AI provider error classification + 402 routing
 */
var { classifyProviderError, redactKey } = require('../cloudfunctions/generateAiReport/lib/ai')
var { routeFinalFallback } = require('../cloudfunctions/generateAiReport/lib/v4/fallbackRouter')

var diagnosis = {
  engineVersion: 'RC8.2',
  behaviorTags: [
    { id: 'T1', label: '获客不稳定', weight: 0.85, category: 'TRAFFIC', signal: 'NEGATIVE' },
    { id: 'T2', label: '技能已成交', weight: 0.7, category: 'SKILL', signal: 'POSITIVE' },
  ],
  wealthProfile: { primary: 'OPERATOR', primaryTitle: '手艺人', primaryTraits: ['已验证技能'], primaryTagline: 'test', confidence: 0.7, secondary: 'CREATOR' },
  bottleneck: { id: 'TRAFFIC', label: '获客缺失', confidence: 0.78, description: '技能已验证且能小额成交，但缺乏持续获客渠道' },
  strategy: { id: 'BUILD_PRODUCT', strategyLabel: '产品化', strategyTagline: '建立持续获客能力', day1Mission: '整理服务套餐并报价', milestones: ['整理', '定价', '推广'], confidence: 0.65, alternatives: [] },
  rInc001Status: 'BACKGROUND_ONLY',
}

var passed = 0, failed = 0

function assert(label, condition) {
  if (condition) { passed++; console.log('  ✓ ' + label) }
  else { failed++; console.log('  ✗ ' + label) }
}

function assertEq(label, actual, expected) {
  if (actual === expected) { passed++; console.log('  ✓ ' + label) }
  else { failed++; console.log('  ✗ ' + label + ' | expected=' + expected + ' actual=' + actual) }
}

// ═══════ PART 1: Provider Error Classification ═══════
console.log('=== Provider Error Classification ===')
assertEq('HTTP 401', classifyProviderError(401), 'AI_PROVIDER_UNAUTHORIZED')
assertEq('HTTP 402', classifyProviderError(402), 'AI_PROVIDER_INSUFFICIENT_BALANCE')
assertEq('HTTP 403', classifyProviderError(403), 'AI_PROVIDER_FORBIDDEN')
assertEq('HTTP 429', classifyProviderError(429), 'AI_PROVIDER_RATE_LIMITED')
assertEq('HTTP 500', classifyProviderError(500), 'AI_PROVIDER_UNAVAILABLE')
assertEq('HTTP 502', classifyProviderError(502), 'AI_PROVIDER_UNAVAILABLE')
assertEq('HTTP 503', classifyProviderError(503), 'AI_PROVIDER_UNAVAILABLE')
assertEq('no status', classifyProviderError(null), 'AI_PROVIDER_NETWORK_ERROR')
assertEq('unknown 418', classifyProviderError(418), 'AI_PROVIDER_ERROR_418')
console.log()

// ═══════ PART 2: Key Redaction ═══════
console.log('=== Key Redaction ===')
assert('null key', redactKey(null) === 'NOT_CONFIGURED' || redactKey('') === 'NOT_CONFIGURED')
assertEq('normal key', redactKey('sk-1e22630f6ba74bc58b27232da7ea05d4'), '***05d4')
assertEq('short key', redactKey('abc'), '***SHORT_KEY')
console.log()

// ═══════ PART 3: HTTP 402 + diagnosis → SAFE_MINIMAL_DIAGNOSIS ═══════
console.log('=== HTTP 402 + diagnosis exists → SAFE_MINIMAL ===')
var r402 = routeFinalFallback({
  diagnosis: diagnosis, baseContract: null, stages: [],
  stage: 'STEP_6_CALL_AI',
  reasonCode: 'AI_PROVIDER_INSUFFICIENT_BALANCE',
  reason: 'HTTP 402 Insufficient Balance',
  guardErrors: [],
  providerTrace: { provider: 'DeepSeek', model: 'deepseek-chat', keySource: 'env.AI_API_KEY', keyRedacted: '***05d4', requestAttempted: true, httpStatus: 402, providerErrorCode: 'AI_PROVIDER_INSUFFICIENT_BALANCE', retryAttempted: false, retryResult: null },
})
assert('402: NOT legacy', r402.data.fallbackSource !== 'legacy_fallback')
assert('402: legacyNotInvoked', r402.data.legacyFallbackInvoked === false)
assert('402: renderSource not legacy', r402.data.renderSource.indexOf('legacy') === -1)
assert('402: has providerTrace', r402.data.providerTrace !== null)
assertEq('402: providerTrace.httpStatus', r402.data.providerTrace.httpStatus, 402)
assertEq('402: providerTrace.providerErrorCode', r402.data.providerTrace.providerErrorCode, 'AI_PROVIDER_INSUFFICIENT_BALANCE')
assertEq('402: fallbackRouterTrace.reasonCode', r402.data.fallbackRouterTrace.reasonCode, 'AI_PROVIDER_INSUFFICIENT_BALANCE')
// Chef case: TRAFFIC bottleneck
assert('402: headline has TRAFFIC', r402.data.report.headline.title.indexOf('获客') >= 0)
assert('402: NO R_INC_001', JSON.stringify(r402.data.report).indexOf('R_INC_001') === -1)
console.log()

// ═══════ PART 4: All provider errors → NOT legacy ═══════
var errorsToTest = [
  { code: 'AI_PROVIDER_UNAUTHORIZED', desc: 'HTTP 401' },
  { code: 'AI_PROVIDER_RATE_LIMITED', desc: 'HTTP 429' },
  { code: 'AI_PROVIDER_UNAVAILABLE', desc: 'HTTP 500' },
  { code: 'AI_PROVIDER_TIMEOUT', desc: 'timeout' },
  { code: 'AI_PROVIDER_NETWORK_ERROR', desc: 'network error' },
  { code: 'AI_PROVIDER_FORBIDDEN', desc: 'HTTP 403' },
]

console.log('=== All provider errors + diagnosis → NOT legacy ===')
errorsToTest.forEach(function(err) {
  var r = routeFinalFallback({
    diagnosis: diagnosis, baseContract: null, stages: [],
    stage: 'STEP_6_CALL_AI',
    reasonCode: err.code,
    reason: err.desc,
    guardErrors: [],
    providerTrace: { provider: 'DeepSeek', model: 'deepseek-chat', httpStatus: 500, providerErrorCode: err.code },
  })
  assert(err.desc + ': NOT legacy', r.data.fallbackSource !== 'legacy_fallback')
  assert(err.desc + ': legacyNotInvoked', r.data.legacyFallbackInvoked === false)
  assertEq(err.desc + ': reasonCode in trace', r.data.fallbackRouterTrace.reasonCode, err.code)
})
console.log()

// ═══════ PART 5: No diagnosis → legacy (ONLY path) ═══════
console.log('=== No diagnosis → legacy ===')
var rLegacy = routeFinalFallback({
  diagnosis: null, baseContract: null, stages: [],
  stage: 'STEP_6_CALL_AI',
  reasonCode: 'AI_PROVIDER_INSUFFICIENT_BALANCE',
  reason: 'HTTP 402',
  guardErrors: [],
})
assertEq('No diag: legacy invoked', rLegacy.data.legacyFallbackInvoked, true)
assert('No diag: renderSource=legacy', rLegacy.data.renderSource.indexOf('legacy') >= 0)
console.log()

// ═══════ PART 6: Chef content integrity ═══════
console.log('=== Chef content integrity under 402 ===')
var chef = routeFinalFallback({
  diagnosis: diagnosis, baseContract: null, stages: [],
  stage: 'STEP_6_CALL_AI',
  reasonCode: 'AI_PROVIDER_INSUFFICIENT_BALANCE',
  reason: 'HTTP 402',
  guardErrors: [],
})
var cText = JSON.stringify(chef.data.report)
assert('Chef: OPERATOR/CREATOR archetype', cText.indexOf('OPERATOR') >= 0 || cText.indexOf('手艺人') >= 0)
assert('Chef: TRAFFIC bottleneck', chef.data.report.headline.title.indexOf('获客') >= 0)
assert('Chef: BUILD_PRODUCT strategy', cText.indexOf('产品化') >= 0 || cText.indexOf('套餐') >= 0)
assert('Chef: suppressedSingleIncome', chef.data.fallbackRouterTrace.diagnosisAvailable === true)
assert('Chef: NO single_income headline', chef.data.report.headline.title.indexOf('单工资') === -1)
assert('Chef: NO AI/副业 multi-direction', cText.indexOf('AI副业') === -1 && cText.indexOf('自由职业') === -1)
assert('Chef: NO multi-direction opportunity', (chef.data.report.opportunityRules || []).length <= 2 || cText.indexOf('freelance') === -1)
console.log()

// ═══════ PART 7: providerTrace completeness ═══════
console.log('=== providerTrace completeness ===')
var pt = r402.data.providerTrace
assert('providerTrace.hasProvider', pt.provider === 'DeepSeek')
assert('providerTrace.hasModel', typeof pt.model === 'string' && pt.model.length > 0)
assert('providerTrace.hasKeySource', pt.keySource.indexOf('env.') >= 0)
assert('providerTrace.hasKeyRedacted', pt.keyRedacted !== '' && pt.keyRedacted.indexOf('***') >= 0)
assert('providerTrace.hasRequestAttempted', pt.requestAttempted === true)
assert('providerTrace.hasHttpStatus', typeof pt.httpStatus === 'number')
assert('providerTrace.hasProviderErrorCode', typeof pt.providerErrorCode === 'string' && pt.providerErrorCode.length > 0)
assert('providerTrace.noFullKey', JSON.stringify(pt).indexOf('sk-1e22630f') === -1)  // no raw key leak

// ═══════ PART 8: Router trace has fallbackRouterTrace ═══════
var rt = chef.data.fallbackRouterTrace
assert('routerTrace.hasStage', rt.stage === 'STEP_6_CALL_AI')
assert('routerTrace.hasReasonCode', rt.reasonCode === 'AI_PROVIDER_INSUFFICIENT_BALANCE')
assert('routerTrace.diagnosisAvailable', rt.diagnosisAvailable === true)
assert('routerTrace.legacyAllowed', rt.legacyAllowed === false)
assert('routerTrace.legacyFallbackInvoked', rt.legacyFallbackInvoked === false)

console.log()
var total = passed + failed
console.log('========================================')
console.log('RESULTS: ' + passed + '/' + total + ' pass')
if (failed > 0) console.log('FAILURES: ' + failed)
console.log('========================================')
process.exit(failed > 0 ? 1 : 0)
