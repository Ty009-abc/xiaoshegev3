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
    { openid: 'oZ', source: 'RAW_6Q', completedAt: 100, facts: { age: '25', job: '学生', education: '本科', income: '0', anxiety: 'old', rootCause: 'oldc' } },
    { openid: 'oZ', source: 'RAW_6Q', completedAt: 300, facts: { age: '30', job: '个体老板', education: '大专', income: '15000', anxiety: 'new', rootCause: 'newc' } },
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

  console.log('  _TEST pass=' + pass + ' fail=' + fail)
  if (fail > 0) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
