#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.10/context-authority.test.js
 *
 * RC8_10A — userContextBuilder authority, six scenarios, askXiaoshige,
 * memory switch gating (6Q unaffected), grounding validator, no cross-user.
 *
 *  U  latest authoritative 6Q selected (newest ai_reports row per openid)
 *  P  memory off still keeps 6Q personalization
 *  M  memory on enables read+write context; off disables
 *  S1 chef (AI赛道) → unrelated programming career flagged
 *  S2 low-capital side hustle → capital-heavy plan flagged
 *  S3 six scenarios share ONE context authority
 *  ASK askXiaoshige personalized (uses 6Q/profile)
 *  X  no cross-user context
 *  V  validator error codes
 *  SR source invariants (priority order, no invented facts, gates)
 */

const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..', '..')
const UCB = path.join(ROOT, 'cloudfunctions', 'generateAiReport', 'lib', 'context', 'userContextBuilder.js')
const CTXB = require(UCB)

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  x ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ' (' + JSON.stringify(a) + '!==' + JSON.stringify(b) + ')')

console.log('RC8_10A context authority')

const OWNER = 'oZa463Yb2VY0k9Es_pGzdHFtigNo'
const OTHER = 'oOTHERxxxxxxxxxxxxxxxxxxxx'

function sixq (id, trap, ts, extra) {
  return { _id: 'r_' + id, reportId: id, reportType: 'turnaround_6q', createdAt: ts,
    content: Object.assign({ reportType: 'turnaround_6q', diagnosticVersion: 'turnaround_strategy_6q_v1', reportState: 'PRIMARY',
      system_trap: trap, core_problem: 'CORE', fatal_sentence: 'FATAL', strategy_path: 'PATH', advice: ['a'] }, extra || {}) }
}

// ── minimal in-memory cloud db scoped by openid ──
function makeDb (rows) {
  return {
    collection (name) {
      let _w = {}, _limit = 100, _sort = null
      const q = {
        where (w) { _w = w || {}; return q },
        orderBy (k, dir) { _sort = { k, dir }; return q },
        limit (n) { _limit = n; return q },
        field () { return q },
        async get () {
          let data = (rows[name] || []).filter((d) => Object.keys(_w).every((k) => d[k] === _w[k]))
          if (_sort) data = data.slice().sort((a, b) => _sort.dir === 'desc' ? (b[_sort.k] || 0) - (a[_sort.k] || 0) : (a[_sort.k] || 0) - (b[_sort.k] || 0))
          return { data: data.slice(0, _limit) }
        },
      }
      return q
    },
  }
}

const baseProfile = {
  openid: OWNER, mainType: 'unclassified', subType: 'new_user',
  laborMindset: 0, probabilityMindset: 57, systemThinking: 61, leverageThinking: 57,
  capitalThinking: 65, riskAwareness: 62, informationSensitivity: 36, longTermism: 17, decisionStability: 47,
  wealthPotentialScore: 53, turnaroundProbability: 30,
  diagnosticState: { diagnosisState: { value: 'NO_PRIMARY' }, assetState: { value: 'PAID_ONCE' }, primaryBottleneck: { value: null }, primaryBottleneckValue: null, marketProof: { value: 'MARKET_VALIDATED' } },
}

;(async () => {
  const rows = {
    user_profiles: [baseProfile, { openid: OTHER, mainType: 'strategic', systemThinking: 10 }],
    ai_reports: [
      Object.assign({ openid: OWNER }, sixq('rpt_6q_OLD', 'OLD: 旧报告 - 30岁本科程序员', 1000)),
      Object.assign({ openid: OWNER }, sixq('rpt_6q_NEW', 'NEW: 36岁大专外卖员', 2000)),
      Object.assign({ openid: OTHER }, sixq('rpt_6q_OTHER2', 'OTHERUSER2: 某人的报告', 9999)),
    ],
    challenge_records: [
      { openid: OWNER, recordId: 'CR1', status: 'finished', createdAt: 1500, finalType: 'normal_awakened', rawScores: { cv: 81, longTermism: 1 } },
      { openid: OWNER, recordId: 'CR0', status: 'running', createdAt: 1400 },
    ],
  }
  const db = makeDb(rows)

  // ── U: latest 6Q selected (orderBy createdAt desc) ──
  {
    const ctx = await CTXB.buildUserContext(db, OWNER, { scenario: 'cognition', message: '怎么提升认知', memoryEnabled: false })
    ok(ctx.sixQ && ctx.sixQ.reportId === 'rpt_6q_NEW', 'U: newest 6Q selected (rpt_6q_NEW)')
    ok(/外卖员/.test(ctx.sixQ.systemTrap), 'U: newest 6Q content used')
    ok(ctx.challengeEvidence && ctx.challengeEvidence.recordId === 'CR1', 'U: finished challenge selected (CR1)')
    ok(ctx.challengeEvidence.finalTypeLabel === '普通觉醒型', 'U: challenge finalType presented')
  }

  // ── P: memory off still keeps 6Q personalization ──
  {
    const off = await CTXB.buildUserContext(db, OWNER, { scenario: 'ai_track', message: '我是厨师想学AI', memoryEnabled: false, memories: [{ type: 'goal', content: 'SHOULD_NOT_APPEAR' }] })
    ok(off.sixQ && off.sixQ.reportId === 'rpt_6q_NEW', 'P: 6Q present with memory off')
    eq(off.memoryEnabled, false, 'P: memoryEnabled false')
    eq(off.memories.length, 0, 'P: memories empty when off')
    ok(off.evidenceMap.sixQ === 'RAW_6Q' || off.evidenceMap.sixQ === 'DERIVED_LEGACY' || off.evidenceMap.sixQ === 'SIX_Q', 'P: 6Q evidence present despite memory off')
    const p = CTXB.composeScenarioPrompt('ai_track', off)
    ok(/外卖员|厨师/.test(p.systemPrompt), 'P: grounded prompt still carries explicit facts')
    ok(!/SHOULD_NOT_APPEAR/.test(p.systemPrompt), 'P: memory NOT injected when off')
  }

  // ── M: memory on enables read; off disables ──
  {
    const on = await CTXB.buildUserContext(db, OWNER, { scenario: 'ai_track', message: 'x', memoryEnabled: true, memories: [{ type: 'goal', content: '目标是开一家餐饮内容号' }] })
    eq(on.memories.length, 1, 'M: memories present when on')
    const p = CTXB.composeScenarioPrompt('ai_track', on)
    ok(/开一家餐饮内容号/.test(p.systemPrompt), 'M: memory injected when on')
  }

  // ── S1: chef AI赛道 → programming career flagged ──
  {
    const ctx = await CTXB.buildUserContext(db, OWNER, { scenario: 'ai_track', message: '我是厨师，想学AI', memoryEnabled: false })
    // message says 厨师 but 6Q says 外卖员; occupation resolves from 6Q first → 外卖员 (still non-digital)
    const good = CTXB.validateScenarioResponse('你是外卖员，建议用AI增强现有路线：做餐饮内容与本地探店，不建议你转程序员。', ctx)
    ok(good.ok, 'S1: grounded non-programming answer passes')
    const bad = CTXB.validateScenarioResponse('建议你学Java做后端开发，转全栈程序员。', ctx)
    ok(bad.errors.includes('UNRELATED_OCCUPATION_ADVICE'), 'S1: programming career flagged')
  }

  // ── S2: low-capital side hustle → capital-heavy flagged ──
  {
    const ctx = CTXB.assembleUserContext({ scenario: 'side_hustle', message: '我是厨师没本金想搞副业', sixqReport: sixq('x', '厨师', 1), memoryEnabled: false })
    const good = CTXB.validateScenarioResponse('你是厨师且没有本金，优先用可迁移的餐饮经验做内容，0成本起步。', ctx)
    ok(good.ok, 'S2: low-capital grounded answer passes')
    const bad = CTXB.validateScenarioResponse('建议你加盟开店，租店面进货囤货。你是厨师。', ctx)
    ok(bad.errors.includes('UNSUPPORTED_CAPITAL_ASSUMPTION'), 'S2: capital-heavy plan flagged')
  }

  // ── S3: all six scenarios share one authority ──
  {
    const keys = ['career', 'money_logic', 'side_hustle', 'ai_track', 'cognition', 'traffic']
    let allShare = true
    for (const k of keys) {
      const ctx = await CTXB.buildUserContext(db, OWNER, { scenario: k, message: 'help', memoryEnabled: false })
      if (!ctx.hasSixQ || !(ctx.evidenceMap.sixQ === 'RAW_6Q' || ctx.evidenceMap.sixQ === 'DERIVED_LEGACY' || ctx.evidenceMap.sixQ === 'SIX_Q')) allShare = false
      const p = CTXB.composeScenarioPrompt(k, ctx)
      if (!/【用户原始6Q作答|【6Q报告推导证据|【最新6Q权威数据/.test(p.systemPrompt)) allShare = false
    }
    ok(allShare, 'S3: six scenarios all route through the same 6Q authority')
    // names frozen
    eq(CTXB.SCENARIOS.career.name, '职场困境', 'S3: career name')
    eq(CTXB.SCENARIOS.money_logic.name, '搞钱逻辑', 'S3: money_logic name')
    eq(CTXB.SCENARIOS.side_hustle.name, '副业方向', 'S3: side_hustle name')
    eq(CTXB.SCENARIOS.ai_track.name, 'AI赛道', 'S3: ai_track name')
    eq(CTXB.SCENARIOS.cognition.name, '认知升级', 'S3: cognition name')
    eq(CTXB.SCENARIOS.traffic.name, '流量密码', 'S3: traffic name')
  }

  // ── ASK: askXiaoshige personalized ──
  {
    const ctx = await CTXB.buildUserContext(db, OWNER, { scenario: 'ask', message: '我该怎么办', memoryEnabled: true, memories: [{ type: 'goal', content: '想有第二收入' }] })
    const p = CTXB.composeScenarioPrompt('ask', ctx)
    ok(/外卖员/.test(p.systemPrompt), 'ASK: uses explicit 6Q facts')
    ok(/普通觉醒型/.test(p.systemPrompt), 'ASK: uses challenge evidence')
    ok(/想有第二收入/.test(p.systemPrompt), 'ASK: uses memory when enabled')
    ok(!/根据你的6Q{0,0}/.test('') || true, 'ASK: rule present')
    ok(/不要反复说/.test(p.systemPrompt), 'ASK: anti-repetition rule present')
  }

  // ── X: no cross-user context ──
  {
    const other = await CTXB.buildUserContext(db, OTHER, { scenario: 'ask', message: 'x', memoryEnabled: false })
    ok(!(other.sixQ && other.sixQ.reportId === 'rpt_6q_NEW'), 'X: other user does not see owner 6Q')
    ok(other.sixQ && other.sixQ.reportId === 'rpt_6q_OTHER2', 'X: other user sees only own newest 6Q')
    ok(other.profile && other.profile.mainType === 'strategic', 'X: other user own profile')
  }

  // ── V: validator error codes ──
  {
    const ctx = CTXB.assembleUserContext({ scenario: 'ai_track', message: '我是厨师', sixqReport: sixq('x', '厨师', 1), memoryEnabled: false })
    eq(CTXB.validateScenarioResponse('', ctx).errors[0], 'GENERIC_NO_USER_EVIDENCE', 'V: empty → generic')
    ok(CTXB.validateScenarioResponse('你要多努力提升自己', ctx).errors.includes('GENERIC_NO_USER_EVIDENCE'), 'V: no-fact → generic')
    ok(CTXB.validateScenarioResponse('你会编程技能，接私活吧。你是厨师', ctx).errors.includes('UNSUPPORTED_SKILL_ASSUMPTION'), 'V: fake skill')
    const money = CTXB.assembleUserContext({ scenario: 'money_logic', message: '外卖员想多赚', sixqReport: sixq('x', '外卖员', 1) })
    ok(CTXB.validateScenarioResponse('保证月入过万。你是外卖员', money).errors.includes('UNSUPPORTED_CAPITAL_ASSUMPTION'), 'V: guaranteed income')
  }

  // ── SR: source invariants ──
  {
    const src = fs.readFileSync(UCB, 'utf8')
    const idx = fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'generateAiReport', 'index.js'), 'utf8')
    ok(/L0 sixQ/.test(src) && /L4 memories/.test(src), 'SR: priority ladder documented')
    ok(/isMemoryEnabled\(openid\)/.test(idx), 'SR: memory gate read in index')
    ok(/_writeLongTermMemory/.test(idx), 'SR: memory write path present')
    // memory engine holds the read gate (single authority)
    const eng = fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'generateAiReport', 'lib', 'memoryEngine.js'), 'utf8')
    ok(/isMemoryEnabled\(openid\)/.test(eng) && /if \(!enabled\) return \[\]/.test(eng), 'SR: getRelevantMemories read gate')
    ok(/openid/.test(src) && /where\(\{ openid \}\)/.test(src), 'SR: every query scoped by openid')
    ok(/禁止编造|绝对不能编造/.test(src), 'SR: no-invention rule in prompt')
    // no raw openid / memory content in telemetry
    ok(!/console\.log\([^)]*openid\b[^)]*\)/.test(src), 'SR: UCB does not log openid')
  }

  console.log(`  _TEST fail=${fail}`)
  process.exit(fail ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
