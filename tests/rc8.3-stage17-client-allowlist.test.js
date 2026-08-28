/**
 * tests/rc8.3-stage17-client-allowlist.test.js
 *
 * RC8.3 Stage 17 — 客户端 V2 内部测试白名单修复验证（allowlist fix）。
 *
 * 验证目标（只测客户端白名单逻辑，不碰 questionnaire/74 options/V2/V1 inference）：
 *   1. V2_INTERNAL_ALLOWLIST 与冻结 U1-U5 openid 精确一致（5 个，无增删改序）。
 *   2. U1-U5 全部 allowed。
 *   3. 随机 unknown openid → denied。
 *   4. empty openid → 不属于 allowlist（allowed=false），且页面必须走 login-ready 流程
 *      （app.onReady + 兜底 timer），不得同步读空 openid 误判 allowed。
 */

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const q = require(path.join(ROOT, 'utils/v2Questionnaire.js'));
const PAGE_SRC = fs.readFileSync(
  path.join(ROOT, 'pages/v2-shadow-test/v2-shadow-test.js'), 'utf8'
);

// ── 冻结 U1-U5 openid（来自 2026-08-13 identity lock，权威映射）──
const FROZEN_U1_U5 = [
  'oZa463Yb2VY0k9Es_pGzdHFtigNo', // U1
  'oZa463TBnL6-nVamuxxIi4UcDflY', // U2
  'oZa463aevHMMq68difgd7RNWycCY', // U3
  'oZa463b1OpLdxZKgH-2Q2oJ0Yl60', // U4
  'oZa463Te7dLGGA5yQlRearlD8B3I', // U5
];

let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; failures.push(name); console.log('  ❌ ' + name); }
}

console.log('=== STEP 1: allowlist 与冻结 U1-U5 精确一致 ===');
check('V2_INTERNAL_ALLOWLIST 存在且为数组', Array.isArray(q.V2_INTERNAL_ALLOWLIST));
check('allowlist length === 5', q.V2_INTERNAL_ALLOWLIST.length === 5);
check('allowlist 精确等于冻结 U1-U5（含顺序）',
  JSON.stringify(q.V2_INTERNAL_ALLOWLIST) === JSON.stringify(FROZEN_U1_U5));

console.log('=== STEP 2: U1-U5 全部 allowed ===');
FROZEN_U1_U5.forEach((oid, i) => {
  check(`U${i + 1} allowed (${oid})`, q.V2_INTERNAL_ALLOWLIST.indexOf(oid) >= 0);
});

console.log('=== STEP 3: 随机 unknown openid → denied ===');
const UNKNOWNS = [
  'oUnknown_random_openid_0000000001',
  'oZa463AAAAAAAAAAAAAAAAAAAAAAAAAA',
  'oZa463Yb2VY0k9Es_pGzdHFtigNX', // 末尾改一位
  'oZa463b1OpLdxZKgH-2Q2oJ0Yl60X',
];
UNKNOWNS.forEach((oid) => {
  check(`unknown denied (${oid.slice(0, 16)}...)`, q.V2_INTERNAL_ALLOWLIST.indexOf(oid) < 0);
});

console.log('=== STEP 4: empty openid → 不得误判 allowed，且走 login-ready 流程 ===');
check('empty openid 不在 allowlist（indexOf(\'\') < 0）', q.V2_INTERNAL_ALLOWLIST.indexOf('') < 0);
check('undefined/null 空值也不在 allowlist',
  q.V2_INTERNAL_ALLOWLIST.indexOf(undefined) < 0 && q.V2_INTERNAL_ALLOWLIST.indexOf(null) < 0);

// 页面必须使用 app.onReady 延迟判定，而非 onLoad 同步读空 openid
check('页面使用 app.onReady(apply) 等待登录就绪', PAGE_SRC.includes('app.onReady(apply)'));
check('页面有 3s 兜底 timer 避免一直 loading', /setTimeout\(apply,\s*3000\)/.test(PAGE_SRC));
check('页面 onUnload 清理兜底 timer', PAGE_SRC.includes('clearTimeout(this._fallbackTimer)'));
// 结构性断言：onLoad 的同步路径（`onLoad() {` 到 `const apply =` 之间）不得出现 allowlist 判定，
// 即 openid 判定必须被 defer 到 apply 闭包内。
const onLoadStart = PAGE_SRC.indexOf('onLoad() {');
const applyStart = PAGE_SRC.indexOf('const apply =', onLoadStart);
const syncPath = PAGE_SRC.slice(onLoadStart, applyStart);
check('页面不在 onLoad 同步直接读 openid 判定',
  onLoadStart >= 0 && applyStart > onLoadStart && !syncPath.includes('V2_INTERNAL_ALLOWLIST'));
check('提交逻辑 renderSource=v2_shadow_only 仍显示 shadow 完成态',
  PAGE_SRC.includes("'V2 内部测试已提交（shadow 记录中，非正式诊断）'"));
check('提交逻辑 renderSource=world_model_v2 仍跳 v2-report',
  PAGE_SRC.includes("wx.navigateTo({ url: '/pages/v2-report/v2-report' })"));

console.log(`\n=== 结果: ${pass} pass / ${fail} fail ===`);
if (fail > 0) {
  console.error('FAILED: ' + failures.join(' | '));
  process.exit(1);
}
console.log('ALLOWLIST_TESTS = PASS');
process.exit(0);
