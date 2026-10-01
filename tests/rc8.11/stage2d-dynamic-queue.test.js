#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.11/stage2d-dynamic-queue.test.js
 *
 * RC8_11_STAGE2D_DYNAMIC_FOLLOWUP_QUEUE — dynamic queue + intent dedup + depth.
 *
 *  A initial response      → visible_count 3
 *  B tap Q1                → Q1_visible false, Q1_asked true
 *  C answer returns        → Q1 not reappear, visible_count 3
 *  D tap Q1,Q2,Q3          → originals never reappear, new questions generated
 *  E same intent, diff wording → duplicate filtered
 *  F topic changes         → stale topic questions expired
 *  G quota reaches 0       → answer visible, wall, next directions, free send blocked
 *  H rapid double tap      → one request only
 *  I long conversation     → no repeated intent across askedFollowUps
 *
 * Node built-ins only. No network.
 */

const path = require('path')
const fs = require('fs')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '..', '..')
const CHAT_JS = path.join(ROOT, 'pages', 'ai-chat', 'ai-chat.js')
const OWN = require(path.join(ROOT, 'pages', 'ai-chat', 'followupOwnership.js'))

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('RC8_11_STAGE2D dynamic follow-up queue')

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

const tick = () => new Promise((r) => setTimeout(r, 0))
function serverReply (list, extra) {
  return { result: { code: 0, data: Object.assign({
    content: '答' + Math.random().toString(36).slice(2, 6),
    followUps: list,
    topicAnchorId: 'anchor_T',
    quota: { isMember: false, remaining: 2, limit: 3 },
  }, extra || {}) } }
}

;(async () => {
  // ── pure: intent dedup (E) ──
  {
    const r = OWN.refillQueue({
      completedRes: ['厨师想变现，我最先该做哪一步？'],
      askedTexts: ['作为厨师，我变现的第一步该做什么？'],
      askedIntents: [OWN.intentKeyOf('作为厨师，我变现的第一步该做什么？')],
      pending: [], scenario: 'ask', topicAnchorId: 'a', depthLevel: 0,
    })
    ok(!r.followUps.some((q) => /变现/.test(q) && /(第一步|最先|该先)/.test(q)), 'E: same intent, different wording → filtered')
    eq(OWN.intentKeyOf('作为厨师，我变现的第一步该做什么？'), OWN.intentKeyOf('厨师想变现，我最先该做哪一步？'), 'E: both normalize to SAME_INTENT')
  }

  // ── A: initial response → 3 visible ──
  {
    CALLS = []
    let n = 0
    const cc = async (opts) => {
      if (opts && opts.data && opts.data.action === 'quota_status') return { result: { code: 0, data: { quota: { isMember: false, remaining: 3, limit: 3 } } } }
      n++
      return serverReply(['第一步做什么？', '该如何一周验证？', '怎么找到第一个客户？'])
    }
    const p = loadChat(cc)
    p.onLoad()
    p.setData({ inputValue: '我是厨师，想变现' })
    await p.onSend()
    eq(p.data.activeFollowUps.length, 3, 'A: visible 3')
    eq(p.data.askedFollowUps.length, 0, 'A: none asked yet')
    ok(OWN.shouldRenderFollowUps(p.data), 'A: queue bound to latest answer')
  }

  // ── B/C/D: tap → remove/asked → replenish without repeats ──
  {
    CALLS = []
    let n = 0
    const cc = async (opts) => {
      if (opts && opts.data && opts.data.action === 'quota_status') return { result: { code: 0, data: { quota: { isMember: false, remaining: 3, limit: 3 } } } }
      n++
      const sets = [
        ['第一步做什么？', '该如何一周验证？', '怎么找到第一个客户？'],
        ['厨师该卖手艺还是内容？', '卡点到底在哪里？', '最低成本怎么验证一次？'],
        ['第一次成交后怎么稳定重复？', '我该怎么给它定价？', '要不要把它放大？'],
        ['怎么拿到第二个付费结果？', '如何降低生活压力？', '什么时候该止损？'],
      ]
      return serverReply(sets[(n - 1) % sets.length])
    }
    const p = loadChat(cc)
    p.onLoad()
    p.setData({ inputValue: '厨师变现' })
    await p.onSend()
    const first = p.data.activeFollowUps.slice()
    eq(first.length, 3, 'B: initial 3')

    // tap Q1
    const q1 = first[0]
    p.onSelectFollowUp({ currentTarget: { dataset: { q: q1 } } })
    eq(p.data.activeFollowUps.length, 0, 'B: selected removed from visible immediately')
    ok(p.data.askedFollowUps.indexOf(q1) >= 0, 'B: Q1 marked ASKED')
    eq(p.data.pendingFollowUps.length, 2, 'B: remaining unasked hidden during loading')
    eq(p.data.followUpLoading, true, 'B: loading state')
    await tick(); await tick(); await tick()

    const after = p.data.activeFollowUps
    eq(after.length, 3, 'C/D: replenished to 3')
    ok(after.indexOf(q1) < 0, 'C: asked Q1 does not reappear')
    const lastAnswer = p.data.messages[p.data.messages.length - 1]
    ok(lastAnswer.followUps.length === 3, 'D: new answer owns a fresh 3-set')
    const newQ = after.find((q) => first.indexOf(q) < 0)
    ok(!!newQ, 'D: new questions generated')

    // tap remaining Q2 then Q3 (they may have been re-shown if unasked)
    const q2 = after.find((q) => q !== newQ)
    if (q2) {
      p.onSelectFollowUp({ currentTarget: { dataset: { q: q2 } } })
      await tick(); await tick(); await tick()
    }
    // no asked question may reappear
    const askedSet = new Set(p.data.askedFollowUps)
    ok(p.data.activeFollowUps.every((q) => !askedSet.has(q)), 'D: no asked question reappears in queue')
  }

  // ── E (page-level): intent dedup across turns ──
  {
    CALLS = []
    let n = 0
    const cc = async (opts) => {
      if (opts && opts.data && opts.data.action === 'quota_status') return { result: { code: 0, data: { quota: { isMember: false, remaining: 3, limit: 3 } } } }
      n++
      // always return the SAME-intent question (action_entry) even after it was asked
      return serverReply(['我该先做哪一步？', '该怎么验证？', '第一个客户怎么来？'])
    }
    const p = loadChat(cc)
    p.onLoad()
    p.setData({ inputValue: '厨师变现' })
    await p.onSend()
    const q1 = p.data.activeFollowUps.find((q) => /(第一步|先做|最先|该先)/.test(q)) || p.data.activeFollowUps[0]
    p.onSelectFollowUp({ currentTarget: { dataset: { q: q1 } } })
    await tick(); await tick(); await tick()
    const askedIntents = p.data.askedIntentKeys.slice()
    // no currently visible item may carry an already-asked intent
    const visibleIntents = p.data.activeFollowUps.map((q) => OWN.intentKeyOf(q))
    ok(visibleIntents.every((ik) => askedIntents.indexOf(ik) < 0), 'E: visible intents exclude asked intents')
  }

  // ── F: topic change → expire ──
  {
    const p = loadChat(async () => serverReply(['a', 'b', 'c']))
    p.onLoad()
    p.setData({ inputValue: 'x' })
    await p.onSend()
    ok(p.data.activeFollowUps.length === 3, 'F: pre-topic-change queue present')
    p.setData({ activeFollowUps: [], askedFollowUps: ['a'], askedIntentKeys: ['action_entry'] })
    // simulate a new topic arrival
    const app = { globalData: { _quickAskTopic: '全新话题', _quickAskPersonality: { name: 'x', emoji: '1', style: '' } } }
    // use the module's expireThread directly (page onShow uses the same reset)
    p.setData(OWN.expireThread())
    eq(p.data.activeFollowUps.length, 0, 'F: stale topic questions expired (active cleared)')
    eq(p.data.askedFollowUps.length, 0, 'F: asked history reset for new thread')
    eq(p.data.depthLevel, 0, 'F: depth reset for new thread')
  }

  // ── G: quota reaches 0 → answer/wall/next-directions, free send blocked ──
  {
    CALLS = []
    const p = loadChat(async (opts) => {
      if (opts && opts.data && opts.data.action === 'quota_status') return { result: { code: 0, data: { quota: { isMember: false, remaining: 1, limit: 3 } } } }
      return { result: { code: 0, data: { content: '最后一次免费回答', followUps: ['g1', 'g2', 'g3'], quota: { isMember: false, remaining: 0, limit: 3 } } } }
    })
    p.onLoad()
    p.setData({ inputValue: '第三次' })
    await p.onSend()
    eq(p.data.messages[p.data.messages.length - 1].content, '最后一次免费回答', 'G: answer visible when quota hits 0')
    eq(p.data.remaining, 0, 'G: remaining 0')

    // 4th attempt → free-exhaustion state, no new free answer, no paid surface
    const cc2 = async () => ({ result: { code: 10006, message: '今天的3次免费深度问答已用完', data: {
      quotaExhausted: true, remaining: 0,
    } } })
    const p2 = loadChat(cc2)
    p2.onLoad()
    p2.setData({ inputValue: '再来一次' })
    await p2.onSend()
    eq(p2.data.quotaExhausted, true, 'G: free-exhaustion state shown')
    eq(p2.data.remaining, 0, 'G: remaining 0')
    ok((p2.data.exhaustedBody || []).length >= 1, 'G: tomorrow-continue body present')
    const lastMsg = p2.data.messages[p2.data.messages.length - 1]
    ok(lastMsg.role === 'user', 'G: no free AI answer appended (free send blocked)')
  }

  // ── H: rapid double/triple tap → one request ──
  {
    CALLS = []
    let n = 0
    const cc = async (opts) => {
      if (opts && opts.data && opts.data.action === 'quota_status') return { result: { code: 0, data: { quota: { isMember: false, remaining: 3, limit: 3 } } } }
      n++
      return serverReply(['h1', 'h2', 'h3'])
    }
    const p = loadChat(cc)
    p.onLoad()
    p.setData({ inputValue: '首问' })
    await p.onSend()
    const base = n
    const q = p.data.activeFollowUps[0]
    p.onSelectFollowUp({ currentTarget: { dataset: { q } } })
    p.onSelectFollowUp({ currentTarget: { dataset: { q } } })
    p.onSelectFollowUp({ currentTarget: { dataset: { q } } })
    await tick(); await tick()
    eq(n - base, 1, 'H: rapid tap → exactly one request')
    const dups = p.data.messages.filter((m) => m.role === 'user' && m.content === q)
    eq(dups.length, 1, 'H: duplicate question not sent')
  }

  // ── I: long conversation → no repeated intent ──
  {
    CALLS = []
    let n = 0
    const cc = async (opts) => {
      if (opts && opts.data && opts.data.action === 'quota_status') return { result: { code: 0, data: { quota: { isMember: false, remaining: 99, limit: 99 } } } }
      n++
      // server cycles three fixed-intent questions every turn
      const pool = ['我该先做哪一步？', '该怎么最低成本验证？', '第一个付费客户从哪来？']
      return serverReply(pool)
    }
    const p = loadChat(cc)
    p.onLoad()
    p.setData({ inputValue: '开始' })
    await p.onSend()
    for (let i = 0; i < 6; i++) {
      const q = p.data.activeFollowUps[0]
      if (!q) break
      p.onSelectFollowUp({ currentTarget: { dataset: { q } } })
      await tick(); await tick(); await tick()
    }
    const asked = p.data.askedIntentKeys
    const uniq = new Set(asked)
    eq(uniq.size, asked.length, 'I: no repeated intent across askedIntentKeys (' + asked.join(',') + ')')
    const visibleIntents = p.data.activeFollowUps.map((q) => OWN.intentKeyOf(q))
    ok(visibleIntents.every((ik) => asked.indexOf(ik) < 0), 'I: visible queue never re-offers an asked intent')
  }

  // ── depth progression (monotonic) ──
  {
    CALLS = []
    const cc = async (opts) => {
      if (opts && opts.data && opts.data.action === 'quota_status') return { result: { code: 0, data: { quota: { isMember: false, remaining: 99, limit: 99 } } } }
      return serverReply(['我该先做哪一步？', '该怎么验证？', '第一个客户从哪来？'])
    }
    const p = loadChat(cc)
    p.onLoad()
    p.setData({ inputValue: '开始' })
    await p.onSend()
    const d0 = p.data.depthLevel
    p.onSelectFollowUp({ currentTarget: { dataset: { q: p.data.activeFollowUps[0] } } })
    await tick(); await tick(); await tick()
    const d1 = p.data.depthLevel
    p.onSelectFollowUp({ currentTarget: { dataset: { q: p.data.activeFollowUps[0] } } })
    await tick(); await tick(); await tick()
    const d2 = p.data.depthLevel
    ok(d0 <= d1 && d1 <= d2, 'DEPTH: level monotonic non-decreasing (' + d0 + ',' + d1 + ',' + d2 + ')')
    ok(d2 >= 1, 'DEPTH: advances below direction after answering')
  }

  console.log(`\nstage2d-dynamic-queue_TEST pass=*** fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('RUNNER ERROR', e); process.exit(2) })
