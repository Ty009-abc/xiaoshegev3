'use strict'
/**
 * tests/rc8.10/golden-cases.test.js — RC8_10A2 GOLDEN CASES
 *
 * ≥20 golden cases spanning the 10 required occupations:
 * 厨师 / 外卖员 / 快递员 / 销售 / 白领 / 个体老板 / 宝妈 / 学生 / 技术人员 / 内容创作者.
 *
 * For each case we assert the CONTEXT AUTHORITY behaves correctly:
 *   G1  latest 6Q is selected for the authenticated openid
 *   G2  employment facts are read from the user's OWN 6Q (never invented)
 *   G3  a chef + AI赛道 turn does NOT recommend Java / Kubernetes / 转码
 *   G4  a low-capital side-hustle turn does NOT get a capital-heavy PRIMARY plan
 *   G5  all six scenarios share the SAME context authority (sixQ surfaced)
 *   G6  memory OFF still uses 6Q; memory ON adds memory context
 *   G7  no cross-user context (openid-scoped)
 *
 * The `makeFakeDb` mirrors the cloud DB `where().orderBy().limit().get()` chain.
 */

const assert = require('assert')
const path = require('path')

const UCB = require(path.join(__dirname, '../../cloudfunctions/generateAiReport/lib/context/userContextBuilder.js'))
const { assembleUserContext, validateScenarioResponse, SCENARIO_NAME_TO_KEY, buildUserContext } = UCB

let pass = 0, fail = 0
function ok (cond, msg) { if (cond) { pass++ } else { fail++; console.log('  ✗ ' + msg) } }

// ── minimal in-memory DB shaped like the cloud one ─────────────────────────
function makeFakeDb (rows) {
  // rows: { [collection]: [ {..} ] }
  function chain (coll, filters) {
    const api = {
      orderBy (field, dir) { api._order = { field, dir }; return api },
      limit (n) { api._limit = n; return api },
      field (f) { api._field = f; return api },
      async get () {
        let data = (rows[coll] || []).filter((r) => Object.keys(filters).every((k) => r[k] === filters[k]))
        if (api._order) {
          const { field, dir } = api._order
          data = data.slice().sort((a, b) => (dir === 'desc' ? (b[field] > a[field] ? 1 : -1) : (a[field] > b[field] ? 1 : -1)))
        }
        if (api._limit) data = data.slice(0, api._limit)
        return { data }
      },
      async count () { return { total: (rows[coll] || []).filter((r) => Object.keys(filters).every((k) => r[k] === filters[k])).length } },
    }
    return api
  }
  return {
    collection (coll) {
      let filters = {}
      const c = {
        where (f) { filters = f; return c },
        orderBy: (field, dir) => chain(coll, filters).orderBy(field, dir),
        limit: (n) => chain(coll, filters).limit(n),
        get: () => chain(coll, filters).get(),
        count: () => chain(coll, filters).count(),
      }
      return c
    },
  }
}

// ── golden corpus ──────────────────────────────────────────────────────────
// Each entry: { name, occupation, sixq (content), extra messages, expect6Q }
const CASES = [
  { occupation: '厨师', job: '饭店厨师，炒菜8年', income: 7000, edu: '初中',
    problem: '想转行但只会炒菜，怕年龄大了没人要', fatal: '我这辈子只能在后厨' },
  { occupation: '厨师', job: '连锁餐厅厨师长', income: 9000, edu: '高中',
    problem: '收入到顶了，想搞点副业', fatal: '除了炒菜我啥也不会' },
  { occupation: '外卖员', job: '外卖员，跑了三年', income: 6000, edu: '高中',
    problem: '风吹日晒，想找个稳定出路', fatal: '没学历只能送外卖' },
  { occupation: '外卖员', job: '外卖员，兼职接单+白天打零工', income: 5000, edu: '初中',
    problem: '想学点技术但不知道学啥', fatal: '学东西太慢，学了也没用' },
  { occupation: '快递员', job: '快递员，驿站分拣', income: 5500, edu: '中专',
    problem: '每天搬货，看不到上升空间', fatal: '我只能干体力活' },
  { occupation: '快递员', job: '快递员，跑了好几年', income: 6500, edu: '高中',
    problem: '想攒钱做点小生意', fatal: '工资涨不上去' },
  { occupation: '销售', job: '建材销售', income: 8000, edu: '大专',
    problem: '业绩忽高忽低，想有稳定副业', fatal: '客户资源带不走' },
  { occupation: '销售', job: '做保险销售', income: 6000, edu: '本科',
    problem: '压力大，收入不稳定', fatal: '干销售吃青春饭' },
  { occupation: '白领', job: '公司白领，做行政文员', income: 7000, edu: '本科',
    problem: '工作重复，担心被替代', fatal: '没核心竞争力' },
  { occupation: '白领', job: '公司白领，运营专员', income: 9000, edu: '本科',
    problem: '想提升收入但没方向', fatal: '打工天花板太低' },
  { occupation: '个体老板', job: '个体老板，开小超市', income: 12000, edu: '高中',
    problem: '客流下滑，想找新增长', fatal: '生意越来越难做' },
  { occupation: '个体老板', job: '个体老板，经营一家服装店', income: 10000, edu: '大专',
    problem: '库存压资金，想转型线上', fatal: '不懂互联网' },
  { occupation: '宝妈', job: '宝妈，全职带娃三年', income: 0, edu: '大专',
    problem: '想在家做点事补贴家用', fatal: '脱离社会太久' },
  { occupation: '宝妈', job: '宝妈，兼职带娃+做过客服', income: 3000, edu: '本科',
    problem: '时间碎片化，想找灵活工作', fatal: '没人帮忙带孩子' },
  { occupation: '学生', job: '学生，大四应届生', income: 0, edu: '本科',
    problem: '不知道毕业该干嘛', fatal: '没经验没人要' },
  { occupation: '学生', job: '学生，大专在读兼职做家教', income: 2000, edu: '大专',
    problem: '想早点赚钱但没方向', fatal: '起点比别人低' },
  { occupation: '技术人员', job: '技术人员，工厂设备维修岗', income: 8500, edu: '大专',
    problem: '想往上走但学历卡住了', fatal: '技术再好人也不值钱' },
  { occupation: '技术人员', job: '技术人员，汽车维修技师', income: 9000, edu: '中专',
    problem: '想自己开店但没本钱', fatal: '给别人打工赚不到钱' },
  { occupation: '内容创作者', job: '内容创作者，做美食短视频', income: 5000, edu: '本科',
    problem: '粉丝涨不动，变现难', fatal: '内容没人看' },
  { occupation: '内容创作者', job: '内容创作者，做职场干货公众号', income: 6000, edu: '本科',
    problem: '流量不稳定，想找第二曲线', fatal: '平台规则一变就完蛋' },
  { occupation: '厨师', job: '厨师出身，小吃摊主卖早餐', income: 8000, edu: '初中',
    problem: '起早贪黑，想放大规模', fatal: '只靠我一个人' },
  { occupation: '销售', job: '做房产中介的销售', income: 7000, edu: '高中',
    problem: '行情差，收入腰斩', fatal: '除了卖房不会别的' },
]

const SCENARIOS = ['career', 'money_logic', 'side_hustle', 'ai_track', 'cognition', 'traffic']

function sixqRow (openid, content, createdAt) {
  return {
    openid, reportType: 'turnaround_6q', reportId: 'rpt_6q_' + createdAt,
    createdAt, content: Object.assign({ diagnosticVersion: 'turnaround_strategy_6q_v1' }, content),
  }
}

function raw6qRow (openid, cse, completedAt) {
  return {
    openid, rawId: 'raw6q_' + completedAt, sixQRecordId: 'raw6q_' + completedAt,
    sixQVersion: 'turnaround_strategy_6q_v1', status: 'completed', source: 'RAW_6Q',
    diagnosticVersion: 'turnaround_strategy_6q_v1', completedAt, createdAt: completedAt,
    facts: {
      age: String(cse.age || 30), job: cse.job, education: cse.edu,
      income: String(cse.income), anxiety: cse.problem, rootCause: cse.fatal,
    },
  }
}

async function main () {
  console.log('RC8_10A2 — GOLDEN CASES (' + CASES.length + ' cases)')

  for (const [i, cse] of CASES.entries()) {
    const openid = 'openid_' + i
    const sixqContent = {
      system_trap: cse.job + ' → ' + cse.problem,
      core_problem: cse.problem,
      fatal_sentence: cse.fatal,
      strategy_path: '先从现有能力出发，做低成本可验证的尝试',
    }
    const rows = {
      ai_reports: [sixqRow(openid, sixqContent, 1000 + i)],
      user_6q_raw: [raw6qRow(openid, cse, 2000 + i)],
      user_profiles: [{ openid, mainType: 'normal_awakened', wealthPotentialScore: 62, laborMindset: 30, capitalThinking: 40 }],
      challenge_records: [],
    }
    const db = makeFakeDb(rows)

    // G1 latest RAW 6Q selected (L0 authority)
    const ctx = await buildUserContext(db, openid, { scenario: 'career', message: '' })
    ok(ctx.hasSixQ && ctx.sixQSource === 'RAW_6Q', `#${i + 1} ${cse.occupation}: latest raw 6Q selected`)
    ok(ctx.raw6Q && ctx.raw6Q.rootCause === cse.fatal, `#${i + 1} ${cse.occupation}: raw 6Q content correct`)

    // G2 occupation read from own raw 6Q
    ok(ctx.explicitProfile.occupation === cse.occupation,
      `#${i + 1} expect occupation ${cse.occupation}, got ${ctx.explicitProfile.occupation}`)
    ok(ctx.evidenceMap.occupation === 'RAW_6Q', `#${i + 1} occupation evidenced as RAW_6Q`)

    // G3 chef / any non-digital → no programming career for AI赛道
    const aiCtx = assembleUserContext({
      scenario: 'ai_track', message: '',
      raw6q: rows.user_6q_raw[0], sixqReport: rows.ai_reports[0], profile: rows.user_profiles[0], memoryEnabled: true,
    })
    const nonDigital = !['技术人员'].includes(cse.occupation)
    if (nonDigital) {
      const badResp = '建议你去学 Java 和 Kubernetes，转码做后端开发。'
      const v = validateScenarioResponse(badResp, aiCtx)
      ok(v.errors.includes('UNRELATED_OCCUPATION_ADVICE'), `#${i + 1} ${cse.occupation}: Java/K8s flagged for non-digital occupation`)
      const goodResp = '不建议你转 Java，AI 应该先增强你现有的' + cse.occupation + '能力，' + cse.problem + ' 可以这样破解。'
      ok(validateScenarioResponse(goodResp, aiCtx).ok, `#${i + 1} ${cse.occupation}: negated-Java answer accepted`)
    }

    // G4 low-capital side hustle → no capital-heavy PRIMARY plan
    const shCtx = assembleUserContext({
      scenario: 'side_hustle', message: '',
      raw6q: rows.user_6q_raw[0], sixqReport: rows.ai_reports[0], profile: rows.user_profiles[0], memoryEnabled: true,
    })
    const capitalHeavy = '首选方案是加盟开店，进货囤货，租店面做起来。' + cse.problem
    const v2 = validateScenarioResponse(capitalHeavy, shCtx)
    ok(v2.errors.includes('UNSUPPORTED_CAPITAL_ASSUMPTION'), `#${i + 1} ${cse.occupation}: capital-heavy primary plan flagged`)

    // G5 all six scenarios share the same authority (6Q surfaced each time)
    for (const sc of SCENARIOS) {
      const sctx = assembleUserContext({
        scenario: sc, message: '',
        raw6q: rows.user_6q_raw[0], sixqReport: rows.ai_reports[0], profile: rows.user_profiles[0], memoryEnabled: true,
      })
      ok(sctx.hasSixQ && sctx.evidenceMap.sixQ === 'RAW_6Q' && sctx.raw6Q.rootCause === cse.fatal,
        `#${i + 1} ${cse.occupation}: scenario ${sc} uses shared raw 6Q authority`)
    }

    // G6 memory OFF still uses 6Q; memory ON adds memory context
    const offCtx = assembleUserContext({
      scenario: 'career', message: '',
      raw6q: rows.user_6q_raw[0], sixqReport: rows.ai_reports[0], profile: rows.user_profiles[0], memories: [{ content: 'MEM' }], memoryEnabled: false,
    })
    ok(offCtx.hasSixQ && offCtx.memories.length === 0 && offCtx.evidenceMap.memories === 'MEMORY_DISABLED',
      `#${i + 1} ${cse.occupation}: memory OFF keeps raw 6Q, drops memory`)
    const onCtx = assembleUserContext({
      scenario: 'career', message: '',
      raw6q: rows.user_6q_raw[0], sixqReport: rows.ai_reports[0], profile: rows.user_profiles[0], memories: [{ content: 'MEM' }], memoryEnabled: true,
    })
    ok(onCtx.hasSixQ && onCtx.memories.length === 1, `#${i + 1} ${cse.occupation}: memory ON adds memory context`)

    // G7 no cross-user context
    const other = await buildUserContext(db, 'stranger_openid', { scenario: 'career', message: '' })
    ok(!other.hasSixQ && other.explicitProfile.occupation === null,
      `#${i + 1} ${cse.occupation}: no cross-user context leak`)
  }

  ok(CASES.length >= 20, 'corpus has >= 20 golden cases')
  const occs = new Set(CASES.map((x) => x.occupation))
  for (const need of ['厨师', '外卖员', '快递员', '销售', '白领', '个体老板', '宝妈', '学生', '技术人员', '内容创作者']) {
    ok(occs.has(need), 'corpus covers occupation ' + need)
  }

  // scenario registry sanity
  ok(SCENARIO_NAME_TO_KEY['AI赛道'] === 'ai_track', 'registry maps AI赛道 → ai_track')
  ok(Object.keys(SCENARIO_NAME_TO_KEY).length >= 7, 'registry has six scenarios + ask')

  console.log('  _TEST pass=' + pass + ' fail=' + fail)
  if (fail > 0) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
