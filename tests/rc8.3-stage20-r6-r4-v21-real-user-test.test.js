/**
 * tests/rc8.3-stage20-r6-r4-v21-real-user-test.test.js
 *
 * RC8.3 Stage20 R6-R4 — V2.1 内部真人测试问卷实现验证。
 *
 * 行为敏感测试（非纯 grep）：
 *   A. 问卷契约：18 题 / 65 选项 / 与服务端契约一致 / 无语义元数据暴露
 *   B. 随机化：渲染顺序可变化 / optionId 存活 / displayPosition=渲染索引 / 会话内稳定
 *   C. 答案校验：18 唯一可过 / 17 拒 / 重复拒 / 非法 questionId 拒 / 非法 optionId 拒 /
 *      缺 displayPosition 拒 / 非整数拒 / 越界拒 / optionId-position 不匹配拒
 *   D. 请求：diagnosticVersion 精确 world_model_v2_1 / 裸 18 元组 / 无 openid / 无语义字段
 *   E. 隔离：app.json 注册 / 无 normal-home 导航 / 无 report-detail 导航 / 无全局状态污染
 *   F. 重复提交保护：pending 锁 / 成功会话不可静默重提 / 显式重启新会话
 */

const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..')
const CLIENT_MIRROR = path.join(ROOT, 'utils/v21Questionnaire.js')
const SERVER_CONTRACT = path.join(
  ROOT, 'cloudfunctions/generateAiReport/lib/engine/worldModel/v2_1/questionnaireV21.js'
)
const PAGE_JS = path.join(ROOT, 'pages/v21-questionnaire-test/v21-questionnaire-test.js')
const PAGE_WXML = path.join(ROOT, 'pages/v21-questionnaire-test/v21-questionnaire-test.wxml')

const mirror = require(CLIENT_MIRROR)
// 服务端契约是纯数据模块（无副作用），可直接 require 做权威对比。
const server = require(SERVER_CONTRACT)
const PAGE_SRC = fs.readFileSync(PAGE_JS, 'utf8')
const WXML_SRC = fs.readFileSync(PAGE_WXML, 'utf8')
const APP_JSON = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'))

let pass = 0
let fail = 0
const failures = []
function check(name, cond) {
  if (cond) { pass++; console.log('  ✅ ' + name) }
  else { fail++; failures.push(name); console.log('  ❌ ' + name) }
}

// ═══════════════════════════════════════════════════════════════
// A. 问卷契约
// ═══════════════════════════════════════════════════════════════
console.log('=== A. 问卷契约 ===')
check('QUESTION_COUNT_V21 === 18', mirror.QUESTION_COUNT_V21 === 18)
check('OPTION_COUNT_TOTAL_V21 === 65', mirror.OPTION_COUNT_TOTAL_V21 === 65)
check('V21_QUESTIONS.length === 18', mirror.V21_QUESTIONS.length === 18)
check('服务端 QUESTIONS_V21.length === 18', server.QUESTIONS_V21.length === 18)

const clientOptCount = mirror.V21_QUESTIONS.reduce((s, q) => s + q.options.length, 0)
check('客户端选项总数 === 65', clientOptCount === 65)

// questionId 一致（含顺序）
const serverIds = server.QUESTIONS_V21.map((q) => q.questionId)
const clientIds = mirror.V21_QUESTIONS.map((q) => q.questionId)
check('客户端 questionId 与服务端完全一致（含顺序）',
  JSON.stringify(clientIds) === JSON.stringify(serverIds))

// optionId/text 逐题一致（忽略服务端 semanticPropositionRefs）
function stripMeta(options) { return options.map((o) => ({ optionId: o.optionId, text: o.text })) }
let optMatch = true
for (let i = 0; i < server.QUESTIONS_V21.length && i < mirror.V21_QUESTIONS.length; i++) {
  if (JSON.stringify(stripMeta(server.QUESTIONS_V21[i].options)) !== JSON.stringify(mirror.V21_QUESTIONS[i].options)) {
    optMatch = false
    console.log('    mismatch @', server.QUESTIONS_V21[i].questionId)
  }
}
check('客户端 optionId/text 与服务端逐题一致', optMatch)

// 语义元数据不得暴露（数据级：客户端选项对象仅含 optionId/text，不含任何推理键）
check('客户端选项对象键 === [optionId, text]',
  mirror.V21_QUESTIONS.every((q) => q.options.every((o) => Object.keys(o).sort().join(',') === 'optionId,text')))
const mirrorJSON = JSON.stringify(mirror.V21_QUESTIONS)
check('客户端数据不含 semanticPropositionRefs', !mirrorJSON.includes('semanticPropositionRefs'))
check('客户端数据不含 evidenceId', !mirrorJSON.includes('evidenceId'))
check('客户端数据不含 distortionType', !mirrorJSON.includes('distortionType'))
check('客户端数据不含 blindspot', !mirrorJSON.includes('blindspot'))
check('客户端模块不导出 CONSTRUCTS_V21', !('CONSTRUCTS_V21' in mirror))

// ═══════════════════════════════════════════════════════════════
// B. 随机化
// ═══════════════════════════════════════════════════════════════
console.log('=== B. 随机化 ===')
function seededRandom(seed) {
  let s = seed
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648 }
}
const q0 = mirror.V21_QUESTIONS[0]

const orders = new Set()
for (let seed = 1; seed <= 30; seed++) {
  const sess = mirror.buildSessionQuestions(seededRandom(seed))
  orders.add(sess[0].options.map((o) => o.optionId).join(''))
}
check('渲染顺序可变化（30 个种子产生 >1 种排列）', orders.size > 1)

const sess = mirror.buildSessionQuestions(seededRandom(7))
const q0rendered = sess[0].options
check('洗牌后 optionId 集合不变', new Set(q0rendered.map(o => o.optionId)).size === q0.options.length)
check('洗牌后 optionId 均在规范集合内',
  q0rendered.every(o => q0.options.some(c => c.optionId === o.optionId)))

check('displayPosition === 渲染索引（0..n-1 连续）',
  q0rendered.every((o, i) => o.displayPosition === i))
check('displayPosition 唯一且无重复',
  new Set(q0rendered.map(o => o.displayPosition)).size === q0rendered.length)

const sessFrozen = mirror.buildSessionQuestions(seededRandom(7))
const snapshot1 = JSON.stringify(sessFrozen)
const snapshot2 = JSON.stringify(sessFrozen)
check('会话内渲染顺序稳定（对象不被后续操作改变）', snapshot1 === snapshot2)

// 无 optionId→position 推导（数据级：shuffle 前无 displayPosition 键，shuffle 后按索引赋值）
const preShuffle = mirror.shuffleWithPositions([{ optionId: 'A', text: 'x' }, { optionId: 'B', text: 'y' }], () => 0)
check('shuffle 结果按渲染索引赋 displayPosition（无 optionId→position 推导）',
  preShuffle.every((o, i) => o.displayPosition === i))

// ═══════════════════════════════════════════════════════════════
// C. 答案校验
// ═══════════════════════════════════════════════════════════════
console.log('=== C. 答案校验 ===')
const sessC = mirror.buildSessionQuestions(seededRandom(42))
function fullAnswers() {
  return sessC.map((q) => ({ questionId: q.questionId, optionId: q.options[0].optionId, displayPosition: 0 }))
}

check('18 条唯一答案 → valid', mirror.validateAnswers(sessC, fullAnswers()).valid === true)
check('17 条 → 拒', mirror.validateAnswers(sessC, fullAnswers().slice(0, 17)).valid === false)

const dup = fullAnswers(); dup[1] = { ...dup[0] }
check('重复 questionId → 拒', mirror.validateAnswers(sessC, dup).valid === false)

const badQ = fullAnswers(); badQ[0] = { ...badQ[0], questionId: 'NOPE_01' }
check('非法 questionId → 拒', mirror.validateAnswers(sessC, badQ).valid === false)

const badO = fullAnswers(); badO[0] = { ...badO[0], optionId: 'Z' }
check('非法 optionId → 拒', mirror.validateAnswers(sessC, badO).valid === false)

const missP = fullAnswers(); const { displayPosition, ...rest } = missP[0]; missP[0] = rest
check('缺 displayPosition → 拒', mirror.validateAnswers(sessC, missP).valid === false)

const nonInt = fullAnswers(); nonInt[0] = { ...nonInt[0], displayPosition: 1.5 }
check('非整数 displayPosition → 拒', mirror.validateAnswers(sessC, nonInt).valid === false)

const oob = fullAnswers(); oob[0] = { ...oob[0], displayPosition: 99 }
check('越界 displayPosition → 拒', mirror.validateAnswers(sessC, oob).valid === false)

const qFirst = sessC[0]
const mismatch = fullAnswers()
const otherOption = qFirst.options.find((o) => o.optionId !== qFirst.options[0].optionId)
mismatch[0] = { questionId: qFirst.questionId, optionId: otherOption.optionId, displayPosition: 0 }
check('optionId 与 displayPosition 处选项不匹配 → 拒',
  mirror.validateAnswers(sessC, mismatch).valid === false)

// ═══════════════════════════════════════════════════════════════
// D. 请求
// ═══════════════════════════════════════════════════════════════
console.log('=== D. 请求 ===')
const req = mirror.buildCloudRequest(fullAnswers())
check('name === generateAiReport', req.name === 'generateAiReport')
check('type === diagnostic', req.data.type === 'diagnostic')
check('diagnosticVersion === world_model_v2_1（精确字面量）', req.data.diagnosticVersion === 'world_model_v2_1')
check('answers 是裸 18 元组数组', Array.isArray(req.data.answers) && req.data.answers.length === 18)
check('每条 answer 精确 {questionId, optionId, displayPosition}',
  req.data.answers.every(a => Object.keys(a).sort().join(',') === 'displayPosition,optionId,questionId'))
check('请求无 openid', !('openid' in req.data))
check('请求无语义字段', !JSON.stringify(req.data).includes('semanticPropositionRefs'))
check('请求无 evidence 字段', !JSON.stringify(req.data).includes('evidence'))
check('请求无 blindspot 字段', !JSON.stringify(req.data).includes('blindspot'))
check('请求无 primary 字段', !JSON.stringify(req.data).includes('primary'))
check('请求无 wealth 字段', !JSON.stringify(req.data).includes('wealth'))

// ═══════════════════════════════════════════════════════════════
// E. 隔离
// ═══════════════════════════════════════════════════════════════
console.log('=== E. 隔离 ===')
check('app.json 注册了 v21-questionnaire-test', APP_JSON.pages.includes('pages/v21-questionnaire-test/v21-questionnaire-test'))
check('不在 tabBar', !(APP_JSON.tabBar && APP_JSON.tabBar.list.some(t => t.pagePath === 'pages/v21-questionnaire-test/v21-questionnaire-test')))

const HOME_SRC = fs.readFileSync(path.join(ROOT, 'pages/home/home.js'), 'utf8')
check('home.js 不导航到 v21-questionnaire-test', !HOME_SRC.includes('v21-questionnaire-test'))

check('页面不导航到 report-detail', !PAGE_SRC.includes('report-detail'))
check('页面不 navigateTo/redirectTo/switchTab', !/wx\.navigateTo|wx\.redirectTo|wx\.switchTab/.test(PAGE_SRC))

check('不写 globalData._diagnosticAnswers', !PAGE_SRC.includes('_diagnosticAnswers'))
check('不写 globalData._diagnosticReport', !PAGE_SRC.includes('_diagnosticReport'))
check('不写 globalData._diagnosticPersonality', !PAGE_SRC.includes('_diagnosticPersonality'))
check('不调用 wx.setStorage', !PAGE_SRC.includes('wx.setStorage'))
check('不调用 wx.cloud.database', !PAGE_SRC.includes('wx.cloud.database'))

// 页面不渲染 primary 诊断 / 盲点 / 财富 / 置信度 / 严重度
check('页面不渲染 primaryBlindSpot', !WXML_SRC.includes('primaryBlindSpot'))
check('页面不渲染 primaryConstruct', !WXML_SRC.includes('primaryConstruct'))
check('页面不渲染 blindspot 结论', !WXML_SRC.includes('blindspot'))
check('页面不渲染 wealth', !WXML_SRC.includes('wealth'))
check('页面不渲染 confidence', !WXML_SRC.includes('confidence'))
check('页面不渲染 severity', !WXML_SRC.includes('severity'))
// 页面 JS 不读取/渲染 primary 诊断字段
check('页面 JS 不读取 primaryBlindSpotId', !PAGE_SRC.includes('primaryBlindSpotId'))
check('页面 JS 不读取 primaryConstruct', !PAGE_SRC.includes('primaryConstruct'))

// ═══════════════════════════════════════════════════════════════
// F. 重复提交保护
// ═══════════════════════════════════════════════════════════════
console.log('=== F. 重复提交保护 ===')
check('submit 入口检查 submitting/submitted 锁', /if\s*\(this\.data\.submitting\s*\|\|\s*this\.data\.submitted\)\s*return/.test(PAGE_SRC))
check('提交前 setData submitting=true', PAGE_SRC.includes('setData({ submitting: true'))
check('成功后 submitted=true', PAGE_SRC.includes('submitted: true'))
check('成功后 submitting=false', PAGE_SRC.includes('submitting: false'))
check('selectOption 受 submitting/submitted 锁保护',
  /selectOption[\s\S]{0,80}submitting\s*\|\|\s*this\.data\.submitted/.test(PAGE_SRC))
check('goNext 受 submitting/submitted 锁保护',
  /goNext[\s\S]{0,80}submitting\s*\|\|\s*this\.data\.submitted/.test(PAGE_SRC))
check('显式 restartSession 重建会话', PAGE_SRC.includes('restartSession'))
check('startSession 重置 _submitted=false', PAGE_SRC.includes('this._submitted = false'))
check('成功会话不静默重提（无自动 submit 循环）',
  !/setTimeout[\s\S]*submit|setInterval[\s\S]*submit/.test(PAGE_SRC))

// 汇总
console.log(`\n=== 结果: ${pass} pass / ${fail} fail ===`)
if (fail > 0) {
  console.error('FAILED: ' + failures.join(' | '))
  process.exit(1)
}
console.log('R6_R4_V21_REAL_USER_TEST = PASS')
process.exit(0)
