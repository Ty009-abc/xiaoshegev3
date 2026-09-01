/**
 * tests/rc8.3-stage21-batch4-r1-payment-authority.test.js
 *
 * Stage21 Batch4 R1/R2 — PAYMENT_MOCK_AUTHORITY_GUARD 权威回归测试.
 *
 * R1 建立服务端 mock 权威守卫；R2 修复其 harness 自欺缺陷并补齐
 * production module-load 验证（antiFraud vendored 副本缺失导致的
 * CRITICAL_MODULE_LOAD_FAILURE）。
 *
 * R2 变更（相对 R1）：
 *   - 移除对 ./lib/antiFraud.js 的 stub（原 L94 掩盖生产模块加载失败）。
 *   - 新增 VERIFY_PAYMENT_PRODUCTION_MODULE_LOAD：子进程只 stub wx-server-sdk，
 *     真实加载 verifyPayment/index.js（含真实 antiFraud.js / payment.js /
 *     paymentAuthority.js），要求无 throw 且 antiFraud 真实模块被加载。
 *   - 新增 antiFraud import/call 契约测试（checkOrderExpired 为 function，
 *     覆盖 verifyPayment 当前实际使用的最小输入空间）。
 *   - 新增变异 M3（删除 antiFraud.js 文件）、M4（重新引入 antiFraud stub），
 *     证明 module-load 测试能捕获缺失文件与 harness 自欺。
 *
 * 目标：
 *   1. mock 支付结果永远不能进入 verifyPayment 的权威 paid / entitlement 转换；
 *   2. 该保障独立于前端短路（直连云函数亦安全）；
 *   3. verifyPayment 云函数可被真实加载（无 MODULE_NOT_FOUND）。
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
 *   T5  restorePendingOrder 覆盖（静态证明：不存在该调用方）
 *   T6  真实非 mock SUCCESS 控制例仍走通 paid/entitlement 路径
 *   T7  非 SUCCESS 状态（NOTPAY/USERPAYING/CLOSED/REVOKED/PAYERROR）不回归
 *   ML  VERIFY_PAYMENT_PRODUCTION_MODULE_LOAD（子进程，仅 stub wx-server-sdk）
 *   CT  antiFraud import/call 契约（checkOrderExpired）
 *   变异 M1 移除 mock 守卫
 *   变异 M2 接受 MOCK_TXN_（谓词失效）
 *   变异 M3 删除 antiFraud.js 文件（module-load 必须捕获）
 *   变异 M4 重新引入 antiFraud stub（harness 自欺必须被捕获）
 *   变异 M5 守卫移动到 paid 写入之后
 *   变异 M6 守卫移动到 grantEntitlements 之后
 *   谓词单元  paymentAuthority.isMockPaymentResult / isMockTransactionId
 */

var path = require('path')
var fs = require('fs')
var Module = require('module')
var os = require('os')
var cp = require('child_process')

var ROOT = path.join(__dirname, '..')
var INDEX = path.join(ROOT, 'cloudfunctions', 'verifyPayment', 'index.js')
var PAYMENT_AUTHORITY = path.join(ROOT, 'cloudfunctions', 'verifyPayment', 'lib', 'paymentAuthority.js')
var ANTI_FRAUD = path.join(ROOT, 'cloudfunctions', 'verifyPayment', 'lib', 'antiFraud.js')

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

// NOTE (R2): antiFraud stub REMOVED. Only wx-server-sdk (external) and
// ./lib/payment.js (provider network API / queryOrder) are stubbed.
// ./lib/antiFraud.js and ./lib/paymentAuthority.js load their REAL files.
var origLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'wx-server-sdk') return mockSdk
  if (request === './lib/payment.js') return { queryOrder: function () { return Promise.resolve(__qo) } }
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
// VERIFY_PAYMENT_PRODUCTION_MODULE_LOAD — 子进程真实加载
// ═══════════════════════════════════════════════════════════

// 子进程脚本：只 stub wx-server-sdk，真实加载 index.js（含真实 antiFraud）。
// 通过 Module._load 探测 antiFraud 是否走了真实文件路径；可选注入 antiFraud
// stub（M4 变异）以证明模块加载测试能识别 harness 自欺。
var CHILD_SCRIPT = [
  'var path = require("path")',
  'var Module = require("module")',
  'var root = process.env.AUDIT_ROOT',
  'var mockSdk = {',
  '  DYNAMIC_CURRENT_ENV: "mock-env",',
  '  init: function () {},',
  '  getWXContext: function () { return { OPENID: "u1" }; },',
  '  database: function () { return { command: {}, collection: function () { return { where: function(){return this}, limit: function(){return this}, get: function(){ return Promise.resolve({ data: [] }) }, add: function(){return Promise.resolve({})}, update: function(){return Promise.resolve({})}, doc: function(){return { update: function(){return Promise.resolve({})} }} }; } }; },',
  '}',
  'var antiFraudRealLoaded = false',
  'var origLoad = Module._load',
  'Module._load = function (request, parent, isMain) {',
  '  if (request === "wx-server-sdk") return mockSdk',
  '  if (request === "./lib/antiFraud.js") {',
  '    if (process.env.INJECT_ANTIFRAUD_STUB === "1") {',
  '      return { checkOrderExpired: function () { return { expired: false } } }',
  '    }',
  '    antiFraudRealLoaded = true',
  '  }',
  '  return origLoad.apply(this, arguments)',
  '}',
  'try {',
  '  require(path.join(root, "cloudfunctions", "verifyPayment", "index.js"))',
  '  process.stdout.write(JSON.stringify({ loadOk: true, antiFraudRealLoaded: antiFraudRealLoaded }))',
  '  process.exit(0)',
  '} catch (e) {',
  '  process.stdout.write(JSON.stringify({ loadOk: false, antiFraudRealLoaded: antiFraudRealLoaded, errorClass: e.code || e.name }))',
  '  process.exit(1)',
  '}',
].join('\n')

function runModuleLoadChild(injectStub) {
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rc83-b4r2-'))
  var childPath = path.join(tmp, 'child.js')
  fs.writeFileSync(childPath, CHILD_SCRIPT)
  return new Promise(function (resolve) {
    cp.execFile(process.execPath, [childPath], {
      env: Object.assign({}, process.env, { AUDIT_ROOT: ROOT, INJECT_ANTIFRAUD_STUB: injectStub ? '1' : '0' }),
    }, function (err, stdout, stderr) {
      var out = null
      try { out = JSON.parse(stdout) } catch (e) { out = { parseError: true, stdout: stdout, stderr: stderr, err: err && err.message } }
      resolve({ exitCode: err ? err.code : 0, out: out })
    })
  })
}

T('ML: VERIFY_PAYMENT_PRODUCTION_MODULE_LOAD (only wx-server-sdk stubbed)', function () {
  return runModuleLoadChild(false).then(function (r) {
    eq(r.out.loadOk, true, 'module load must not throw; got ' + JSON.stringify(r.out))
    eq(r.out.antiFraudRealLoaded, true, 'ANTI_FRAUD_REAL_MODULE_LOADED must be YES')
  })
})

// ═══════════════════════════════════════════════════════════
// antiFraud import/call 契约测试
// ═══════════════════════════════════════════════════════════

T('CT: antiFraud import contract valid (checkOrderExpired is function)', function () {
  var af = require(ANTI_FRAUD)
  eq(typeof af.checkOrderExpired, 'function', 'checkOrderExpired must be a function')
})

T('CT: checkOrderExpired minimal input space (pending/paid/no-createdAt)', function () {
  var af = require(ANTI_FRAUD)
  var now = Date.now()
  // 未过期 pending_payment
  eq(af.checkOrderExpired({ status: 'pending_payment', createdAt: now - 60 * 1000 }).expired, false, 'fresh pending not expired')
  // 已过期 pending_payment（> 30min）
  eq(af.checkOrderExpired({ status: 'pending_payment', createdAt: now - 31 * 60 * 1000 }).expired, true, 'stale pending expired')
  // paid 状态不参与过期判定（verifyPayment 只在 pending 状态前调用）
  eq(af.checkOrderExpired({ status: 'paid', createdAt: now - 999 * 60 * 1000 }).expired, false, 'paid never expired')
  // 缺 createdAt → 不 expired（fail-safe，不误关）
  eq(af.checkOrderExpired({ status: 'pending_payment' }).expired, false, 'missing createdAt not expired')
  // 空/null
  eq(af.checkOrderExpired(null).expired, false, 'null order not expired')
  eq(af.checkOrderExpired({}).expired, false, 'empty order not expired')
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
var M5 = function (src) {
  var r = guardRange(src); if (!r) throw new Error('M5: guard not found')
  var s = src.slice(0, r.start) + src.slice(r.end)
  var anchor = '      // 写 payments 流水'
  var i = s.indexOf(anchor); if (i < 0) throw new Error('M5: payments anchor not found')
  return s.slice(0, i) + r.block + '\n\n' + s.slice(i)
}
var M6 = function (src) {
  var r = guardRange(src); if (!r) throw new Error('M6: guard not found')
  var s = src.slice(0, r.start) + src.slice(r.end)
  var anchor = 'const grantResult = await grantEntitlements(db, order, ts)'
  var i = s.indexOf(anchor); if (i < 0) throw new Error('M6: grantEntitlements anchor not found')
  return s.slice(0, i + anchor.length) + '\n' + r.block + s.slice(i + anchor.length)
}

var guardMutations = [
  ['M1: remove mock guard', M1],
  ['M2: accept MOCK_TXN_ (predicate disabled)', M2],
  ['M5: guard moved after paid mutation', M5],
  ['M6: guard moved after grantEntitlements', M6],
]

guardMutations.forEach(function (entry) {
  var name = entry[0], mut = entry[1]
  T('mutation detected: ' + name, function () {
    return runMockScenario(mut).then(function (r) {
      var violated = r.paid > 0 || r.ent > 0
      ok(violated, name + ' must violate invariant (paid=' + r.paid + ', ent=' + r.ent + ')')
    })
  })
})

// M3 — 删除 antiFraud.js 文件 → module-load 必须失败（MODULE_NOT_FOUND）
T('M3: remove antiFraud.js file is caught by module-load test', function () {
  if (!fs.existsSync(ANTI_FRAUD)) throw new Error('M3 precondition: antiFraud.js missing before test')
  var bak = ANTI_FRAUD + '.r2bak'
  fs.renameSync(ANTI_FRAUD, bak)
  return runModuleLoadChild(false).then(function (r) {
    fs.renameSync(bak, ANTI_FRAUD) // restore
    eq(r.out.loadOk, false, 'module load must fail when antiFraud.js removed')
    eq(r.out.errorClass, 'MODULE_NOT_FOUND', 'failure class must be MODULE_NOT_FOUND')
  }).catch(function (e) {
    if (fs.existsSync(bak) && !fs.existsSync(ANTI_FRAUD)) fs.renameSync(bak, ANTI_FRAUD)
    throw e
  })
})

// M4 — 重新引入 antiFraud stub → 真实模块加载探测必须返回 NO
T('M4: reintroduce antiFraud stub is caught (ANTI_FRAUD_REAL_MODULE_LOADED=NO)', function () {
  return runModuleLoadChild(true).then(function (r) {
    eq(r.out.loadOk, true, 'with stub the function still loads (stub masks the real file)')
    eq(r.out.antiFraudRealLoaded, false, 'real-module detector must report NO when stub is injected')
  })
})

// ═══════════════════════════════════════════════════════════
// 汇总
// ═══════════════════════════════════════════════════════════

chain.then(function () {
  console.log('\n===== Stage21 Batch4 R1/R2 payment-authority tests =====')
  console.log('TOTAL=' + t + ' PASS=' + p + ' FAIL=' + f)
  console.log('GUARD_MUTATION_TOTAL=' + guardMutations.length)
  console.log('MODULE_LOAD_MUTATION_TOTAL=' + 2) // M3 + M4
  if (f > 0) { console.log('RESULT=FAIL'); process.exit(1) }
  console.log('RESULT=PASS')
  process.exit(0)
}).catch(function (e) {
  console.error('FATAL', e)
  process.exit(2)
})
