'use strict'
/**
 * tests/rc8.10/ask-xiaoshige.test.js — RC8_10A2 STAGE_C
 *
 * 直接问小事哥 (AI chat) must be personalized via the SAME context authority:
 *   A1  context order: persona → rules → 6Q → challenge/report → memory[gated] → conversation
 *   A2  uses the user's real 6Q when present
 *   A3  asks a conditional / clarifying question when facts are missing (never invents)
 *   A4  memory ON adds memory context; memory OFF drops it but KEEPS 6Q
 *   A5  no "根据你的6Q" parroting; free-form (light) reply structure
 *   A6  no cross-user context
 */

const assert = require('assert')
const path = require('path')

const UCB = require(path.join(__dirname, '../../cloudfunctions/generateAiReport/lib/context/userContextBuilder.js'))
const { buildUserContext, composeScenarioPrompt, validateScenarioResponse } = UCB

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
      }
      return c
    },
  }
}

async function main () {
  console.log('RC8_10A2 — ASK XIAOSHIGE')
  const OWNER = 'owner_openid'
  const db = makeFakeDb({
    ai_reports: [{ openid: OWNER, reportType: 'turnaround_6q', reportId: 'rpt_6q_A', createdAt: 9,
      content: { diagnosticVersion: 'turnaround_strategy_6q_v1', system_trap: '厨师，月收入7000，想转行没方向',
        core_problem: '只会炒菜，怕年龄大了没人要', fatal_sentence: '我这辈子只能在后厨', strategy_path: '先从菜品标准化做起' } }],
    user_profiles: [{ openid: OWNER, mainType: 'normal_awakened', wealthPotentialScore: 61, laborMindset: 25 }],
    challenge_records: [{ openid: OWNER, status: 'finished', recordId: 'CR1', finalType: 'normal_awakened', rawScores: { cv: 40 } }],
  })

  // A1/A2 — context order + real 6Q
  const ctx = await buildUserContext(db, OWNER, { scenario: 'ask', message: '我现在很迷茫，该干嘛', memoryEnabled: true, memories: [{ content: '想三年内开一家小店' }] })
  ok(ctx.hasSixQ && ctx.sixQ.rootProblem === '只会炒菜，怕年龄大了没人要', 'A2: ask uses real 6Q')
  ok(ctx.explicitProfile.occupation === '厨师', 'A2: ask reads occupation from own 6Q')
  const p = composeScenarioPrompt('ask', ctx)
  const idxPersona = p.systemPrompt.indexOf('珠澳小事哥')
  const idxSixQ = p.systemPrompt.indexOf('【最新6Q权威数据')
  const idxMem = p.systemPrompt.indexOf('【长期记忆')
  ok(idxPersona >= 0 && idxSixQ > idxPersona, 'A1: persona precedes 6Q')
  ok(idxMem < 0 || idxMem > idxSixQ, 'A1: memory comes after 6Q')
  ok(/只会炒菜/.test(p.systemPrompt), 'A2: 6Q content present in prompt')

  // A3 — missing facts → conditional handling, not invention
  const sparse = await buildUserContext(db, 'newbie', { scenario: 'ask', message: '我想赚钱', memoryEnabled: true })
  ok(!sparse.hasSixQ && sparse.explicitProfile.occupation === null, 'A3: unknown user has no invented occupation')
  ok(sparse.missingFields.includes('occupation') && sparse.missingFields.includes('income'), 'A3: missing fields recorded')
  const ps = composeScenarioPrompt('ask', sparse)
  ok(/未知/.test(ps.systemPrompt), 'A3: prompt marks unknown facts (no invention)')

  // A4 — memory gating
  const onCtx = await buildUserContext(db, OWNER, { scenario: 'ask', message: 'x', memoryEnabled: true, memories: [{ content: '想三年内开一家小店' }] })
  const offCtx = await buildUserContext(db, OWNER, { scenario: 'ask', message: 'x', memoryEnabled: false, memories: [{ content: '想三年内开一家小店' }] })
  ok(onCtx.memories.length === 1 && onCtx.hasSixQ, 'A4: memory ON keeps memory + 6Q')
  ok(offCtx.memories.length === 0 && offCtx.hasSixQ, 'A4: memory OFF drops memory, keeps 6Q')

  // A5 — no parroting + light structure for ask
  ok(/不要反复说/.test(p.systemPrompt), 'A5: anti-repetition rule present')
  ok(/自然段|不要套用固定报告标题/.test(p.systemPrompt), 'A5: ask uses light free-form structure')
  const careerP = composeScenarioPrompt('career', ctx)
  ok(/当前判断 \/ 为什么/.test(careerP.systemPrompt), 'A5: six scenarios keep the report structure')

  // A6 — cross-user isolation
  const other = await buildUserContext(db, 'stranger', { scenario: 'ask', message: 'x', memoryEnabled: true })
  ok(!other.hasSixQ && other.explicitProfile.occupation === null, 'A6: no cross-user context')

  // sanity: validator accepts a grounded ask answer, rejects a fabricated one
  const good = '你现在是厨师，月入7000，核心卡点是「只会炒菜，怕年龄大了没人要」。建议先把菜品标准化沉淀成可复制的方法。'
  ok(validateScenarioResponse(good, ctx).ok, 'ask grounded answer accepted')
  const bad = '建议你去学 Java 转码做后端。'
  ok(validateScenarioResponse(bad, ctx).errors.includes('UNRELATED_OCCUPATION_ADVICE'), 'ask fabricated programming pivot flagged')

  console.log('  _TEST pass=' + pass + ' fail=' + fail)
  if (fail > 0) process.exit(1)
}
main().catch((e) => { console.error(e); process.exit(1) })
