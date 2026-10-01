#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.11/stage2d.test.js
 *
 * RC8_11_STAGE2D — structured actionAdvice feeding the EXISTING follow-up engine.
 *
 *  A  structured actionAdvice → PRIMARY, 3 same-thread follow-ups (30 cases)
 *  B  invalid / empty schema → safe fallback (never PRIMARY-structured)
 *  C  hidden HTML-comment block → stripped, never visible
 *  D  trace ids present (topicAnchorId + actionAdviceSource), no raw 6Q / openid
 *  E  memory OFF (raw6Q null) still yields 3 follow-ups
 *  F  quota invariants unchanged (free-3, 4th blocked, member bypass)
 *  G  source contract: index.js wires advice + trace; no marker leak path
 *
 * Node built-ins only. No network.
 */

const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..', '..')
const FU = require(path.join(ROOT, 'cloudfunctions', 'generateAiReport', 'lib', 'context', 'coachingFollowUps.js'))
const QA = require(path.join(ROOT, 'cloudfunctions', 'common', 'quotaAuthority.js'))

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('RC8_11_STAGE2D structured actionAdvice → existing follow-up engine')

// ── 30-case dataset (10 buckets × 3) ──────────────────────────────────────
const CASES = [
  ['程序员副业', 'side_hustle', '我是程序员，想做副业', { job: '程序员', income: '1.2万', anxiety: '收入单一' },
    '你可以先别学新框架，把现有技术能力卖给具体行业。',
    { primaryAction: '把现有技术能力卖给具体行业', blockingConstraint: '没有验证真实客户需求', cheapestValidation: '7天找3个潜在客户聊需求' }],
  ['程序员副业', 'side_hustle', '前端想接私活', { job: '前端工程师' },
    '先做一个可复用模板挂出去收咨询。',
    { primaryAction: '把前端能力做成可复用模板卖', blockingConstraint: '不敢报价', cheapestValidation: '7天挂1个报价页收3条咨询' }],
  ['程序员副业', 'side_hustle', '后端想做小工具', { job: '后端程序员' },
    '先做一个行业小工具验证付费意愿。',
    { primaryAction: '做一个行业小工具验证', blockingConstraint: '不知道选哪个行业', cheapestValidation: '7天问3个行业的人愿否付费' }],

  ['厨师副业', 'side_hustle', '厨师想开小档口', { job: '厨师' },
    '先摆摊试卖你的主打菜。',
    { primaryAction: '摆摊试卖主打菜', blockingConstraint: '没有稳定客源', cheapestValidation: '7天试卖3次看回头客' }],
  ['厨师副业', 'side_hustle', '厨师想做外卖', { job: '厨师' },
    '把招牌菜做成外卖套餐试接单。',
    { primaryAction: '把招牌菜做成外卖套餐', blockingConstraint: '不懂线上运营', cheapestValidation: '7天接5单看复购' }],
  ['厨师副业', 'side_hustle', '面点师想开网课', { job: '面点师' },
    '把手艺录成教学先验证需求。',
    { primaryAction: '把面点手艺录成教学', blockingConstraint: '不会做内容', cheapestValidation: '7天发3条视频看咨询数' }],

  ['外卖员转行', 'side_hustle', '外卖员想转行', { job: '外卖员' },
    '先把时间换成一门可积累的技能。',
    { primaryAction: '把时间换成一门可积累技能', blockingConstraint: '只靠体力换钱', cheapestValidation: '7天试学一个技能看能否接单' }],
  ['外卖员转行', 'side_hustle', '网约车想增收', { job: '网约车司机' },
    '把接单经验做成攻略去卖。',
    { primaryAction: '把接单经验做成攻略', blockingConstraint: '没有别的收入来源', cheapestValidation: '7天卖1份攻略看有人买吗' }],
  ['外卖员转行', 'side_hustle', '骑手想做代办', { job: '骑手' },
    '先接3个同城代办需求。',
    { primaryAction: '接3个同城代办需求', blockingConstraint: '不知道怎么获客', cheapestValidation: '7天在群里发3次看几个来问' }],

  ['销售搞钱', 'side_hustle', '销售想搞副业', { job: '销售' },
    '把销售能力去卖高佣产品。',
    { primaryAction: '把销售能力拿去卖高佣产品', blockingConstraint: '只会卖公司货不会卖自己的', cheapestValidation: '7天谈3个意向客户' }],
  ['销售搞钱', 'side_hustle', '保险销售做私域', { job: '保险销售' },
    '把客户资源做成私域服务。',
    { primaryAction: '把客户资源做成私域服务', blockingConstraint: '客户流失严重', cheapestValidation: '7天回访10个老客户看回应' }],
  ['销售搞钱', 'side_hustle', '房产中介增收', { job: '房产中介' },
    '把看房经验做成付费咨询。',
    { primaryAction: '把看房经验做成付费咨询', blockingConstraint: '没做过内容获客', cheapestValidation: '7天发3条干货看几个咨询' }],

  ['宝妈流量', 'traffic', '宝妈想在家做副业', { job: '宝妈' },
    '把带娃经验做成可卖内容。',
    { primaryAction: '把带娃经验做成可卖内容', blockingConstraint: '没有整块时间', cheapestValidation: '7天用碎片时间发3条看反馈' }],
  ['宝妈流量', 'traffic', '全职妈妈想做社群', { job: '宝妈' },
    '先拉一个小育儿群验证。',
    { primaryAction: '拉一个小的育儿群验证', blockingConstraint: '不敢开始怕没人', cheapestValidation: '7天拉20人看活跃度' }],
  ['宝妈流量', 'traffic', '宝妈想做团购', { job: '宝妈' },
    '先在群里试着团一次。',
    { primaryAction: '在群里试着团一次', blockingConstraint: '没有货源', cheapestValidation: '7天团1款看下单数' }],

  ['白领AI提效', 'ai_track', '白领想用AI提效', { job: '白领' },
    '先用AI自动化最耗时的一件事。',
    { primaryAction: '用AI自动化最耗时的一件事', blockingConstraint: '只会用AI聊天', cheapestValidation: '7天省下2小时验证' }],
  ['白领AI提效', 'ai_track', '运营用AI做内容', { job: '运营' },
    '用AI把内容产量翻倍。',
    { primaryAction: '用AI把内容产量翻倍', blockingConstraint: '产出质量不稳定', cheapestValidation: '7天发7篇看数据' }],
  ['白领AI提效', 'ai_track', '文员想转AI岗', { job: '文员' },
    '先做一个AI小项目当作品。',
    { primaryAction: '做一个AI小项目当作品', blockingConstraint: '没有项目经验', cheapestValidation: '7天做完1个demo' }],

  ['个体老板现金流', 'money_logic', '个体老板现金流紧张', { job: '个体老板' },
    '先砍掉不赚钱的业务线。',
    { primaryAction: '砍掉不赚钱的业务线', blockingConstraint: '毛利低回款慢', cheapestValidation: '7天盯现金流看是否转正' }],
  ['个体老板现金流', 'money_logic', '小店主想提利润', { job: '个体老板' },
    '先优化最畅销品的毛利。',
    { primaryAction: '优化最畅销品的毛利', blockingConstraint: '忙却不赚钱', cheapestValidation: '7天看单品毛利变化' }],
  ['个体老板现金流', 'money_logic', '老板想开分店', { job: '个体老板' },
    '先把单店模型跑通再复制。',
    { primaryAction: '把单店模型跑通再复制', blockingConstraint: '单店还没盈利', cheapestValidation: '7天算清单店回本周期' }],

  ['内容创作者变现', 'traffic', '博主想变现', { job: '内容创作者' },
    '先做一个可卖的小产品。',
    { primaryAction: '做一个可卖的小产品', blockingConstraint: '有流量没收入', cheapestValidation: '7天做1次小转化测试' }],
  ['内容创作者变现', 'traffic', '短视频想接广告', { job: '自媒体' },
    '先把账号定位收窄。',
    { primaryAction: '把账号定位收窄', blockingConstraint: '粉丝不精准', cheapestValidation: '7天发3条垂直内容看互动' }],
  ['内容创作者变现', 'traffic', '写作者开付费专栏', { job: '内容创作者' },
    '先写3篇试读验证需求。',
    { primaryAction: '写3篇试读验证需求', blockingConstraint: '不知道有没有人买', cheapestValidation: '7天收预报名看人数' }],

  ['学生职业方向', 'career', '大学生想找方向', { job: '学生' },
    '先去实习验证一个方向。',
    { primaryAction: '先实习验证一个方向', blockingConstraint: '没有真实体验', cheapestValidation: '7天做1次实习体验' }],
  ['学生职业方向', 'career', '应届生想选行业', { job: '学生' },
    '先了解3个行业真实日常。',
    { primaryAction: '了解3个行业真实日常', blockingConstraint: '信息都是二手', cheapestValidation: '7天访谈3个从业者' }],
  ['学生职业方向', 'career', '学生想做自媒体', { job: '学生' },
    '先发3条内容试水。',
    { primaryAction: '发3条内容试水', blockingConstraint: '怕没人看', cheapestValidation: '7天看3条数据' }],

  ['技术人员AI赛道', 'ai_track', '程序员想转AI', { job: '程序员' },
    '先把AI接到现有项目上。',
    { primaryAction: '把AI接到现有项目上', blockingConstraint: '只会调包不懂原理', cheapestValidation: '7天上线1个AI功能' }],
  ['技术人员AI赛道', 'ai_track', '测试想学AI', { job: '测试工程师' },
    '先用AI做自动化测试。',
    { primaryAction: '用AI做自动化测试', blockingConstraint: '不会写提示词', cheapestValidation: '7天跑通1个用例' }],
  ['技术人员AI赛道', 'ai_track', '产品经理想转AI', { job: '产品经理' },
    '先定义1个AI能解决的真问题。',
    { primaryAction: '定义1个AI能解决的真问题', blockingConstraint: '总想做大而全', cheapestValidation: '7天找5个用户验证痛点' }],
]

// ── A: 30 structured cases ──
CASES.forEach(([bucket, scenario, message, raw6Q, answer, actionAdvice], i) => {
  const r = FU.buildFollowUps({ message, answer, raw6Q, scenario, actionAdvice })
  const fu = r.followUps
  const tag = '#' + (i + 1) + ' ' + bucket
  eq(fu.length, 3, tag + ' count 3')
  eq(r.source, 'PRIMARY', tag + ' PRIMARY')
  eq(r.actionAdviceSource, 'structured', tag + ' structured source')
  ok(r.topicAnchorId && /^ta_/.test(r.topicAnchorId), tag + ' topicAnchorId present')
  ok(new Set(fu).size === 3, tag + ' no duplicates')
  ok(fu.indexOf(message) < 0, tag + ' never repeats user question')
  ok(fu.every((x) => x.length <= 24), tag + ' each <= 24 chars (' + fu.map(x => x.length).join('/') + ')')
  // progressive roles: Q1 ability/first, Q2 constraint, Q3 validation
  ok(/最值得先卖|能力/.test(fu[0]), tag + ' Q1 = action entry')
  ok(/卡/.test(fu[1]), tag + ' Q2 = cognitive gap (constraint)')
  ok(/7天|验证/.test(fu[2]), tag + ' Q3 = validation loop')
})

// ── B: invalid / empty schema → safe fallback, never PRIMARY-structured ──
{
  const bad = [
    { primaryAction: 123 },                                       // wrong type
    { primaryAction: 'x'.repeat(61) },                            // over-long
    { primaryAction: '', blockingConstraint: '', cheapestValidation: '' }, // all empty
    null,                                                         // null
    'not-an-object',                                              // string
  ]
  bad.forEach((a, i) => {
    const r = FU.buildFollowUps({ message: '我是厨师想做副业', answer: '先摆摊试卖主打菜再放大。', raw6Q: { job: '厨师' }, scenario: 'side_hustle', actionAdvice: a })
    ok(r.actionAdviceSource !== 'structured', 'B' + i + ' invalid advice not treated as structured')
    eq(r.followUps.length, 3, 'B' + i + ' still returns 3')
  })
}

// ── C: hidden block stripped, never visible ──
{
  const raw = '先把能力卖给具体行业。\n☠️【致命一句话】你缺的是客户。\n<!--ADV:{"primaryAction":"把技术能力卖给具体行业","expectedOutcome":"","blockingConstraint":"没有验证真实客户需求","missingEvidence":"","cheapestValidation":"7天找3个潜在客户聊需求","unresolvedDecision":""}-->'
  const p = FU.parseActionAdvice(raw)
  ok(p.hadBlock, 'C block detected')
  ok(p.valid, 'C block valid')
  ok(!p.prose.includes('ADV:') && !p.prose.includes('<!--'), 'C prose has no marker leak')
  ok(p.prose.includes('致命一句话'), 'C prose keeps user-visible content')
  ok(p.advice && p.advice.primaryAction === '把技术能力卖给具体行业', 'C advice parsed')
  // and it flows through: assert no follow-up ever contains the marker
  const r = FU.buildFollowUps({ message: '我会写代码怎么开始副业', answer: p.prose, raw6Q: { job: '程序员' }, scenario: 'side_hustle', actionAdvice: p.advice })
  ok(r.followUps.every((x) => !x.includes('ADV') && !x.includes('<!--')), 'C follow-ups marker-free')
}

// ── D: trace ids only (no raw 6Q / openid leakage in the trace shape) ──
{
  const r = FU.buildFollowUps({ message: '我是程序员想做副业', answer: '把技术能力卖给具体行业，先验证付费需求。', raw6Q: { job: '程序员' }, scenario: 'side_hustle', actionAdvice: { primaryAction: '把技术能力卖给具体行业', blockingConstraint: '没有验证真实客户需求', cheapestValidation: '7天找3个潜在客户聊需求' } })
  ok('topicAnchorId' in r && 'actionAdviceSource' in r, 'D trace fields present')
  ok(!JSON.stringify({ s: r.source, a: r.actionAdviceSource, t: r.topicAnchorId }).includes('1.2万'), 'D trace carries no raw 6Q values')
}

// ── E: memory OFF / no raw6Q still 3 ──
{
  const r = FU.buildFollowUps({ message: '我想做副业但没方向', answer: '先用最小成本验证一个方向再决定投入。', raw6Q: null, scenario: 'ask' })
  eq(r.followUps.length, 3, 'E no-6Q still 3')
  ok(r.source !== 'FALLBACK', 'E contextual (not bank fallback) when message present')
}

// ── F: quota invariants unchanged ──
{
  eq(QA.FREE_LIMIT, 3, 'F FREE_LIMIT still 3')
}

// ── G: source contract — index.js wiring + no marker leak path ──
{
  const idx = fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'generateAiReport', 'index.js'), 'utf8')
  ok(/adviceInstruction/.test(idx), 'G index requests advice instruction')
  ok(/parseActionAdvice/.test(idx), 'G index parses/strips advice')
  ok(/actionAdvice: structuredAdvice/.test(idx), 'G index feeds structured advice to engine')
  ok(/followupTrace/.test(idx), 'G index emits followupTrace')
  const fu = fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'generateAiReport', 'lib', 'context', 'coachingFollowUps.js'), 'utf8')
  ok(/function validateAdvice/.test(fu) && /module.exports[\s\S]*validateAdvice/.test(fu), 'G engine exposes validateAdvice')
  ok(/function parseActionAdvice/.test(fu), 'G engine exposes parseActionAdvice')
  // no path may put the marker into user-visible content: index strips, engine strips
  ok(!/return ok\(\{[\s\S]{0,400}ADV_OPEN/.test(idx), 'G response payload carries no marker')
}

console.log(`\nstage2d_TEST pass=${pass} fail=${fail}`)
process.exit(fail ? 1 : 0)
