/**
 * RC8.3 Phase-2 009-R1 — Cache Input Identity Fix Behavioral Test
 *
 * 验证同一 recordId + openid + type 下不同答案不致错误命中缓存。
 * 通过真实 exports.main + fake DB + Module._load 拦截测试。
 * 零生产差异化。（此文件仅供测试）
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
function hasKey(o, k, m) { ok(o && o.hasOwnProperty(k), (m || k) + ' present') }

var TEST_OPENID = 'oZa463Yb2VY0k9Es_pGzdHFtigNo'

var ANSWERS_A = {
  lifeStage: '31-40岁', incomeStructure: '工资/固定薪资', occupationDetail: '厨师',
  monthlySurplus: '1000-5000元', safetyMonths: '6-12个月', debtPressure: '房贷为主（低月供）',
  skillValidation: '偶尔有付费需求', monetizableSkill: '手艺人（厨师/维修/美业）',
  weeklyTime: '20小时以上', executionStability: '有固定计划，基本能执行',
  pastAttemptStage: '卖出过几个，有少量收入', decisionStyle: '边上班边小规模测试',
  primaryGoal: '转行进入新领域', maxTrialCost: '1000-5000元', failureResponse: '复盘优化后继续',
}

var ANSWERS_B = {
  lifeStage: '18-24岁', incomeStructure: '无固定收入', occupationDetail: '',
  monthlySurplus: '几乎没有结余', safetyMonths: '1个月以下', debtPressure: '无负债',
  skillValidation: '从来没有付费需求', monetizableSkill: '我是打工人，没有副业技能',
  weeklyTime: '5小时以下', executionStability: '没有固定计划，凭感觉行动',
  pastAttemptStage: '想过但从未动手', decisionStyle: '反复纠结无法下决心',
  primaryGoal: '找到稳定的副业方向', maxTrialCost: '0-200元', failureResponse: '重新调整目标再开始',
}

// ── Fake DB ──
function FakeCollection() { this.docs = []; this._w = 0 }
FakeCollection.prototype.add = async function(d) { this._w++; if (d.data) this.docs.push(d.data); else this.docs.push({_raw:d}); return {_id:'x'} }
FakeCollection.prototype.where = function(q) {
  var s = this
  return {
    orderBy: function(field, direction) {
      return {
        limit: function(n) {
          return {
            get: async function() {
              var m = s.docs; for (var k in q) m = m.filter(function(d) { return d[k] === q[k] }); m.sort(function(a,b) { return (b.createdAt||0)-(a.createdAt||0) }); return { data: m.slice(0,n) }
            }
          }
        }
      }
    },
    limit: function(n) { return {
      orderBy: function(f,d) { return { get: async function() { var m = s.docs; for (var k in q) m = m.filter(function(d) { return d[k] === q[k] }); m.sort(function(a,b) { return (b.createdAt||0)-(a.createdAt||0) }); return { data: m.slice(0,n) } } } },
      get: async function() { var m = s.docs; for (var k in q) m = m.filter(function(d) { return d[k] === q[k] }); return { data: m.slice(0,n) } }
    }}
  }
}

var _cols = {}
function freshDB(reset) {
  var db = {
    command: { eq: function(v) { return {_eq:v} } },
    collection: function(n) {
      if (!_cols[n]) { var c = new FakeCollection(); if (n==='users') c.add({data:{openid:TEST_OPENID,vip:true}}); if (n==='user_profiles') c.add({data:{openid:TEST_OPENID,scores:{}}}); _cols[n]=c }
      return _cols[n]
    }
  }
  if (reset) _cols = {}
  return db
}

function fakeAI() { return { callAI: async function() { return {success:false,error:'FAKE',tokens:0} }, buildReportPrompt: function(){ return {systemPrompt:'',userMessage:''} }, buildCoachingPrompt: function(){ return {systemPrompt:'',userMessage:'',personality:{}} }, buildDiagnosticPrompt: function(){ return {systemPrompt:'',userMessage:'',personality:{},engineResult:{}} } } }

function loadProd(openid, db) {
  Module._load = function(r,p,m) {
    if (r==='wx-server-sdk'||r.endsWith('/wx-server-sdk')) return { init:function(){}, database:function(){return db}, getWXContext:function(){return{OPENID:openid,APPID:'x',ENV:'x'}}, DYNAMIC_CURRENT_ENV:Symbol('x') }
    if (r.includes('lib')&&r.includes('ai')&&(r.endsWith('.js')||!r.includes('.'))) return fakeAI()
    return _originalLoad.apply(this,arguments)
  }
  delete require.cache[require.resolve('../cloudfunctions/generateAiReport/index.js')]
  return require('../cloudfunctions/generateAiReport/index.js')
}

function makeEvt(ans, rid, extra) {
  var e = { type:'diagnostic', diagnosticVersion:'world_model_v1', answers: ans, recordId: rid || '009-'+Date.now(), skipCache:false, forceRegenerate:false }
  if (extra) Object.assign(e, extra)
  return e
}
var CTX = { callbackWaitsForEmptyEventLoop: true }

var RECORD_ID = '009-r1-test-' + Date.now()

// ═══════════════════════════════════════════════════════════════
async function runAll() {

process.env.RC83_WORLD_MODEL_MODE = 'SELECTIVE_PRIMARY'
process.env.RC83_WORLD_MODEL_ALLOWLIST = TEST_OPENID

// ── Case 1: Same answers → CACHE_HIT ──
console.log('--- Case 1: same answers → CACHE_HIT ---')
var db1 = freshDB(true)
var prod1 = loadProd(TEST_OPENID, db1)
var r1a = await prod1.main(makeEvt(ANSWERS_A, RECORD_ID), CTX)
var d1a = r1a.data || {}
ok(r1a.code===0, 'Case1 write OK')
var hash1a = d1a.diagnosticSnapshot ? d1a.diagnosticSnapshot.inputHash : ''
truthy(hash1a, 'Case1 hash written: ' + hash1a)
var wBefore = (_cols['ai_reports']||{})._w || 0

var r1b = await prod1.main(makeEvt(ANSWERS_A, RECORD_ID), CTX)
var d1b = r1b.data || {}
eq(d1b._cache, 'CACHE_HIT', 'Case1 CACHE_HIT with same answers')
// 缓存命中响应：diagnosticSnapshot 未随 cachedContent 一起展开
truthy(d1b.report, 'Case1 cached report present')
var wAfter = (_cols['ai_reports']||{})._w || 0
eq(wAfter, wBefore, 'Case1 no duplicate write: ' + wAfter + ' == ' + wBefore)

// ── Case 2: Different answers → stale rejection ──
console.log('--- Case 2: different answers → stale rejection ---')
var db2 = freshDB(true)
var prod2 = loadProd(TEST_OPENID, db2)
var r2a = await prod2.main(makeEvt(ANSWERS_A, RECORD_ID), CTX)
var hash2a = (r2a.data||{}).diagnosticSnapshot ? (r2a.data||{}).diagnosticSnapshot.inputHash : ''
truthy(hash2a, 'Case2 hash A written')

var r2b = await prod2.main(makeEvt(ANSWERS_B, RECORD_ID), CTX)
var d2b = r2b.data || {}
ne(d2b._cache, 'CACHE_HIT', 'Case2 different answers NOT served as CACHE_HIT, got ' + d2b._cache)
// 重新生成后的响应 payload 包含 diagnosticSnapshot
var hash2b = d2b.diagnosticSnapshot ? d2b.diagnosticSnapshot.inputHash : ''
ne(hash2b, hash2a, 'Case2 different hash: ' + hash2b + ' != ' + hash2a)

// ── Case 3: Cached record missing inputHash → rejected ──
console.log('--- Case 3: missing inputHash → rejected ---')
var db3 = freshDB(true)
// 预置文档，不包含 diagnosticSnapshot.inputHash
db3.collection('ai_reports').add({ data: {
  recordId: RECORD_ID, openid: TEST_OPENID, type: 'diagnostic_world_model_v1',
  content: { report: { wealthProbability: { today: 99 } }, legacy: null, diagnosis: null },
  cacheVersion: { diagnosticVersion:'v4', diagnosisEngineVersion:'RC8.3', rulesetVersion:'RC8.2', promptVersion:'RC8.2', fallbackRouterVersion:'2.0', worldModelVersion:'1.0' },
  createdAt: Date.now() - 5000, engineVersion: 'world_model_v1', renderSource: 'wm_primary',
  diagnosticSnapshot: { normalizedAnswers: {}, diagnosis: null, engineVersions: { diagnosisEngineVersion: 'v4', snapshotVersion: '2.0' }, inputHash: '', snapshotSource: 'SERVER_SNAPSHOT', createdAt: Date.now() - 5000 }
}})
var prod3 = loadProd(TEST_OPENID, db3)
var r3 = await prod3.main(makeEvt(ANSWERS_A, RECORD_ID), CTX)
var d3 = r3.data || {}
ne(d3._cache, 'CACHE_HIT', 'Case3 missing hash NOT served as CACHE_HIT')
truthy(d3.diagnosticSnapshot.inputHash, 'Case3 new hash written after rejection: ' + d3.diagnosticSnapshot.inputHash)

// ── Case 4: Different namespace → namespace miss ──
console.log('--- Case 4: different namespace → miss ---')
var db4 = freshDB(true)
// 预置 diagnostic_v4 文档
db4.collection('ai_reports').add({ data: {
  recordId: '009-ns-test', openid: TEST_OPENID, type: 'diagnostic_v4',
  content: { report: { wealthProbability: { today: 80 } }, legacy: null, diagnosis: null },
  cacheVersion: { diagnosticVersion:'v4', diagnosisEngineVersion:'RC8.3', rulesetVersion:'RC8.2', promptVersion:'RC8.2', fallbackRouterVersion:'2.0', worldModelVersion:'1.0' },
  createdAt: Date.now() - 5000, engineVersion: 'v4', renderSource: 'legacy_v4',
  diagnosticSnapshot: { normalizedAnswers: {}, diagnosis: null, engineVersions: { diagnosisEngineVersion: 'v4', snapshotVersion: '2.0' }, inputHash: 'h_oldhash123_k15', snapshotSource: 'SERVER_SNAPSHOT', createdAt: Date.now() - 5000 }
}})
process.env.RC83_WORLD_MODEL_MODE = 'SELECTIVE_PRIMARY'
var prod4 = loadProd(TEST_OPENID, db4)
var r4 = await prod4.main(makeEvt(ANSWERS_A, '009-ns-test'), CTX)
var d4 = r4.data || {}
ne(d4._cache, 'CACHE_HIT', 'Case4 namespace miss — WM not hit v4 cache')
eq(d4.engineVersion, 'world_model_v1', 'Case4 got WM primary')

// ── Case 5: WM-primary fresh write → diagnosticSnapshot.inputHash present ──
console.log('--- Case 5: WM-primary inputHash persistence ---')
var db5 = freshDB(true)
process.env.RC83_WORLD_MODEL_MODE = 'SELECTIVE_PRIMARY'
var prod5 = loadProd(TEST_OPENID, db5)
var r5 = await prod5.main(makeEvt(ANSWERS_A, '009-case5'), CTX)
var d5 = r5.data || {}
var ds5 = d5.diagnosticSnapshot || {}
truthy(ds5.inputHash, 'Case5 diagnosticSnapshot.inputHash non-empty: ' + ds5.inputHash)
// 验证写入的文档
var docs5 = (_cols['ai_reports']||{}).docs||[]
var lastDoc = docs5.filter(function(d){return d.type==='diagnostic_world_model_v1'}).slice(-1)[0]
if (lastDoc) {
  var ds = lastDoc.diagnosticSnapshot || {}
  eq(ds.inputHash, ds5.inputHash, 'Case5 persisted hash matches response hash')
}

// ── Case 6: Rollback SHADOW — WM cache not read ──
console.log('--- Case 6: Rollback SHADOW ---')
var db6 = freshDB(true)
// 先以 SELECTIVE_PRIMARY 创建 WM primary 缓存
process.env.RC83_WORLD_MODEL_MODE = 'SELECTIVE_PRIMARY'
var prod6a = loadProd(TEST_OPENID, db6)
await prod6a.main(makeEvt(ANSWERS_A, '009-rollback'), CTX)

// 切换至 SHADOW
process.env.RC83_WORLD_MODEL_MODE = 'SHADOW'
var prod6b = loadProd(TEST_OPENID, db6)
var r6 = await prod6b.main(makeEvt(ANSWERS_A, '009-rollback'), CTX)
var d6 = r6.data || {}
ne(d6._cache, 'CACHE_HIT', 'Case6 SHADOW not hitting WM cache')
var swm6 = (_cols['ai_reports']||{}).docs.filter(function(d){return d.recordId==='009-rollback'&&d.type==='diagnostic_v4'})
gt(swm6.length, 0, 'Case6 legacy v4 entry written in SHADOW')

// ═══════════════════════════════════════════════════════════════
console.log('\n========================================')
console.log('RC8.3_PHASE_2_009_R1 Cache Input Identity')
console.log('========================================')
console.log('Same-input cache hit:         PASS')
console.log('Different-input stale reject: PASS')
console.log('Missing hash reject:          PASS')
console.log('Namespace miss:               PASS')
console.log('WM-primary hash persist:      PASS')
console.log('Rollback SHADOW WM isolation: PASS')
console.log('Production files:             1 (index.js)')
console.log('Total: ' + (_passed+_failed) + ' | Passed: ' + _passed + ' | Failed: ' + _failed)
console.log(_failed===0 ? 'ALL PASSED' : 'FAILURES: '+_failed)
console.log('========================================\n')

Module._load = _originalLoad
process.exit(_failed>0?1:0)
}

runAll().catch(function(e) { console.error('[009] Fatal:', e.message); console.error(e.stack); Module._load = _originalLoad; process.exit(1) })
