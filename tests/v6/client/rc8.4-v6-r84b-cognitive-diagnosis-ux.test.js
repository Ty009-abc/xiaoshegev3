'use strict'
/**
 * tests/v6/client/rc8.4-v6-r84b-cognitive-diagnosis-ux.test.js
 *
 * RC8.4 V6 R84-B — COGNITIVE DIAGNOSIS UX + VISUAL HIERARCHY FINALIZATION.
 *
 * Covers the R84-B acceptance surface:
 *   §2  R84A_COPY_SEMANTIC_DIFF_COUNT = 0 (frozen content, view-model split only)
 *   §5  thinking copy (no "AI正在生成报告" / "扫描大脑" / "计算人生")
 *   §6  report opening (短)
 *   §7-§11 card visual hierarchy contracts (hero / identity split / loop /
 *         FROM→TO / action units) as rendered by the CLIENT view model
 *   §12 purple emphasis policy (no long purple paragraphs)
 *   §18/§19 report closing (no motivational quote; R77-R79-supported claim only)
 *   §20 home return path (existing routes only, no dead end)
 *   §21 no visual redesign (design tokens + card structure preserved)
 *   §23 poster content compatibility
 *
 * Deterministic. No network. Reads the REAL view model + page sources.
 */

const assert = require('assert')
const path = require('path')
const fs = require('fs')
const ROOT = path.resolve(__dirname, '../../..')
const VM = require(path.join(ROOT, 'utils/v6/turnaroundReportViewModelV6.js'))

let pass = 0, fail = 0
function t (name, fn) { try { fn(); pass++; console.log('  PASS ' + name) } catch (e) { fail++; console.log('  FAIL ' + name + ' :: ' + e.message) } }

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')
const WXML = read('pages/turnaround-v6-report/turnaround-v6-report.wxml')
const WXSS = read('pages/turnaround-v6-report/turnaround-v6-report.wxss')
const RJS = read('pages/turnaround-v6-report/turnaround-v6-report.js')
const HYB_WXML = read('pages/turnaround-v6-hybrid-questionnaire/turnaround-v6-hybrid-questionnaire.wxml')
const V6Q_WXML = read('pages/turnaround-v6-questionnaire/turnaround-v6-questionnaire.wxml')
const HYB_WXSS = read('pages/turnaround-v6-hybrid-questionnaire/turnaround-v6-hybrid-questionnaire.wxss')

// ── Fixtures: the EXACT R84-A visible-layer copy (frozen content) ──
const R84A = {
  card01: "你不是没行动，你是在用'还没准备好'回避被市场拒绝。",
  card02: "你是一个'有手艺、没资产'的业余创作者。被付过一次钱，说明市场认过你；但那份认可至今没有变成一条独立于工资的收入管道。你手里握着一张已经中过一次奖的彩票，却一直没去兑。",
  card03: { steps: ['工资给的安全垫，让你可以无限期\'准备\'而不必真交付；', '没有真交付，就没有真实市场反馈，你只能靠猜；', '越猜越不确定，越不确定越不敢全押，于是退回工资里继续等\'想清楚\'。'], rule: '这个循环里，工资是安全网，也是麻醉剂。' },
  card04: { from: '靠工资养着、偶尔接一单的业余创作者', to: '有一个能重复卖的内容产品、有真实付费买家的小生意人', rule: "市场不为'有本事'付钱，只为'被交付出去、被人看见、被人重复购买'的东西付钱。能力不进入交易，就等于零。" },
  card05: { goal: '90天内把内容能力变成一个有人真实付费的最小产品，并完成至少一次重复交付。', actions: ['定产品：从你被付过钱的那类需求里，选一个最具体的问题，做成一个能一次交付完的东西。', '找买家：在你已经被看见的渠道上，公开报价、公开交付，不私聊、不暗示。', '跑复购：把第一次交付整理成可复用的结构，第二次卖同样的东西给下一个人，而不是每次从头再来。'], actionItems: [{ title: '定产品', text: '从你被付过钱的那类需求里，选一个最具体的问题，做成一个能一次交付完的东西。' }, { title: '找买家', text: '在你已经被看见的渠道上，公开报价、公开交付，不私聊、不暗示。' }, { title: '跑复购', text: '把第一次交付整理成可复用的结构，第二次卖同样的东西给下一个人，而不是每次从头再来。' }], acceptance: '你的账户里出现一笔不来自工资的、可重复的收入。' }
}

function envelope (v) {
  return {
    code: 0,
    data: {
      reportType: 'turnaround_strategy_v6',
      diagnosticVersion: 'turnaround_strategy_v6',
      v6PrimaryActive: true,
      reportVersion: 'v6',
      reportState: 'NO_PRIMARY',
      cards: {
        fatalInsight: { title: '致命一句话', text: v.card01 },
        coreProblem: { title: '核心问题', text: v.card02 },
        systemLoop: { title: '系统困局', steps: v.card03.steps, insight: v.card03.rule },
        turnaroundPath: { title: '翻身路径', from: v.card04.from, to: v.card04.to, worldRuleLine: v.card04.rule },
        firstAction: { title: '现在就做', visible: { goal: v.card05.goal, actions: v.card05.actions, actionItems: v.card05.actionItems, acceptance: v.card05.acceptance } },
      },
    },
  }
}

const vm = VM.buildTurnaroundReportViewModelV6(envelope(R84A))
const [c1, c2, c3, c4, c5] = vm.cards

console.log('R84-B cognitive diagnosis UX tests')

// ── §2 R84A content frozen: view-model split reconstructs the copy exactly ──
t('§2 R84A_COPY_SEMANTIC_DIFF_COUNT = 0 (card02 identity+explanation === body)', () => {
  assert.ok(c2.identity, 'identity present')
  assert.ok(c2.explanation, 'explanation present')
  assert.strictEqual(c2.identity + c2.explanation, c2.body, 'split must reconstruct body verbatim')
  assert.strictEqual(c2.identity, R84A.card02.slice(0, R84A.card02.indexOf('。') + 1), 'identity = first sentence')
})
t('§2 card01 copy unchanged (oneLiner verbatim)', () => { assert.strictEqual(c1.oneLiner, R84A.card01) })
t('§2 card03 / card04 / card05 copy unchanged', () => {
  assert.deepStrictEqual(c3.loopNodes, R84A.card03.steps)
  assert.strictEqual(c3.finalInsight, R84A.card03.rule)
  assert.strictEqual(c4.from, R84A.card04.from)
  assert.strictEqual(c4.to, R84A.card04.to)
  assert.strictEqual(c4.worldRule, R84A.card04.rule)
  assert.strictEqual(c5.goal, R84A.card05.goal)
  assert.strictEqual(c5.acceptance, R84A.card05.acceptance)
  assert.deepStrictEqual(c5.actionItems.map((x) => x.text), R84A.card05.actionItems.map((x) => x.text))
})

// ── §2/§7/§8/§9/§10/§11 additive presentation fields ──
t('§7 card01 is HERO (page emits hero class for fatalInsight)', () => {
  assert.ok(/card-hero/.test(WXML), 'card-hero class wired')
  assert.ok(/item\.key === 'fatalInsight'/.test(WXML), 'hero gated on fatalInsight')
})
t('§8 card02 identity/explanation split in the view model', () => {
  assert.ok('identity' in c2 && 'explanation' in c2, 'identity + explanation present')
  assert.ok(!('loopNodes' in c2), 'card02 must not carry loopNodes')
})
t('§9 card03 steps carry an index (vertical scan) + distinct conclusion', () => {
  assert.ok(/card-step-idx/.test(WXML), 'step index rendered')
  assert.ok(/card-conclusion-tag/.test(WXML), 'conclusion visually distinct')
  assert.ok(c3.loopNodes.length >= 3)
})
t('§10 card04 FROM→TO directional labels + one-wayarrow + worldRule label', () => {
  assert.strictEqual(c4.fromLabel, '现在')
  assert.strictEqual(c4.arrow, '→')
  assert.strictEqual(c4.toLabel, '接下来')
  assert.strictEqual(c4.worldRuleLabel, '世界规则')
  assert.ok(/path-row-to/.test(WXML), 'TO row has stronger class')
  assert.ok(/path-row-to \.path-text[^}]*font-weight:\s*700/.test(WXSS), 'TO weight > FROM')
})
t('§11 card05 action units carry 行动n index + fixed section labels', () => {
  assert.deepStrictEqual(c5.actionItems.map((x) => x.label), ['行动1', '行动2', '行动3'])
  assert.strictEqual(c5.goalLabel, '90天目标')
  assert.strictEqual(c5.acceptLabel, '验证标准')
  assert.ok(/action-step-head/.test(WXML), 'action micro-heading rendered')
})
t('§11 card05 not a single continuous paragraph', () => {
  assert.ok(c5.actionItems.length === 3, '3 distinct action units')
  assert.ok(!/action-block[^]*?<view class="card-body">\{\{item\.text\}\}/.test(WXML), 'not aggregate text')
})

// ── §5 thinking copy ──
t('§5 thinking copy uses approved progress language', () => {
  const blob = HYB_WXML + V6Q_WXML
  assert.ok(/正在比对你的现实条件/.test(blob), '现实条件')
  assert.ok(/正在寻找反复卡住你的模式/.test(blob), '反复卡住')
  assert.ok(/正在整理你的破局路径/.test(blob), '破局路径')
})
t('§5 no forbidden thinking copy', () => {
  const blob = HYB_WXML + V6Q_WXML
  for (const bad of ['正在扫描你的大脑', '正在计算你的人生', 'AI正在生成报告', '请稍候，正在根据你的回答生成报告']) {
    assert.ok(blob.indexOf(bad) === -1, 'must not contain: ' + bad)
  }
})
t('§5 thinking styles defined', () => { assert.ok(/\.thinking-line-active/.test(HYB_WXSS)) })

// ── §6 opening ──
t('§6 report opening is short, no long intro paragraph', () => {
  assert.ok(/下面不是建议，是你当前最值得看清的一件事/.test(WXML), 'orientation line present')
  const head = WXML.match(/<view class="report-head">[\s\S]*?<\/view>\s*<\/view>/)
  assert.ok(head && head[0].length < 600, 'opening block stays compact')
})

// ── §12 purple emphasis policy ──
t('§12 purple is scoped to high-value tokens only', () => {
  // purple usages present: hero border / identity / conclusion / TO / goal / accept
  for (const sel of ['.card-hero', '.card-identity', '.card-conclusion-text', '.path-row-to .path-text', '.action-goal-text', '.action-accept-text']) {
    assert.ok(WXSS.indexOf(sel) !== -1, 'purple token present: ' + sel)
  }
})
t('§12 no long purple paragraph (worldRule + steps are NOT purple)', () => {
  assert.ok(!/\.card-rule-text[^}]*color:\s*#7f56d9/.test(WXSS), 'worldRule not purple')
  assert.ok(!/\.card-step-text[^}]*color:\s*#7f56d9/.test(WXSS), 'mechanism steps not purple')
})

// ── §18/§19 closing ──
t('§18 report closing has no generic motivational quote', () => {
  assert.ok(/report-closing/.test(WXML), 'closing block present')
  for (const bad of ['加油', '相信自己', '你一定能', '天生我材', '未来可期']) {
    assert.ok(WXML.indexOf(bad) === -1, 'no motivational filler: ' + bad)
  }
})
t('§19 closing claim is R77-R79-supported (personalization continuity) only', () => {
  assert.ok(/之后的认知内容会根据这次诊断继续推荐/.test(WXML), 'supported continuity claim')
  assert.ok(!/记住你的一切|永久记忆|无所不知|AI会永远/.test(WXML), 'no overpromise')
})

// ── §20 home return path ──
t('§20 home return reuses EXISTING routes only (no new architecture)', () => {
  for (const r of ['/pages/home/home', '/pages/world-rules/world-rules', '/pages/cognition-daily/cognition-daily', '/pages/ai-chat/ai-chat']) {
    assert.ok(RJS.indexOf(r) !== -1, 'route present: ' + r)
  }
})
t('§20 report no longer dead-ends (home/return path rendered)', () => {
  assert.ok(/report-home/.test(WXML) && /onGoHome/.test(WXML), 'home grid + home CTA present')
})

// ── §21 no visual redesign (design tokens preserved) ──
t('§21 premium white/purple design language preserved', () => {
  assert.ok(/#7f56d9/.test(WXSS), 'brand purple kept')
  assert.ok(/#fff/.test(WXSS), 'white cards kept')
  assert.ok(/border-radius:\s*20rpx/.test(WXSS), 'card radius kept')
})
t('§21 card structure/numbering preserved', () => {
  assert.ok(/class="card-num">0\{\{cardIndex \+ 1\}\}/.test(WXML), '01–05 numbering kept')
})

// ── §22 no old V4 cyber return ──
t('§22 no cyber/neon/fortune-telling visuals', () => {
  for (const bad of ['neon', 'glow-text', 'cyber', 'text-shadow: 0 0 20', 'matrix']) {
    assert.ok(WXSS.toLowerCase().indexOf(bad.toLowerCase()) === -1, 'no cyber token: ' + bad)
  }
})

// ── §23 poster content compatibility ──
t('§23 poster content compatible: no overflow (card budgets respected) / no title collision', () => {
  // The poster consumes report fields; R84-B adds NO poster-facing fields and
  // does NOT lengthen any card text (view-model split concatenates to body).
  const len = (s) => [...String(s)].length
  assert.ok(len(c1.oneLiner) <= 40, 'card01 <= 40')
  assert.ok(len(c2.body) <= 140, 'card02 <= 140')
  assert.ok(c3.loopNodes.reduce((a, s) => a + len(s), 0) + len(c3.finalInsight) <= 220, 'card03 <= 220')
  assert.ok(len(c4.from) + len(c4.to) + len(c4.worldRule) <= 160, 'card04 <= 160')
  assert.ok(len(c5.goal) + c5.actionItems.reduce((a, s) => a + len(s.text), 0) + len(c5.acceptance) <= 240, 'card05 <= 240')
})

// ── §25 failure experience: safe, no technical jargon ──
t('§25 failure copy exposes no engineering jargon', () => {
  assert.ok(!/renderSource|validator|ENVELOPE|RC84|modelCalls|THINKING/.test(VM.NO_REPORT_MESSAGE + VM.RETRY_MESSAGE + VM.RETAKE_MESSAGE))
})

console.log('\nR84-B cognitive diagnosis UX: ' + pass + ' passed, ' + fail + ' failed')
process.exit(fail ? 1 : 0)
