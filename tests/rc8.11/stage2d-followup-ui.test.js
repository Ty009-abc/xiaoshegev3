#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.11/stage2d-followup-ui.test.js
 *
 * RC8_11_STAGE2D_FOLLOWUP_FLOW_UI_STABILITY — UI flow + ownership + exact-3.
 *
 *  A initial answer      → followups below answer, count 3
 *  B tap Q1              → old follow-ups hidden immediately, question appended
 *  C new answer loading  → old Q2/Q3 not visible
 *  D new answer success  → new answer full, new follow-ups below, count 3
 *  E rapid double tap    → one request only, no duplicate question
 *  F server returns 2    → client fills to 3
 *  G long AI answer      → follow-up block does not overlay (static flow)
 *  H quota 3rd answer    → answer visible before membership wall
 *  I quota exhausted     → wall does not mix with old follow-ups
 *
 * Node built-ins only. No network.
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const CHAT_JS = path.join(ROOT, 'pages', 'ai-chat', 'ai-chat.js')
const CHAT_WXML = path.join(ROOT, 'pages', 'ai-chat', 'ai-chat.wxml')
const CHAT_WXSS = path.join(ROOT, 'pages', 'ai-chat', 'ai-chat.wxss')
const OWN = require(path.join(ROOT, 'pages', 'ai-chat', 'followupOwnership.js'))

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('RC8_11_STAGE2D follow-up flow UI stability')

// ── page harness ──
let CALLS = []
function loadChat (cloudImpl) {
  const src = fs.readFileSync(CHAT_JS, 'utf8')
  let config = null
  const sandbox = {
    require: (r) => {
      if (r.indexOf('data/aiChatSuggestions.js') >= 0) return require(path.join(ROOT, 'data', 'aiChatSuggestions.js'))
      if (r.indexOf('followupOwnership.js') >= 0) return require(path.join(ROOT, 'pages', 'ai-chat', 'followupOwnership.js'))
      if (r.indexOf('userTrack.js') >= 0) return { event: () => {} }
      throw new Error('unexpected require: ' + r)
    },
    getApp: () => ({ globalData: {} }),
    Page: (c) => { config = c },
    console, Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp, Error, Set,
    setTimeout: setTimeout, clearTimeout: clearTimeout,
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
  inst.setData = function (o, cb) { Object.assign(inst.data, o); if (typeof cb === 'function') setTimeout(cb, 0) }
  return inst
}

function countingCloud (resp) {
  let n = 0
  const fn = async (opts) => {
    // ignore the quota_status probe fired in onLoad; count only real sends
    if (!(opts && opts.data && opts.data.action === 'quota_status')) n++
    return resp
  }
  fn.count = () => n
  return fn
}

// ── pure ownership helper unit checks ──
{
  ok(typeof OWN.completeFollowUps === 'function', 'completeFollowUps exported')
  // scenario fallback fill
  const c2 = OWN.completeFollowUps(['仅有一问'], { scenario: 'ask' })
  eq(c2.followUps.length, 3, 'F: server 1 → fill to 3')
  const c0 = OWN.completeFollowUps([], { scenario: 'wealth' })
  eq(c0.followUps.length, 3, 'F: server 0 → generate 3')
  eq(c0.followUpSource, 'fallback', 'F: no server items → fallback source')
  const c3 = OWN.completeFollowUps(['甲问题', '乙问题', '丙问题', '丁问题'], { scenario: 'ask' })
  eq(c3.followUps.length, 3, 'server >3 → capped at 3')
  // dedupe + exclude selected
  const cd = OWN.completeFollowUps(['重复', '重复', '另问'], { scenario: 'ask', selectedText: '重复' })
  ok(cd.followUps.every((x) => x !== '重复'), 'dedupe drops duplicates and the selected text')
  ok(new Set(cd.followUps).size === cd.followUps.length, 'no duplicate items after complete')
  // ladder roles (structural slots) + semantic intent keys
  const cl = OWN.completeFollowUps(['a', 'b', 'c'], { scenario: 'ask', topicAnchorId: 'anchor_x' })
  eq(cl.followUpLadder.length, 3, 'ladder 3 entries')
  eq(cl.followUpLadder[0].role, 'action_entry', 'ladder[0].role=action_entry')
  eq(cl.followUpLadder[1].role, 'cognitive_gap', 'ladder[1].role=cognitive_gap')
  eq(cl.followUpLadder[2].role, 'validation_loop', 'ladder[2].role=validation_loop')
  ok(cl.followUpLadder.every((x) => !!x.intent), 'ladder entries carry a semantic intent key')
  ok(cl.followUpLadder.every((x) => x.topicAnchorId === 'anchor_x'), 'ladder shares topicAnchorId')
}

// ── wxml structural contract (G: static flow, no overlay) ──
{
  const w = fs.readFileSync(CHAT_WXML, 'utf8')
  ok(w.indexOf('接下来你可以继续问') >= 0, 'title present')
  ok(/item\.id === activeFollowUpParentId/.test(w), 'follow-ups render ONLY for the parent answer')
  ok(/wx:for="\{\{item\.followUps\}\}"/.test(w), 'follow-ups iterate the answer-owned set')
  ok(/wx:key="id"/.test(w), 'messages keyed by stable id')
  ok(/scroll-into-view/.test(w), 'scroll-into-view used for scroll behavior')
  // follow-up block must live INSIDE the scroll-view (in document flow)
  const svStart = w.indexOf('scroll-view')
  const svEnd = w.indexOf('</scroll-view>')
  const fuInScroll = w.indexOf('follow-section') > svStart && w.indexOf('follow-section') < svEnd
  ok(fuInScroll, 'G: follow-up section is inside the scroll content (no overlay)')
  // no page-global footer follow-ups
  ok(!/wx:if="\{\{activeFollowUps\.length/.test(w), 'no separate page-global follow-up block')
}
{
  const s = fs.readFileSync(CHAT_WXSS, 'utf8')
  ok(/\.follow-section\s*\{[^}]*position:\s*static/.test(s), 'G: .follow-section position static')
  ok(!/\.follow-section\s*\{[^}]*(position:\s*(fixed|absolute|sticky))/.test(s), 'G: .follow-section not fixed/absolute/sticky')
}

;(async () => {
  // ── A: initial answer → 3 follow-ups below answer ──
  {
    CALLS = []
    const cc = countingCloud({ result: { code: 0, data: {
      content: '先把技术能力产品化。',
      followUps: ['第一步做什么', '如何一周验证', '怎么找第一个客户'],
      topicAnchorId: 'anchor_A',
      quota: { isMember: false, remaining: 2, limit: 3 },
    } } })
    const p = loadChat(cc)
    p.onLoad()
    p.setData({ inputValue: '我是程序员，想做副业' })
    await p.onSend()
    const last = p.data.messages[p.data.messages.length - 1]
    eq(last.role, 'assistant', 'A: last message is assistant answer')
    eq(last.followUps.length, 3, 'A: answer owns 3 follow-ups')
    eq(p.data.activeFollowUpParentId, last.id, 'A: active parent == answer id')
    ok(OWN.shouldRenderFollowUps(p.data), 'A: follow-ups render (bound to latest answer)')
    eq(cc.count(), 1, 'A: exactly one request')
  }

  // ── B/C/D: tap Q1 → old set gone immediately; loading hides Q2/Q3; new set after ──
  {
    CALLS = []
    let n = 0
    const cc = async (opts) => {
      if (opts && opts.data && opts.data.action === 'quota_status') return { result: { code: 0, data: { quota: { isMember: false, remaining: 3, limit: 3 } } } }
      n++
      if (n === 1) return { result: { code: 0, data: { content: 'A1', followUps: ['Q1x', 'Q2x', 'Q3x'], topicAnchorId: 'anchor_B', quota: { isMember: false, remaining: 2, limit: 3 } } } }
      return { result: { code: 0, data: { content: 'A2', followUps: ['N1', 'N2', 'N3'], topicAnchorId: 'anchor_B', quota: { isMember: false, remaining: 1, limit: 3 } } } }
    }
    const p = loadChat(cc)
    p.onLoad()
    p.setData({ inputValue: '首问' })
    await p.onSend()
    const oldAnswer = p.data.messages[p.data.messages.length - 1]
    eq(oldAnswer.followUps.length, 3, 'B: initial 3 follow-ups')
    const oldParentId = p.data.activeFollowUpParentId

    // tap Q1 (setData callback deferred → loading state observable synchronously)
    const tapped = oldAnswer.followUps[0]
    p.onSelectFollowUp({ currentTarget: { dataset: { q: tapped } } })
    eq(p.data.activeFollowUps.length, 0, 'B: old follow-ups cleared immediately on tap')
    eq(p.data.followUpVisible, false, 'C: follow-up block hidden during loading')
    eq(p.data.followUpLoading, true, 'C: loading state set')
    ok(!OWN.shouldRenderFollowUps(p.data), 'C: old Q2/Q3 NOT rendered while loading')

    // let the deferred send run to completion
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))

    const userMsg = p.data.messages[p.data.messages.length - 2]
    eq(userMsg.role, 'user', 'B: selected question appended as user message')
    eq(userMsg.content, tapped, 'B: appended message == tapped question')

    // ── D: new answer success → new set below, count 3 ──
    const newAnswer = p.data.messages[p.data.messages.length - 1]
    eq(newAnswer.role, 'assistant', 'D: new assistant answer appended')
    eq(newAnswer.content, 'A2', 'D: new answer content')
    eq(newAnswer.followUps.length, 3, 'D: new answer owns 3 follow-ups')
    eq(p.data.activeFollowUpParentId, newAnswer.id, 'D: active parent == NEW answer id')
    ok(p.data.activeFollowUpParentId !== oldParentId, 'D: parent rebound to newest answer (no mixing)')
    ok(OWN.shouldRenderFollowUps(p.data), 'D: new follow-ups render below new answer')
    eq(n, 2, 'B/D: exactly two real requests (initial + follow-up)')
  }

  // ── E: rapid double tap → one request, no duplicate ──
  {
    CALLS = []
    let n = 0
    const cc = async () => { n++; return { result: { code: 0, data: { content: 'ok' + n, followUps: ['a', 'b', 'c'], quota: { isMember: false, remaining: 2, limit: 3 } } } } }
    const p = loadChat(cc)
    p.onLoad()
    p.setData({ inputValue: '首问' })
    await p.onSend()
    const base = n
    const q = p.data.messages[p.data.messages.length - 1].followUps[0]
    p.onSelectFollowUp({ currentTarget: { dataset: { q } } })
    p.onSelectFollowUp({ currentTarget: { dataset: { q } } })
    p.onSelectFollowUp({ currentTarget: { dataset: { q } } })
    await new Promise((r) => setTimeout(r, 0))
    eq(n - base, 1, 'E: rapid triple tap → exactly one request')
    const userMsgs = p.data.messages.filter((m) => m.role === 'user' && m.content === q)
    eq(userMsgs.length, 1, 'E: duplicate question not sent')
  }

  // ── F: server returns only 2 → client fills to 3 ──
  {
    CALLS = []
    const p = loadChat(async () => ({ result: { code: 0, data: {
      content: 'ok', followUps: ['只有一', '只有二'], quota: { isMember: false, remaining: 2, limit: 3 },
    } } }))
    p.onLoad()
    p.setData({ inputValue: '问题' })
    await p.onSend()
    eq(p.data.messages[p.data.messages.length - 1].followUps.length, 3, 'F: server 2 → rendered 3')
    ok(new Set(p.data.activeFollowUps).size === 3, 'F: no duplicate after fill')
  }

  // ── H: quota third answer → answer visible before wall ──
  {
    CALLS = []
    const p = loadChat(async () => ({ result: { code: 0, data: {
      content: '第三次回答内容', followUps: ['h1', 'h2', 'h3'], quota: { isMember: false, remaining: 0, limit: 3 },
    } } }))
    p.onLoad()
    p.setData({ inputValue: '第三次' })
    await p.onSend()
    const last = p.data.messages[p.data.messages.length - 1]
    eq(last.content, '第三次回答内容', 'H: third answer visible')
    ok(last.followUps.length === 3, 'H: third answer still shows follow-ups')
    eq(p.data.quotaExhausted, false, 'H: no exhaustion while answer delivered')
  }

  // ── I: quota exhausted → free-exhaustion state, no mixing with old follow-ups ──
  {
    CALLS = []
    const p = loadChat(async () => ({ result: { code: 10006, message: '今天的3次免费深度问答已用完', data: {
      quotaExhausted: true, remaining: 0,
    } } }))
    p.onLoad()
    p.setData({ inputValue: '再来' })
    await p.onSend()
    eq(p.data.quotaExhausted, true, 'I: free-exhaustion state shown')
    eq(p.data.activeFollowUps.length, 0, 'I: old follow-ups cleared on exhaustion')
    eq(p.data.followUpLoading, false, 'I: loading cleared on exhaustion')
    ok(!OWN.shouldRenderFollowUps(p.data), 'I: no follow-ups render with exhaustion state')
  }

  console.log(`\nstage2d-followup-ui_TEST pass=${pass} fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('RUNNER ERROR', e); process.exit(2) })
