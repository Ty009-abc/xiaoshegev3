'use strict'
/**
 * cloudfunctions/generateAiReport/lib/turnaround6q/reportValidator6Q.js
 *
 * RC8.8 — validators for the 6Q report (§12). Layers, never conflated:
 *   A. required fields   — do the required fields EXIST (present + non-blank)
 *   B. field types       — are the required field TYPES valid
 *   C. structural policy — length ranges / experiment shape / advice count /
 *                          loop count / horizon / enum leak
 *   D. semantic          — fact grounding, anti-generic, unsupported facts,
 *                          contradiction, SPLIT overclaim subtypes, and the R4
 *                          EVIDENCE BOUNDARY (unsupported assertion vs conditional
 *                          hypothesis vs irreversible action)
 *
 * R1.1 (§1/§2): the overloaded MISSING_FIELDS bucket is GONE.
 * R2   (§3–§9): SEMANTIC CALIBRATION — blocks unsupported factual invention and
 *   certainty claims, but does NOT suppress grounded sharp judgment. OVERCLAIM is
 *   split into exact subtypes; every rejection returns {code, field, evidence,
 *   reason, card}; grounding is REPORT-level and material (not decorative).
 * R4   (§1–§7): EVIDENCE BOUNDARY + ACTION FOCUS.
 *   · every statement is USER_FACT / GROUNDED_INTERPRETATION (allowed) or
 *     CONDITIONAL_HYPOTHESIS (conditional wording required) — never an
 *     UNSUPPORTED_ASSERTION presented as fact (invented business economics,
 *     employer policy, job duties, past behaviour, motivation);
 *   · Card05 is exactly ONE experiment (goal/actions/target/output/
 *     success_signal/time_horizon), no multi-action plan, no long-horizon plan;
 *   · irreversible / high-impact actions without evidence are rejected.
 *   Voice/tone is UNCHANGED.
 *
 * @version turnaround_strategy_6q_v1
 */

// ── internal identifiers that must NEVER reach user-visible copy ──
const ENUM_LEAK_RE = /\b(SYSTEM_LOOP|FATAL_INSIGHT|CORE_PROBLEM|TURNAROUND_PATH|VALIDATION_GAP|DIRECTION_GAP|ACTION_GAP|CONSISTENCY_GAP|REPEATABILITY_GAP|PRIMARY|NO_PRIMARY|INVALID_INPUT|turnaround_strategy|diagnosticVersion|reportState|qid|optionId)\b/

// ── R2 §3: TRUE overclaim = certainty / promise language (NOT any strong wording) ──
const CERTAINTY_RE = /(一定能|保证|百分百|100%|必定|肯定会|稳赚|躺赚|一定会|一定可以|肯定能|必然能|必定会|包赚|稳赢|势必会|绝对会)/
const PROB_RE = /((\d+(\.\d+)?\s*(%|％|个百分点)\s*(的?概率|可能性|成功率|把握|几率))|((概率|可能性|成功率|几率|把握)[^，。]{0,6}\d+(\.\d+)?\s*(%|％|成|倍))|(\d+(\.\d+)?\s*(成|分之[\d一二三四五六七八九十]+)\s*(的?(概率|把握|成功率))))/
const SOFT_PROB_RE = /(成功(率|概率|几率)(高|很大|极高|相当高|更高))|(大概(率|几率)[^，。]{0,4}(会|能|可以))|(很可能[^，。]{0,6}(成为|翻身|成功|赚))/

// ── generic copy that could be sent to almost anyone unchanged ──
const GENERIC_PHRASES = [
  '要相信自己', '保持努力', '坚持下去', '提升认知', '多学习', '努力学习',
  '加油', '不要放弃', '天道酬勤', '一定会好起来', '时间会给你答案',
  '每天进步一点点', '走出舒适区', '培养自律',
]

// ── facts the model must NOT invent (not supplied by the user) ──
const UNSUPPORTED_FACT_RE = /(你(的)?(孩子|子女|女儿|儿子|父母|配偶|妻子|丈夫|房贷|车贷|负债|网贷|信用卡|存款|病史|学历不高|没有能力))/g
const INVENTED_FACT_RE = /(你(的)?(孩子|子女|女儿|儿子|父母|配偶|妻子|丈夫|家里|家庭)|老(婆|公)|(房贷|车贷|房租|负债|欠债|网贷|信用卡|借了|借过|贷款)|(创业|开(过|了)公司|生意失败|倒闭|破产|亏了)|(生病|抑郁症|焦虑症|心理|童年|被裁|失业半年))/
const FUTURE_CERTAINTY_RE = /(未来[^，。]{0,12}(一定|必然|肯定|会(大幅|翻倍|暴涨))|(你|这)[^，。]{0,10}(一定|必然|肯定)(会|能|可以)[^，。]{0,10}(翻身|成功|赚|月入|收入|变|实现)|下(个)?(一)?(年|月)[^，。]{0,8}(一定|必然|肯定))/
const CAPABILITY_ASSERTION_RE = /(你(天生|本来就|本质上)(就)?是(一个)?[^，。]{0,8}(人|者)|你(其实|实际上)(是|属于)[^，。]{0,6}(型|人格|性格)|你(根本|压根)(就)?(没有|不具备|缺少)[^，。]{0,6}(能力|天赋|资源)|你(就是|属于)[^，。]{0,6}(领袖|销售|管理|技术)型)/
const PSYCH_ASSERTION_RE = /(你(有|患有|得了)[^，。]{0,6}(抑郁症|焦虑症|心理疾病|强迫症|躁郁))|(你(其实|内心|内心深处|骨子里|潜意识)[^，。]{0,6}(逃避|自卑|懦弱|恐惧|害怕|抑郁|焦虑症))|(你(在)?(逃避|自卑|懦弱)[^，。]{0,2}(现实|责任|问题|自己))/

// ── R4 §2: CONDITIONAL markers — an industry/mechanism claim expressed as a
// hypothesis (C) is ALLOWED; the same claim as bare fact (D) is rejected. ──
const CONDITIONAL_RE = /(如果|假如|若|倘若|一种可能|可能是|也许|或许|未必|不一定|需要先(确认|验证|核实|试|看|判断|了解)|值得(先)?(验证|确认|核实|试)|从你(目前)?提供的信息(里|看)|从你目前的(描述|情况|回答|答案)看|假设|取决于|是否|有待(验证|确认)|未经证实|可以验证|先验证|先确认|需要你(先)?确认|有待观察|还看不到|看不到|没有体现|没有被?提到|尚未|暂无|目前没有|可能意味着|可能说明|需要核对|值得核对)/

// ── R4.1 §2: ABSENCE OF EVIDENCE — “你没有/你从未/你一直/你只会…” stated as an
// established fact. NO_EVIDENCE != EVIDENCE_OF_ABSENCE. Only allowed when the same
// sentence carries a valid absence form (还看不到/没有体现/值得验证/可能…) or when
// the phrase is a direct paraphrase of the user's own words. ──
const ABSENCE_AS_FACT_RE = /((你|你的)[^，。]{0,8}(并?没|从来没|从未|从没|从来不|一直没|始终没|根本没|压根没)[^，。]{0,6}(面对|承认|验证|尝试|改变|行动|投入|坚持|做完|完成|扁|承担|负责|记录|关注|争取|开口|动|试|离开|跳出|问|谈|准备|进入|开始))|((每(一份|份|种|次|个))[^，。]{0,6}(工作|岗位|方向|离职|跳槽|尝试|职责)[^，。]{0,4}(都|总是|都是|全都|只))|((过去|这几年|这些年|多年|这么多年)[^，。]{0,6}(都|一直|始终|从来|没))|(还没(到|有|能)[^，。]{0,10}(判断|验证|沉淀|积累|真正))/

// ── R4.1 §3: MOTIVE / MENTAL-STATE attribution asserted as fact ──
const MOTIVE_ASSERTION_RE = /((你|你的)[^，。]{0,12}(不敢|害怕|怕|逃避|抗拒|不愿意|不肯|不想|懒|贪|缺乏勇气|没勇气|没胆))|((不敢|害怕|逃避|抗拒|不愿意|不肯|贪图稳定|缺乏勇气|没勇气)[^，。]{0,6}(面对|承认|验证|尝试|改变|行动|投入|换|离开|开始|动手|拒绝|开口|沟通|争取|停下来|停|走|做|进入|线上|营销))|((内心(深处)?|骨子里|潜意识|真正)[^，。]{0,2}(想|怕|要|图))|(真正怕的是|其实怕的是|你怕的是|怕的是|怕的其实|你担心的是|真正担心的是)/

// ── R4.1 §4: HISTORY attribution asserted as fact (unless user said it) ──
const HISTORY_ASSERTION_RE = /(((你|你的)[^，。]{0,8}(从未|从没|从没有|从来不|向来|历来|始终没|一直没)[^，。]{0,14})|((每(一份|份|次|个))[^，。]{0,6}(工作|岗位|方向|离职|跳槽|尝试|职责)[^，。]{0,6}(都|只|没|是)[^，。]{0,10})|((过去|这几年|这些年|多年)[^，。]{0,8}(都|一直|始终)[^，。]{0,10}))/

// ── R4.1 §5: EXTERNAL BENCHMARK claims (no external data source exists) ──
const EXTERNAL_BENCHMARK_RE = /((同龄人|同行|同一批人|行业平均|平均水平|大多数人|一般人|大部分人)[^，。]{0,8}(中|里)?[^，。]{0,6}(不算|算高|算低|算不错|算中上|算中下|高于|低于|普遍|通常|都))|((你|你的)[^，。]{0,10}(在同龄|跟同龄|比同行|在行业|高于行业|低于行业|高于平均|低于平均)[^，。]{0,10})|(高薪|低薪|低于行业水平|高于行业水平|高于平均|低于平均|行业普遍|高于同行|低于同行|不算差)/

// ── R4 §3: UNSUPPORTED ASSERTION detectors — a claim about the user/industry that
// the user never supplied and that is asserted as FACT (no conditional wording). ──
const ASSERTION_DETECTORS = [
  ['INVENTED_BUSINESS_ECONOMICS', /((收入结构|客源结构|成本结构)(完全|全部|都|只|只靠|单一)[^，。]{0,10})|(单位经济(模型)?[^，。]{0,8}(失衡|不成立|已?负|算不过来|撑不))|((你|你的)[^，。]{0,8}(客源|收入|利润)[^，。]{0,6}(全靠|完全依赖|只依赖)[^，。]{0,6}(老客|回头客|一个|单一))/],
  ['INVENTED_EMPLOYER_POLICY', /((编制|绩效规则|岗位定级|职称(体系|规则)?|公司制度|平台算法|平台规则|派单规则)[^，。]{0,10}(决定|锁死|规定|限制|固定|控制|掌握))|((收入|工资|收入上限|工资上限|晋升)[^，。]{0,8}(由|被)[^，。]{0,10}(编制|规则|绩效|岗位|制度|职级|算法|平台|领导))/],
  ['INVENTED_JOB_DUTIES', /((时间|精力)[^，。]{0,4}(全|全部|都)[^，。]{0,6}(被|给|用于|用来)[^，。]{0,8}(占满|填满|占|耗|吃))|((每天|天天|一天)[^，。]{0,6}(十几个|十多个|十六个|十二个)小时)/],
  ['INVENTED_PAST_BEHAVIOR', /(你(从来|从未|从没|从没有)[^，。]{0,18}(扛|承担|坚持|完成|做成|做到|负责|做过|尝试过|在一件事))|((都|也|越|从|从没|从来)?不敢[^，。]{0,6}(涨价|降价|换菜单|换工作|关店|压缩|裁|辞|拒绝|开口))|(你(从来|从未|从没)[^，。]{0,18}(逃|回避|错过))|(你(从不|从不曾))|((都|也|从来|从没|从未|先)[^，。]{0,2}没[^，。]{0,6}(做过|试过|坚持过|负责过))|(不敢[^，。]{0,4}(换|改|质|调整|动[^，。]{0,2}(菜单|价格|铺面|店面|人工|堂食|规矩)))/],
  ['INVENTED_MOTIVATION', /(你(其实|真正|说白了|说到底|根本)[^，。]{0,10}(是|就是)[^，。]{0,10}(想|为了|怕|图|逃|贪|一夜))|(你(其实|真正)[^，。]{0,6}(怕|想要|图)[^，。]{0,8}(是|的)是)/],
]
// R4 §7: irreversible / high-impact actions that must NOT be prescribed without evidence.
const IRREVERSIBLE_ACTION_RE = /(裁掉|裁员|辞退|开除|减少一名|减掉一名|搬店|搬迁|关店|转让店|辞职|裸辞|停掉全部|全部停掉|停止所有|砍掉[^，。]{0,12}(兼职|副业|全部|所有)|直接涨价|直接降价|大幅涨价|大幅降价|大额投入|贷款|借钱|一次性投入)/
// R4 §6: long-horizon planning is not allowed for Card05.
const LONG_HORIZON_RE = /(\d+\s*(个月|月|年)内?[^，。]{0,6}(计划|路线图|规划|目标|完成|实现)|(半年|一年|3个月|三个月|6个月|六个月|三十天|30天|一个月)内?[^，。]{0,4}(计划|路线|转型|达|实现|翻|完))/

// ── R4.1 §2: user-specific fact stated as established fact (mechanism → user fact) ──
const USER_FACT_AS_CERTAIN_RE = /((老客|老客户|客户|客流|客源)[^，。]{0,4}(是|就是)[^，。]{0,4}(唯一|仅有的?)[^，。]{0,4}(变量|收入|来源|客源|依赖))|((成本|房租|人工|开销)[^，。]{0,8}(固定|一直|持续|不断|常年)[^，。]{0,4}(上涨|上升|增加|变高|涨))|((个人)?价值[^，。]{0,6}(只|仅仅|仅)[^，。]{0,8}(在)?[^，。]{0,2}内部[^，。]{0,6}(被)?[^，。]{0,4}(评价|定价|看见|认可|衡量))|((外部|外面|市场|别人)[^，。]{0,6}(看不到|看不见|看不到你)[^，。]{0,10})|((时间|精力)[^，。]{0,4}(全|全部|都)[^，。]{0,6}(被|给|用于|用来)[^，。]{0,8}(占满|填满|占|耗|吃))|((这|那)门生意[^，。]{0,8}(单位经济|经济模型)[^，。]{0,6}(失衡|不成立|撑不|算不过来))/
// R4.1 §7: repair markers — a contradictory input must be FLAGGED, not silently resolved.
const CONTRADICTION_MARKER_RE = /(矛盾|不一致|存在出入|说法(不|前后)|前后(不|两)|描述本身|自述(里)?(本身)?(就)?(有|存在)|你自己(的)?(说法|描述|回答)[^，。]{0,8}(不|两|冲)|前面说[^，。]{0,8}(又|却)|一方面[^，。]{0,8}另一方面|口径)/

// ── card model ──
const REQUIRED_FIELDS = ['system_trap', 'core_problem', 'fatal_sentence', 'strategy_path', 'experiment']
const REQUIRED_EXPERIMENT_FIELDS = ['goal', 'actions', 'target', 'output', 'success_signal', 'time_horizon']
const TEXT_FIELDS = ['system_trap', 'core_problem', 'fatal_sentence', 'strategy_path', 'path_from', 'path_to']
const EXPERIMENT_TEXT_FIELDS = ['goal', 'target', 'output', 'success_signal', 'time_horizon']
const CARD_RANGES = { fatal_sentence: [20, 140], core_problem: [40, 260], strategy_path: [6, 120], system_trap: [6, 120] }
const PATH_RANGES = { path_from: [3, 20], path_to: [3, 20] }
const EXPERIMENT_TEXT_RANGES = { goal: [4, 24], target: [2, 20], output: [4, 24], success_signal: [4, 30], time_horizon: [2, 12] }
const ADVICE_RANGE = [1, 6]       // legacy optional field (not part of the contract)
const EXPERIMENT_ACTION_RANGE = [1, 2]
const LOOP_RANGE = [3, 5]

const CARD_OF = {
  fatal_sentence: 'CARD01', core_problem: 'CARD02', system_trap: 'CARD03', strategy_path: 'CARD04',
  advice: 'CARD05', system_loop: 'CARD03', path_from: 'CARD04', path_to: 'CARD04',
}

function s (v) { return typeof v === 'string' ? v : '' }
function negate (t) { return t.replace(/(不一定能|不能保证|不敢保证|没有任何保证)/g, '') }
function cleanText (v) { return s(v).replace(/\s+/g, ' ').trim() }
function countChars (v) { return cleanText(v).replace(/\s/g, '').length }
function uniq (a) { return Array.from(new Set(a)) }
function includesLenient (blob, needle) {
  if (!needle) return false
  if (blob.includes(needle)) return true
  if (/^\d+$/.test(needle)) return Number(blob.match(new RegExp(needle)) ? needle : NaN) === Number(needle)
  return false
}
function digitsIn (blob) { return (String(blob).match(/\d+(?:\.\d+)?/g) || []).map(Number) }
function exp (r) { return (r && r.experiment && typeof r.experiment === 'object' && !Array.isArray(r.experiment)) ? r.experiment : null }
function expStr (r, k) { const e = exp(r); return e ? s(e[k]).trim() : '' }
function expArr (r, k) { const e = exp(r); return (e && Array.isArray(e[k])) ? e[k].map((x) => s(x).trim()).filter(Boolean) : [] }

function isFieldPresent (v) {
  if (v === undefined || v === null) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (Array.isArray(v)) return v.length > 0
  return true
}
function experimentPresent (r) {
  const e = exp(r)
  if (!e) return false
  if (!isFieldPresent(e.goal)) return false
  if (!isFieldPresent(e.actions)) return false
  for (const k of ['target', 'output', 'success_signal', 'time_horizon']) if (!isFieldPresent(e[k])) return false
  return true
}
function requiredFieldsPresent (report) {
  const r = report || {}
  return ['system_trap', 'core_problem', 'fatal_sentence', 'strategy_path'].every((k) => isFieldPresent(r[k])) && experimentPresent(r)
}

// ─────────────────────────────────────────────────────────────────────────
// A. REQUIRED FIELDS
// ─────────────────────────────────────────────────────────────────────────
function validateRequiredFields6Q (report) {
  const errors = []
  const r = report || {}
  for (const k of ['system_trap', 'core_problem', 'fatal_sentence', 'strategy_path']) {
    const v = r[k]
    if (v === undefined || v === null) { errors.push('MISSING_REQUIRED_FIELD:' + k); continue }
    if (typeof v === 'string') {
      if (v.length === 0) { errors.push('MISSING_REQUIRED_FIELD:' + k); continue }
      if (v.trim().length === 0) { errors.push('EMPTY_REQUIRED_FIELD:' + k); continue }
      continue
    }
  }
  const e = exp(r)
  if (!e) {
    errors.push('MISSING_REQUIRED_FIELD:experiment')
  } else {
    for (const k of REQUIRED_EXPERIMENT_FIELDS) {
      if (e[k] === undefined || e[k] === null) { errors.push('MISSING_REQUIRED_FIELD:experiment.' + k); continue }
      if (typeof e[k] === 'string' && e[k].trim().length === 0) { errors.push('EMPTY_REQUIRED_FIELD:experiment.' + k); continue }
      if (Array.isArray(e[k]) && e[k].length === 0) { errors.push('MISSING_REQUIRED_FIELD:experiment.' + k); continue }
    }
  }
  return { ok: errors.length === 0, errors, codes: errors.map((x) => x.split(':')[0]) }
}

// ─────────────────────────────────────────────────────────────────────────
// B. FIELD TYPES
// ─────────────────────────────────────────────────────────────────────────
function validateFieldTypes6Q (report) {
  const errors = []
  const r = report || {}
  for (const k of TEXT_FIELDS) {
    if (r[k] !== undefined && r[k] !== null && typeof r[k] !== 'string') errors.push('FIELD_TYPE_INVALID:' + k)
  }
  if (r.advice !== undefined && r.advice !== null && !Array.isArray(r.advice)) errors.push('FIELD_TYPE_INVALID:advice')
  if (Array.isArray(r.advice) && r.advice.some((x) => typeof x !== 'string')) errors.push('FIELD_TYPE_INVALID:advice[]')
  if (r.system_loop !== undefined && r.system_loop !== null && !Array.isArray(r.system_loop)) errors.push('FIELD_TYPE_INVALID:system_loop')
  if (Array.isArray(r.system_loop) && r.system_loop.some((x) => typeof x !== 'string')) errors.push('FIELD_TYPE_INVALID:system_loop[]')
  if (r.experiment !== undefined && r.experiment !== null) {
    if (typeof r.experiment !== 'object' || Array.isArray(r.experiment)) {
      errors.push('FIELD_TYPE_INVALID:experiment')
    } else {
      for (const k of EXPERIMENT_TEXT_FIELDS) {
        if (r.experiment[k] !== undefined && r.experiment[k] !== null && typeof r.experiment[k] !== 'string') errors.push('FIELD_TYPE_INVALID:experiment.' + k)
      }
      if (r.experiment.actions !== undefined && r.experiment.actions !== null && !Array.isArray(r.experiment.actions)) errors.push('FIELD_TYPE_INVALID:experiment.actions')
    }
  }
  return { ok: errors.length === 0, errors, codes: errors.map((x) => x.split(':')[0]) }
}

// ─────────────────────────────────────────────────────────────────────────
// C. STRUCTURAL POLICY
// ─────────────────────────────────────────────────────────────────────────
function validateStructuralPolicy6Q (report) {
  const errors = []
  const r = report || {}
  for (const [k, [lo, hi]] of Object.entries(Object.assign({}, CARD_RANGES, PATH_RANGES))) {
    if (typeof r[k] !== 'string') continue
    const n = countChars(r[k])
    if (n && (n < lo || n > hi)) errors.push('FIELD_LENGTH_OUT_OF_RANGE:' + k + ':' + n)
  }
  // experiment text ranges
  const e = exp(r)
  if (e) {
    for (const [k, [lo, hi]] of Object.entries(EXPERIMENT_TEXT_RANGES)) {
      if (typeof e[k] !== 'string') continue
      const n = countChars(e[k])
      if (n && (n < lo || n > hi)) errors.push('FIELD_LENGTH_OUT_OF_RANGE:experiment.' + k + ':' + n)
    }
    // ONE experiment: 1-2 actions
    if (Array.isArray(e.actions) && e.actions.length > 0 && (e.actions.length < EXPERIMENT_ACTION_RANGE[0] || e.actions.length > EXPERIMENT_ACTION_RANGE[1])) {
      errors.push('EXPERIMENT_ACTIONS_INVALID:' + e.actions.length)
    }
    // no long-horizon plan
    const expBlob = [e.goal, e.output, e.success_signal, e.time_horizon, ...(Array.isArray(e.actions) ? e.actions : []), ...(Array.isArray(r.advice) ? r.advice : [])].filter(Boolean).join(' ')
    if (LONG_HORIZON_RE.test(expBlob)) errors.push('LONG_HORIZON_PLAN')
  }
  if (Array.isArray(r.advice) && r.advice.length > 0 && (r.advice.length < ADVICE_RANGE[0] || r.advice.length > ADVICE_RANGE[1])) {
    errors.push('ADVICE_COUNT_INVALID:' + r.advice.length)
  }
  const loopPresent = r.system_loop !== undefined && r.system_loop !== null && r.system_loop !== '' &&
    !(Array.isArray(r.system_loop) && r.system_loop.length === 0)
  if (loopPresent && Array.isArray(r.system_loop) && (r.system_loop.length < LOOP_RANGE[0] || r.system_loop.length > LOOP_RANGE[1])) {
    errors.push('LOOP_COUNT_INVALID:' + r.system_loop.length)
  }
  const blob = [r.system_trap, r.core_problem, r.fatal_sentence, r.strategy_path,
    ...(Array.isArray(r.advice) ? r.advice : []),
    ...(Array.isArray(r.system_loop) ? r.system_loop : []),
    s(r.path_from), s(r.path_to)].join(' ')
  const enumLeak = ENUM_LEAK_RE.test(blob)
  if (enumLeak) errors.push('ENUM_LEAK')
  return { ok: errors.length === 0, errors, codes: errors.map((x) => x.split(':')[0]), enumLeak }
}

function validateStructure6Q (report) {
  const required = validateRequiredFields6Q(report)
  const types = validateFieldTypes6Q(report)
  const policy = validateStructuralPolicy6Q(report)
  const errors = [...required.errors, ...types.errors, ...policy.errors]
  return { ok: errors.length === 0, errors, codes: errors.map((x) => x.split(':')[0]), enumLeak: policy.enumLeak, required, types, policy }
}

// ─────────────────────────────────────────────────────────────────────────
// §6 SAFE MECHANICAL NORMALIZATION (policy-only, meaning-preserving)
// ─────────────────────────────────────────────────────────────────────────
function normalizeStructural6Q (report) {
  const r = report || {}
  const ops = []
  const rep = Object.assign({}, r)
  if (rep.experiment && typeof rep.experiment === 'object' && Array.isArray(rep.experiment.actions) && rep.experiment.actions.length > EXPERIMENT_ACTION_RANGE[1]) {
    rep.experiment = Object.assign({}, rep.experiment, { actions: rep.experiment.actions.slice(0, EXPERIMENT_ACTION_RANGE[1]) })
    ops.push('TRUNCATE_EXPERIMENT_ACTIONS:' + r.experiment.actions.length + '->' + EXPERIMENT_ACTION_RANGE[1])
  }
  if (Array.isArray(rep.advice) && rep.advice.length > ADVICE_RANGE[1]) {
    rep.advice = rep.advice.slice(0, ADVICE_RANGE[1]); ops.push('TRUNCATE_ADVICE:' + r.advice.length + '->' + ADVICE_RANGE[1])
  }
  if (Array.isArray(rep.system_loop) && rep.system_loop.length > LOOP_RANGE[1]) {
    rep.system_loop = rep.system_loop.slice(0, LOOP_RANGE[1]); ops.push('TRUNCATE_LOOP:' + r.system_loop.length + '->' + LOOP_RANGE[1])
  }
  return { report: rep, changed: ops.length > 0, ops }
}

// ─────────────────────────────────────────────────────────────────────────
// D. SEMANTIC — calibrated (R2) + evidence boundary (R4)
// ─────────────────────────────────────────────────────────────────────────
const FIELD_LABELS = {
  fatal_sentence: 'CARD01 致命一句话', core_problem: 'CARD02 核心问题', system_trap: 'CARD03 系统困局',
  system_loop: 'CARD03 系统困局', strategy_path: 'CARD04 翻身路径', path_from: 'CARD04 翻身路径',
  path_to: 'CARD04 翻身路径', advice: 'CARD05 行动建议',
  'experiment.goal': 'CARD05 行动建议', 'experiment.actions': 'CARD05 行动建议', 'experiment.target': 'CARD05 行动建议',
  'experiment.output': 'CARD05 行动建议', 'experiment.success_signal': 'CARD05 行动建议', 'experiment.time_horizon': 'CARD05 行动建议',
}
const cardOf = (field) => CARD_OF[field] || (field && field.startsWith('experiment') ? 'CARD05' : 'REPORT')

function isUserProvided (token, userText) {
  if (!token) return false
  const t = String(token).replace(/^你(的)?/, '')
  if (!t) return false
  return userText.includes(t)
}
function fullMatches (text, re) {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
  const out = []
  let m
  while ((m = g.exec(text))) { if (m[0]) out.push(m[0]); if (m.index === g.lastIndex) g.lastIndex++ }
  return uniq(out)
}
// is the matched phrase (or a ≥5-char window of it) already present in the user's own words?
function groundedInUser (match, userText) {
  if (!match || !userText) return false
  const m = String(match).replace(/[，。、！？\s]/g, '')
  if (!m) return false
  if (userText.includes(m)) return true
  if (m.length >= 5) for (let i = 0; i + 5 <= m.length; i++) if (userText.includes(m.slice(i, i + 5))) return true
  if (m.length >= 3 && m.length < 5 && userText.includes(m)) return true
  return false
}
// does the sentence containing index carry conditional (hypothesis) wording?
function sentenceHasConditional (text, idx) {
  let start = 0
  for (const p of ['。', '！', '？', '；', '\n']) { const i = text.lastIndexOf(p, idx); if (i + 1 > start) start = i + 1 }
  let end = text.length
  for (const p of ['。', '！', '？', '；', '\n']) { const i = text.indexOf(p, idx); if (i >= 0 && i < end) end = i }
  return CONDITIONAL_RE.test(text.slice(start, end))
}
// does the sentence carry an explicit ABSENCE form (还看不到/没有体现/值得验证/缺的是…)?
const ABSENCE_FORM_RE = /(还看不到|看不到|没有体现|没有被?提到|尚未|暂无|目前没有|现在没有|没有记录|没有证据|缺的是|缺少的是|没有一个|没有一件|值得(先)?(验证|确认|核对)|需要(先)?(确认|核对)|可能意味着|可能说明|一种可能|可能不是|不是没(有|试)|也许|未必|不一定|如果|假如|从你(目前)?提供的信息)/
function sentenceIsAbsenceForm (text, idx) {
  let start = 0
  for (const p of ['。', '！', '？', '；', '\n']) { const i = text.lastIndexOf(p, idx); if (i + 1 > start) start = i + 1 }
  let end = text.length
  for (const p of ['。', '！', '？', '；', '\n']) { const i = text.indexOf(p, idx); if (i >= 0 && i < end) end = i }
  return ABSENCE_FORM_RE.test(text.slice(start, end))
}
// stricter grounding for motive: a 1-char token like “怕” is not a paraphrase.
function groundedInUserStrict (hit, userText, minLen) {
  if (!hit || !userText) return false
  const m = String(hit).replace(/^你(的)?/, '').replace(/[，。、！？\s]/g, '')
  if (!m || m.length < (minLen || 2)) return false
  if (userText.includes(m)) return true
  if (m.length >= 5) for (let i = 0; i + 5 <= m.length; i++) if (userText.includes(m.slice(i, i + 5))) return true
  return false
}
// R4.1 §7: does the REPORT acknowledge the input contradiction explicitly?
function reportAcknowledgesContradiction (blob) { return CONTRADICTION_MARKER_RE.test(blob) }
// R4.1 §7: does the report lean on the disputed JOB-HISTORY fact?
function reportTouchesJobHistory (blob) { return /(换(了|过)?[^，。]{0,4}(几|两|三|四|多)?[^，。]{0,2}份?工作|第[一二三四五六七八九十两]份工作|换工作|换岗|辞职|离职|工作经历|职业经历|每一份|每份工作)/.test(blob) }
function detectAssertions (text, userText) {
  const out = []
  for (const [subtype, re] of ASSERTION_DETECTORS) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
    let m
    while ((m = g.exec(text))) {
      const hit = m[0]
      if (m.index === g.lastIndex) g.lastIndex++
      if (groundedInUser(hit, userText)) continue
      if (sentenceHasConditional(text, m.index)) continue
      out.push({ subtype, evidence: hit })
      break // one per subtype per field is enough
    }
  }
  return out
}
function detectIrreversible (text, userText) {
  const out = []
  const g = new RegExp(IRREVERSIBLE_ACTION_RE.source, 'g')
  let m
  while ((m = g.exec(text))) {
    const hit = m[0]
    if (m.index === g.lastIndex) g.lastIndex++
    if (groundedInUser(hit, userText)) continue
    if (sentenceHasConditional(text, m.index)) continue
    out.push(hit)
    break
  }
  return out
}

// R4.1 §10: an AGE claim that contradicts the user-provided exact age.
const AGE_CLAIM_RE = /(\d{1,3}|[零一二两三四五六七八九十百]{1,4})\s*岁/g
function cnNum (s) {
  const d = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
  if (/^\d+$/.test(s)) return Number(s)
  let n = 0
  if (s.includes('百')) { const p = s.split('百'); n += (p[0] ? (d[p[0]] || 0) : 1) * 100; s = p[1] }
  if (s.includes('十')) { const p = s.split('十'); n += (p[0] ? (d[p[0]] || 0) : 1) * 10; s = p[1] }
  if (s) n += d[s] || 0
  return n
}
function detectAgeMismatch (text, userText) {
  const age = Number(String((userText || '').match(/\b(\d{1,3})\b/) ? (userText.match(/\b(\d{1,3})\b/) || [])[1] : NaN))
  if (!age) return null
  const g = new RegExp(AGE_CLAIM_RE.source, 'g')
  let m
  while ((m = g.exec(text))) {
    const hit = m[0]
    if (m.index === g.lastIndex) g.lastIndex++
    const n = cnNum(m[1])
    if (!n || n === age) continue
    if (groundedInUser(hit, userText)) continue
    if (sentenceHasConditional(text, m.index)) continue
    const pre = text.slice(Math.max(0, m.index - 6), m.index)
    if (/[到再过未来以后等将至]/.test(pre)) continue
    return hit
  }
  return null
}

function scanFieldText (field, text, facts, userText) {
  const out = []
  const t = s(text)
  if (!t) return out
  const tneg = negate(t)
  const add = (code, evidence, reason, extra) => out.push(Object.assign({ code, field, card: cardOf(field), evidence, reason }, extra || {}))

  // INVENTED_USER_FACT — claims a private fact the user never supplied.
  const inv = uniq([...fullMatches(t, INVENTED_FACT_RE), ...fullMatches(t, UNSUPPORTED_FACT_RE)])
  const real = inv.filter((x) => !isUserProvided(x, userText))
  if (real.length) add('INVENTED_USER_FACT', real[0], '输出声称了用户未提供的私人事实（家庭/债务/健康/失败史等）')
  // UNSUPPORTED_CAUSAL_CERTAINTY
  if (CERTAINTY_RE.test(tneg)) add('UNSUPPORTED_CAUSAL_CERTAINTY', (tneg.match(CERTAINTY_RE) || [])[0], '把未经验证的判断表述为确定性结论（"一定能/保证/必定"等）')
  // UNSUPPORTED_FUTURE_PREDICTION
  if (FUTURE_CERTAINTY_RE.test(tneg)) add('UNSUPPORTED_FUTURE_PREDICTION', (tneg.match(FUTURE_CERTAINTY_RE) || [])[0], '对未来结果做出未经支持的确定性预测')
  // UNSUPPORTED_NUMERIC_CLAIM
  const pm = tneg.match(PROB_RE) || tneg.match(SOFT_PROB_RE)
  if (pm) add('UNSUPPORTED_NUMERIC_CLAIM', pm[0], '使用了没有依据的概率/成功率数字')
  // UNSUPPORTED_PSYCHOLOGICAL_ASSERTION
  if (PSYCH_ASSERTION_RE.test(t)) add('UNSUPPORTED_PSYCHOLOGICAL_ASSERTION', (t.match(PSYCH_ASSERTION_RE) || [])[0], '断言了用户的隐藏心理状态/诊断')
  // UNSUPPORTED_CAPABILITY_ASSERTION
  if (CAPABILITY_ASSERTION_RE.test(t)) add('UNSUPPORTED_CAPABILITY_ASSERTION', (t.match(CAPABILITY_ASSERTION_RE) || [])[0], '断言了用户未被提供的性格/能力/天赋')
  // R4 §2/§3 — UNSUPPORTED_ASSERTION (bare-fact industry/behaviour/motive claims)
  for (const a of detectAssertions(t, userText)) add('UNSUPPORTED_ASSERTION', a.evidence, '把用户未提供、也非合理推断的内容说成了确定事实（' + a.subtype + '）', { assertionSubtype: a.subtype })
  // R4.1 §2 — ABSENCE stated as established fact
  {
    const mm = t.match(ABSENCE_AS_FACT_RE)
    if (mm && !sentenceIsAbsenceForm(t, mm.index) && !groundedInUser(mm[0], userText)) {
      add('PLAUSIBLE_INFERENCE_AS_FACT', mm[0], '把“用户没有提供证据”写成了“用户事实就是如此”（NO_EVIDENCE ≠ EVIDENCE_OF_ABSENCE）', { assertionSubtype: 'ABSENCE_AS_FACT' })
    }
  }
  // R4.1 §3 — MOTIVE / mental-state asserted as fact
  {
    const mm = t.match(MOTIVE_ASSERTION_RE)
    if (mm && !sentenceHasConditional(t, mm.index) && !sentenceIsAbsenceForm(t, mm.index) && !groundedInUserStrict(mm[0], userText, 2)) {
      add('UNSUPPORTED_MOTIVE_ASSERTION', mm[0], '把未经用户证实的心理/动机写成了事实（只能条件化或引用用户原话）', { assertionSubtype: 'MOTIVE_ASSERTION' })
    }
  }
  // R4.1 §4 — HISTORY asserted as fact
  {
    const mm = t.match(HISTORY_ASSERTION_RE)
    if (mm && !sentenceHasConditional(t, mm.index) && !sentenceIsAbsenceForm(t, mm.index) && !groundedInUserStrict(mm[0], userText, 3)) {
      add('UNSUPPORTED_HISTORY_ASSERTION', mm[0], '把未经证实的历史/频次写成了事实（只能条件化或引用用户原话）', { assertionSubtype: 'HISTORY_ASSERTION' })
    }
  }
  // R4.1 §5 — EXTERNAL BENCHMARK claim (no external data source exists)
  {
    const mm = t.match(EXTERNAL_BENCHMARK_RE)
    if (mm && !sentenceHasConditional(t, mm.index) && !groundedInUser(mm[0], userText)) {
      add('UNSUPPORTED_EXTERNAL_BENCHMARK', mm[0], '使用了不存在外部数据来源的横向对比/基准（同龄人/同行/行业平均/高薪等）', { assertionSubtype: 'EXTERNAL_BENCHMARK' })
    }
  }
  // R4.1 §6 — INDUSTRY MECHANISM stated as user-specific fact
  {
    const mm = t.match(USER_FACT_AS_CERTAIN_RE)
    if (mm && !sentenceHasConditional(t, mm.index) && !sentenceIsAbsenceForm(t, mm.index) && !groundedInUser(mm[0], userText)) {
      add('UNSUPPORTED_ASSERTION', mm[0], '把行业机制/推断写成了用户的具体事实（应条件化，或引用用户已提到的内容）', { assertionSubtype: 'USER_FACT_AS_CERTAIN' })
    }
  }
  // R4.1 §10 — AGE claimed as fact that contradicts the user-provided age
  {
    const hit = detectAgeMismatch(t, userText)
    if (hit) add('PLAUSIBLE_INFERENCE_AS_FACT', hit, '把与用户提供年龄不一致的年龄写成了事实（如用户30岁却写“二十九岁到三十岁”）', { assertionSubtype: 'AGE_AS_FACT' })
  }
  // R4 §7 — irreversible / high-impact action without evidence
  const irr = detectIrreversible(t, userText)
  if (irr.length) add('IRREVERSIBLE_ACTION_WITHOUT_EVIDENCE', irr[0], '在没有证据前就建议不可逆或高代价的直接动作（应先验证）')
  return out
}

function validateSemantics6Q (report, facts) {
  const r = report || {}
  const f = facts || {}
  const fields = {
    fatal_sentence: s(r.fatal_sentence), core_problem: s(r.core_problem), system_trap: s(r.system_trap),
    strategy_path: s(r.strategy_path), path_from: s(r.path_from), path_to: s(r.path_to),
    system_loop: (Array.isArray(r.system_loop) ? r.system_loop.join('\n') : ''),
    advice: (Array.isArray(r.advice) ? r.advice.join('\n') : ''),
    'experiment.goal': expStr(r, 'goal'), 'experiment.actions': expArr(r, 'actions').join('\n'),
    'experiment.target': expStr(r, 'target'), 'experiment.output': expStr(r, 'output'),
    'experiment.success_signal': expStr(r, 'success_signal'), 'experiment.time_horizon': expStr(r, 'time_horizon'),
  }
  const blob = Object.values(fields).filter(Boolean).join('\n')
  const userText = [f.age, f.job, f.education, f.income, f.anxiety, f.rootCause].filter(Boolean).join(' ')

  // ── §7 FACT GROUNDING — REPORT-level, MATERIAL ──
  const jobT = String(f.job || '').split(/[\/、,，\s]+/).filter((x) => x.length >= 2)
  const anxietyT = String(f.anxiety || '').split(/[，。！？、,.\s]+/).filter((x) => x.length >= 2)
  const rootT = String(f.rootCause || '').split(/[，。！？、,.\s]+/).filter((x) => x.length >= 2)
  const grounded = []
  if (f.age && includesLenient(blob, String(f.age))) grounded.push('age')
  const jobHit = jobT.some((x) => blob.includes(x)) || /(你现在做|你做的|作为|职业|工作|干活|体力|跑单|接单|送餐|配送|上班|打工|工时|时薪)/.test(blob)
  if (f.job && jobHit) grounded.push('job')
  if (f.education && includesLenient(blob, String(f.education))) grounded.push('education')
  if (f.income && (includesLenient(blob, String(f.income)) || /(收入|月入|工资|时薪|现金流|单价|计件|按单|跑单量|挣|赚)/.test(blob))) grounded.push('income')
  const anxHit = anxietyT.some((x) => blob.includes(x)) || /(一停|停下来|停下就|不敢停|现金流断|停就|归零|不够用)/.test(blob)
  if (f.anxiety && anxHit) grounded.push('anxiety')
  const rootHit = rootT.some((x) => blob.includes(x)) ||
    /(你把[^，。]{0,20}(归(因|结)于|归为|归结为|理解|定义|当成|看成)|你以为|你自认为|不是[^，。]{0,10}(学历|关系|运气)|只是表面)/.test(blob)
  if (f.rootCause && rootHit) grounded.push('rootCause')
  const FACT_GROUNDING_COUNT = uniq(grounded).length

  const genericHits = GENERIC_PHRASES.filter((p) => blob.includes(p))

  const findings = []
  for (const [field, text] of Object.entries(fields)) {
    for (const fd of scanFieldText(field, text, facts, userText)) findings.push(fd)
  }

  // ── R4 metrics: conditional hypotheses present / unsupported assertions rejected ──
  let conditionalHypothesisCount = 0
  for (const text of Object.values(fields)) {
    if (!text) continue
    const g = new RegExp(CONDITIONAL_RE.source, 'g')
    let m
    while ((m = g.exec(text))) { conditionalHypothesisCount++; if (m.index === g.lastIndex) g.lastIndex++ }
  }

  // ── USER_FACT_CONTRADICTION (structural income check) ──
  const contradictions = []
  if (f.income && /^\d+$/.test(f.income)) {
    const inc = Number(f.income)
    const re = /(\d{3,7})\s*(元|块|k|K)/g
    let mm
    while ((mm = re.exec(blob))) {
      const n = Number(mm[1]); if (n === inc) continue
      const pre = blob.slice(Math.max(0, mm.index - 14), mm.index)
      if (/(月入|月收入|工资(只有|才|是)|收入(只有|才|是))/.test(pre)) contradictions.push({ field: 'REPORT', evidence: mm[0], reason: '文中出现的收入数字 ' + mm[1] + ' 与用户提供的月收入 ' + inc + ' 不一致' })
    }
    const re2 = /(月入|月收入|工资|收入)([^，。\d]{0,4})(\d{3,7})/g
    let m2
    while ((m2 = re2.exec(blob))) {
      const gap = m2[2] || ''
      if (/超过|达到|目标|做到|涨|增加|多|外|私|翻|提升|增收/.test(gap)) continue
      const n = Number(m2[3]); if (n !== inc) contradictions.push({ field: 'REPORT', evidence: m2[0], reason: '文中声称的月收入 ' + m2[3] + ' 与用户提供的 ' + inc + ' 不一致' })
    }
  }

  const explanations = []
  const errors = []
  const subtypeCounts = {
    INVENTED_USER_FACT: 0, UNSUPPORTED_CAUSAL_CERTAINTY: 0, UNSUPPORTED_FUTURE_PREDICTION: 0,
    UNSUPPORTED_NUMERIC_CLAIM: 0, UNSUPPORTED_PSYCHOLOGICAL_ASSERTION: 0, UNSUPPORTED_CAPABILITY_ASSERTION: 0,
    UNSUPPORTED_ASSERTION: 0, PLAUSIBLE_INFERENCE_AS_FACT: 0, UNSUPPORTED_MOTIVE_ASSERTION: 0,
    UNSUPPORTED_HISTORY_ASSERTION: 0, UNSUPPORTED_EXTERNAL_BENCHMARK: 0,
  }
  const assertionSubtypeCounts = {
    INVENTED_BUSINESS_ECONOMICS: 0, INVENTED_EMPLOYER_POLICY: 0, INVENTED_JOB_DUTIES: 0,
    INVENTED_PAST_BEHAVIOR: 0, INVENTED_MOTIVATION: 0, USER_FACT_AS_CERTAIN: 0,
    ABSENCE_AS_FACT: 0, MOTIVE_ASSERTION: 0, HISTORY_ASSERTION: 0, EXTERNAL_BENCHMARK: 0,
  }
  let irreversibleCount = 0
  let plausibleCount = 0
  let motiveCount = 0
  let historyCount = 0
  let benchmarkCount = 0
  for (const fd of findings) {
    subtypeCounts[fd.code] = (subtypeCounts[fd.code] || 0) + 1
    if (fd.assertionSubtype) assertionSubtypeCounts[fd.assertionSubtype] = (assertionSubtypeCounts[fd.assertionSubtype] || 0) + 1
    if (fd.code === 'IRREVERSIBLE_ACTION_WITHOUT_EVIDENCE') irreversibleCount++
    if (fd.code === 'PLAUSIBLE_INFERENCE_AS_FACT') plausibleCount++
    if (fd.code === 'UNSUPPORTED_MOTIVE_ASSERTION') motiveCount++
    if (fd.code === 'UNSUPPORTED_HISTORY_ASSERTION') historyCount++
    if (fd.code === 'UNSUPPORTED_EXTERNAL_BENCHMARK') benchmarkCount++
    errors.push(fd.code)
    explanations.push({ code: fd.code, field: fd.field, card: fd.card, evidence: fd.evidence, reason: fd.reason, assertionSubtype: fd.assertionSubtype })
  }
  if (FACT_GROUNDING_COUNT < 3) {
    errors.push('MISSING_FACT_GROUNDING:' + FACT_GROUNDING_COUNT)
    explanations.push({ code: 'MISSING_FACT_GROUNDING', field: 'REPORT', card: 'REPORT', evidence: 'grounded=' + FACT_GROUNDING_COUNT + ' [' + grounded.join(',') + ']', reason: '报告层面实质使用到的用户事实不足 3 项（需 ≥3）' })
  }
  if (genericHits.length >= 3) {
    errors.push('GENERIC_COPY:' + genericHits.length)
    explanations.push({ code: 'GENERIC_COPY', field: 'REPORT', card: 'REPORT', evidence: genericHits.join('、'), reason: '出现 ' + genericHits.length + ' 个可原样发给任何人的空话模板' })
  }
  for (const c of contradictions) {
    errors.push('USER_FACT_CONTRADICTION')
    explanations.push({ code: 'USER_FACT_CONTRADICTION', field: c.field, card: 'REPORT', evidence: c.evidence, reason: c.reason })
  }

  // ── R4.1 §7: USER_INPUT_CONTRADICTION — the user's RAW ANSWERS conflict ──
  // (F04: job=“刚换的第二份工作” vs anxiety=“换了几份工作都没方向”). The report must
  // FLAG the conflict, never silently pick one side. Detection is fact-based on the
  // raw answers; no LLM self-certification.
  const JOB_HISTORY_CLAIM_RE = /(换(了|过)?[^，。]{0,6}份?工作|第[一二三四五六七八九十两]份工作|换过[^，。]{0,4}工作|跳槽)/
  const hasSecondJob = /第[二两]份工作/.test(String(f.job || ''))
  const hasManyJobs = /(几份|好几份|好多份|很多份|多份)/.test(String(f.anxiety || '') + String(f.rootCause || '')) || /换了几份/.test(String(f.anxiety || ''))
  const hasJobHistoryConflict = hasSecondJob && hasManyJobs
  const inputContradictionDetected = hasJobHistoryConflict
  let silentResolution = 0
  if (hasJobHistoryConflict) {
    const ack = reportAcknowledgesContradiction(blob)
    const touchesDisputed = reportTouchesJobHistory(blob)
    if (!ack) {
      if (touchesDisputed) silentResolution = 1
      errors.push('USER_INPUT_CONTRADICTION')
      explanations.push({
        code: 'USER_INPUT_CONTRADICTION', field: 'REPORT', card: 'REPORT',
        evidence: 'job=“' + s(f.job) + '” vs anxiety=“' + s(f.anxiety) + '”',
        reason: touchesDisputed
          ? '用户的工作经历自述相互矛盾，报告直接倚用了有争议的事实而未先指出矛盾（不得静默二选一）'
          : '用户的工作经历自述相互矛盾（“刚换的第二份工作” vs “换了几份工作”），报告未指出这一矛盾',
      })
    }
  }

  const codes = uniq(errors)
  const overclaimSubtypes = subtypeCounts.INVENTED_USER_FACT + subtypeCounts.UNSUPPORTED_CAUSAL_CERTAINTY +
    subtypeCounts.UNSUPPORTED_FUTURE_PREDICTION + subtypeCounts.UNSUPPORTED_NUMERIC_CLAIM +
    subtypeCounts.UNSUPPORTED_PSYCHOLOGICAL_ASSERTION + subtypeCounts.UNSUPPORTED_CAPABILITY_ASSERTION + subtypeCounts.UNSUPPORTED_ASSERTION
  const UNSUPPORTED_FACT_COUNT = (subtypeCounts.INVENTED_USER_FACT || 0) + (subtypeCounts.UNSUPPORTED_ASSERTION || 0) + contradictions.length

  return {
    ok: errors.length === 0,
    errors,
    codes,
    explanations,
    subtypeCounts,
    assertionSubtypeCounts,
    unsupportedAssertionCount: subtypeCounts.UNSUPPORTED_ASSERTION || 0,
    conditionalHypothesisCount,
    irreversibleActionCount: irreversibleCount,
    PLAUSIBLE_INFERENCE_AS_FACT_COUNT: plausibleCount,
    UNSUPPORTED_MOTIVE_ASSERTION_COUNT: motiveCount,
    UNSUPPORTED_HISTORY_ASSERTION_COUNT: historyCount,
    UNSUPPORTED_EXTERNAL_BENCHMARK_COUNT: benchmarkCount,
    USER_INPUT_CONTRADICTION_DETECTED: inputContradictionDetected,
    SILENT_CONTRADICTION_RESOLUTION_COUNT: silentResolution,
    overclaim: overclaimSubtypes > 0,
    FACT_GROUNDING_COUNT,
    GENERIC_COPY_COUNT: genericHits.length,
    UNSUPPORTED_FACT_COUNT,
    OVERCLAIM: overclaimSubtypes > 0,
    CONTRADICTION: contradictions.length > 0,
    genericHits,
    unsupported: findings.filter((x) => x.code === 'INVENTED_USER_FACT' || x.code === 'UNSUPPORTED_ASSERTION').map((x) => x.evidence),
    grounded,
  }
}

module.exports = {
  validateStructure6Q,
  validateRequiredFields6Q,
  validateFieldTypes6Q,
  validateStructuralPolicy6Q,
  requiredFieldsPresent,
  normalizeStructural6Q,
  validateSemantics6Q,
  GENERIC_PHRASES,
  ENUM_LEAK_RE,
  OVERCLAIM_RE: CERTAINTY_RE,
  CERTAINTY_RE,
  PROB_RE,
  UNSUPPORTED_FACT_RE,
  INVENTED_FACT_RE,
  FUTURE_CERTAINTY_RE,
  PSYCH_ASSERTION_RE,
  CAPABILITY_ASSERTION_RE,
  CONDITIONAL_RE,
  ABSENCE_AS_FACT_RE,
  MOTIVE_ASSERTION_RE,
  HISTORY_ASSERTION_RE,
  EXTERNAL_BENCHMARK_RE,
  USER_FACT_AS_CERTAIN_RE,
  CONTRADICTION_MARKER_RE,
  ABSENCE_FORM_RE,
  IRREVERSIBLE_ACTION_RE,
  LONG_HORIZON_RE,
  ASSERTION_DETECTORS,
  REQUIRED_FIELDS,
  REQUIRED_EXPERIMENT_FIELDS,
  CARD_RANGES,
  PATH_RANGES,
  EXPERIMENT_TEXT_RANGES,
  EXPERIMENT_ACTION_RANGE,
  ADVICE_RANGE,
  LOOP_RANGE,
  CARD_OF,
}
