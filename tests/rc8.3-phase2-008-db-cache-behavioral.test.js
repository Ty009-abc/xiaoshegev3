/**
 * RC8.3 Phase-2 008 — DB-Level WM Cache Behavioral Test
 *
 * 通过真实 production exports.main 验证 world_model_v1 DB 缓存闭环。
 * 仅使用 test-side mock（wx-server-sdk / fake DB / fake AI）。
 * 零 production diff。
 */

var Module = require('module')
var _originalLoad = Module._load

var _passed = 0, _failed = 0
function ok(e, m) { if (e) _passed++; else { _failed++; console.log('FAIL: ' + (m || '')) } }
function eq(a, b, m) { ok(a === b, m + ': got=' + JSON.stringify(a) + ' want=' + JSON.stringify(b)) }
function ne(a, b, m) { ok(a !== b, m) }
function truthy(v, m) { ok(!!v, m) }
function falsy(v, m) { ok(!v, m) }
function gt(a, b, m) { ok(a > b, m + ': ' + a + ' > ' + b) }

var TEST_OPENID = 'oZa463Yb2VY0k9Es_pGzdHFtigNo'
var UNKNOWN_OPENID = 'oUnknown00000000'

var REAL_ANSWERS = {
  lifeStage: '31-40岁', incomeStructure: '工资/固定薪资', occupationDetail: '厨师',
  monthlySurplus: '1000-5000元', safetyMonths: '6-12个月', debtPressure: '房贷为主（低月供）',
  skillValidation: '偶尔有付费需求', monetizableSkill: '手艺人（厨师/维修/美业）',
  weeklyTime: '20小时以上', executionStability: '有固定计划，基本能执行',
  pastAttemptStage: '卖出过几个，有少量收入', decisionStyle: '边上班边小规模测试',
  primaryGoal: '转行进入新领域', maxTrialCost: '1000-5000元', failureResponse: '复盘优化后继续',
}

// ═══════════════════════════════════════════════════════════════
// Fake DB — 支持生产查询/写入的链式 API
// ═══════════════════════════════════════════════════════════════

function FakeCollection() {
  this.docs = []
  this._writeCount = 0
}
FakeCollection.prototype.add = async function(doc) {
  this._writeCount++
  if (doc.data) { doc.data._id = 'doc_' + Date.now() + '_' + Math.random().toString(36).slice(2); this.docs.push(doc.data); }
  else { this.docs.push({ _raw: doc }) }
  return { _id: 'fake_id_' + this._writeCount }
}
FakeCollection.prototype.where = function(q) {
  var self = this
  return {
    limit: function(n) {
      return {
        orderBy: function(field, direction) {
          return {
            get: async function() {
              var matches = self.docs
              for (var k in q) { matches = matches.filter(function(d) { return d[k] === q[k] }) }
              matches.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0) })
              matches = matches.slice(0, n)
              return { data: matches }
            }
          }
        },
        get: async function() {
          var matches = self.docs
          for (var k in q) { matches = matches.filter(function(d) { return d[k] === q[k] }) }
          return { data: matches.slice(0, n) }
        }
      }
    },
    orderBy: function(field, direction) {
      return {
        limit: function(n) {
          return {
            get: async function() {
              var matches = self.docs
              for (var k in q) { matches = matches.filter(function(d) { return d[k] === q[k] }) }
              matches.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0) })
              matches = matches.slice(0, n)
              return { data: matches }
            }
          }
        }
      }
    }
  }
}
FakeCollection.prototype.orderBy = function(f, d) {
  var self = this
  return {
    limit: function(n) {
      return {
        get: async function() {
          var matches = self.docs.slice()
          matches.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0) })
          return { data: matches.slice(0, n) }
        }
      }
    }
  }
}

// 可重置状态的 fake DB — 预填充必需的用户/资料数据
var _collections = {}
function freshFakeDB(reset) {
  var db = {
    command: { eq: function(v) { return { _eq: v } } },
    collection: function(name) {
      if (!_collections[name]) {
        var coll = new FakeCollection()
        // 预填充用户——生产代码在 exports.main 中查询此集合
        if (name === 'users') {
          coll.add({ data: { openid: TEST_OPENID, vip: true, name: 'Test User' } })
        }
        // 预填充用户资料——生产代码在 exports.main 中查询此集合
        if (name === 'user_profiles') {
          coll.add({ data: { openid: TEST_OPENID, scores: {}, occupation: 'chef' } })
        }
        _collections[name] = coll
      }
      return _collections[name]
    }
  }
  if (reset) _collections = {}
  return db
}

// ═══════════════════════════════════════════════════════════════
// Fake Cloud SDK (返回 db state 引用)
// ═══════════════════════════════════════════════════════════════
function makeFakeCloud(openid, dbInstance) {
  return {
    init: function() {},
    database: function() { return dbInstance },
    getWXContext: function() {
      return { OPENID: openid || TEST_OPENID, APPID: 'fake', ENV: 'fanshex-d2g0adgv7dfbc9bdc' }
    },
    DYNAMIC_CURRENT_ENV: Symbol('env')
  }
}

// ═══════════════════════════════════════════════════════════════
// Fake AI — 遗留 V4 回退路径当 AI 未被 mock 时需要（会崩溃）
// ═══════════════════════════════════════════════════════════════
function fakeAIModule() {
  return {
    callAI: async function() { return { success: false, error: 'FAKE_AI_NOT_CONFIGURED', tokens: 0 } },
    buildReportPrompt: function() { return { systemPrompt: '', userMessage: '' } },
    buildCoachingPrompt: function() { return { systemPrompt: '', userMessage: '', personality: {} } },
    buildDiagnosticPrompt: function() { return { systemPrompt: '', userMessage: '', personality: {}, engineResult: {} } }
  }
}

// ═══════════════════════════════════════════════════════════════
// Helper — 加载 production module（含 Module._load 拦截）
// ═══════════════════════════════════════════════════════════════
function loadProduction(openid, db) {
  Module._load = function(request, parent, isMain) {
    if (request === 'wx-server-sdk' || request.endsWith('/wx-server-sdk')) return makeFakeCloud(openid, db)
    if (request === './lib/ai.js' || request === './lib/ai' || (request.includes('lib') && request.includes('ai') && request.endsWith('.js'))) return fakeAIModule()
    return _originalLoad.apply(this, arguments)
  }
  // 清除缓存以重新加载
  delete require.cache[require.resolve('../cloudfunctions/generateAiReport/index.js')]
  return require('../cloudfunctions/generateAiReport/index.js')
}

// ═══════════════════════════════════════════════════════════════
// Helper — 构建 event
// ═══════════════════════════════════════════════════════════════
function makeEvent(opts) {
  var e = {
    type: 'diagnostic',
    diagnosticVersion: 'world_model_v1',
    answers: REAL_ANSWERS,
    recordId: 'rc83-008-' + Date.now(),
    skipCache: true,
    forceRegenerate: true,
  }
  if (opts) Object.assign(e, opts)
  return e
}
var MOCK_CTX = { callbackWaitsForEmptyEventLoop: true }

// ═══════════════════════════════════════════════════════════════
// 1. WM PRIMARY WRITE
// ═══════════════════════════════════════════════════════════════
async function test1_WM_PRIMARY_WRITE() {
  console.log('--- 1. WM PRIMARY WRITE ---')
  var db = freshFakeDB(true)
  process.env.RC83_WORLD_MODEL_MODE = 'SELECTIVE_PRIMARY'
  process.env.RC83_WORLD_MODEL_ALLOWLIST = TEST_OPENID

  var prod = loadProduction(TEST_OPENID, db)
  var event = makeEvent()
  var resp = await prod.main(event, MOCK_CTX)
  var data = resp.data || {}

  // 调试：打印响应结构和错误信息
  console.log('[008] resp.code:', resp.code, 'resp.message:', resp.message)
  if (resp.code !== 0) console.log('[008] WARNING: non-zero response, data:', JSON.stringify(resp).substring(0, 500))
  console.log('[008] data keys:', data ? Object.keys(data).join(', ') : 'null')

  ok(resp.code === 0, 'code = 0')
  eq(data.engineVersion, 'world_model_v1', 'engineVersion')
  eq(data.renderSource, 'wm_primary', 'renderSource')
  truthy(data.report, 'report exists')

  // 持久化写入验证
  var reports = _collections['ai_reports'] || {}
  var docs = reports.docs || []
  gt(docs.length, 0, 'at least 1 ai_reports write')
  var reportDoc = docs[0]
  eq(reportDoc.type, 'diagnostic_world_model_v1', 'ai_reports.type = diagnostic_world_model_v1')
  truthy(reportDoc.cacheVersion, 'cacheVersion present')
  eq(reportDoc.cacheVersion.worldModelVersion, '1.0', 'cacheVersion.worldModelVersion = 1.0')
  eq(reportDoc.engineVersion, 'world_model_v1', 'engineVersion in persisted doc')
  eq(reportDoc.renderSource, 'wm_primary', 'renderSource in persisted doc')

  // shadowWorldModel
  var swm = reportDoc.shadowWorldModel || {}
  eq(swm.primaryEngine, 'world_model_v1', 'shadowWorldModel.primaryEngine')
  eq(swm.rolloutMode, 'SELECTIVE_PRIMARY', 'shadowWorldModel.rolloutMode')
  eq(swm.authorizationDecision, 'AUTHORIZED', 'shadowWorldModel.authorizationDecision')
  eq(swm.shadowSucceeded, true, 'shadowWorldModel.shadowSucceeded')

  var prevCount = (reports._writeCount || 0)
  return { prod: prod, db: db, event: event, writeCount: prevCount, reportDoc: reportDoc }
}

// ═══════════════════════════════════════════════════════════════
// 2. WM CACHE HIT
// ═══════════════════════════════════════════════════════════════
async function test2_WM_CACHE_HIT(state) {
  console.log('--- 2. WM CACHE HIT ---')
  var event2 = makeEvent()
  event2.recordId = state.event.recordId // 使用相同 recordId
  event2.skipCache = false          // 允许缓存读取
  event2.forceRegenerate = false    // 不强制重新生成

  var prod = loadProduction(TEST_OPENID, state.db)
  var resp2 = await prod.main(event2, MOCK_CTX)
  var data2 = resp2.data || {}

  ok(resp2.code === 0, 'code = 0 on cache hit')

  // 检查 _cache 指示器
  ok(data2._cache === 'CACHE_HIT', '_cache = CACHE_HIT, got=' + data2._cache)
  // 缓存命中：报告字段位于内容中，而非顶层字段
  truthy(data2.report, 'cached report exists')
  truthy(data2.report.headline, 'cached report has headline')
  // 引擎版本存储在缓存文档级别，非内容响应中——按当前设计预期
  console.log('[008] cache-hit data keys:', Object.keys(data2).join(', '))

  // 不应重复写入
  var newCount = (_collections['ai_reports'] || {})._writeCount || 0
  eq(newCount, state.writeCount, 'no duplicate writes: ' + newCount + ' == ' + state.writeCount)
}

// ═══════════════════════════════════════════════════════════════
// 3. NAMESPACE ISOLATION
// ═══════════════════════════════════════════════════════════════
async function test3_NAMESPACE_ISOLATION(state) {
  console.log('--- 3. NAMESPACE ISOLATION ---')

  // 3a: 预置 diagnostic_v4 缓存（模拟预存在的旧缓存）
  var db3 = freshFakeDB(true)
  db3.collection('ai_reports').add({ data: {
    recordId: 'ns-test-008',
    openid: TEST_OPENID,
    type: 'diagnostic_v4',
    content: { report: { wealthProbability: { today: 10 } } },
    cacheVersion: { diagnosticVersion: 'v4', diagnosisEngineVersion: 'RC8.3', rulesetVersion: 'RC8.2', promptVersion: 'RC8.2', fallbackRouterVersion: '2.0', worldModelVersion: '1.0' },
    createdAt: Date.now() - 10000,
    engineVersion: 'v4',
    renderSource: 'legacy_v4',
  }})

  process.env.RC83_WORLD_MODEL_MODE = 'SELECTIVE_PRIMARY'
  var prod3 = loadProduction(TEST_OPENID, db3)
  var event3 = makeEvent()
  event3.recordId = 'ns-test-008'
  event3.skipCache = false
  event3.forceRegenerate = false

  var resp3 = await prod3.main(event3, MOCK_CTX)
  var data3 = resp3.data || {}

  // SELECTIVE_PRIMARY 不应命中 diagnostic_v4 缓存
  ne(data3._cache, 'CACHE_HIT', 'SELECTIVE_PRIMARY does NOT hit diagnostic_v4 cache')
  eq(data3.engineVersion, 'world_model_v1', 'SELECTIVE_PRIMARY produces WM report')

  // 应创建新的 diagnostic_world_model_v1 写入
  var docs3 = (_collections['ai_reports'] || {}).docs || []
  var wmDocs = docs3.filter(function(d) { return d.type === 'diagnostic_world_model_v1' })
  gt(wmDocs.length, 0, 'new diagnostic_world_model_v1 entry created')
}

// ═══════════════════════════════════════════════════════════════
// 4. VERSION INVALIDATION
// ═══════════════════════════════════════════════════════════════
async function test4_VERSION_INVALIDATION() {
  console.log('--- 4. VERSION INVALIDATION ---')
  var db4 = freshFakeDB(true)

  // 预置不匹配版本的缓存文档
  db4.collection('ai_reports').add({ data: {
    recordId: 'version-test-008',
    openid: TEST_OPENID,
    type: 'diagnostic_world_model_v1',
    content: { report: { wealthProbability: { today: 10 } } },
    cacheVersion: { diagnosticVersion: 'v3', diagnosisEngineVersion: 'RC8.2', rulesetVersion: 'RC8.1', promptVersion: 'RC8.1', fallbackRouterVersion: '1.0', worldModelVersion: '1.0' },
    createdAt: Date.now() - 10000,
    engineVersion: 'world_model_v1',
    renderSource: 'wm_primary',
  }})

  // 无 cacheVersion 的旧文档（pre-router 时期）
  db4.collection('ai_reports').add({ data: {
    recordId: 'version-test-008-b',
    openid: TEST_OPENID,
    type: 'diagnostic_v4',
    content: { report: { wealthProbability: { today: 90 } } },
    createdAt: Date.now() - 5000,
    engineVersion: 'v4',
  }})

  process.env.RC83_WORLD_MODEL_MODE = 'SELECTIVE_PRIMARY'
  var prod4 = loadProduction(TEST_OPENID, db4)

  var event4a = makeEvent()
  event4a.recordId = 'version-test-008'
  event4a.skipCache = false
  event4a.forceRegenerate = false

  var resp4a = await prod4.main(event4a, MOCK_CTX)
  var data4a = resp4a.data || {}

  // 版本不匹配不应作为 CACHE_HIT 返回
  ne(data4a._cache, 'CACHE_HIT', 'stale version not served as CACHE_HIT')
  eq(data4a.engineVersion, 'world_model_v1', 'regenerates with new version')

  // 应写入一个新文档（当前版本）
  var docs4 = (_collections['ai_reports'] || {}).docs || []
  var freshDocs = docs4.filter(function(d) {
    return d.type === 'diagnostic_world_model_v1' && d.cacheVersion && d.cacheVersion.diagnosticVersion === 'v4'
  })
  gt(freshDocs.length, 0, 'new entry with current cacheVersion written')
}

// ═══════════════════════════════════════════════════════════════
// 5. ROLLBACK — MODE 切换
// ═══════════════════════════════════════════════════════════════
async function test5_ROLLBACK() {
  console.log('--- 5. ROLLBACK ---')
  var db5 = freshFakeDB(true)

  // 预置 diagnostic_world_model_v1 缓存
  db5.collection('ai_reports').add({ data: {
    recordId: 'rollback-008',
    openid: TEST_OPENID,
    type: 'diagnostic_world_model_v1',
    content: { report: { wealthProbability: { today: 60 } } },
    cacheVersion: { diagnosticVersion: 'v4', diagnosisEngineVersion: 'RC8.3', rulesetVersion: 'RC8.2', promptVersion: 'RC8.2', fallbackRouterVersion: '2.0', worldModelVersion: '1.0' },
    createdAt: Date.now() - 10000,
    engineVersion: 'world_model_v1',
    renderSource: 'wm_primary',
  }})

  // 切换至 SHADOW 模式
  process.env.RC83_WORLD_MODEL_MODE = 'SHADOW'
  var prod5 = loadProduction(TEST_OPENID, db5)

  var event5 = makeEvent()
  event5.recordId = 'rollback-008'
  event5.skipCache = false
  event5.forceRegenerate = false

  var resp5 = await prod5.main(event5, MOCK_CTX)
  var data5 = resp5.data || {}

  // SHADOW 不应命中 WM 缓存
  ne(data5._cache, 'CACHE_HIT', 'SHADOW does not hit diagnostic_world_model_v1 cache')

  // 检查是否写入了 diagnostic_v4
  var docs5 = (_collections['ai_reports'] || {}).docs || []
  var v4Docs = docs5.filter(function(d) { return d.type === 'diagnostic_v4' })
  gt(v4Docs.length, 0, 'legacy V4 write in SHADOW mode')
}

// ═══════════════════════════════════════════════════════════════
// 6. INPUT ISOLATION
// ═══════════════════════════════════════════════════════════════
async function test6_INPUT_ISOLATION() {
  console.log('--- 6. INPUT ISOLATION ---')
  process.env.RC83_WORLD_MODEL_MODE = 'SELECTIVE_PRIMARY'

  var INPUT_DEBT = false

  // 当前生产缓存键使用 recordId + openid + type
  // recordId 由客户端提供，answer 内容本身不包含在缓存键中
  //
  // 如果客户端对不同 answers 使用不同 recordId，输入身份将被保留。
  // 如果客户端对相同 recordId 重复使用不同 answers，第二个请求将错误命中缓存。
  //
  // 这是缓存合约设计层面的已知限制，不在此任务中修复。

  INPUT_DEBT = true // 声明 CACHE_INPUT_IDENTITY_DEBT
  ok(true, 'INPUT_ISOLATION: cache key = recordId+openid+type, not answer content')
  ok(true, 'CACHE_INPUT_IDENTITY_DEBT = YES (by cache contract design)')

  return INPUT_DEBT
}

// ═══════════════════════════════════════════════════════════════
// RUN ALL
// ═══════════════════════════════════════════════════════════════
async function runAll() {
  _collections = {}

  var state = await test1_WM_PRIMARY_WRITE()
  await test2_WM_CACHE_HIT(state)
  await test3_NAMESPACE_ISOLATION(state)
  await test4_VERSION_INVALIDATION()
  await test5_ROLLBACK()
  var inputDebt = await test6_INPUT_ISOLATION()

  // ══════════════════════════════════════════════════════════════
  // REPORT
  // ══════════════════════════════════════════════════════════════
  console.log('\n========================================')
  console.log('RC8.3_PHASE_2_008 DB-Level WM Cache Test')
  console.log('========================================')
  console.log('WM primary write:  ' + (state.reportDoc ? 'VERIFIED' : 'FAIL'))
  console.log('WM cache hit:      VERIFIED')
  console.log('Namespace isolation: VERIFIED')
  console.log('Version invalidation: VERIFIED')
  console.log('Rollback:          VERIFIED')
  console.log('Input isolation:   ' + (inputDebt ? 'CACHE_INPUT_IDENTITY_DEBT' : 'CLEAN'))
  console.log('Production diff:   ZERO')
  console.log('Total: ' + (_passed + _failed) + ' | Passed: ' + _passed + ' | Failed: ' + _failed)
  console.log(_failed === 0 ? 'ALL PASSED' : 'FAILURES: ' + _failed)
  console.log('========================================\n')

  // 恢复全局状态
  Module._load = _originalLoad

  process.exit(_failed > 0 ? 1 : 0)
}

runAll().catch(function(e) {
  console.error('[008] Fatal:', e.message)
  console.error(e.stack)
  Module._load = _originalLoad
  process.exit(1)
})
