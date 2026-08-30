/**
 * tests/rc8.3-stage20-r5c-v21-smoke-entry.test.js
 *
 * RC8.3 Stage20 R5C — V2.1 OFF-state 内部 smoke 入口的客户端/静态契约验证。
 *
 * 只做静态/结构断言（不启动小程序运行时）：
 *   1. 请求使用 world_model_v2_1，且无 world_model_v2 fallback
 *   2. 不携带 answers / 伪造 openid
 *   3. 页面不写数据库、不更新正常报告缓存/历史
 *   4. OFF 签名解析器精确（4 字段 + 3 个判定）
 */

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const PAGE_SRC = fs.readFileSync(
  path.join(ROOT, 'pages/v21-smoke-test/v21-smoke-test.js'), 'utf8'
);
const WXML_SRC = fs.readFileSync(
  path.join(ROOT, 'pages/v21-smoke-test/v21-smoke-test.wxml'), 'utf8'
);
const APP_JSON = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));

let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; failures.push(name); console.log('  ❌ ' + name); }
}

console.log('=== STEP 1: 请求协议 — 精确 world_model_v2_1，无 world_model_v2 fallback ===');
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

console.log('=== STEP 2: 不携带 answers / 伪造 openid ===');
check('调用数据块不含 answers 字段',
  !/data:\s*\{[\s\S]*?answers\s*:/.test(PAGE_SRC));
check('不含伪造 openid 字段（不向 data 注入 openid）',
  !PAGE_SRC.includes('openid:'));

console.log('=== STEP 3: 零副作用 — 不写 DB、不更新正常报告缓存/历史 ===');
check('不调用 wx.cloud.database()（无 DB 写路径）',
  !PAGE_SRC.includes('wx.cloud.database'));
check('不调用 generateAiReport / getAiReport / generateDiagnosticReport（不走正常报告存储流）',
  !PAGE_SRC.includes('generateAiReport(') &&
  !PAGE_SRC.includes('getAiReport(') &&
  !PAGE_SRC.includes('generateDiagnosticReport('));
check('不写 globalData 报告缓存（无 v21Report / currentReport 写入）',
  !PAGE_SRC.includes('globalData.v21') &&
  !PAGE_SRC.includes('globalData.currentReport'));
check('不调用 wx.setStorage / 报告历史（无本地报告覆盖）',
  !PAGE_SRC.includes('wx.setStorage'));
check('页面唯一云调用是 wx.cloud.callFunction(generateAiReport smoke)',
  (PAGE_SRC.match(/wx\.cloud\.callFunction/g) || []).length === 1);

console.log('=== STEP 4: OFF 签名解析精确 ===');
check('解析 code（数字类型）',
  PAGE_SRC.includes("result && typeof result.code === 'number'"));
check('解析 reportType === "diagnostic_v2_1_off"',
  PAGE_SRC.includes("reportType === 'diagnostic_v2_1_off'"));
check('解析 v21Mode === "OFF"',
  PAGE_SRC.includes("v21Mode === 'OFF'"));
check('解析 v21PrimaryActive === false',
  PAGE_SRC.includes("v21PrimaryActive === false"));
check('AUTH_GATE_PASSED = code 非 10002（真实 OPENID 通过认证门）',
  PAGE_SRC.includes('AUTH_FAILED_CODE') &&
  PAGE_SRC.includes("code !== AUTH_FAILED_CODE"));
check('V21_OFF_BRANCH_REACHED = code===0 && reportType===off',
  PAGE_SRC.includes("code === 0 && reportType === 'diagnostic_v2_1_off'"));
check('OFF_SIGNATURE_PASS = offBranch && v21Mode===OFF && v21PrimaryActive===false',
  PAGE_SRC.includes("offSignaturePass = v21OffBranchReached === true && v21Mode === 'OFF' && v21PrimaryActive === false"));

console.log('=== STEP 5: 内部边界 — 不挂载到正常 UI ===');
check('app.json 注册了 v21-smoke-test 页面',
  APP_JSON.pages.includes('pages/v21-smoke-test/v21-smoke-test'));
check('v21-smoke-test 不在 tabBar（无底部 tab 入口）',
  !(APP_JSON.tabBar && APP_JSON.tabBar.list.some(t => t.pagePath === 'pages/v21-smoke-test/v21-smoke-test')));
check('页面显示内部警告文案',
  WXML_SRC.includes('内部测试入口') &&
  WXML_SRC.includes('仅用于 RC8.3 V2.1 smoke'));

console.log('=== STEP 6: 复用现有白名单，不新增认证绕过 ===');
check('import V2_INTERNAL_ALLOWLIST（复用 U1-U5 客户端白名单）',
  PAGE_SRC.includes('V2_INTERNAL_ALLOWLIST'));
check('白名单判定 = openid in allowlist（无额外绕过分支）',
  PAGE_SRC.includes('V2_INTERNAL_ALLOWLIST.indexOf(openid) >= 0'));

console.log(`\n=== 结果: ${pass} pass / ${fail} fail ===`);
if (fail > 0) {
  console.error('FAILED: ' + failures.join(' | '));
  process.exit(1);
}
console.log('V21_SMOKE_ENTRY_TESTS = PASS');
process.exit(0);
