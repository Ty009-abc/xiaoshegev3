#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.11/stage2bc.test.js
 *
 * RC8_11_STAGE2B/2C — AI-chat follow-up UI + remaining counter + membership paywall.
 *
 *  UI   : 3 contextual follow-ups after each answer; 3 starters only (no random 4);
 *         remaining counter; membership paywall (monthly/annual; NO retired CTAs).
 *  SERVER: paywall summary ≤ 3 facts; nextDirections = 3; offer = monthly/annual.
 *  BANK : 100-question bank file retained as FALLBACK only.
 *
 * Node built-ins only. No network.
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const CHAT_JS = path.join(ROOT, 'pages', 'ai-chat', 'ai-chat.js')
const CHAT_WXML = path.join(ROOT, 'pages', 'ai-chat', 'ai-chat.wxml')
const FU = require(path.join(ROOT, 'cloudfunctions', 'generateAiReport', 'lib', 'context', 'coachingFollowUps.js'))

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('RC8_11_STAGE2B/2C ai-chat follow-ups + quota UI + paywall')

// ── page harness ──
let CALLS = []
function loadChat (cloudImpl) {
  const src = fs.readFileSync(CHAT_JS, 'utf8')
  let config = null
  const sandbox = {
    require: (r) => {
      if (r.indexOf('data/aiChatSuggestions.js') >= 0) return require(path.join(ROOT, 'data', 'aiChatSuggestions.js'))
      if (r.indexOf('followupOwnership.js') >= 0) return require(path.join(ROOT, 'pages', 'ai-chat', 'followupOwnership.js'))
      if (r.indexOf('utils/userTrack.js') >= 0) return { event: () => {} }
      if (r.indexOf('../../utils/userTrack.js') >= 0) return { event: () => {} }
      throw new Error('unexpected require: ' + r)
    },
    getApp: () => ({ globalData: {} }),
    Page: (c) => { config = c },
    console, Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error,
    setTimeout: () => 0, clearTimeout: () => {},
    wx: {
      cloud: { callFunction: cloudImpl || (async () => ({ result: { code: 0, data: {} } })) },
      navigateTo: (o) => { CALLS.push({ m: 'navigateTo', url: o.url }) },
      showModal: () => {}, getStorageSync: () => '', setStorageSync: () => {},
      showToast: () => {},
    },
  }
  vm.createContext(sandbox)
  vm.runInContext(src, sandbox, { filename: CHAT_JS })
  const inst = Object.assign({}, config)
  inst.data = JSON.parse(JSON.stringify(config.data || {}))
  inst.setData = function (o) { Object.assign(inst.data, o) }
  return inst
}

;(async () => {
  // ── UI: contextual 3 follow-ups section ──
  {
    const w = fs.readFileSync(CHAT_WXML, 'utf8')
    ok(w.indexOf('接下来你可以继续问') >= 0, 'UI follow-up section present')
    ok(/wx:for="\{\{item\.followUps\}\}"/.test(w), 'UI renders answer-owned followUps')
    ok(w.indexOf('今日免费还可问') >= 0, 'UI remaining quota copy')
    ok(/wx:if="\{\{showPaywall\}\}"/.test(w), 'UI paywall gated by showPaywall')
    ok(w.indexOf('¥39.9/月') >= 0 || /monthly\.display/.test(w), 'UI monthly offer')
    ok(/annual\.display/.test(w), 'UI annual offer')
    // retired CTAs forbidden
    ok(w.indexOf('¥9.9') < 0, 'UI no ¥9.9 CTA')
    ok(w.indexOf('¥39.9/次') < 0 && w.indexOf('解锁完整挑战') < 0, 'UI no standalone challenge CTA')
    ok(w.indexOf('¥99') < 0, 'UI no ¥99 CTA')
    // starters = bank fallback, no "每次随机推荐4个" primary
    ok(w.indexOf('每次随机推荐4个') < 0, 'UI removed random-4 primary copy')
  }

  // ── JS: no random-4 primary; follow-ups + quota integrated ──
  {
    const j = fs.readFileSync(CHAT_JS, 'utf8')
    ok(j.indexOf('pickQuestions(4') < 0, 'JS no longer picks 4 as primary')
    ok(/onSelectFollowUp/.test(j), 'JS follow-up tap handler')
    ok(/quota_status/.test(j), 'JS probes quota status')
    ok(/10006/.test(j) && /quotaExhausted/.test(j), 'JS handles QUOTA_EXHAUSTED')
    ok(/pages\/membership\/membership\?source=ai_quota/.test(j), 'JS paywall routes to membership')
    ok(j.indexOf('vip_month_39_9') >= 0 && j.indexOf('vip_year_299') >= 0, 'JS offers monthly/annual member SKUs')
    ok(j.indexOf('report_9_9') < 0 && j.indexOf('challenge_39_9') < 0, 'JS offers no retired standalone SKU')
  }

  // ── runtime: starters = 3, not 4 ──
  {
    CALLS = []
    const p = loadChat()
    p.onLoad()
    eq(p.data.starters.length, 3, 'starters count 3')
    eq(p.data.activeFollowUps.length, 0, 'no followUps before any answer')
    eq(p.data.activeFollowUpParentId, '', 'no follow-up parent before any answer')
  }

  // ── runtime: answer returns 3 followUps + quota decrement ──
  {
    CALLS = []
    const p = loadChat(async () => ({ result: { code: 0, data: {
      content: '你可以先把技术能力产品化，从接单开始。',
      followUps: ['作为程序员，我副业的第一步该做什么？', '如果每天只有2小时，我第一周该怎么验证？', '怎么找到第一个愿意付钱的客户？'],
      quota: { isMember: false, remaining: 2, limit: 3 },
    } } }))
    p.onLoad()
    p.setData({ inputValue: '我是程序员，想做副业' })
    await p.onSend()
    eq(p.data.activeFollowUps.length, 3, 'answer → 3 followUps')
    ok(!!p.data.activeFollowUpParentId, 'answer → follow-up set bound to parent message')
    ok(p.data.activeFollowUpParentId === p.data.messages[p.data.messages.length - 1].id, 'follow-up parent == latest assistant message')
    eq(p.data.remaining, 2, 'answer → remaining 2')
    eq(p.data.quotaKnown, true, 'quota known after answer')
    eq(p.data.showPaywall, false, 'no paywall while remaining')
  }

  // ── runtime: quota exhausted → paywall, no AI reply ──
  {
    CALLS = []
    const p = loadChat(async () => ({ result: { code: 10006, message: '今天的3次免费深度问答已用完', data: {
      quotaExhausted: true, remaining: 0, needPay: true,
      paywall: { title: '今天的3次免费深度问答已用完', summary: ['职业：程序员'], nextDirections: ['a', 'b', 'c'], offer: { monthly: { productId: 'vip_month_39_9', display: '¥39.9/月' }, annual: { productId: 'vip_year_299', display: '¥299/年' } }, benefits: ['x'] },
    } } }))
    p.onLoad()
    p.setData({ inputValue: '再来一个问题' })
    await p.onSend()
    eq(p.data.showPaywall, true, 'paywall shown on quota exhausted')
    eq(p.data.remaining, 0, 'remaining 0')
    const assistantMsgs = p.data.messages.filter((m) => m.role === 'assistant')
    ok(assistantMsgs.every((m) => m.content !== '再来一个问题'), 'no echoed AI reply on block')
  }

  // ── runtime: member → no reminder, no paywall ──
  {
    const p = loadChat(async () => ({ result: { code: 0, data: { content: 'ok', followUps: ['a', 'b', 'c'], quota: { isMember: true, unlimited: true } } } }))
    p.onLoad()
    p.setData({ inputValue: 'hi' })
    await p.onSend()
    eq(p.data.isMember, true, 'member flag set')
    eq(p.data.remaining, null, 'member remaining null (unlimited)')
    eq(p.data.showPaywall, false, 'member no paywall')
  }

  // ── server paywall summary ≤ 3 facts + grounded ──
  {
    const s = FU.buildPaywallSummary({ raw6Q: { job: '程序员', income: '1.2万', anxiety: '收入单一' }, message: '想做副业' })
    ok(s.length <= 3, 'paywall summary ≤ 3 facts')
    ok(s.some((x) => /程序员/.test(x)), 'summary grounded on RAW_6Q job')
    const s2 = FU.buildPaywallSummary({ raw6Q: null, profile: null, message: '随便问问' })
    eq(s2.length, 0, 'no context → no fabricated summary facts')
  }

  // ── bank retained as fallback ──
  {
    const bank = require(path.join(ROOT, 'data', 'aiChatSuggestions.js'))
    ok(bank.AI_CHAT_SUGGESTIONS.length >= 90, 'KEEP_FILE: suggestion bank retained (' + bank.AI_CHAT_SUGGESTIONS.length + ')')
    ok(typeof bank.pickQuestions === 'function', 'bank pickQuestions available (fallback)')
  }

  console.log(`\nstage2bc_TEST pass=*** fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('RUNNER ERROR', e); process.exit(2) })
