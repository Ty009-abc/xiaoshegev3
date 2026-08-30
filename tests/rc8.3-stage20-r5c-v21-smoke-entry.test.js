/**
 * tests/rc8.3-stage20-r5c-v21-smoke-entry.test.js
 *
 * RC8.3 Stage20 R5C/R1A — V2.1 OFF-state 内部 smoke 入口的契约验证。
 *
 * 两部分：
 *   A. 静态契约（请求协议 / 零副作用 / 内部边界 / 白名单复用）
 *   B. 行为验证 —— 在 mock 小程序运行时里加载真实页面代码，喂入各类
 *      generateAiReport 返回 payload，断言 OFF 签名判定精确：
 *        - 五字段全正确 → OFF_SIGNATURE_PASS = true
 *        - 任一字段错误/缺失 → OFF_SIGNATURE_PASS = false（无部分匹配）
 *
 * OFF 签名五个强制条件（R1A 修复后）：
 *   code === 0
 *   data.reportType === 'diagnostic_v2_1_off'
 *   data.diagnosticVersion === 'world_model_v2_1'
 *   data.v21Mode === 'OFF'
 *   data.v21PrimaryActive === false
 */

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const PAGE_PATH = path.join(ROOT, 'pages/v21-smoke-test/v21-smoke-test.js');
const WXML_PATH = path.join(ROOT, 'pages/v21-smoke-test/v21-smoke-test.wxml');
const PAGE_SRC = fs.readFileSync(PAGE_PATH, 'utf8');
const WXML_SRC = fs.readFileSync(WXML_PATH, 'utf8');
const APP_JSON = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));

let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; failures.push(name); console.log('  ❌ ' + name); }
}

// ═══════════════════════════════════════════════════════════════
// 行为测试沙盒：mock 小程序运行时，加载真实页面代码
// ═══════════════════════════════════════════════════════════════
let readyCallback = null;
let captured = null;
global.getApp = () => ({
  globalData: { openid: '' },
  onReady: (cb) => { readyCallback = cb; },
});
global.Page = (def) => { captured = def; };
global.wx = {
  cloud: { callFunction: () => Promise.resolve({}) },
  setClipboardData: ({ success }) => { if (success) success(); },
  showToast: () => {},
};

// 加载真实页面模块（触发 getApp()/Page() 捕获）
require(PAGE_PATH);

function makeInstance() {
  const inst = { data: JSON.parse(JSON.stringify(captured.data)) };
  inst.setData = function (patch) { Object.assign(this.data, patch); };
  for (const k of Object.keys(captured)) {
    if (typeof captured[k] === 'function') inst[k] = captured[k].bind(inst);
  }
  return inst;
}

// 喂入一个 server result（{ code, message, data }），返回 onSmoke 后的页面 data。
function smoke(serverResult) {
  return new Promise((resolve) => {
    global.wx.cloud.callFunction = () => Promise.resolve({ result: serverResult });
    const inst = makeInstance();
    inst.onSmoke();
    setImmediate(() => resolve(inst.data));
  });
}

// 便捷构造一个标准正确 payload（可逐字段覆盖）。
function okPayload(overrides) {
  const base = {
    code: 0,
    message: 'success',
    data: {
      reportType: 'diagnostic_v2_1_off',
      diagnosticVersion: 'world_model_v2_1',
      v21Mode: 'OFF',
      v21PrimaryActive: false,
    },
  };
  if (overrides && overrides.data) Object.assign(base.data, overrides.data);
  if (overrides && overrides.code !== undefined) base.code = overrides.code;
  if (overrides && overrides.noData) base.data = null;
  return base;
}

// ═══════════════════════════════════════════════════════════════
// STEP 1: 请求协议 —— 精确 world_model_v2_1，无 world_model_v2 fallback
// ═══════════════════════════════════════════════════════════════
console.log('=== STEP 1: 请求协议 ===');
check('data.diagnosticVersion === "world_model_v2_1"',
  PAGE_SRC.includes("diagnosticVersion: 'world_model_v2_1'"));
check('调用 name === "generateAiReport"',
  PAGE_SRC.includes("name: 'generateAiReport'"));
check('type === "diagnostic"',
  PAGE_SRC.includes("type: 'diagnostic'"));
check('无 world_model_v2 fallback（不含 diagnosticVersion: "world_model_v2"）',
  !PAGE_SRC.includes("diagnosticVersion: 'world_model_v2'"));
check('不 import generateV2ShadowReport（不走 V2 服务）',
  !PAGE_SRC.includes('generateV2ShadowReport'));

// ═══════════════════════════════════════════════════════════════
// STEP 2: 不携带 answers / 伪造 openid
// ═══════════════════════════════════════════════════════════════
console.log('=== STEP 2: 不携带 answers / 伪造 openid ===');
check('调用数据块不含 answers 字段',
  !/data:\s*\{[\s\S]*?answers\s*:/.test(PAGE_SRC));
check('不含伪造 openid 字段（不向 data 注入 openid）',
  !PAGE_SRC.includes('openid:'));

// ═══════════════════════════════════════════════════════════════
// STEP 3: 零副作用
// ═══════════════════════════════════════════════════════════════
console.log('=== STEP 3: 零副作用 ===');
check('不调用 wx.cloud.database()（无 DB 写路径）',
  !PAGE_SRC.includes('wx.cloud.database'));
check('不调用 generateAiReport / getAiReport / generateDiagnosticReport（不走正常报告存储流）',
  !PAGE_SRC.includes('generateAiReport(') &&
  !PAGE_SRC.includes('getAiReport(') &&
  !PAGE_SRC.includes('generateDiagnosticReport('));
check('不写 globalData 报告缓存',
  !PAGE_SRC.includes('globalData.v21') &&
  !PAGE_SRC.includes('globalData.currentReport'));
check('不调用 wx.setStorage（无本地报告覆盖）',
  !PAGE_SRC.includes('wx.setStorage'));
check('页面唯一云调用是 wx.cloud.callFunction(generateAiReport smoke)',
  (PAGE_SRC.match(/wx\.cloud\.callFunction/g) || []).length === 1);

// ═══════════════════════════════════════════════════════════════
// STEP 4: OFF 签名判定（行为）—— 五字段全强制
// ═══════════════════════════════════════════════════════════════
console.log('=== STEP 4: OFF 签名判定（行为） ===');

// 4.0 静态：predicate 要求 diagnosticVersion === 'world_model_v2_1'
check('predicate 强制 diagnosticVersion === "world_model_v2_1"（三等于）',
  PAGE_SRC.includes("diagnosticVersion === 'world_model_v2_1'"));
check('predicate 五条件均为 && 连接（任一不满足即 false）',
  /offSignaturePass\s*=[\s\S]*?code === 0 &&[\s\S]*?reportType === 'diagnostic_v2_1_off' &&[\s\S]*?diagnosticVersion === 'world_model_v2_1' &&[\s\S]*?v21Mode === 'OFF' &&[\s\S]*?v21PrimaryActive === false/.test(PAGE_SRC));

(async () => {
  // 4.1 全正确 → PASS
  let d = await smoke(okPayload());
  check('正确 diagnosticVersion + 全字段正确 → OFF_SIGNATURE_PASS=true', d.offSignaturePass === true);
  check('正确 payload → AUTH_GATE_PASSED=true', d.authGatePassed === true);
  check('正确 payload → V21_OFF_BRANCH_REACHED=true', d.v21OffBranchReached === true);

  // 4.2 错误 diagnosticVersion（world_model_v2）→ FAIL
  d = await smoke(okPayload({ data: { diagnosticVersion: 'world_model_v2' } }));
  check('A. wrong diagnosticVersion=world_model_v2 → OFF_SIGNATURE_PASS=false', d.offSignaturePass === false);

  // 4.3 缺失 diagnosticVersion → FAIL
  d = await smoke(okPayload({ data: { diagnosticVersion: undefined } }));
  check('B. missing diagnosticVersion → OFF_SIGNATURE_PASS=false', d.offSignaturePass === false);

  // 4.4 错误 reportType → FAIL
  d = await smoke(okPayload({ data: { reportType: 'diagnostic_v2_1_shadow' } }));
  check('C. wrong reportType → OFF_SIGNATURE_PASS=false', d.offSignaturePass === false);

  // 4.5 SHADOW mode → FAIL
  d = await smoke(okPayload({ data: { v21Mode: 'SHADOW' } }));
  check('D. v21Mode=SHADOW → OFF_SIGNATURE_PASS=false', d.offSignaturePass === false);

  // 4.6 v21PrimaryActive=true → FAIL
  d = await smoke(okPayload({ data: { v21PrimaryActive: true } }));
  check('E. v21PrimaryActive=true → OFF_SIGNATURE_PASS=false', d.offSignaturePass === false);

  // 4.7 code=10002（AUTH_FAILED）→ FAIL
  d = await smoke({ code: 10002, message: 'auth failed', data: null });
  check('F. code=10002 → OFF_SIGNATURE_PASS=false', d.offSignaturePass === false);
  check('F. code=10002 → AUTH_GATE_PASSED=false', d.authGatePassed === false);

  // 4.8 缺失 data → FAIL
  d = await smoke({ code: 0, message: 'success', data: null });
  check('G. missing data → OFF_SIGNATURE_PASS=false', d.offSignaturePass === false);
  check('G. missing data → V21_OFF_BRANCH_REACHED=false', d.v21OffBranchReached === false);

  // 4.9 错误 code（非 0，非 10002）→ FAIL
  d = await smoke({ code: 10008, message: 'ai error', data: null });
  check('H. code=10008 → OFF_SIGNATURE_PASS=false', d.offSignaturePass === false);

  finish();
})().catch((err) => {
  console.error('行为测试执行异常:', err);
  failures.push('BEHAVIORAL_RUNNER_EXCEPTION: ' + err.message);
  finish();
});

// ═══════════════════════════════════════════════════════════════
// STEP 5: 内部边界
// ═══════════════════════════════════════════════════════════════
function staticBoundaryChecks() {
  console.log('=== STEP 5: 内部边界 ===');
  check('app.json 注册了 v21-smoke-test 页面',
    APP_JSON.pages.includes('pages/v21-smoke-test/v21-smoke-test'));
  check('v21-smoke-test 不在 tabBar（无底部 tab 入口）',
    !(APP_JSON.tabBar && APP_JSON.tabBar.list.some(t => t.pagePath === 'pages/v21-smoke-test/v21-smoke-test')));
  check('页面显示内部警告文案',
    WXML_SRC.includes('内部测试入口') &&
    WXML_SRC.includes('仅用于 RC8.3 V2.1 smoke'));

  console.log('=== STEP 6: 复用白名单，不新增认证绕过 ===');
  check('import V2_INTERNAL_ALLOWLIST（复用 U1-U5 客户端白名单）',
    PAGE_SRC.includes('V2_INTERNAL_ALLOWLIST'));
  check('白名单判定 = openid in allowlist（无额外绕过分支）',
    PAGE_SRC.includes('V2_INTERNAL_ALLOWLIST.indexOf(openid) >= 0'));
}

let finished = false;
function finish() {
  if (finished) return;
  finished = true;
  staticBoundaryChecks();
  console.log(`\n=== 结果: ${pass} pass / ${fail} fail ===`);
  if (fail > 0) {
    console.error('FAILED: ' + failures.join(' | '));
    process.exit(1);
  }
  console.log('V21_SMOKE_ENTRY_TESTS = PASS');
  process.exit(0);
}
