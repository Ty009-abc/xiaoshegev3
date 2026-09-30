'use strict'
/**
 * lib/context/userContextBuilder.js
 *
 * RC8_10A — USER CONTEXT BUILDER (UCB).
 *
 * The SINGLE authority that assembles the per-user context consumed by
 *
 *   • the six home-page scenarios (职场困境 / 搞钱逻辑 / 副业方向 / AI赛道 /
 *     认知升级 / 流量密码), and
 *   • 直接问小事哥 (AI chat).
 *
 * PRIORITY (locked, highest → lowest)
 *   L0 sixQ            latest AUTHORITATIVE 6Q (from persisted ai_reports)   ← always
 *   L1 profile         structured cognitive profile (user_profiles)          ← always
 *   L2 challenge       latest finished challenge evidence                     ← always
 *   L3 reportEvidence  report / world-model evidence                          ← always
 *   L4 memories        long-term memory — ONLY when memoryEnabled === true    ← gated
 *   L5 session         current user message                                   ← always
 *
 * HARD RULES (non-negotiable)
 *   - Explicit 6Q data ALWAYS outranks long-term memory and model inference.
 *   - memoryEnabled === false disables ONLY L4 (read/write of long-term memory).
 *     It NEVER disables 6Q/profile/challenge/report personalization.
 *   - NEVER invent a user fact (occupation / income / skills / capital / history).
 *     A value that is not present is `null` and recorded in `missingFields`.
 *   - Every value read/written is scoped to the AUTHENTICATED openid only
 *     (the openid comes from cloud.getWXContext(), never from the client).
 *
 * Pure assembly (`assembleUserContext`) + thin async loader (`buildUserContext`).
 */

// Canonical world-model presenter (mirror of utils/worldModelLabels.js — keep
// in lock-step; asserted by tests).
const WORLD_MODEL_TYPE_LABELS = Object.freeze({
  strategic: '战略型翻身者',
  effort_trap: '努力陷阱型',
  high_risk: '高风险冲动型',
  opportunity_hunter: '机会捕手型',
  system_thinker: '系统思维型',
  normal_awakened: '普通觉醒型',
})
const WORLD_MODEL_TYPE_FALLBACK = '认知探索者'

const UNKNOWN = '—'

const SIXQ_DOMAIN = 'turnaround_6q'
const RAW6Q_TYPE = 'raw_6q'
const RAW6Q_COLLECTION = 'user_6q_raw'
const SIXQ_VERSION = 'turnaround_strategy_6q_v1'
const RAW6Q_FIELDS = ['age', 'job', 'education', 'income', 'anxiety', 'rootCause']

// Six scenario registry (user-facing names are FROZEN).
const SCENARIOS = Object.freeze({
  career: { key: 'career', name: '职场困境', mustUse: ['occupation', 'income', 'education', 'careerProblem'] },
  money_logic: { key: 'money_logic', name: '搞钱逻辑', mustUse: ['income', 'occupation', 'goal'] },
  side_hustle: { key: 'side_hustle', name: '副业方向', mustUse: ['occupation', 'skills', 'capital'] },
  ai_track: { key: 'ai_track', name: 'AI赛道', mustUse: ['occupation', 'digitalSkill', 'workflow'] },
  cognition: { key: 'cognition', name: '认知升级', mustUse: ['sixQRootProblem', 'challengeBehavior', 'worldModelWeakness'] },
  traffic: { key: 'traffic', name: '流量密码', mustUse: ['occupation', 'productOrService', 'contentAbility'] },
  ask: { key: 'ask', name: '直接问小事哥', mustUse: [] },
})

const SCENARIO_NAME_TO_KEY = Object.freeze(
  Object.keys(SCENARIOS).reduce((m, k) => { m[SCENARIOS[k].name] = k; return m }, {})
)

// ── deterministic extraction (rule-based over the user's OWN words) ─────────
const OCCUPATION_TOKENS = [
  // RC8_10A2 — common occupations (explicit recognition only; never inferred).
  // Longest match wins, so generic substrings (老板/个体户) do not shadow them.
  '个体老板', '内容创作者', '技术人员', '自由职业', '健身教练',
  '外卖员', '快递员', '骑手', '厨师', '宝妈', '学生', '白领',
  '个体户', '创业者', '老板', '自媒体', '网约车',
  '司机', '销售', '程序员', '开发', '工程师',
  '设计师', '教师', '老师', '护士', '医生', '保安', '客服', '运营', '会计', '律师',
  '主播', '美工', '维修', '店员', '导购', '服务员', '理发', '美容',
  '公务员', '工人', '电商', '农户', '农民',
  '文员', '行政', '人事', '采购', '仓管', '摄影师', '剪辑',
]
// The AI-track "digital occupation" set — a non-digital occupation must NOT be
// pushed a software-engineering career.
const DIGITAL_TOKENS = ['程序员', '开发', '工程师', '设计师', '运营', '主播', '剪辑', '美工', '产品经理', '数据', '技术人员']
const EDUCATION_TOKENS = ['小学', '初中', '中专', '高中', '大专', '本科', '硕士', '研究生', '博士', 'MBA', '海归']

// 流量密码 — domain tokens (only read out of the user's own 6Q text).
const DOMAIN_TOKENS = {
  food: ['餐饮', '饭店', '餐厅', '外卖', '小吃', '厨'],
  retail: ['零售', '门店', '店铺', '电商', '带货'],
  edu: ['教育', '培训', '老师', '家教'],
  beauty: ['美容', '美发', '理发', '美甲'],
  health: ['健身', '健康', '养生'],
  service: ['服务', '客服', '销售', '咨询'],
}

const DIMENSION_LABELS = Object.freeze({
  laborMindset: '劳动思维', probabilityMindset: '概率思维', systemThinking: '系统思维',
  leverageThinking: '杠杆思维', capitalThinking: '资本思维', riskAwareness: '风险意识',
  informationSensitivity: '信息敏感度', longTermism: '长期主义', decisionStability: '决策稳定性',
})

function clean (v) { return (v === undefined || v === null) ? '' : String(v).trim() }

function firstToken (text, tokens) {
  const t = clean(text)
  if (!t) return ''
  // Longest matching token wins (more specific occupation beats a generic
  // substring: 个体老板 > 老板, 技术人员 > 维修). Deterministic.
  let best = ''
  for (const tok of tokens) {
    if (t.includes(tok) && tok.length > best.length) best = tok
  }
  return best
}

function extractIncome (text) {
  const t = clean(text)
  if (!t) return null
  let m = t.match(/(?:月入|月收入|月薪|收入|工资)\s*[:：]?\s*(\d{2,7})/)
  if (!m) m = t.match(/(\d{3,7})\s*(?:元|块|rmb|RMB)/)
  if (!m) return null
  const n = parseInt(m[1], 10)
  return (Number.isFinite(n) && n > 0) ? n : null
}

function extractAge (text) {
  const m = clean(text).match(/(\d{2})\s*岁/)
  if (!m) return null
  const n = parseInt(m[1], 10)
  return (n >= 12 && n <= 99) ? n : null
}

function extractEducation (text) { return firstToken(text, EDUCATION_TOKENS) }

function typeLabel (token) {
  if (typeof token !== 'string') return WORLD_MODEL_TYPE_FALLBACK
  const k = token.trim()
  if (!k) return WORLD_MODEL_TYPE_FALLBACK
  return WORLD_MODEL_TYPE_LABELS[k] || WORLD_MODEL_TYPE_FALLBACK
}

/** Lowest / negative cognitive dimensions — deterministic weakness read. */
function resolveWeakDimensions (dims, limit) {
  if (!dims || typeof dims !== 'object') return []
  const arr = []
  for (const k of Object.keys(DIMENSION_LABELS)) {
    if (typeof dims[k] === 'number') arr.push({ key: k, label: DIMENSION_LABELS[k], value: dims[k] })
  }
  arr.sort((a, b) => a.value - b.value)
  return arr.slice(0, limit || 3)
}

// ── assembleUserContext (PURE) ─────────────────────────────────────────────
/**
 * @param {object} raw
 *   { openid, scenario, message,
 *     profile,          // user_profiles doc | null
 *     sixqReport,       // { content, reportId, createdAt } | null
 *     challengeRecord,  // challenge_records doc | null
 *     memories,         // array | null
 *     memoryEnabled }   // boolean
 * @returns {object} explicitProfile, sixQ, challengeEvidence, reportEvidence,
 *                   memories, missingFields, evidenceMap
 */
function assembleUserContext (raw) {
  const r = raw || {}
  const scenario = r.scenario || 'ask'
  const message = clean(r.message)
  const profile = r.profile || null
  const sixq = r.sixqReport || null
  const challenge = r.challengeRecord || null
  const memoryEnabled = r.memoryEnabled !== false
  const evidenceMap = {}
  const missingFields = []

  // ── L0 RAW 6Q (highest authority; server-persisted raw answers) ──
  const rawDoc = r.raw6q || null
  // Canonical snapshot: six answers stored FLAT on the doc. Backward-compatible
  // with the legacy {facts:{...}} shape. Either way it is ONE indivisible version.
  const rs = rawDoc || {}
  const rf = (rs.facts && rs.job == null && rs.age == null) ? rs.facts : rs
  // Atomic set: present iff at least one of the six answers is non-empty. A gap
  // inside the set stays a gap (never backfilled from another version).
  const hasRaw = !!(clean(rf.job) || clean(rf.rootCause) || clean(rf.anxiety) || clean(rf.income) || clean(rf.education) || clean(rf.age))
  const raw6Q = hasRaw ? {
    // whole set used as ONE version — never field-mixed with older sets
    sixQRecordId: clean(rawDoc.sixQRecordId) || clean(rawDoc.rawId) || null,
    sixQVersion: clean(rawDoc.sixQVersion) || clean(rawDoc.diagnosticVersion) || SIXQ_VERSION,
    source: 'RAW_6Q',
    diagnosticVersion: clean(rawDoc.diagnosticVersion) || SIXQ_VERSION,
    job: clean(rf.job), income: clean(rf.income), age: clean(rf.age),
    education: clean(rf.education), anxiety: clean(rf.anxiety), rootCause: clean(rf.rootCause),
    completedAt: rawDoc.completedAt || null,
  } : null

  // ── L0b turnaround_6q report (DERIVED evidence only) ──
  const c = (sixq && sixq.content) || {}
  const reportText = [clean(c.system_trap), clean(c.core_problem), clean(c.fatal_sentence), clean(c.strategy_path)].join('\n')
  const hasReport = !!(clean(c.system_trap) || clean(c.core_problem) || clean(c.fatal_sentence) || clean(c.strategy_path))
  const sixQ = hasReport ? {
    reportId: clean((sixq && sixq.reportId) || c.reportId),
    diagnosticVersion: clean(c.diagnosticVersion) || SIXQ_VERSION,
    systemTrap: clean(c.system_trap),
    rootProblem: clean(c.core_problem),
    fatalSentence: clean(c.fatal_sentence),
    strategyPath: clean(c.strategy_path),
    createdAt: (sixq && sixq.createdAt) || null,
    derivedFrom: 'DERIVED_LEGACY',
  } : null
  // Authority text: RAW wins; else report text marked DERIVED_LEGACY.
  const sixqText = hasRaw ? [raw6Q.job, raw6Q.anxiety, raw6Q.rootCause].filter(Boolean).join('\n') : reportText
  const hasSixQ = hasRaw || hasReport
  const sixQSource = hasRaw ? 'RAW_6Q' : (hasReport ? 'DERIVED_LEGACY' : null)
  if (hasRaw) evidenceMap.sixQ = 'RAW_6Q'
  else if (hasReport) evidenceMap.sixQ = 'DERIVED_LEGACY'

  // ── L1 explicit profile ──
  // When RAW 6Q exists, explicit facts come from the RAW answers ONLY — no model
  // extraction from the generated report text. Otherwise derive from the user's
  // own message (+ report text as a DERIVED_LEGACY fallback).
  // When RAW 6Q is active, the report text is NEVER used to backfill facts
  // (RAW_6Q_LATEST_SET_ONLY case E: a gap in the latest set stays a gap — the
  // user's own CURRENT message may still supply it, nothing else).
  const textPool = (hasRaw ? '' : reportText + '\n') + message
  const rawOcc = hasRaw ? firstToken(raw6Q.job, OCCUPATION_TOKENS) : ''
  let occupation = rawOcc || firstToken(textPool, OCCUPATION_TOKENS)
  if (!occupation && profile && typeof profile.occupation === 'string') occupation = clean(profile.occupation)
  const rawIncomeNum = hasRaw ? parseInt(raw6Q.income, 10) : NaN
  const repIncome = hasRaw ? null : extractIncome(reportText)
  const income = Number.isFinite(rawIncomeNum) ? rawIncomeNum : (repIncome != null ? repIncome : extractIncome(message))
  const rawAgeNum = hasRaw ? parseInt(raw6Q.age, 10) : NaN
  const repAge = hasRaw ? null : extractAge(reportText)
  const age = Number.isFinite(rawAgeNum) ? rawAgeNum : (repAge != null ? repAge : extractAge(message))
  const rawEdu = hasRaw ? firstToken(raw6Q.education, EDUCATION_TOKENS) : ''
  const education = rawEdu || (hasRaw ? extractEducation(message) : (extractEducation(reportText) || extractEducation(message)))

  if (occupation) evidenceMap.occupation = rawOcc ? 'RAW_6Q' : ((!hasRaw && reportText.includes(occupation)) ? 'DERIVED_LEGACY' : 'CURRENT_USER_MESSAGE')
  else missingFields.push('occupation')
  if (income != null) evidenceMap.income = Number.isFinite(rawIncomeNum) ? 'RAW_6Q' : (repIncome != null ? 'DERIVED_LEGACY' : 'CURRENT_USER_MESSAGE')
  else missingFields.push('income')
  if (age != null) evidenceMap.age = Number.isFinite(rawAgeNum) ? 'RAW_6Q' : (repAge != null ? 'DERIVED_LEGACY' : 'CURRENT_USER_MESSAGE')
  else missingFields.push('age')
  if (education) evidenceMap.education = rawEdu ? 'RAW_6Q' : ((!hasRaw && extractEducation(reportText)) ? 'DERIVED_LEGACY' : 'CURRENT_USER_MESSAGE')
  else missingFields.push('education')
  if (hasRaw && !raw6Q.anxiety) missingFields.push('anxiety')
  if (hasRaw && !raw6Q.rootCause) missingFields.push('rootCause')

  // skills / capital are NEVER invented — absent unless the message states them.
  const skills = []
  const capital = { amount: null, level: null, known: false }
  missingFields.push('skills')
  missingFields.push('capital')

  const explicitProfile = {
    occupation: occupation || null,
    income: income != null ? income : null,
    age: age != null ? age : null,
    education: education || null,
    anxiety: hasRaw ? (raw6Q.anxiety || null) : null,
    rootCause: hasRaw ? (raw6Q.rootCause || null) : null,
    skills,
    capital,
    goal: (profile && profile.currentFocus && profile.currentFocus.goalText && profile.currentFocus.goalText.value) || null,
  }

  // ── L1b cognitive profile ──
  let profileEvidence = null
  if (profile) {
    const dims = {}
    for (const k of Object.keys(DIMENSION_LABELS)) if (typeof profile[k] === 'number') dims[k] = profile[k]
    const ds = (profile.diagnosticState && profile.diagnosticState.diagnosisState && profile.diagnosticState.diagnosisState.value) || null
    const assetState = (profile.diagnosticState && profile.diagnosticState.assetState && profile.diagnosticState.assetState.value) || null
    profileEvidence = {
      mainTypeLabel: typeLabel(profile.mainType),
      mainType: profile.mainType || null,
      wealthPotentialScore: typeof profile.wealthPotentialScore === 'number' ? profile.wealthPotentialScore : null,
      turnaroundProbability: typeof profile.turnaroundProbability === 'number' ? profile.turnaroundProbability : null,
      diagnosisState: ds,
      assetState,
      weakDimensions: resolveWeakDimensions(dims, 3),
      dimensions: dims,
    }
    evidenceMap.profile = 'PROFILE'
  }

  // ── L2 challenge evidence ──
  let challengeEvidence = null
  if (challenge) {
    const rs = challenge.rawScores || {}
    const finalType = challenge.finalType || (challenge.result && challenge.result.finalType) || null
    challengeEvidence = {
      recordId: clean(challenge.recordId),
      finalType: finalType || null,
      finalTypeLabel: finalType ? typeLabel(finalType) : null,
      cv: typeof rs.cv === 'number' ? rs.cv : null,
      weakDimensions: resolveWeakDimensions(rs, 3),
    }
    evidenceMap.challenge = 'CHALLENGE'
  }

  // ── L3 report evidence ──
  let reportEvidence = null
  if (sixq && sixq.reportId) {
    reportEvidence = { reportId: clean(sixq.reportId), reportType: SIXQ_DOMAIN, diagnosticVersion: SIXQ_VERSION }
    evidenceMap.report = 'REPORT'
  }

  // ── L4 memories (gated) ──
  let memories = []
  if (memoryEnabled) {
    memories = Array.isArray(r.memories) ? r.memories : []
    if (memories.length) evidenceMap.memories = 'MEMORY'
  } else {
    evidenceMap.memories = 'MEMORY_DISABLED'
  }

  if (message) evidenceMap.currentUserMessage = 'CURRENT_USER_MESSAGE'

  return {
    scenario,
    scenarioName: (SCENARIOS[scenario] && SCENARIOS[scenario].name) || SCENARIOS.ask.name,
    message,
    explicitProfile,
    sixQ,
    raw6Q,
    sixQSource,
    // active-set version output (RAW_6Q_LATEST_SET_ONLY)
    activeSixQRecordId: hasRaw ? (clean(rawDoc.sixQRecordId) || clean(rawDoc.rawId) || null) : null,
    activeSixQVersion: hasRaw ? (clean(rawDoc.sixQVersion) || clean(rawDoc.diagnosticVersion) || SIXQ_VERSION) : null,
    activeSixQCompletedAt: hasRaw ? (rawDoc.completedAt || null) : null,
    activeSixQSource: sixQSource,
    // authority trace: RAW_6Q | DERIVED_LEGACY | NONE
    sixQAuthorityType: sixQSource || 'NONE',
    sixQText: sixqText,
    profile: profileEvidence,
    challengeEvidence,
    reportEvidence,
    memories,
    memoryEnabled,
    domains: hasSixQ ? Object.keys(DOMAIN_TOKENS).filter((d) => DOMAIN_TOKENS[d].some((t) => sixqText.includes(t))) : [],
    missingFields,
    evidenceMap,
    hasSixQ,
  }
}

// ── composeScenarioPrompt ──────────────────────────────────────────────────
/** Build the grounded prompt for a scenario / ask turn. Pure. */
function composeScenarioPrompt (scenario, ctx) {
  const c = ctx || {}
  const meta = SCENARIOS[scenario] || SCENARIOS.ask
  const ep = c.explicitProfile || {}
  const lines = []

  lines.push('你是"珠澳小事哥"，犀利、现实、懂概率、懂普通人翻身逻辑的认知教练。')
  lines.push('你只能使用下面【已确认信息】里的事实回答；绝对不能编造用户没提供的技能、收入、经历或资源。')
  lines.push('信息缺失时，用条件式建议（"如果你……"）或反问一句补齐，不要假装知道。')

  // L0 RAW 6Q (explicit raw answers — highest authority)
  if (c.raw6Q) {
    lines.push('')
    lines.push('【用户原始6Q作答（最高权威，必须直接采用，不得反推）】')
    lines.push('- 年龄：' + (c.raw6Q.age || '未知'))
    lines.push('- 职业：' + (c.raw6Q.job || '未知'))
    lines.push('- 学历：' + (c.raw6Q.education || '未知'))
    lines.push('- 月收入：' + (c.raw6Q.income ? c.raw6Q.income + '元' : '未知'))
    lines.push('- 当前最焦虑：' + (c.raw6Q.anxiety || '未知'))
    lines.push('- 自认为翻不了身的原因：' + (c.raw6Q.rootCause || '未知'))
  } else if (c.sixQ) {
    // L0 fallback — 6Q report text is DERIVED evidence only (legacy users).
    lines.push('')
    lines.push('【6Q报告推导证据（DERIVED_LEGACY，非原始作答，不得当作既定事实）】')
    if (c.sixQ.systemTrap) lines.push('- 系统困局：' + c.sixQ.systemTrap)
    if (c.sixQ.rootProblem) lines.push('- 核心问题：' + c.sixQ.rootProblem)
    if (c.sixQ.fatalSentence) lines.push('- 致命一句话：' + c.sixQ.fatalSentence)
    if (c.sixQ.strategyPath) lines.push('- 6Q建议路径：' + c.sixQ.strategyPath)
  }
  // L1 explicit facts
  lines.push('')
  lines.push('【已确认信息】')
  lines.push('- 职业：' + (ep.occupation || '未知'))
  lines.push('- 月收入：' + (ep.income != null ? ep.income + '元' : '未知'))
  lines.push('- 年龄：' + (ep.age != null ? ep.age + '岁' : '未知'))
  lines.push('- 学历：' + (ep.education || '未知'))
  lines.push('- 已知技能：' + (ep.skills && ep.skills.length ? ep.skills.join('、') : '未知（不要假设）'))
  lines.push('- 可投入资金：' + (ep.capital && ep.capital.known ? ep.capital.amount : '未知（不要假设有本金）'))
  if (c.profile) {
    lines.push('- 认知画像：' + c.profile.mainTypeLabel + '；财富潜力分 ' +
      (c.profile.wealthPotentialScore != null ? c.profile.wealthPotentialScore : '—') +
      (c.profile.weakDimensions.length ? '；薄弱维度：' + c.profile.weakDimensions.map((d) => d.label).join('、') : ''))
  } else {
    lines.push('- 认知画像：未知')
  }
  // L2 challenge
  if (c.challengeEvidence) {
    lines.push('- 挑战表现：' + (c.challengeEvidence.finalTypeLabel || '—'))
  }
  // L4 memory (only when enabled)
  if (c.memoryEnabled && c.memories && c.memories.length) {
    lines.push('')
    lines.push('【长期记忆（次要，不得覆盖6Q事实）】')
    for (const m of c.memories) lines.push('- ' + m.content)
  }

  lines.push('')
  lines.push('【场景】' + meta.name)
  const mustRules = {
    career: '必须结合职业、收入、学历和明确的职场问题回答。',
    money_logic: '必须结合收入、职业和明确目标回答；禁止承诺必赚收入或给出无依据的投资回报。',
    side_hustle: '必须结合职业和已知技能回答；优先"邻近可迁移技能"；资金/时间未知时不得默认有本金，给低成本方案。',
    ai_track: 'AI 先增强用户现有职业，不默认让用户转程序员；非数字职业禁止推荐编程/开发转行路线。',
    cognition: '必须结合6Q核心问题、挑战行为与世界模型弱点回答。',
    traffic: '必须结合职业/领域、产品或服务和已知内容能力回答；禁止泛泛的"做短视频""每天发3条"。',
    ask: '基于用户真实现实回答，不要反复说"根据你的6Q"。',
  }
  if (mustRules[scenario]) lines.push(mustRules[scenario])

  lines.push('')
  // RC8_10A2 (stage C) — 直接问小事哥 is free-form chat: use a LIGHT reply
  // structure (not the heavy five-part report scaffold the six scenarios use).
  if (scenario === 'ask') {
    lines.push('【输出结构】用一个自然段直接回答用户问题：先给结论/判断，再给一句依据（可引用用户自己的事实），必要时最后给一条可执行建议。不要套用固定报告标题，不要长篇大论。')
  } else {
    lines.push('【输出结构】当前判断 / 为什么 / 最适合你的方向 / 不建议你做什么 / 7天可执行动作')
  }
  if (c.missingFields && c.missingFields.length) {
    lines.push('缺失信息（需用条件式或反问处理）：' + c.missingFields.join('、'))
  }
  const systemPrompt = lines.join('\n')
  const userMessage = (c.scenario && c.scenario !== 'ask')
    ? ('请针对「' + meta.name + '」给出深度认知分析。\n话题：' + (c.message || meta.name))
    : (c.message || '请给我一句建议。')
  return { systemPrompt, userMessage, scenario: meta.key, scenarioName: meta.name }
}

// ── validator ──────────────────────────────────────────────────────────────
const BANNED_DIGITAL_CAREER = ['java', 'kubernetes', 'k8s', '全栈', '后端', '前端开发', '算法工程师', '转码', '学编程', '程序员']
const CAPITAL_HEAVY = ['加盟', '开店', '租店面', '囤货', '进货', '买设备', '投资', '入股', '盘店', '开公司']
const NEGATION = ['不建议', '不要', '别', '勿', '避免', '无需', '没必要', '不推荐', '不建议你', '不适合', '不鼓励']
const CONDITIONAL = ['如果', '若', '假如', '当你有', '一旦有']

function includesAny (text, arr) {
  const t = String(text || '').toLowerCase()
  return arr.some((x) => t.includes(x))
}

/**
 * True when any term appears as a POSITIVE (non-negated, non-conditional)
 * mention. A term inside a negation / conditional window does NOT count —
 * "不建议你转 Java" must never trip the programming-career guard.
 */
function mentionsRecommended (text, arr) {
  const t = String(text || '').toLowerCase()
  for (const x of arr) {
    let idx = t.indexOf(x)
    while (idx !== -1) {
      const win = t.slice(Math.max(0, idx - 8), idx)
      if (!NEGATION.some((n) => win.includes(n)) && !CONDITIONAL.some((c) => win.includes(c))) return true
      idx = t.indexOf(x, idx + 1)
    }
  }
  return false
}

/** Does the response reference the user's own words (>=4-char overlap)? */
function overlapsUserText (text, userText) {
  const t = String(text || '')
  const u = String(userText || '')
  for (let i = 0; i + 4 <= u.length; i++) {
    const gram = u.slice(i, i + 4)
    if (gram.trim().length >= 3 && t.includes(gram)) return true
  }
  return false
}

/**
 * Deterministic scenario response validator. Pure.
 * @returns {{ok:boolean, errors:string[]}}
 */
function validateScenarioResponse (text, ctx) {
  const errors = []
  const t = clean(text)
  const c = ctx || {}
  const ep = c.explicitProfile || {}
  const scenario = c.scenario || 'ask'

  if (!t) return { ok: false, errors: ['GENERIC_NO_USER_EVIDENCE'] }

  // 1. generic-only answer — must reference the user's own reality.
  const userText = (c.sixQText || '') + '。' + (c.message || '')
  const factTokens = []
  if (ep.occupation) factTokens.push(ep.occupation)
  if (ep.income != null) factTokens.push(String(ep.income))
  if (ep.education) factTokens.push(ep.education)
  if (ep.age != null) factTokens.push(String(ep.age))
  // Any occupation / education / number the USER actually stated (6Q or message).
  for (const tok of OCCUPATION_TOKENS) if (userText.includes(tok)) factTokens.push(tok)
  for (const tok of EDUCATION_TOKENS) if (userText.includes(tok)) factTokens.push(tok)
  const nums = userText.match(/\d{2,7}/g)
  if (nums) for (const x of nums) factTokens.push(x)
  const directFact = factTokens.some((tok) => tok && t.includes(tok))
  if (!directFact && !overlapsUserText(t, userText)) errors.push('GENERIC_NO_USER_EVIDENCE')

  // 2. unrelated occupation advice — a NON-digital occupation pushed a
  //    programming / software-engineering career as a POSITIVE recommendation.
  if (ep.occupation && !DIGITAL_TOKENS.some((d) => ep.occupation.includes(d))) {
    if (mentionsRecommended(t, BANNED_DIGITAL_CAREER)) errors.push('UNRELATED_OCCUPATION_ADVICE')
  }

  // 3. unsupported skill assumption — asserts a skill while skills unknown.
  if ((!ep.skills || !ep.skills.length) && /你(?:会|的|具备|已掌握|有)[^。；\n]{0,10}(?:技能|能力|经验|专业)/.test(t)) {
    if (!CONDITIONAL.some((k) => t.includes(k)) && !/未知|不确定/.test(t)) errors.push('UNSUPPORTED_SKILL_ASSUMPTION')
  }

  // 4. unsupported capital assumption — capital-heavy plan while capital unknown.
  if ((!ep.capital || !ep.capital.known) && mentionsRecommended(t, CAPITAL_HEAVY)) {
    errors.push('UNSUPPORTED_CAPITAL_ASSUMPTION')
  }

  // 5. guaranteed income (money_logic).
  if (scenario === 'money_logic' && /保证.{0,4}(?:赚|盈利|收入)|稳赚|月入过万|一定.{0,4}赚/.test(t)) {
    errors.push('UNSUPPORTED_CAPITAL_ASSUMPTION')
  }

  return { ok: errors.length === 0, errors }
}

// ── async loader ───────────────────────────────────────────────────────────
/**
 * Load + assemble the context for the authenticated openid.
 * DB access is scoped to `openid` (server-derived) ONLY.
 * @param {object} db
 * @param {string} openid
 * @param {object} opts { scenario, message, memoryEnabled, memoryEngine }
 * @returns {Promise<object>}
 */
async function buildUserContext (db, openid, opts) {
  const o = opts || {}
  const scenario = o.scenario || 'ask'
  const memoryEnabled = o.memoryEnabled !== false

  let profile = null, sixqReport = null, raw6qReport = null, challengeRecord = null, memories = []
  try {
    const pr = await db.collection('user_profiles').where({ openid }).limit(1).get()
    profile = (pr.data && pr.data[0]) || null
  } catch (_) { profile = null }
  try {
    // L0 RAW 6Q — LATEST_COMPLETED_SET_ONLY (strict; never merges old sets).
    // PRIMARY completedAt DESC, SECONDARY createdAt DESC, TERTIARY sixQVersion DESC.
    const rr = await db.collection(RAW6Q_COLLECTION)
      .where({ openid, status: 'completed' })
      .get()
    const docs = (rr.data || []).slice().sort((a, b) =>
      ((b.completedAt || 0) - (a.completedAt || 0)) ||
      ((b.createdAt || 0) - (a.createdAt || 0)) ||
      String(b.sixQVersion || '').localeCompare(String(a.sixQVersion || '')))
    raw6qReport = docs[0] || null
  } catch (_) { raw6qReport = null }
  try {
    const sr = await db.collection('ai_reports')
      .where({ openid, reportType: SIXQ_DOMAIN })
      .orderBy('createdAt', 'desc').limit(1).get()
    sixqReport = (sr.data && sr.data[0]) || null
  } catch (_) { sixqReport = null }
  try {
    const cr = await db.collection('challenge_records')
      .where({ openid, status: 'finished' })
      .orderBy('createdAt', 'desc').limit(1).get()
    challengeRecord = (cr.data && cr.data[0]) || null
  } catch (_) { challengeRecord = null }

  if (memoryEnabled) {
    if (Array.isArray(o.memories)) memories = o.memories
    else if (o.memoryEngine && typeof o.memoryEngine.getRelevantMemories === 'function') {
      try { memories = await o.memoryEngine.getRelevantMemories(openid, openid, scenario, { limit: 8 }) } catch (_) { memories = [] }
    }
  }

  return assembleUserContext({
    openid, scenario, message: o.message,
    profile, sixqReport, raw6q: raw6qReport, challengeRecord, memories, memoryEnabled,
  })
}

module.exports = {
  SCENARIOS, SCENARIO_NAME_TO_KEY, DOMAIN_TOKENS, DIMENSION_LABELS, RAW6Q_TYPE, RAW6Q_FIELDS,
  WORLD_MODEL_TYPE_LABELS, WORLD_MODEL_TYPE_FALLBACK,
  assembleUserContext, composeScenarioPrompt, validateScenarioResponse,
  buildUserContext, typeLabel,
  _internal: { extractIncome, extractAge, extractEducation, firstToken },
}
