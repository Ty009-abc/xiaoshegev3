/**
 * tests/rc8.3-stage21-batch4-r1-payment-authority.test.js
 *
 * Stage21 Batch4 R1 — PAYMENT_MOCK_AUTHORITY_GUARD 权威回归测试.
 *
 * 目标：证明 mock 支付结果永远不能进入 verifyPayment 的权威 paid /
 * entitlement 转换，且该保障独立于前端短路（直连云函数亦安全）。
 *
 * 测试策略：
 *   - 通过 Module._load 打桩 wx-server-sdk（内存 mock DB，无网络/无真实 DB）。
 *   - 通过 Module._compile 加载可注入的 verifyPayment/index.js，以便做变异测试。
 *   - queryOrder 被替换为可控制的返回值（直连 verifyPayment 语义）。
 *   - 无真实支付请求、无真实扣费、无生产 DB 写入。
 *
 * 覆盖：
 *   T1  直连 verifyPayment + mock SUCCESS → 拒绝（非成功码）
 *   T2  mock 不能把 order 标记为 paid（paid 写次数 = 0）
 *   T3  mock 不能发放权益（entitlement/membership 写次数 = 0）
 *   T4  前端完全绕过（直连云函数）依然安全
 *   T5  restorePendingOrder 覆盖（静态证明：不存在该调用方，verifyPayment 是唯一权威入口）
 *   T6  真实非 mock SUCCESS 控制例仍走通 paid/entitlement 路径
 *   T7  非 SUCCESS 状态（NOTPAY/USERPAYING/CLOSED/REVOKED/PAYERROR）不回归
 *   变异 M1 移除 mock 守卫
 *   变异 M2 接受 MOCK_TXN_（谓词失效）
 *   变异 M3 守卫移动到 paid 写入之后
 *   变异 M4 守卫移动到 grantEntitlements 之后
 *   谓词单元  paymentAuthority.isMockPaymentResult / isMockTransactionId
 */

var path = require('path')
var fs = require('fs')
var Module = require('module')

var ROOT = path.join(__dirname, '..')
var INDEX = path.join(ROOT, 'cloudfunctions', 'verifyPayment', 'index.js')
var PAYMENT_AUTHORITY = path.join(ROOT, 'cloudfunctions', 'verifyPayment', 'lib', 'paymentAuthority.js')

var t = 0, p = 0, f = 0
var chain = Promise.resolve()
function T(n, fn) {
  t++
  chain = chain.then(function () {
    return Promise.resolve().then(fn)
  }).then(function () { p++ }, function (e) { f++; console.error('FAIL [' + n + ']:', e && e.message) })
}
function eq(a, b, m) { if (a !== b) throw new Error((m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)) }
function ok(v, m) { if (!v) throw new Error((m || 'ok') + ': falsy') }

// ═══════════════════════════════════════════════════════════
// 内存 mock DB + 可控制 queryOrder + 编译加载
// ═══════════════════════════════════════════════════════════

var __qo = null
var __writes = []
var __data = {}

function resetState() {
  __writes = []
  __data = { orders: [], payments: [], products: [], memberships: [], entitlements: [], users: [], payment_logs: [], ai_reports: [], challenge_records: [] }
}

function coll(name) {
  if (!__data[name]) __data[name] = []
  return {
    where: function () { return this },
    orderBy: function () { return this },
    limit: function () { return this },
    get: function () { return Promise.resolve({ data: __data[name].slice() }) },
    add: function (o) { __writes.push({ collection: name, op: 'add', data: o && o.data }); return Promise.resolve({ _id: 'mock-id' }) },
    update: function (o) { __writes.push({ collection: name, op: 'update', data: o && o.data }); return Promise.resolve({ stats: { updated: 1 } }) },
    doc: function () {
      return {
        get: function () { return Promise.resolve({ data: null }) },
        update: function (o) { __writes.push({ collection: name, op: 'update', data: o && o.data }); return Promise.resolve({}) },
        set: function () { return Promise.resolve({}) },
      }
    },
  }
}

var mockSdk = {
  DYNAMIC_CURRENT_ENV: 'mock-env',
  init: function () {},
  getWXContext: function () { return { OPENID: 'u1' } },
  database: function () {
    return { command: { gt: function () { return {} }, lt: function () { return {} } }, collection: coll }
  },
}

var origLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'wx-server-sdk') return mockSdk
  if (request === './lib/payment.js') return { queryOrder: function () { return Promise.resolve(__qo) } }
  if (request === './lib/antiFraud.js') return { checkOrderExpired: function () { return { expired: false } } }
  return origLoad.apply(this, arguments)
}

function compileIndex(mutate) {
  var src = fs.readFileSync(INDEX, 'utf8')
  if (mutate) src = mutate(src)
  var m = new Module(INDEX, module)
  m.filename = INDEX
  m.paths = Module._nodeModulePaths(path.dirname(INDEX))
  m._compile(src, INDEX)
  return m.exports
}

function guardRange(src) {
  var start = src.indexOf('if (isMockPaymentResult(queryResult)) {')
  if (start < 0) return null
  var ret = src.indexOf("return fail(CODES.PAYMENT_ERROR, '模拟支付结果不可作为真实支付')", start)
  if (ret < 0) return null
  var end = src.indexOf('    }', ret)
  if (end < 0) return null
  end += '    }'.length
  return { start: start, end: end, block: src.slice(start, end) }
}

function paidWrites() {
  return __writes.filter(function (w) { return w.collection === 'orders' && w.op === 'update' && w.data && w.data.status === 'paid' })
}
function entitlementWrites() {
  return __writes.filter(function (w) {
    return (w.collection === 'entitlements' && w.op === 'add') || (w.collection === 'memberships' && w.op === 'add')
  })
}

function seedPendingOrder() {
  __data.orders.push({
    orderId: 'XSG_1', openid: 'u1', status: 'pending_payment',
    productId: 'VIP_MONTHLY', relatedId: '', totalAmount: 100, createdAt: Date.now(),
  })
}

function mockSuccessQo() { return { success: true, tradeState: 'SUCCESS', transactionId: 'MOCK_TXN_XSG_1' } }
function realSuccessQo() { return { success: true, tradeState: 'SUCCESS', transactionId: '4200001234567890123' } }

async function runMockScenario(mutate) {
  resetState()
  seedPendingOrder()
  __qo = mockSuccessQo()
  var idx = compileIndex(mutate)
  var resp = await idx.main({ orderId: 'XSG_1' })
  return { resp: resp, paid: paidWrites().length, ent: entitlementWrites().length }
}

// ═══════════════════════════════════════════════════════════
// 谓词单元测试（服务端派生的 mock 识别）
// ═══════════════════════════════════════════════════════════

var auth = require(PAYMENT_AUTHORITY)

T('predicate: isMockTransactionId MOCK_TXN_ -> true', function () {
  eq(auth.isMockTransactionId('MOCK_TXN_XSG_1'), true)
})
T('predicate: isMockTransactionId real txn -> false', function () {
  eq(auth.isMockTransactionId('4200001234567890123'), false)
})
T('predicate: isMockPaymentResult mock txn SUCCESS -> true', function () {
  eq(auth.isMockPaymentResult({ success: true, tradeState: 'SUCCESS', transactionId: 'MOCK_TXN_XSG_1' }), true)
})
T('predicate: isMockPaymentResult _mock=true -> true', function () {
  eq(auth.isMockPaymentResult({ _mock: true, tradeState: 'SUCCESS' }), true)
})
T('predicate: isMockPaymentResult real -> false', function () {
  eq(auth.isMockPaymentResult({ success: true, tradeState: 'SUCCESS', transactionId: '4200001234567890123' }), false)
})
T('predicate: isMockPaymentResult null/undefined -> false', function () {
  eq(auth.isMockPaymentResult(null), false)
  eq(auth.isMockPaymentResult(undefined), false)
})
T('predicate: isMockPaymentResult non-SUCCESS empty txn -> false', function () {
  eq(auth.isMockPaymentResult({ success: true, tradeState: 'NOTPAY', transactionId: '' }), false)
})

// ═══════════════════════════════════════════════════════════
// T1 — 直连 verifyPayment + mock SUCCESS → 拒绝
// ═══════════════════════════════════════════════════════════

T('T1: direct verifyPayment rejects mock SUCCESS (non-success code)', function () {
  return runMockScenario().then(function (r) {
    ok(r.resp.code !== 0, 'mock SUCCESS must not return code 0; got ' + r.resp.code)
    eq(r.resp.code, 10009, 'rejected with PAYMENT_ERROR')
  })
})

T('T2: mock cannot mark order paid (paid mutation = 0)', function () {
  return runMockScenario().then(function (r) {
    eq(r.paid, 0, 'orders.status=paid write count must be 0')
  })
})

T('T3: mock cannot grant entitlement (grant calls = 0)', function () {
  return runMockScenario().then(function (r) {
    eq(r.ent, 0, 'entitlement/membership write count must be 0')
  })
})

T('T4: frontend fully bypassed (direct invocation) still safe', function () {
  // 本测试从不加载/咨询前端 paymentService；verifyPayment 直连语义下，
  // mock 结果必须被服务端守卫独立拒绝。
  return runMockScenario().then(function (r) {
    ok(r.resp.code !== 0 && r.paid === 0 && r.ent === 0, 'CLIENT_GUARD_BYPASSED_IN_TEST must still be safe')
  })
})

// ═══════════════════════════════════════════════════════════
// T6 — 真实非 mock SUCCESS 控制例仍走通
// ═══════════════════════════════════════════════════════════

T('T6: real non-mock SUCCESS control remains accepted', function () {
  resetState()
  seedPendingOrder()
  __data.products.push({ productId: 'VIP_MONTHLY', type: 'membership', durationDays: 30 })
  __qo = realSuccessQo()
  var idx = compileIndex()
  return idx.main({ orderId: 'XSG_1' }).then(function (resp) {
    eq(resp.code, 0, 'real success returns code 0')
    eq(resp.data.status, 'paid', 'real success marks paid')
    eq(paidWrites().length, 1, 'exactly one paid write for real success')
    ok(entitlementWrites().length >= 1, 'real success grants entitlement')
  })
})

// ═══════════════════════════════════════════════════════════
// T7 — 非 SUCCESS 状态不回归
// ═══════════════════════════════════════════════════════════

T('T7: non-success states unchanged (no paid, no entitlement)', function () {
  var states = ['NOTPAY', 'USERPAYING', 'CLOSED', 'REVOKED', 'PAYERROR']
  var runs = states.map(function (st) {
    resetState()
    seedPendingOrder()
    __qo = { success: true, tradeState: st, transactionId: '' }
    var idx = compileIndex()
    return idx.main({ orderId: 'XSG_1' }).then(function (resp) {
      eq(resp.code, 0, st + ' should return OK code 0')
      eq(resp.data.status, 'pending_payment', st + ' -> pending_payment')
      eq(paidWrites().length, 0, st + ' must not mark paid')
      eq(entitlementWrites().length, 0, st + ' must not grant entitlement')
    })
  })
  return Promise.all(runs)
})

// ═══════════════════════════════════════════════════════════
// T5 — restorePendingOrder 静态覆盖
// ═══════════════════════════════════════════════════════════

T('T5: restore path statically proven protected', function () {
  // 静态扫描：不存在 restorePendingOrder 调用方；verifyPayment 是唯一
  // queryOrder-based SUCCESS → paid/entitlement 的权威入口。
  var hits = []
  ;(function walk(dir) {
    var entries = fs.readdirSync(dir, { withFileTypes: true })
    entries.forEach(function (e) {
      var full = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.git') return
        walk(full)
      } else if (/\.js$/.test(e.name)) {
        var txt = fs.readFileSync(full, 'utf8')
        if (/restorePendingOrder/.test(txt)) hits.push(full)
      }
    })
  })(path.join(ROOT, 'cloudfunctions'))
  eq(hits.length, 0, 'no restorePendingOrder caller exists: ' + JSON.stringify(hits))
})

// ═══════════════════════════════════════════════════════════
// 变异测试 — 每个变异必须被现有断言捕获（违反不变式）
// ═══════════════════════════════════════════════════════════

var M1 = function (src) {
  var r = guardRange(src); if (!r) throw new Error('M1: guard not found')
  return src.slice(0, r.start) + src.slice(r.end)
}
var M2 = function (src) {
  if (src.indexOf('isMockPaymentResult(queryResult)') < 0) throw new Error('M2: predicate call not found')
  return src.split('isMockPaymentResult(queryResult)').join('false')
}
var M3 = function (src) {
  var r = guardRange(src); if (!r) throw new Error('M3: guard not found')
  var s = src.slice(0, r.start) + src.slice(r.end)
  var anchor = '      // 写 payments 流水'
  var i = s.indexOf(anchor); if (i < 0) throw new Error('M3: payments anchor not found')
  return s.slice(0, i) + r.block + '\n\n' + s.slice(i)
}
var M4 = function (src) {
  var r = guardRange(src); if (!r) throw new Error('M4: guard not found')
  var s = src.slice(0, r.start) + src.slice(r.end)
  var anchor = 'const grantResult = await grantEntitlements(db, order, ts)'
  var i = s.indexOf(anchor); if (i < 0) throw new Error('M4: grantEntitlements anchor not found')
  return s.slice(0, i + anchor.length) + '\n' + r.block + s.slice(i + anchor.length)
}

var mutations = [
  ['M1: remove mock guard', M1],
  ['M2: accept MOCK_TXN_ (predicate disabled)', M2],
  ['M3: guard moved after paid mutation', M3],
  ['M4: guard moved after grantEntitlements', M4],
]

mutations.forEach(function (entry) {
  var name = entry[0], mut = entry[1]
  T('mutation detected: ' + name, function () {
    return runMockScenario(mut).then(function (r) {
      // 安全不变式被破坏 → paid 或 entitlement 写发生 → 变异被测试捕获
      var violated = r.paid > 0 || r.ent > 0
      ok(violated, name + ' must violate invariant (paid=' + r.paid + ', ent=' + r.ent + ')')
    })
  })
})

// ═══════════════════════════════════════════════════════════
// 汇总
// ═══════════════════════════════════════════════════════════

chain.then(function () {
  console.log('\n===== Stage21 Batch4 R1 payment-authority tests =====')
  console.log('TOTAL=' + t + ' PASS=' + p + ' FAIL=' + f)
  console.log('MUTATION_SANITY_TOTAL=' + mutations.length)
  if (f > 0) { console.log('RESULT=FAIL'); process.exit(1) }
  console.log('RESULT=PASS')
  process.exit(0)
}).catch(function (e) {
  console.error('FATAL', e)
  process.exit(2)
})
