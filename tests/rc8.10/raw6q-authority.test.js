'use strict'
/**
 * tests/rc8.10/raw6q-authority.test.js — RC8_10B STAGE_D1
 *
 * RAW 6Q is the L0 authority. The generated turnaround_6q report is DERIVED
 * evidence only; NO fact is reverse-engineered from report text when a raw
 * answer exists. Covers spec TEST_MATRIX raw items:
 *   R1 raw 6Q is server-persisted (dedicated store) + bound to openid
 *   R2 raw 6Q is L0 (evidenceMap RAW_6Q beats profile/memory)
 *   R3 raw 6Q beats contradictory memory
 *   R4 newest raw 6Q beats historical raw 6Q
 *   R5 legacy user (no raw) → DERIVED_LEGACY from report, NO fabrication
 *   R6 no report-text extraction of facts when raw exists
 *   R7 no cross-user raw context
 */

const assert = require('assert')
const path = require('path')

const BASE = path.join(__dirname, '../../cloudfunctions/generateAiReport/lib')
const UCB = require(path.join(BASE, 'context/userContextBuilder.js'))
const rawStore = require(path.join(BASE, 'raw6qStore.js'))
const { assembleUserContext, buildUserContext } = UCB

let pass = 0, fail = 0
function ok (cond, msg) { if (cond) pass++; else { fail++; console.log('  ✗ ' + msg) } }

function makeFakeDb (rows) {
  return {
    collection (coll) {
      let filters = {}
      const c = {
        where (f) { filters = f; return c },
        orderBy (field, dir) { c._o = { field, dir }; return c },
        limit (n) { c._l = n; return c },
        async get () {
          let data = (rows[coll] || []).filter((r) => Object.keys(filters).every((k) => r[k] === filters[k]))
          if (c._o) { const { field, dir } = c._o; data = data.slice().sort((a, b) => dir === 'desc' ? (b[field] > a[field] ? 1 : -1) : (a[field] > b[field] ? 1 : -1)) }
          if (c._l) data = data.slice(0, c._l)
          return { data }
        },
        add ({ data }) { rows[coll] = rows[coll] || []; rows[coll].push(data); return Promise.resolve({ _id: 'id' + (rows[coll].length) }) },
      }
      return c
    },
  }
}

async function main () {
  console.log('RC8_10B — RAW 6Q AUTHORITY')

  // R1 — persistence (dedicated collection, openid-bound, idempotent)
  const rows = {}
  const db = makeFakeDb(rows)
  const answers = { age: '32', job: '厨师', education: '初中', income: '7000', anxiety: '想副业没方向', rootCause: '只会炒菜', diagnosticVersion: 'turnaround_strategy_6q_v1' }
  const p1 = await rawStore.persistRaw6Q(db, { openid: 'o1', requestId: 'r1', answers, ts: 100 })
  ok(p1.ok && p1.rawId, 'R1: raw 6Q persisted')
  ok((rows.user_6q_raw || []).length === 1, 'R1: stored in dedicated user_6q_raw collection')
  ok(rows.user_6q_raw[0].openid === 'o1' && rows.user_6q_raw[0].source === 'RAW_6Q', 'R1: bound to openid + source RAW_6Q')
  const p2 = await rawStore.persistRaw6Q(db, { openid: 'o1', requestId: 'r1', answers, ts: 101 })
  ok(p2.ok && (rows.user_6q_raw || []).length === 1, 'R1: idempotent by requestId')
  const bad = await rawStore.persistRaw6Q(db, { openid: 'o1', requestId: 'r2', answers: { job: 'x' }, ts: 102 })
  ok(!bad.ok && /INVALID/.test(bad.reason), 'R1: incomplete answers rejected')

  // R2/R3 — raw 6Q is L0, beats profile + contradictory memory
  const rawDoc = { source: 'RAW_6Q', diagnosticVersion: 'turnaround_strategy_6q_v1', completedAt: 200,
    facts: { age: '32', job: '外卖员', education: '高中', income: '6000', anxiety: '想第二收入', rootCause: '没学历' } }
  const sixqReport = { reportId: 'rpt_6q_X', createdAt: 150, content: { system_trap: 'CALLED ME A 程序员', core_problem: '写代码', fatal_sentence: 'x', strategy_path: 'y' } }
  const ctx = assembleUserContext({
    scenario: 'career', message: '',
    raw6q: rawDoc, sixqReport,
    profile: { occupation: '销售', mainType: 'normal_awakened' },
    memories: [{ content: '用户是程序员，想转产品经理' }],
    memoryEnabled: true,
  })
  ok(ctx.sixQSource === 'RAW_6Q', 'R2: sixQSource is RAW_6Q')
  ok(ctx.evidenceMap.sixQ === 'RAW_6Q', 'R2: evidenceMap.sixQ = RAW_6Q')
  ok(ctx.explicitProfile.occupation === '外卖员', 'R2: occupation from RAW 6Q (not profile 销售)')
  ok(ctx.evidenceMap.occupation === 'RAW_6Q', 'R2: occupation evidenced RAW_6Q')
  ok(ctx.raw6Q.rootCause === '没学历', 'R2: raw rootCause surfaced')
  ok(ctx.explicitProfile.anxiety === '想第二收入', 'R2: raw anxiety surfaced')
  ok(ctx.explicitProfile.occupation !== '程序员' && ctx.explicitProfile.occupation !== '销售', 'R3: raw 6Q beats contradictory memory + profile')

  // R6 — no report-text extraction when raw exists
  ok(!/程序员/.test(ctx.sixQText) && !/写代码/.test(ctx.sixQText), 'R6: report text NOT used for facts when raw exists')

  // R4 — newest raw 6Q beats historical
  const db2 = makeFakeDb({ user_6q_raw: [
    { openid: 'oZ', status: 'completed', source: 'RAW_6Q', completedAt: 100, createdAt: 100, facts: { age: '25', job: '学生', education: '本科', income: '0', anxiety: 'old', rootCause: 'oldc' } },
    { openid: 'oZ', status: 'completed', source: 'RAW_6Q', completedAt: 300, createdAt: 300, facts: { age: '30', job: '个体老板', education: '大专', income: '15000', anxiety: 'new', rootCause: 'newc' } },
  ] })
  const latest = await buildUserContext(db2, 'oZ', { scenario: 'career', message: '' })
  ok(latest.raw6Q.job === '个体老板' && latest.raw6Q.completedAt === 300, 'R4: newest raw 6Q selected')
  ok(latest.explicitProfile.occupation === '个体老板', 'R4: newest raw drives occupation')

  // R5 — legacy user: report-derived → DERIVED_LEGACY, NO fabrication
  const legacy = assembleUserContext({
    scenario: 'career', message: '',
    raw6q: null, sixqReport,
    profile: null, memoryEnabled: true,
  })
  ok(legacy.sixQSource === 'DERIVED_LEGACY', 'R5: legacy user → DERIVED_LEGACY')
  ok(legacy.evidenceMap.sixQ === 'DERIVED_LEGACY', 'R5: evidenceMap DERIVED_LEGACY')
  ok(legacy.raw6Q === null, 'R5: no fabricated raw 6Q for legacy user')
  ok(legacy.missingFields.includes('income'), 'R5: unknown legacy facts stay missing (no fabrication)')

  // R7 — no cross-user raw context
  const other = await buildUserContext(db2, 'stranger', { scenario: 'career', message: '' })
  ok(!other.hasSixQ && other.raw6Q === null, 'R7: no cross-user raw context')

  // ── ADD_RULE RAW_6Q_LATEST_SET_ONLY — cases A–G ──

  // A: one user one 6Q → that set selected
  const dbA = makeFakeDb({ user_6q_raw: [
    { openid: 'A', status: 'completed', sixQRecordId: 'r-A', sixQVersion: 'turnaround_strategy_6q_v1', completedAt: 10, createdAt: 10, source: 'RAW_6Q', facts: { age: '28', job: '销售', education: '本科', income: '9000', anxiety: 'a', rootCause: 'b' } },
  ] })
  const cA = await buildUserContext(dbA, 'A', { scenario: 'career', message: '' })
  ok(cA.activeSixQRecordId === 'r-A' && cA.explicitProfile.occupation === '销售', 'A: single set selected')

  // B: three completed sets → newest completedAt selected
  const dbB = makeFakeDb({ user_6q_raw: [
    { openid: 'B', status: 'completed', completedAt: 100, createdAt: 100, facts: { age: '20', job: '学生', education: '高中', income: '0', anxiety: 'x', rootCause: 'y' } },
    { openid: 'B', status: 'completed', completedAt: 300, createdAt: 300, facts: { age: '24', job: '快递员', education: '大专', income: '6000', anxiety: 'x', rootCause: 'y' } },
    { openid: 'B', status: 'completed', completedAt: 200, createdAt: 200, facts: { age: '22', job: '外卖员', education: '大专', income: '5000', anxiety: 'x', rootCause: 'y' } },
  ] })
  const cB = await buildUserContext(dbB, 'B', { scenario: 'career', message: '' })
  ok(cB.raw6Q.completedAt === 300 && cB.explicitProfile.occupation === '快递员', 'B: newest completedAt selected')

  // C: newest createdAt but NOT completed → latest COMPLETED set selected
  const dbC = makeFakeDb({ user_6q_raw: [
    { openid: 'C', status: 'completed', completedAt: 100, createdAt: 100, facts: { age: '30', job: '厨师', education: '初中', income: '7000', anxiety: 'x', rootCause: 'y' } },
    { openid: 'C', status: 'draft', completedAt: 0, createdAt: 999, facts: { age: '31', job: '餐饮店老板', education: '初中', income: '20000', anxiety: 'x', rootCause: 'y' } },
  ] })
  const cC = await buildUserContext(dbC, 'C', { scenario: 'career', message: '' })
  ok(cC.explicitProfile.occupation === '厨师' && cC.activeSixQCompletedAt === 100, 'C: incomplete newest ignored → latest completed used')

  // D: newest 6Q contradicts old occupation → newest used everywhere
  const dCareer = assembleUserContext({ scenario: 'career', message: '', raw6q: cC.raw6Q, memoryEnabled: true })
  const dHustle = assembleUserContext({ scenario: 'side_hustle', message: '', raw6q: cC.raw6Q, memoryEnabled: true })
  ok(dCareer.explicitProfile.occupation === '厨师' && dHustle.explicitProfile.occupation === '厨师', 'D: newest occupation used in every scenario')

  // E: newest set has an empty optional field → NO backfill from old 6Q, mark missing
  const dbE = makeFakeDb({ user_6q_raw: [
    { openid: 'E', status: 'completed', completedAt: 100, createdAt: 100, facts: { age: '32', job: '程序员', education: '本科', income: '25000', anxiety: 'old', rootCause: 'old' } },
    { openid: 'E', status: 'completed', completedAt: 300, createdAt: 300, facts: { age: '33', job: '餐饮店老板', education: '', income: '30000', anxiety: '新焦虑', rootCause: '新原因' } },
  ] })
  const cE = await buildUserContext(dbE, 'E', { scenario: 'career', message: '' })
  ok(cE.raw6Q.job === '餐饮店老板' && cE.explicitProfile.occupation !== '程序员', 'E: newest set wins (old 程序员 not used)')
  ok(cE.raw6Q.education === '' && cE.explicitProfile.education === null && cE.missingFields.includes('education'), 'E: empty field stays missing (no backfill from old 本科)')
  ok(cE.explicitProfile.education !== '本科', 'E: old-set education NOT merged in')
  ok(cE.evidenceMap.sixQ === 'RAW_6Q', 'E: still a single RAW set')

  // F: new 6Q completed while cache exists → cache invalidated (version key changes)
  const before = await buildUserContext(dbE, 'E', { scenario: 'career', message: '' })
  await rawStore.persistRaw6Q(dbE, { openid: 'E', requestId: 'E-new', answers: { age: '40', job: '投资人', education: '硕士', income: '50000', anxiety: 'c', rootCause: 'd' }, ts: 500 })
  const after = await buildUserContext(dbE, 'E', { scenario: 'career', message: '' })
  ok(before.raw6Q.completedAt === 300 && after.raw6Q.completedAt === 500 && after.raw6Q.job === '投资人', 'F: retake changes active set (stale context invalidated)')
  ok(before.activeSixQRecordId !== after.activeSixQRecordId || after.activeSixQRecordId === 'raw6q_E-new', 'F: active set id advances on retake')

  // G: old memory contradicts new 6Q → new 6Q wins
  const cG = assembleUserContext({
    scenario: 'career', message: '', raw6q: cC.raw6Q,
    memories: [{ content: '用户是餐饮店老板，收入20000' }], memoryEnabled: true,
  })
  ok(cG.explicitProfile.occupation === '厨师' && cG.evidenceMap.sixQ === 'RAW_6Q', 'G: active 6Q beats contradicting memory')

  // ── RC8_10B1 — deterministic tie-break + single-version drift checks ──

  // H: same completedAt → newer createdAt wins
  const dbH = makeFakeDb({ user_6q_raw: [
    { openid: 'H', status: 'completed', completedAt: 500, createdAt: 500, facts: { age: '1', job: '旧职业', education: 'x', income: '1', anxiety: 'a', rootCause: 'b' } },
    { openid: 'H', status: 'completed', completedAt: 500, createdAt: 900, facts: { age: '2', job: '新职业', education: 'x', income: '2', anxiety: 'a', rootCause: 'b' } },
  ] })
  const cH = await buildUserContext(dbH, 'H', { scenario: 'career', message: '' })
  ok(cH.raw6Q.job === '新职业' && cH.raw6Q.completedAt === 500, 'H: same completedAt → newer createdAt wins')

  // I: same completedAt + createdAt → deterministic sixQVersion DESC
  const dbI = makeFakeDb({ user_6q_raw: [
    { openid: 'I', status: 'completed', completedAt: 500, createdAt: 500, sixQVersion: 'turnaround_strategy_6q_v1', facts: { age: '1', job: 'AA', education: 'x', income: '1', anxiety: 'a', rootCause: 'b' } },
    { openid: 'I', status: 'completed', completedAt: 500, createdAt: 500, sixQVersion: 'turnaround_strategy_6q_v2', facts: { age: '2', job: 'BB', education: 'x', income: '2', anxiety: 'a', rootCause: 'b' } },
  ] })
  const cI = await buildUserContext(dbI, 'I', { scenario: 'career', message: '' })
  ok(cI.raw6Q.job === 'BB', 'I: tie-break deterministic on sixQVersion desc')
  ok(cI.sixQAuthorityType === 'RAW_6Q', 'I: sixQAuthorityType = RAW_6Q')

  // J/K/L: six scenarios + ask + challenge all resolve the SAME activeSixQRecordId
  const dbJ = makeFakeDb({ user_6q_raw: [
    { openid: 'J', status: 'completed', sixQRecordId: 'the-active-id', completedAt: 700, createdAt: 700, facts: { age: '30', job: '厨师', education: '初中', income: '7000', anxiety: 'a', rootCause: 'b' } },
  ] })
  const ids = new Set()
  for (const sc of ['career', 'ai_track', 'side_hustle', 'promotion', 'boss', 'anxiety', 'ask']) {
    const cx = await buildUserContext(dbJ, 'J', { scenario: sc, message: '' })
    ids.add(cx.activeSixQRecordId)
  }
  ok(ids.size === 1 && ids.has('the-active-id'), 'J/K: six scenarios + ask share one activeSixQRecordId')
  // challenge path uses the same UCB copy (getChallengeEvent/lib) → same active id
  const UCB_GC = require(path.join(__dirname, '../../cloudfunctions/getChallengeEvent/lib/context/userContextBuilder.js'))
  const gcCtx = await UCB_GC.buildUserContext(dbJ, 'J', { scenario: 'career', message: '' })
  ok(gcCtx.activeSixQRecordId === 'the-active-id', 'L: challenge-path UCB resolves the same activeSixQRecordId')

  console.log('  _TEST pass=' + pass + ' fail=' + fail)
  if (fail > 0) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
