'use strict'
/**
 * turnaroundStrategy/v6/reasoning/caseReportV1.js
 *
 * R87B2 §2–§8 — REALITY-FIRST FIVE-CARD BUILDER (deterministic, NO LLM).
 *
 * Renders the visible five cards from ONE `caseThesis` (R87B1):
 *
 *   Card01 致命一句话 = REALITY FACTS → PRIMARY CONTRADICTION → PRIMARY DERIVED INSIGHT → VERDICT
 *   Card02 核心问题   = REALITY + BEHAVIOR + WORLD MODEL → HIDDEN MECHANISM
 *   Card03 系统困局   = CURRENT_RULE → REAL_BEHAVIOR → SHORT_TERM_REWARD →
 *                       APPARENT_CONFIRMATION → REINFORCEMENT → LONG_TERM_COST
 *   Card04 翻身路径   = OLD_RULE → WHY_LIMITED_HERE → NEW_RULE → USER_SPECIFIC_APPLICATION
 *   Card05 现在就做   = HYPOTHESIS → TEST → OBSERVE → PASS_SIGNAL → FAIL_SIGNAL → UPDATE_RULE
 *
 * Core principle: USER REALITY = SUBJECT · WORLD MODEL = EXPLANATORY ENGINE.
 * The world model may only SHARPEN the mechanism (card02) — it never owns a card.
 *
 * Every visible SENTENCE is emitted as a structured segment carrying:
 *   { text, level, facts[] }  — level ∈ L1 OBSERVED · L2 DERIVED · L3 HYPOTHESIS.
 * The flattened `claims[]` is the §7 CLAIM LEDGER the auditor validates.
 *
 * §3 B1 BOUNDARY: an internal B1 conclusion (e.g. PRICE_EMPLOYER) is only ever
 * surfaced as the user's OWN reality fact in their own language — never as a bare
 * exposed conclusion. Every sentence traces to the claim ledger.
 *
 * Deterministic. Pure. No AI. No I/O. No network.
 */

const CASE_REPORT_VERSION = 'r87b2_case_report_v1'
const HORIZON_3_7 = '3–7 天'

const L1 = 'L1_OBSERVED_FACT'
const L2 = 'L2_STRONG_DERIVATION'
const L3 = 'L3_TESTABLE_HYPOTHESIS'

function s (text, level, facts) { return { text: String(text), level: level, facts: (facts || []).filter(Boolean) } }
function join (segs) { return (segs || []).map((x) => x.text).join('') }

// ── natural phrase layer (§3: the user's OWN reality, in their own language) ─
const P = Object.freeze({
  PRICE_EMPLOYER: '收入由公司/老板定价', PRICE_PLATFORM: '收入由平台规则定价',
  PRICE_CLIENT: '收入由客户/甲方定价', PRICE_SELF: '收入由你自己定价',
  PRICE_MIXED: '收入由多方共同决定', PRICE_UNKNOWN: '你还没说清收入由谁定价',
  TIME_UNDER_2: '不到 2 小时', TIME_2_5: '2–5 小时', TIME_5_10: '5–10 小时',
  TIME_10_20: '10–20 小时', TIME_20_PLUS: '20 小时以上',
  SAFETY_UNDER_1: '存款撑不到 1 个月', SAFETY_1_3: '一旦断了收入，你的安全垫只有 1–3 个月',
  SAFETY_3_6: '存款能撑 3–6 个月', SAFETY_6_12: '你有 6–12 个月的缓冲',
  SAFETY_12_24: '你有 12–24 个月的缓冲', SAFETY_24_PLUS: '你有两年以上的缓冲',
  PROOF_NEVER: '这项能力从没被人用过', PROOF_FREE_HELPED: '只免费帮人做过、没收过钱',
  PROOF_FREE_THANKED: '免费帮人做过、被对方感谢过', PROOF_PAID_ONCE: '被人付过一次钱',
  PROOF_OCCASIONAL: '断断续续有人付费', PROOF_STABLE: '已经有稳定客户/长期合作',
  ATTEMPT_NONE: '你还没真正开始过任何尝试', ATTEMPT_COURSE_ONLY: '只学过、还没落地',
  ATTEMPT_UNDER_30D: '试过不到 30 天就停了', ATTEMPT_NO_SALE: '做过东西、但没卖出去',
  ATTEMPT_FEW_SALES: '有过一两笔成交', ATTEMPT_STABLE_SIDE: '副业已经相对稳定',
  SURPLUS_NEGATIVE: '每月结余是负的', SURPLUS_ZERO: '每月基本没有结余',
  SURPLUS_UNDER_1K: '每月结余不足 1000 元', SURPLUS_1K_5K: '每月结余 1000–5000 元',
  SURPLUS_5K_10K: '每月结余 5000–10000 元', SURPLUS_OVER_10K: '每月结余 1 万元以上',
  DEBT_NONE: '没有负债', DEBT_MORTGAGE: '主要背着房贷',
  DEBT_CONSUMER: '背着消费贷/信用卡压力', DEBT_HIGH: '债务压力已经比较高',
  INC_SALARY: '主要靠一份工资', INC_SKILL_SERVICE: '靠接单/技能服务吃饭',
  INC_COMMISSION: '靠提成/绩效', INC_BUSINESS: '有在经营的生意',
  INC_CONTENT: '靠内容/流量', INC_ASSET: '有资产性收入', INC_UNSTABLE: '收入不稳定',
  RULE_EFFORT: '再努力点、做好点', RULE_AWARE: '先看这活是谁在定价',
  RULE_DEMAND: '先看市场还缺不缺人', RULE_NONE: '没多想，先把活干好',
  LABOR_MORE_WORK: '先再多接两单、多做一点', LABOR_REUSABLE: '先把它整理成能重复用的方法',
  LABOR_LEVERAGE: '先让别人帮我分担一部分', LABOR_PRICING: '先去找愿意出更高价的人'
})
const PRICER = Object.freeze({ PRICE_EMPLOYER: '公司/老板', PRICE_PLATFORM: '平台规则', PRICE_CLIENT: '客户/甲方', PRICE_SELF: '你自己', PRICE_MIXED: '多方', PRICE_UNKNOWN: '说不清的一方' })
const SAFETY_SHORT = Object.freeze({ SAFETY_UNDER_1: '不到 1 个月', SAFETY_1_3: '1–3 个月', SAFETY_3_6: '3–6 个月', SAFETY_6_12: '6–12 个月', SAFETY_12_24: '12–24 个月', SAFETY_24_PLUS: '两年以上' })

// ── fact-meaning accessors (verbatim user language) ────────────────────────
function M (ev) {
  const m = (f) => (ev.byField[f] ? ev.byField[f].semanticMeaning : null)
  const c = (f) => (ev.cognitiveByField[f] ? ev.cognitiveByField[f].semanticMeaning : null)
  const ph = (f) => { const v = ev.byField[f] && ev.byField[f].normalizedValue; return P[v] || m(f) }
  const cp = (f) => { const v = ev.cognitiveByField[f] && ev.cognitiveByField[f].normalizedValue; return P[v] || c(f) }
  const nv = (f) => (ev.byField[f] && ev.byField[f].normalizedValue) || null
  return {
    occ: m('occupationDetail'), cat: m('occupationCategory'), life: m('lifeStage'),
    income: ph('incomeStructure'), price: ph('pricingAuthority'), surplus: ph('monthlySurplus'),
    safety: ph('safetyMonths'), debt: ph('debtPressure'), proof: ph('skillValidation'),
    skill: m('monetizableSkill'), time: ph('weeklyTime'), attempt: ph('pastAttemptStage'),
    problem: ph('primaryProblem'), cost: ph('maxTrialCost'),
    laborModel: cp('laborModel'), decisionStyle: cp('decisionStyle'), systemModel: cp('systemModel'),
    ruleModel: cp('ruleModel'), failureResponse: cp('failureResponse'), timeBehavior: cp('timeBehavior'),
    selfBelief: cp('selfBelief'),
    skillRef: (ev.byField.occupationDetail && ev.byField.occupationDetail.semanticMeaning) || '你这门手艺',
    pricer: PRICER[nv('pricingAuthority')] || '对方',
    safetyShort: SAFETY_SHORT[nv('safetyMonths')] || '很薄'
  }
}

// ── switch-class application language (§7) ─────────────────────────────────
const SWITCH_APP = Object.freeze({
  STAY_AND_UPGRADE: '留在当前这个局里，把已经成立的优势放大',
  ADD_OPTIONALITY: '不辞职，保住现在的收入，再用一小部分时间开一条能产生新证据的第二线',
  CHANGE_ALLOCATION: '不换整个局，只做一次资源分配的调整',
  CHANGE_GAME: '换的不是努力程度，是你在这个局里的位置',
  RUN_TEST_FIRST: '先用你手里的缓冲，跑一次最小现实检验',
  NO_SWITCH_YET: '先不切换任何赛道，把缓冲修好再谈别的'
})
const OLD_RULE_OF = Object.freeze({
  CAPABILITY_UNEXPOSED: '多投入一点时间，就更稳',
  CAPABILITY_VS_MARKET_PROOF: '再多试几次、再多做一点，总会成',
  VALIDATED_NOT_REPEATABLE: '多接一单、再多接一单',
  STABILITY_BINDING: '先保住这份稳的收入，再想别的',
  STABILITY_VS_OPTIONALITY: '先把本职做到最好，别的以后再说',
  EFFORT_ALLOCATION: '把自己的时间继续加回那条已经有回报的路',
  LIQUIDITY_VS_AMBITION: '先把收入做上去，现金流自然就好',
  DEBT_PRESSURE_DOMINANT: '看到机会就加大投入，做大才能翻身',
  TIME_SHORTAGE: '等以后时间多一点再开始',
  SCATTERED_FOCUS: '这个方向试试、那个方向也看看',
  ALIGNED_NO_CONTRADICTION: '再多想清楚一点、再准备充分一点'
})
const NEW_RULE_OF = Object.freeze({
  CAPABILITY_UNEXPOSED: '把一小部分可支配时间，从已有确定回报的路径，转移到能产生新证据的路径',
  CAPABILITY_VS_MARKET_PROOF: '先走到「有人直接为它付钱」那一步，再谈加码',
  VALIDATED_NOT_REPEATABLE: '把最常被要的那一项，做成一份能被重复交付、重复购买的东西',
  STABILITY_BINDING: '在不牺牲收入的前提下，先造出一点点「能产生新证据」的空间',
  STABILITY_VS_OPTIONALITY: '把缓冲从「安全垫」改成「期权」——用它去行使一次能产生新证据的动作',
  EFFORT_ALLOCATION: '把时间从「加固旧路」改成「投向能产生新证据的路径」',
  LIQUIDITY_VS_AMBITION: '先把现金流修到「不能断」，再谈收益',
  DEBT_PRESSURE_DOMINANT: '先让缓冲活过来，扩张往后排',
  TIME_SHORTAGE: '先把一块可支配时间固定下来，再谈内容',
  SCATTERED_FOCUS: '把方向砍到只剩一个，先做减法',
  ALIGNED_NO_CONTRADICTION: '用一个最小的现实动作，代替继续推演'
})
const KEY_UNKNOWN_OF = Object.freeze({
  CAPABILITY_UNEXPOSED: '这项能力一旦直接接触市场，是否真的有人愿意为它付钱',
  CAPABILITY_VS_MARKET_PROOF: '走到收费那一步时，卡点到底是「没人要」还是「没走到」',
  VALIDATED_NOT_REPEATABLE: '已经被付费验证的价值，能不能被重复交付和重复购买',
  STABILITY_BINDING: '在不放弃稳定收入的前提下，是否真能挤出一点「自己定价」的空间',
  STABILITY_VS_OPTIONALITY: '手里的缓冲，能不能被真正用来做一件不由别人定价的事',
  EFFORT_ALLOCATION: '把时间从旧路切走一小块后，会不会长出新的、能被定价的产出',
  LIQUIDITY_VS_AMBITION: '现金流的真实下限在哪里，多少投入才不至于把它打断',
  DEBT_PRESSURE_DOMINANT: '缓冲到底要修到多少，一次波动才不会把你推回原点',
  TIME_SHORTAGE: '可支配的时间块建立起来之后，结果会不会真的不同',
  SCATTERED_FOCUS: '把方向砍到一个之后，问题会不会真的收敛',
  ALIGNED_NO_CONTRADICTION: '在没有明显矛盾时，最小动作能不能换来真实反馈'
})

// ── fact-id helpers ────────────────────────────────────────────────────────
const F = {
  occ: 'occupationDetail', price: 'pricingAuthority', time: 'weeklyTime', proof: 'skillValidation',
  attempt: 'pastAttemptStage', income: 'incomeStructure', safety: 'safetyMonths', skill: 'monetizableSkill',
  surplus: 'monthlySurplus', debt: 'debtPressure', problem: 'primaryProblem', rule: 'ruleModel',
  labor: 'laborModel', timeBehavior: 'timeBehavior'
}
function present (ev, ids) {
  const out = []
  for (const id of ids) if (ev.byField[id] || ev.cognitiveByField[id]) out.push(id)
  return out
}

// ── CARD01 (segments) ───────────────────────────────────────────────────────
function card01Segs (id, k, ev) {
  switch (id) {
    case 'CAPABILITY_UNEXPOSED':
      // §R87D_1 CARD01 HERO COMPRESSION — ONE dominant insight + ONE short
      // evidence paragraph. The hero insight leads; the evidence line carries
      // only the load-bearing reality facts (capability already used inside
      // paid employment · employer currently controls pricing · the missing
      // evidence is INDEPENDENT market validation, not capability). Removed from
      // CARD01 (still causally used in CARD02/03/04): 5–10 小时, 免费帮人, 被感谢,
      // and the full company-pricing explanation. Semantic authority unchanged.
      return [s('你缺的不是「会不会做」的证据，而是「离开现有体系以后，这项能力还能不能独立成立」的证据。', L2, present(ev, [F.occ, F.price, F.proof, F.attempt])),
        s('你做的是' + k.occ + '，它已经在公司体系内被使用、领着工资；但' + k.price + '——你还没把它单独拿到真实市场，验证有没有人愿意付费。', L1, present(ev, [F.occ, F.income, F.price, F.proof, F.attempt]))]
    case 'CAPABILITY_VS_MARKET_PROOF':
      return [s('你做的是' + k.occ + '，' + k.attempt + '，可' + k.proof + '。', L1, present(ev, [F.occ, F.attempt, F.proof])),
        s('这说明卡点不在「敢不敢开始」：你每次都在走到「有人直接为它付钱」那一步之前就收手了。', L2, present(ev, [F.attempt, F.proof])),
        s('你真正的矛盾不是「做过但没结果」，而是：每一轮都停在同一个位置——进入收费环节之前。', L2, present(ev, [F.attempt, F.proof]))]
    case 'VALIDATED_NOT_REPEATABLE':
      return [s('你做的是' + k.occ + '，' + k.proof + '、' + k.attempt + '——你的能力已经被市场验证过了。', L1, present(ev, [F.occ, F.proof, F.attempt])),
        s('可你的收入一直是「' + k.income + '」的形状，一单一结。', L1, present(ev, [F.income])),
        s('你真正的矛盾不是「没人要」，而是：你一直停在「接一单算一单」，从没把它做成能被重复买的东西。', L2, present(ev, [F.proof, F.attempt, F.income]))]
    case 'STABILITY_BINDING':
      return [s('你做的是' + k.occ + '，' + k.income + '，' + k.price + '，而' + k.safety + '。', L1, present(ev, [F.occ, F.income, F.price, F.safety])),
        s('你真正的矛盾不是「要不要换」，而是：你的「稳」本身成了最贵的东西——它让你换不起，也让加码的努力换不来抗风险。', L2, present(ev, [F.income, F.price, F.safety]))]
    case 'STABILITY_VS_OPTIONALITY':
      return [s('你做的是' + k.occ + '，' + k.price + '，但你手里其实有一张别人没有的牌——' + k.safety + '。', L1, present(ev, [F.occ, F.price, F.safety])),
        s('你真正的矛盾不是「没条件」，而是：这张牌一直被你当成安全垫，而没被当成一张可以行使的期权。', L2, present(ev, [F.price, F.safety]))]
    case 'EFFORT_ALLOCATION':
      return [s('你每周可自由支配的时间有 ' + k.time + '，而且' + k.proof + '——你并不缺拼劲。', L1, present(ev, [F.time, F.proof])),
        s('可你多出时间的默认是「' + k.laborModel + '」。', L1, present(ev, [F.labor])),
        s('你真正的矛盾不是「不够努力」，而是：这部分时间一直加在「已经稳的那条路」上，你的努力正在持续加固那个你最想离开的位置。', L2, present(ev, [F.time, F.proof, F.labor]))]
    case 'LIQUIDITY_VS_AMBITION':
      return [s('你' + k.surplus + '，' + k.debt + '。', L1, present(ev, [F.surplus, F.debt])),
        s('你真正的第一问题不是「多赚」，而是：现金流不能断——在它修好之前，任何「再投钱、再扩张」都只是在拿必需的钱去赌概率。', L2, present(ev, [F.surplus, F.debt]))]
    case 'DEBT_PRESSURE_DOMINANT':
      return [s('你' + k.income + '（定价权在你自己手里，这点你没错），但' + k.debt + '，' + k.safety + '。', L1, present(ev, [F.income, F.debt, F.safety])),
        s('你的第一问题不是「再投钱扩张」，而是：先让缓冲活过来，否则一次波动就把你推回原点。', L2, present(ev, [F.debt, F.safety]))]
    case 'TIME_SHORTAGE':
      return [s('你的可支配时间只有每周 ' + k.time + '，而且' + k.attempt + '。', L1, present(ev, [F.time, F.attempt])),
        s('你真正的约束不是「不够努力」，而是：可支配的时间块本身太少——在它建立起来之前，更努力不会转化出任何新结果。你缺的是时间，不是意愿。', L2, present(ev, [F.time, F.attempt]))]
    case 'SCATTERED_FOCUS':
      return [s('你最想先解决的是「' + k.problem + '」，可你也自述' + k.selfBelief + '。', L1, present(ev, [F.problem, 'selfBelief'])),
        s('你真正的矛盾不是「没找到方向」，而是：你缺的是把方向砍到只剩一个——筛选动作，比选择动作更关键。', L2, present(ev, [F.problem, 'selfBelief']))]
    default:
      return [s('从你的回答看，当前没有明显的结构性矛盾——' + (k.price || k.income || '你的处境') + '。', L1, present(ev, [F.price, F.income])),
        s('这种情况下最该做的不是「再想清楚一点」，而是：先做一个最小的现实动作，用结果代替猜测。', L2, present(ev, [F.price, F.income]))]
  }
}

// ── CARD02 (hidden mechanism, segments) ────────────────────────────────────
function card02Segs (id, k, ev) {
  const rule = k.ruleModel || k.laborModel || '再把这一套做一遍'
  switch (id) {
    case 'CAPABILITY_UNEXPOSED':
      return [s('为什么这些会同时出现在你身上？因为你用的是「' + rule + '」的默认，遇到不确定又习惯「' + (k.decisionStyle || '先看看再说') + '」——而这套在你现在这个局里确实被奖励：' + k.price + '、按时到账（这份回报是真实的，不否认）。', L2, present(ev, [F.rule, F.labor, 'decisionStyle', F.price])),
        s('于是你多出的时间会继续投入那条确定路径，公司体系外的独立市场验证一直没有发生。', L2, present(ev, [F.time, F.attempt])),
        s('不是这项能力没有价值，而是它一直在一个别人替你定价的体系里被使用；真正没有发生过的，是你自己把它带到体系外，接受一次市场定价。', L2, present(ev, [F.proof, F.attempt, F.price]))]
    case 'CAPABILITY_VS_MARKET_PROOF':
      return [s('为什么每次都停在同一个位置？因为你的默认是「' + rule + '」，习惯把「再多准备一点、再做到更好」当成行动本身。', L2, present(ev, [F.rule, F.labor])),
        s('于是每一轮你都把力气花在「把它做得更完整」上，而真正决定结果的「有人直接付费」那一步，一直没被走到。', L2, present(ev, [F.attempt, F.proof]))]
    case 'VALIDATED_NOT_REPEATABLE':
      return [s('为什么明明被付费验证过，收入还是上不去？因为你的默认是「' + rule + '」，加上你的时间习惯是「' + (k.timeBehavior || '先做当天见效的事') + '」——手艺被切成了一单一单，每一单都要你重新出场。', L2, present(ev, [F.rule, F.labor, F.timeBehavior])),
        s('你赚的是「当次的手艺」，而不是「一次做好、能反复卖的东西」。', L2, present(ev, [F.proof, F.income]))]
    case 'STABILITY_BINDING':
      return [s('为什么这些会同时出现？因为「' + rule + '」在你现在的局里真的有用：' + k.price + '、收入按时到账。', L2, present(ev, [F.rule, F.price, F.income])),
        s('可这份「稳」是别人给的，' + k.safety + '——于是你既换不起，也加不出抗风险，越投入越被锁在原地。', L2, present(ev, [F.price, F.safety]))]
    case 'STABILITY_VS_OPTIONALITY':
      return [s('为什么有缓冲却一直没动？因为「' + rule + '」让你把缓冲理解成了「更保险」，而不是「可以做点什么」。', L2, present(ev, [F.rule, F.safety])),
        s(k.safety + '本来是一张牌，但你一直把它压箱底，只用来对冲风险，从没用来行使一次能产生新证据的动作。', L2, present(ev, [F.safety, F.price]))]
    case 'EFFORT_ALLOCATION':
      return [s('为什么这些会同时出现？因为「' + rule + '」这套默认，在你现在的现实里确实有回报（任务完成）。', L2, present(ev, [F.rule, F.labor])),
        s('于是你多出的时间会默认加回那条已经稳的路，' + k.skillRef + '只在顺手的场景出现。你的努力一直在给旧路添砖，而不是给新路开门。', L2, present(ev, [F.time, F.skill, F.labor]))]
    case 'LIQUIDITY_VS_AMBITION':
      return [s('为什么第一问题会是现金流？因为你' + k.surplus + '，' + k.debt + '——可你的注意力还停在「怎么把收入做上去」。', L2, present(ev, [F.surplus, F.debt])),
        s('把结余和负债放在一起看，约束其实不在收益，而在「不能断」：任何一笔再投入，用的都是你输不起的钱。', L2, present(ev, [F.surplus, F.debt]))]
    case 'DEBT_PRESSURE_DOMINANT':
      return [s('为什么这些会同时出现？因为你的默认是「' + rule + '」，看到机会就加大投入——这在生意顺的时候是优点。', L2, present(ev, [F.rule])),
        s('但' + k.debt + '、' + k.safety + '，每一次「再投一点」都在悄悄吃掉缓冲，把「做大」变成了「更危险」。', L2, present(ev, [F.debt, F.safety]))]
    case 'TIME_SHORTAGE':
      return [s('为什么「更努力」不奏效？因为你的约束是硬的：每周只有 ' + k.time + ' 可支配，而且' + k.attempt + '。', L2, present(ev, [F.time, F.attempt])),
        s('在可支配时间块建立起来之前，任何努力都只是把已经很满的时间再切一次，换不出新的结果。', L2, present(ev, [F.time]))]
    case 'SCATTERED_FOCUS':
      return [s('为什么方向一直定不下来？因为你的默认是「' + rule + '」，一个问题还没跑出结果，另一个方向已经开始了。', L2, present(ev, [F.rule, F.problem])),
        s('你缺的不是「找到对的方向」，而是「把方向砍到只剩一个」——在筛选完成之前，任何方向都会显得差不多。', L2, present(ev, [F.problem, 'selfBelief']))]
    default:
      return [s('从你的回答看，当前没有明显的结构性矛盾。', L1, present(ev, [F.price, F.income])),
        s('这说明「再想清楚一点」的边际价值很低——此时最优动作，是让现实给你一个反馈，而不是继续推演。', L2, present(ev, [F.price, F.income]))]
  }
}

// ── CARD03 (personal reinforcement loop, segments) ─────────────────────────
// The loop is MODEL-AWARE: its first element is THIS USER'S decision rule (their
// cognitive answer) and its reinforcement element is their decision STYLE. The
// reality (behavior / reward / cost) stays contradiction-anchored.
function card03Data (id, k) {
  switch (id) {
    case 'CAPABILITY_UNEXPOSED':
      return { rule: '多投入一点时间，就更稳', behavior: '能力主要继续留在已有工作体系里；体系外只有免费帮助，还没有直接的付费验证', reward: '工资/确定性继续存在（这是真实回报，不否认）', cost: '外部市场始终没有形成第二个独立的需求/定价证据；这份工作一旦变动，你的安全垫只有 ' + k.safetyShort }
    case 'CAPABILITY_VS_MARKET_PROOF':
      return { rule: '再准备一点、再做完整一点，就更接近成', behavior: '力气都花在「把东西做得更完整」上，收费那一步一直被往后排', reward: '交出去的东西一次比一次体面，被认可（真实的）', cost: '东西越来越好，可「有人直接付钱」这件事始终没被验证，市场证据一直是零' }
    case 'VALIDATED_NOT_REPEATABLE':
      return { rule: '多接一单，就多一份确定的收入', behavior: '时间优先给「今天能接的单」，手艺被切成一单一单', reward: '每接一单就有一笔现金，立刻兑现（真实的）', cost: '单量被你的时间和身体封顶，收入一直停在「接一单算一单」，始终没有可重复卖的东西' }
    case 'STABILITY_BINDING':
      return { rule: '先保住这份稳的收入，再想别的', behavior: '把时间和精力优先给本职，' + k.price, reward: '收入按时到账、位置稳定（真实的）', cost: '「稳」是别人给的：你的安全垫只有 ' + k.safetyShort + '，一旦这份收入有波动，你几乎没有缓冲，也几乎没有第二条定价来源' }
    case 'STABILITY_VS_OPTIONALITY':
      return { rule: '先把本职做到最好，别的以后再说', behavior: k.safety + '被当成「更保险」，而不是可以动用的资源', reward: '不做冒险动作，也就不会踩坑（真实的好处）', cost: '缓冲一直只是缓冲，没被换成任何能产生新证据的产出，时间越久越难动' }
    case 'EFFORT_ALLOCATION':
      return { rule: '多做一点、做好一点就稳', behavior: '多出的时间优先加回已经稳的那条路', reward: '任务完成（真实的）', cost: '努力一直用来加固旧路，' + k.skillRef + '始终没有在能产生新证据的地方出现过' }
    case 'LIQUIDITY_VS_AMBITION':
      return { rule: '先把收入做上去，现金流自然就好', behavior: '注意力集中在「多赚」，' + k.surplus + '这件事被排在后面', reward: '偶尔进账增加，看似在变好', cost: '只要现金流一断，之前赚到的都不算数；' + k.debt }
    case 'DEBT_PRESSURE_DOMINANT':
      return { rule: '看到机会就加大投入，做大才能翻身', behavior: '每一次「再投一点」，都从缓冲里扣', reward: '流水或单量短时间变好（真实的）', cost: k.debt + '，你的安全垫只有 ' + k.safetyShort + '；扩张没让它变稳，反而让它更脆' }
    case 'TIME_SHORTAGE':
      return { rule: '等以后时间多一点再开始', behavior: '每周只有 ' + k.time + ' 可支配，' + k.attempt, reward: '暂时不用面对「没时间」的难受', cost: '时间块一直没被建立起来，「以后」永远不来，能力也一直没上过场' }
    case 'SCATTERED_FOCUS':
      return { rule: '这个方向试试，那个方向也看看', behavior: '一个方向还没跑出结果，注意力已经移到下一个', reward: '始终保持在「有可能」的状态，不用面对「选错」', cost: '每个方向都停在起步阶段，没有一个积累到能被检验的深度' }
    default:
      return { rule: '再多想清楚一点、再准备充分一点', behavior: '把时间用在推演和准备上，而不是最小动作上', reward: '避免了几次可能踩空的动作（真实的）', cost: '想得越久，越拿不到能证伪的证据，判断始终停在推测' }
  }
}
function card03Segs (id, k, ev) {
  const d = card03Data(id, k)
  const rule = k.ruleModel || '照原来这套来'
  const dec = k.decisionStyle || '先看看再说'
  return { steps: [
    s('当前规则：你默认「' + rule + '」，具体到这件事就是「' + d.rule + '」。', L1, present(ev, [F.rule, F.labor])),
    s('真实行为：' + d.behavior + '。', L1, present(ev, [F.time, F.skill, F.timeBehavior, F.price, F.problem])),
    s('短期真实回报：' + d.reward + '。', L2, present(ev, [F.price, F.income, F.proof, F.surplus])),
    s('强化：「' + dec + '」这条决定方式又一次被现实确认——你继续把时间放回那条确定路径。', L2, present(ev, ['decisionStyle', F.rule])),
    s('长期代价：' + d.cost + '。', L2, present(ev, [F.skill, F.attempt, F.safety, F.debt, F.problem, F.price]))
  ] }
}

// ── CARD04 (OLD → WHY → NEW → APPLICATION, segments) ──────────────────────
function card04Segs (id, k, ev, switchOutcome) {
  const rule = k.ruleModel || '照原来这套来'
  const from = OLD_RULE_OF[id] || '照原来这套来'
  const to = NEW_RULE_OF[id] || '用一个最小动作代替推演'
  let why
  switch (id) {
    case 'CAPABILITY_UNEXPOSED':
    case 'EFFORT_ALLOCATION':
      why = '为什么失效：这份收入的价格由' + k.pricer + '说了算——只增加投入，并不会自动改变「谁定价」；而安全垫只有 ' + k.safetyShort + '，光靠「更努力」也不会自动让你更抗风险。'
      break
    case 'CAPABILITY_VS_MARKET_PROOF':
      why = '为什么失效：「准备得更完整」不会自动变成「有人付钱」——市场看的从来不是完整度，是你有没有把它拿到台面上。'
      break
    case 'VALIDATED_NOT_REPEATABLE':
      why = '为什么失效：单量受你的时间和身体封顶，多接一单换不来「可重复」，收入永远是一条随你出场的曲线。'
      break
    case 'STABILITY_BINDING':
    case 'STABILITY_VS_OPTIONALITY':
      why = '为什么失效：这份收入由' + k.pricer + '定价，守住它不会增加你的选择；而安全垫只有 ' + k.safetyShort + '，光靠「更稳」换不来抗风险。'
      break
    case 'LIQUIDITY_VS_AMBITION':
    case 'DEBT_PRESSURE_DOMINANT':
      why = '为什么失效：在' + k.debt + '、安全垫只有 ' + k.safetyShort + '的前提下，任何「先扩张」都是拿必需的钱去赌概率，越努力越危险。'
      break
    case 'TIME_SHORTAGE':
      why = '为什么失效：每周只有 ' + k.time + ' 可支配，不先建立可支配的时间块，「更努力」只会把已经很满的时间再切一次。'
      break
    case 'SCATTERED_FOCUS':
      why = '为什么失效：方向不收敛，任何尝试都停在起步阶段，积累不到能被检验的深度。'
      break
    default:
      why = '为什么失效：「想清楚」不产生新的证据，继续推演只会让判断停在推测。'
  }
  const app = SWITCH_APP[switchOutcome] || SWITCH_APP.STAY_AND_UPGRADE
  const target = (id === 'CAPABILITY_UNEXPOSED' || id === 'EFFORT_ALLOCATION')
    ? '，先从' + (k.skill || '这项能力') + '开始这一步'
    : ''
  // §R87D_3 — owner-visible copy must NEVER expose an internal enum switch id
  // (e.g. CHANGE_ALLOCATION). The switch is expressed in natural language only,
  // and the worldRule no longer repeats the TO sentence verbatim (the visible
  // FROM → TO block already carries it). worldRule stays WHY-fails + WHY-switch
  // + HOW-to-apply.
  return {
    from: s('你现在的规则：你默认「' + rule + '」，具体就是「' + from + '」', L1, present(ev, [F.rule, F.labor])),
    to: s(to, L2, present(ev, [F.price, F.skill])),
    why: s(why, L2, present(ev, [F.price, F.income, F.safety, F.debt, F.time])),
    app: s('以你「' + (k.decisionStyle || '先看看再说') + '」的决定方式，用在' + (k.occ ? '你（' + k.occ + '）' : '你') + '身上：' + app + target + '。', L2, present(ev, [F.occ, F.skill, F.price, 'decisionStyle']))
  }
}

// ── CARD05 (experiment, segments) ──────────────────────────────────────────
function card05Segs (id, k, ev, caseThesis) {
  const ex = caseThesis.realityExperiment || {}
  const dec = k.decisionStyle || '先看看再说'
  // §R87C CARD05 — the visible experiment must be ONE concrete action, and must
  // describe the INDEPENDENT-MARKET test (out of the current system), never a
  // bundle of two alternative actions.
  const isMarketTest = /打包成一个明确的对外动作|一次报价|一次公开交付/.test(String(ex.test || ''))
  const test = isMarketTest
    ? '3–7 天内，把' + (k.skill || '这项能力') + '整理成一个明确的服务，向 1 个真实潜在客户完成一次报价。'
    : (ex.test || '3–7 天内，只做一个可观察的最小动作，用来检验上面那条判断。')
  const observe = isMarketTest
    ? '看对方的反应：是继续询问、讨价还价、拒绝并给出原因，还是愿意付费。'
    : (ex.observe || '这个动作有没有改变任何一项现实指标。')
  // §R87B2_1 E — the VISIBLE goal must NOT assert that one action RESOLVES the
  // question (the core hypothesis is retained internally as an explanation).
  // Bounded authority: what is missing is a reality test that yields NEW EVIDENCE.
  const goalText = '当前缺少的是一次能够产生新证据的现实测试'
  // §R87B2_1 §3 — bounded experiment semantics: a positive signal means CONTINUE
  // VALIDATION; no signal means diagnose EXPOSURE / DEMAND / OFFER / PRESENTATION —
  // never declare the final market truth.
  const signal = '出现正向信号（有人问价或愿意付费）→ 继续验证这条路径；完全没有信号 → 先分别排查「曝光不够」「需求不足」「供给不对口」「呈现不到位」，不据此得出最终市场结论。'
  const update = ex.updateRule || '按这次结果，决定下一次把时间/资源切给哪一边。'
  return {
    goal: s('假设：以你「' + dec + '」的决定方式，' + goalText + '。', L3, present(ev, [F.proof, F.attempt, 'decisionStyle'])),
    test: s('检验：' + test, L3, present(ev, [F.skill, F.time, F.cost])),
    observe: s('观察：' + observe, L3, present(ev, [F.skill])),
    signal: s('成败信号：' + signal, L3, present(ev, [F.proof])),
    update: s('更新：' + update, L2, present(ev, [F.time, F.skill]))
  }
}

/**
 * Build the deterministic reality-first five-card report from ONE caseThesis.
 * @returns {Object} { card01..card05, claims[], ... } — cards are the SAME shape
 *   the runtime maps; `claims` is the §7 ledger.
 */
function buildCaseReportV1 (caseThesis, evidence, worldModel) {
  const ct = caseThesis || {}
  const ev = evidence || { byField: {}, cognitiveByField: {} }
  const id = ct.PRIMARY_CASE_CONTRADICTION || (ct.primaryContradiction && ct.primaryContradiction.contradictionId) || 'ALIGNED_NO_CONTRADICTION'
  const k = M(ev)
  const switchOutcome = ct.SWITCH_OUTCOME || (ct.strategicSwitch && ct.strategicSwitch.outcome) || 'STAY_AND_UPGRADE'
  const keyUnknown = KEY_UNKNOWN_OF[id] || KEY_UNKNOWN_OF.ALIGNED_NO_CONTRADICTION

  const c1 = card01Segs(id, k, ev)
  const c2 = card02Segs(id, k, ev)
  const c3 = card03Segs(id, k, ev)
  const c4 = card04Segs(id, k, ev, switchOutcome)
  const c5 = card05Segs(id, k, ev, ct)

  // ── §7 CLAIM LEDGER — every visible sentence registered with provenance ──
  const claims = []
  let n = 0
  const reg = (seg, card, rule) => {
    // A segment that asserts a fact/derivation but carries NO evidence is
    // DOWNGRADED to a testable hypothesis (L3): without evidence we propose,
    // we do not assert. This keeps the weak/unknown submission honest.
    const level = (seg.level !== L3 && seg.facts.length === 0) ? L3 : seg.level
    claims.push({
      claimId: 'V' + String(++n).padStart(3, '0'),
      card: card,
      semanticClaim: seg.text,
      claimLevel: level,
      evidenceIds: seg.facts.slice(),
      derivationRule: rule,
      confidence: level === L1 ? 'HIGH' : (level === L2 ? 'MEDIUM' : 'LOW'),
      allowed: seg.facts.length > 0 || level === L3
    })
    return seg.text
  }
  const card01 = c1.map((x) => reg(x, 'card01', 'REALITY_VERDICT')).join('')
  const card02 = c2.map((x) => reg(x, 'card02', 'HIDDEN_MECHANISM')).join('')
  const c3steps = c3.steps.slice(0, 4).map((x) => reg(x, 'card03', 'REINFORCEMENT_LOOP'))
  const c3rule = reg(c3.steps[4], 'card03', 'REINFORCEMENT_LOOP_COST')
  const card04 = {
    from: reg(c4.from, 'card04', 'OLD_RULE'),
    to: reg(c4.to, 'card04', 'NEW_RULE'),
    rule: reg(c4.why, 'card04', 'WHY_LIMITED') + reg(c4.app, 'card04', 'USER_SPECIFIC_APPLICATION')
  }
  const card05 = {
    goal: reg(c5.goal, 'card05', 'HYPOTHESIS'),
    actions: [reg(c5.test, 'card05', 'TEST'), reg(c5.observe, 'card05', 'OBSERVE'), reg(c5.update, 'card05', 'UPDATE_RULE')],
    acceptance: reg(c5.signal, 'card05', 'PASS_FAIL_SIGNAL'),
    horizon: HORIZON_3_7
  }

  return {
    version: CASE_REPORT_VERSION,
    contradictionId: id,
    switchClass: switchOutcome,
    keyUnknown: keyUnknown,
    card01: card01,
    card01FactIds: c1.reduce((a, x) => a.concat(x.facts), []).filter((v, i, arr) => arr.indexOf(v) === i),
    card02: card02,
    card03: { steps: c3steps, rule: c3rule },
    card04: card04,
    card05: card05,
    claims: claims
  }
}

module.exports = {
  CASE_REPORT_VERSION,
  HORIZON_3_7,
  L1, L2, L3,
  SWITCH_APP, OLD_RULE_OF, NEW_RULE_OF, KEY_UNKNOWN_OF,
  buildCaseReportV1
}
