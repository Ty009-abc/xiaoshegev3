#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/persistent-report-entitlement.test.js
 *
 * RC8_10_P0_PERSISTENT_REPORT_ENTITLEMENT_AND_CHALLENGE_DECOUPLE
 *
 * P0 释放阻塞：owner 拥有永久 report_9_9 权益后，重做 6Q / 重新生成世界模型报告
 * 不得再次要求 ¥9.90；30 天挑战入口必须与报告付费解耦（独立 challenge 权益）。
 *
 * 无网络 / 无真实 DB / 无支付 / 不写库。
 *
 * MATRIX:
 *   A  paid 9.9 owner retakes 6Q          → new_report_unlocked=true, new_payment=false
 *   B  unpaid user first 6Q               → report_paywall=true
 *   C  challenge-entitled + unpaid report → challenge_access=true, report 不阻断挑战
 *   D  report-entitled only, no challenge → report_access=true, challenge 仍需权益
 *   E  replay/start owned challenge       → 不需 9.9 / 39.9
 *   F  RAW 6Q retake                       → latest used, entitlement unchanged
 */

const path = require('path')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '..', '..')
const COMMON = path.join(ROOT, 'cloudfunctions', 'common', 'reportAccess.js')
const GEN_COPY = path.join(ROOT, 'cloudfunctions', 'generateAiReport', 'lib', 'reportAccess.js')
const GET_COPY = path.join(ROOT, 'cloudfunctions', 'getAiReport', 'lib', 'reportAccess.js')
const ENT_GET = path.join(ROOT, 'cloudfunctions', 'getAiReport', 'lib', 'reportEntitlement.js')
const ENT_GEN = path.join(ROOT, 'cloudfunctions', 'generateAiReport', 'lib', 'reportEntitlement.js')
const IDEM = path.join(ROOT, 'cloudfunctions', 'generateAiReport', 'lib', 'challengeReportIdempotency.js')
const GET_INDEX = path.join(ROOT, 'cloudfunctions', 'getAiReport', 'index.js')
const IDEM_SRC = fs.readFileSync(IDEM, 'utf8')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

console.log('RC8_10 P0 persistent report entitlement + challenge decouple')

const RA = require(COMMON)

// ── §1 canonical resolver: three independent unlock channels ────────────────
{
  // A — permanent report_9_9 entitlement unlocks a brand-new (unpaid) report
  const a = RA.resolveReportAccess({ isPaid: false }, false, true)
  eq(a.locked, false, 'A report_9_9 → unlocked')
  eq(a.canViewFullReport, true, 'A report_9_9 → can view full')
  eq(a.accessSource, 'REPORT_9_9_ENTITLEMENT', 'A authority = REPORT_9_9_ENTITLEMENT')

  // B — unpaid, no VIP, no report_9_9 → paywall
  const b = RA.resolveReportAccess({ isPaid: false }, false, false)
  eq(b.locked, true, 'B unpaid+noVIP+no9_9 → locked')
  eq(b.canViewFullReport, false, 'B → cannot view full')
  eq(b.accessSource, 'NONE', 'B accessSource NONE')

  // report.isPaid still top priority + independent
  const c = RA.resolveReportAccess({ isPaid: true }, false, false)
  eq(c.accessSource, 'REPORT_IS_PAID', 'isPaid still REPORT_IS_PAID')
  // VIP independent
  const d = RA.resolveReportAccess({ isPaid: false }, true, false)
  eq(d.accessSource, 'VIP_AUTHORITY', 'VIP independent channel')
  // report_9_9 can never be overridden by membership free
  ok(RA.canAccessFullReport({ isPaid: false }, false, true) === true, 'report_9_9 never overridden by free')
  // fail-closed
  ok(RA.canAccessFullReport(null, false, false) === false, 'null entity fail-closed')
  ok(RA.canAccessFullReport({ isPaid: false }, false, undefined) === false, 'undefined 9_9 fail-closed')

  // byte-identical copies
  const sha = (f) => require('crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex')
  eq(sha(COMMON), sha(GEN_COPY), 'generateAiReport copy byte-identical')
  eq(sha(COMMON), sha(GET_COPY), 'getAiReport copy byte-identical')
}

;(async () => {
// ── §2 report_9_9 entitlement resolver (sources-based; independent of full_report) ──
{
  const { hasReport9_9Entitlement } = require(ENT_GET)
  const sha = (f) => require('crypto').createHash('sha256').update(fs.readFileSync(f)).digest('hex')
  eq(sha(ENT_GET), sha(ENT_GEN), 'reportEntitlement copies byte-identical')

  const mkdb = (ent) => ({
    collection: () => ({ where: () => ({ limit: () => ({ get: async () => ({ data: ent ? [ent] : [] }) }) }) }),
  })

  // owner-like: sources include report_9_9 (permanent) → true
  const owner = { openid: 'o1', permissions: ['challenge_full', 'full_report', 'report_unlock'], sources: [{ productId: 'challenge_39_9', expiresAt: 0 }, { productId: 'report_9_9', expiresAt: 0 }] }
  ok(await hasReport9_9Entitlement(mkdb(owner), 'o1') === true, 'owner report_9_9 source → true')

  // challenge-only: has full_report permission but NO report_9_9 source → false
  const chalOnly = { openid: 'o2', permissions: ['challenge_full', 'full_report', 'report_history'], sources: [{ productId: 'challenge_39_9', expiresAt: 0 }] }
  ok(await hasReport9_9Entitlement(mkdb(chalOnly), 'o2') === false, 'challenge-only (no report_9_9 source) → false')

  // expired report_9_9 source → false
  const expired = { openid: 'o3', sources: [{ productId: 'report_9_9', expiresAt: 1 }] }
  ok(await hasReport9_9Entitlement(mkdb(expired), 'o3') === false, 'expired report_9_9 → false')

  // no entitlement record → false
  ok(await hasReport9_9Entitlement(mkdb(null), 'o4') === false, 'no entitlements → false')
  // no openid → false
  ok(await hasReport9_9Entitlement(mkdb(owner), '') === false, 'no openid → false')
}

// ── §3 getAiReport / idempotency wired to the report_9_9 channel ────────────
{
  const getSrc = fs.readFileSync(GET_INDEX, 'utf8')
  ok(/hasReport9_9Entitlement/.test(getSrc), 'getAiReport uses hasReport9_9Entitlement')
  ok(/resolveReportAccess\(report, isVip === true, report9_9 === true\)/.test(getSrc), 'getAiReport passes report9_9 into resolver')

  ok(/hasReport9_9Entitlement/.test(IDEM_SRC), 'idempotency requires reportEntitlement')
  ok(/resolveReport9_9/.test(IDEM_SRC), 'idempotency resolves report_9_9')
  ok(/reportAccessFields\(entity, vip === true, owned9_9\)/.test(IDEM_SRC), 'idempotency passes owned9_9 into resolver')

  // A (server): a brand-new report, unpaid, owner holds permanent report_9_9 → unlocked
  async function runReady (reportEntity, vipGranted, owned9_9) {
    delete require.cache[require.resolve(IDEM)]
    const { runChallengeFinalReport } = require(IDEM)
    const db = {
      command: { set: (v) => ({ __op: 'set', value: v }) },
      collection (name) {
        const api = { where () { return api }, limit () { return api }, async get () { return { data: [] } }, async update () { return { stats: { updated: 1 } } }, async add () { return { _id: 'x' } } }
        if (name === 'challenge_records') api.get = async () => ({ data: [{ recordId: 'CR1', openid: 'o1' }] })
        if (name === 'ai_reports') api.get = async () => ({ data: [reportEntity] })
        return api
      },
    }
    return runChallengeFinalReport({
      db, openid: 'o1', event: { recordId: 'CR1' }, ts: Date.now(),
      deps: { checkVip: async () => vipGranted, hasReport9_9: async () => owned9_9, callAI: async () => ({ success: false }), buildReportPrompt: () => ({ systemPrompt: '', userMessage: '' }), emitModelCall: () => Promise.resolve(), staleMs: 90000 },
    })
  }
  const NEW_UNPAID = { _id: 'ARnew', reportId: 'ARnew', openid: 'o1', type: 'challenge_final', recordId: 'CR1', status: 'ready', isPaid: false, content: { oneSentence: 's', worldModelType: 'w', bestPath: 'p' } }

  // A: new report + report_9_9 → unlocked, no payment needed
  const rA = await runReady(NEW_UNPAID, false, true)
  eq(rA.data.locked, false, 'A new report + report_9_9 → unlocked')
  eq(rA.data.canViewFullReport, true, 'A → canViewFullReport true')
  eq(rA.data.isPaid, true, 'A isPaid true (entitled)')
  ok(!!(rA.data.content && rA.data.content.oneSentence), 'A full content returned (no paywall)')
  eq(rA.data.reportId, 'ARnew', 'A reportId preserved')

  // B: new report, no entitlement → paywall
  const rB = await runReady(NEW_UNPAID, false, false)
  eq(rB.data.locked, true, 'B new report, no entitlement → locked')
  eq(rB.data.canViewFullReport, false, 'B → cannot view full')
  ok(!rB.data.content, 'B no full content')
  ok(!!rB.data.summary, 'B summary teaser only')
}

// ── §4 challenge decoupled from report payment ──────────────────────────────
{
  const SC = fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'startChallenge', 'index.js'), 'utf8')
  const GCE = fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'getChallengeEvent', 'index.js'), 'utf8')
  const CE = fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'startChallenge', 'lib', 'challengeEntitlement.js'), 'utf8')

  // challenge authority = challenge entitlements only
  ok(/hasChallengeEntitlement/.test(SC), 'startChallenge uses hasChallengeEntitlement')
  ok(/CHALLENGE_PERMISSION = 'challenge_full'/.test(CE), 'challenge authority = challenge_full')
  ok(!/report_9_9/.test(SC), 'startChallenge never references report_9_9')
  ok(!/report\.isPaid/.test(SC), 'startChallenge never references report.isPaid')
  ok(!/reportAccess/.test(SC), 'startChallenge never reads report access authority')
  ok(!/report_9_9/.test(GCE) && !/reportAccess/.test(GCE), 'getChallengeEvent locks only on trialMode (not report)')

  // C: challenge-entitled owner + (any) report state → challenge access granted
  const { hasChallengeEntitlement } = require(path.join(ROOT, 'cloudfunctions', 'startChallenge', 'lib', 'challengeEntitlement.js'))
  const mkdb = (perms) => ({ collection: (n) => ({ where: () => ({ limit: () => ({ get: async () => ({ data: n === 'entitlements' ? [{ permissions: perms }] : [] }) }) }) }) })
  ok(await hasChallengeEntitlement(mkdb(['challenge_full', 'full_report']), 'o1') === true, 'C challenge_full → challenge access granted')
  ok(await hasChallengeEntitlement(mkdb(['full_report', 'report_history']), 'o1') === false, 'D report-only (no challenge_full) → challenge still required')
}

// ── §5 UI copy: keep 一次购买 · 永久解锁 ─────────────────────────────────────
{
  const mw = fs.readFileSync(path.join(ROOT, 'pages', 'membership', 'membership.wxml'), 'utf8')
  ok(/认知会员/.test(mw), 'UI advertises 认知会员 (RC8_11 membership)')
  ok(/会员权益/.test(mw), 'UI shows membership rights')
  ok(!/一次购买 · 永久解锁/.test(mw), 'UI no longer advertises the retired standalone permanent unlock')
}

console.log(`\npersistent-report-entitlement_TEST pass=${pass} fail=${fail}`)
process.exit(fail ? 1 : 0)
})().catch((e) => { console.error('RUNNER ERROR', e); process.exit(2) })
