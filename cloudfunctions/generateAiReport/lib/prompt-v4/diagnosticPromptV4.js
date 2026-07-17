/**
 * prompt-v4/diagnosticPromptV4.js (v3.1)
 *
 * V4 System Prompt + User Prompt + Persona Summary 生成。
 *
 * v2.0: 从 "认知审判书文字主笔（翻译工）" 升级为 "世界运行规则解释者（叙事者）"
 * v3.1: 新增 buildPersonaSummary() — AI 先理解"这是一个什么样的人"，再生成报告
 *
 * 判断已完成。AI 无权改变 Engine 结论。
 * 但 AI 有权用世界观框架翻译数据和规则，
 * 而不是照搬 Mapper 的预设模板。
 */

const {
  FATAL_ONE_LINER_RULES,
  SYSTEM_GAP_RULES,
  ACTION_PLAN_RULES,
  FINAL_STRIKE_RULES,
  GLOBAL_FORBIDDEN,
  HEADLINE_WORLDVIEW_ANCHORS,
} = require('./writingRulesV4')

// ═══════════════════════════════════════════════════════════════
// System Prompt (v2.0)
// ═══════════════════════════════════════════════════════════════

function buildSystemPrompt() {
  return `你是"世界运行规则解释者"。你把规则指给人看，不给人建议。

# 世界观
财富由规则驱动，而非努力。大多数困境来自没看清自己活在什么规则里。

四阶段框架：
1. 看清系统 — 你活在什么规则里，规则对谁有利
2. 寻找杠杆 — 你的时间/技能/注意力，哪一点可被放大
3. 建立系统 — 从出卖时间转向建设资产，让系统替你工作
4. 长期复利 — 系统建成后，时间就是你的朋友

规则链：打工（时间换钱，天花板固定）→ 技能经营（有定价权但仍在出卖劳动）→ 生产效率（一份成果卖多人）→ 资产拥有（别人的劳动为你创造价值）→ 系统建设（自动运行）

# 铁律
1. 不得修改任何数字、分数、概率、规则ID、weight、recommend
2. 不得推荐 engine 标记为 not_recommended 的路径
3. 不得编造用户未回答的经历、收入、资产、家庭信息
4. 不得承诺收益或确定性
5. 不得输出鸡汤或空洞鼓励
6. 每个判断必须对应 lockedFacts 中的证据或规则
7. 语言可锋利但不得羞辱人格；不得归因于"不够努力"或"心态不好"
8. 只输出严格JSON，不得输出Markdown、解释文字、前后缀、代码围栏
9. 只输出 writable schema 允许的字段

# 禁用语
${GLOBAL_FORBIDDEN.slice(0, 10).map(s => `- "${s}"`).join('\n')}
- 以及一切"建议/鼓励/加油/未来可期"类表达

# 写作规则

## headline
- title: ${FATAL_ONE_LINER_RULES.minChars}-${FATAL_ONE_LINER_RULES.maxChars}字，表达用户当前 wealthStage 下的核心结构性问题
- subtitle: 不超过100字，补全语境
- 参考 wealthStage 锚点：
${Object.entries(HEADLINE_WORLDVIEW_ANCHORS).map(([stage, insight]) => `  ${stage}: ${insight}`).join('\n')}
- 禁止：${FATAL_ONE_LINER_RULES.forbiddenPatterns.slice(0,5).join(' / ')}

## fatalDiagnosis
- mainProblem/reason: ${SYSTEM_GAP_RULES.minChars}-${SYSTEM_GAP_RULES.maxChars}字，格式：现象 → 机制 → 后果

## fatalRules / advantageRules / opportunityRules
- ruleId/area 必须匹配 lockedFacts
- title: 用锋利中文重表达
- description/why: 结合 userContext 数据

## wealthPathReasons
- 每条 ≤80字，基于 lockedFacts.wealthPathStatus 的 recommend/score
- not_recommended 路径写真实代价

## actionPlan
- day1/day3/day7/day15/day30，每项含 goal、tasks[]、checkpoint
- 每项必须可观察/可完成/有数量/有时间边界
- 禁止：打造个人品牌 / 提升认知 / 持续学习 / 建立人脉 / 赋能 / 抓手 / 闭环
- 正确格式：${ACTION_PLAN_RULES.example}

## stopDoingItems
- 直接告诉用户必须停掉什么，每条对应一个致命规则
- 动词开头：停止/退出/注销/删除

## identityUpgrade
- 所有 identity 必须匹配 lockedFacts
- currentIdentity/targetIdentity: 用短语表达阶段本质
- gap: 用分数差距说明
- upgradePath: 完整的5阶段升级路径

## finalStrike
- ${FINAL_STRIKE_RULES.minChars}-${FINAL_STRIKE_RULES.maxChars}字，一次认知暴击
- 用于海报传播，读者愿意截图转发
- 禁止：一定赚钱/年入百万/财富自由/月入过万

# 输出格式
只输出一个JSON对象，结构：headline, fatalDiagnosis, fatalRules[], advantageRules[], opportunityRules[], wealthPathReasons{}, actionPlan{day1,day3,day7,day15,day30}, stopDoingItems[], identityUpgrade{currentIdentity,targetIdentity,gap,upgradePath}, finalStrike{sentence,shareTitle}

记住：不说教。不鼓励。不分析。只照亮盲区。`
}

// ═══════════════════════════════════════════════════════════════
// Persona Summary (v3.1)
// ═══════════════════════════════════════════════════════════════

/**
 * 从 Engine 原始输出构建一段自然语言人物画像。
 * 只使用 Engine 已计算的数据，不访问 Mapper/Contract/Guard。
 * 插入到 User Prompt 最前面，让 AI 先理解"这个人是谁"，再生成报告。
 *
 * @param {Object} engineResult — turnaroundEngineV4.analyze() 输出
 * @returns {string} 自然语言 persona summary
 */

const EARNINGS_LABELS = {
  pure_time:          '出卖时间（无定价权）',
  skill_unpriced:     '出售技能（未定价）',
  skill_validated:    '出售技能（已验证，但仍是按交付计价）',
  system_proto:       '系统雏形（有业务但仍需亲自运转）',
  no_income:          '暂无稳定收入',
  content_attention:  '出售内容与注意力，尚未形成稳定商业系统',
  insufficient:       '现有信息不足，暂不做强判断',
}

const SURVIVAL_LABELS = {
  critical:  '现金流紧绷，一次意外就可能触发债务螺旋',
  fragile:   '结构脆弱，有收入但不稳',
  stable:    '基础稳固，能扛风险',
  growing:   '加速区间，可承受试错成本',
  free:      '自由区间，时间和资产都在为你工作',
  default:   '徘徊区，尚未做出决定性动作',
}

// ── 内容/流量/创作者语义检测 ──
const CONTENT_SEMANTIC_HINTS = [
  '内容', '自媒体', '短视频', '公众号', '主播', '博主', '创作者', '流量', '粉丝', '账号', '知识付费',
  '写作', '视频', '拍摄', '剪辑', '直播', '文案', '营销', '运营',
]

function _hasContentSemantic(engineResult) {
  const haystack = [
    (engineResult.normalizedProfile?.monetizableSkillRaw?.raw || ''),
    (engineResult.normalizedProfile?.occupationDetailRaw?.raw || ''),
    (engineResult.normalizedProfile?.skillValidationRaw?.raw || ''),
    (engineResult.answers?.monetizableSkill || ''),
    (engineResult.answers?.occupationDetail || ''),
    (engineResult.answers?.skillValidation || ''),
    (engineResult.userContext?.monetizableSkill || ''),
    (engineResult.userContext?.occupationDetail || ''),
  ].join(' ')
  return CONTENT_SEMANTIC_HINTS.some(hint => haystack.includes(hint))
}

function _hasStableClients(engineResult) {
  const haystack = [
    (engineResult.normalizedProfile?.skillValidationRaw?.raw || ''),
    (engineResult.answers?.skillValidation || ''),
    (engineResult.userContext?.skillValidation || ''),
  ].join(' ')
  return haystack.includes('稳定客户') || haystack.includes('长期合作')
}

function _isFreelance(engineResult) {
  const haystack = [
    (engineResult.normalizedProfile?.incomeStructureRaw?.raw || ''),
    (engineResult.answers?.incomeStructure || ''),
    (engineResult.userContext?.incomeStructure || ''),
  ].join(' ')
  return haystack.includes('自由职业') || haystack.includes('不稳定收入') || haystack.includes('个体')
}

function _hasNoIncome(engineResult) {
  const haystack = [
    (engineResult.normalizedProfile?.incomeStructureRaw?.raw || ''),
    (engineResult.answers?.incomeStructure || ''),
    (engineResult.userContext?.incomeStructure || ''),
  ].join(' ')
  return haystack.includes('暂时没有收入') || haystack.includes('暂时无收入') || haystack.includes('没有收入')
}

function buildPersonaSummary(engineResult) {
  const np = engineResult.normalizedProfile || {}
  const scores = engineResult.scores || {}
  const fatalCount = (engineResult.fatalRules || []).length

  const earningsModel = inferEarningsModel(engineResult)
  const survival = inferSurvival(engineResult)
  const misjudgment = inferBiggestMisjudgment(engineResult)
  const leverage = inferBiggestLeverage(engineResult)
  const danger = inferMostDangerousPath(engineResult)
  const bestBet = inferBestDirection(engineResult)

  return `STATUS    ${survival}
MODE      ${earningsModel}
MISTAKE   ${misjudgment}
LEVER     ${leverage}
DANGER    ${danger}
BET       ${bestBet}`
}

function inferEarningsModel(engineResult) {
  const np = engineResult.normalizedProfile || {}
  const incomeLevel = np.incomeStructureRaw?.level || ''
  const skillLevel = np.monetizableSkillRaw?.level || ''
  const svLevel = np.skillValidationRaw?.level || ''
  const execLevel = np.executionStabilityRaw?.level || ''

  // 无收入优先
  if (_hasNoIncome(engineResult)) return EARNINGS_LABELS.no_income

  // Engine level 已识别 — 优先（包含 technical/content等）
  if (incomeLevel === 'skill_service' || skillLevel === 'technical' || skillLevel === 'content') {
    if (svLevel === 'market_validated' || svLevel === 'stable_clients' || _hasStableClients(engineResult)) {
      return EARNINGS_LABELS.skill_validated
    }
    return EARNINGS_LABELS.skill_unpriced
  }

  // Engine 已精确匹配
  if (svLevel === 'stable_clients' && execLevel === 'stable') {
    return EARNINGS_LABELS.skill_validated
  }

  // 内容/流量语义兜底 — 仅在 Engine level 未识别时使用
  if (_hasContentSemantic(engineResult)) {
    if (_hasStableClients(engineResult)) return EARNINGS_LABELS.skill_validated
    return EARNINGS_LABELS.content_attention
  }

  if (_isFreelance(engineResult)) return EARNINGS_LABELS.system_proto

  // 技能 unknown 但 raw 包含具体技能名
  const rawSkill = np.monetizableSkillRaw?.raw || ''
  if (skillLevel === 'unknown' && rawSkill && rawSkill !== '无特定变现技能') {
    const rawSV = np.skillValidationRaw?.raw || ''
    if (rawSV.includes('偶尔有') || rawSV.includes('曾有')) return EARNINGS_LABELS.skill_unpriced
    return EARNINGS_LABELS.pure_time
  }

  return EARNINGS_LABELS.pure_time
}

function inferSurvival(engineResult) {
  const scores = engineResult.scores || {}
  const fatalCount = (engineResult.fatalRules || []).length
  const cashflow = scores.cashflow || 50
  const overall = scores.overall || 50

  if (fatalCount >= 4 || cashflow <= 15) return SURVIVAL_LABELS.critical
  if (fatalCount >= 2 && cashflow <= 30) return SURVIVAL_LABELS.fragile
  if (overall >= 80 && fatalCount <= 1) return SURVIVAL_LABELS.free
  if (overall >= 65) return SURVIVAL_LABELS.growing
  if (fatalCount <= 1 && cashflow >= 50) return SURVIVAL_LABELS.stable
  return SURVIVAL_LABELS.default
}

function inferBiggestMisjudgment(engineResult) {
  const scores = engineResult.scores || {}
  const fatalRules = engineResult.fatalRules || []
  const np = engineResult.normalizedProfile || {}
  const execLevel = np.executionStabilityRaw?.level || ''

  // 技能强 + 现金流弱
  if (scores.skill >= 65 && scores.cashflow <= 35) {
    return '误判：认为技能好就够了。技能不经过获客和成交，不会自动变成现金流'
  }
  // 执行弱 + 现金流弱
  if (execLevel === 'unstable' || scores.execution <= 30) {
    if (scores.cashflow <= 35) return '误判：认为需要再学一个技能。你的瓶颈不是知识，是你从未完成过一次付费验证'
    return '误判：认为需要更多准备。你已经准备好了，缺乏的不是信息而是行动'
  }
  // 安全垫极弱
  const safetyLevel = np.safetyMonthsRaw?.level || ''
  if ((safetyLevel === 'critical' || safetyLevel === 'very_low') && execLevel === 'stable') {
    return '误判：低估了安全垫的作用。你的执行力够强，但一次意外就能把你打回原点'
  }
  // fatal 多
  if (fatalRules.length >= 3) {
    return '误判：把系统性风险当成单个问题。你的困境不是某一个点出了问题，是规则本身对你不利'
  }
  // 自由职业/无收入：不映射到工资安全性
  if (_isFreelance(engineResult)) {
    if (_hasContentSemantic(engineResult) && scores.cashflow >= 50) {
      return '误判：把流量当成商业模式。注意力只有接入产品和成交系统，才会变成现金流'
    }
    return '误判：把接到订单当成拥有系统。订单来自临时机会，不等于稳定获客能力'
  }
  if (_hasNoIncome(engineResult)) {
    return '误判：把等待机会当成准备。当前最重要的不是选择更多，而是先验证一项可成交能力'
  }
  // 无工资但有其他证据：降级
  if (engineResult.normalizedProfile?.incomeStructureRaw?.raw === '自由职业/不稳定收入') {
    return '误判：把接到订单当成拥有系统。订单来自临时机会，不等于稳定获客能力'
  }
  return '误判：把稳定当成安全。单一收入来源本身就是最大的风险'
}

function inferBiggestLeverage(engineResult) {
  const scores = engineResult.scores || {}
  const advRules = engineResult.advantageRules || []
  const np = engineResult.normalizedProfile || {}
  const advTitles = advRules.map(r => (r.output?.title || ''))
  const allTitles = advTitles.join(' ')

  const levers = []
  const skillLevel = np.monetizableSkillRaw?.level || ''
  const timeLevel = np.weeklyTimeRaw?.level || ''

  // 技能：engine level 或 语义检测
  if (scores.skill >= 70 || skillLevel === 'technical' || skillLevel === 'content') {
    levers.push({ name: '技能可产品化', score: scores.skill, why: '你的能力是稀缺资产，只需把它包装成可出售的产品' })
  } else if (_hasContentSemantic(engineResult)) {
    levers.push({ name: '内容能力', score: Math.max(scores.skill, scores.time), why: '你的内容创作能力是杠杆，需要被人看见' })
  }
  if (timeLevel === 'high' || timeLevel === 'moderate') {
    levers.push({ name: '时间盈余', score: scores.time, why: '有可用时间投入新方向，这是多数人没有的资源' })
  }
  if (scores.execution >= 60) {
    levers.push({ name: '执行稳定性', score: scores.execution, why: '你能坚持，这是从0到1最稀缺的品质' })
  }
  if (allTitles.includes('市场') || allTitles.includes('客户') || allTitles.includes('付费') || _hasStableClients(engineResult)) {
    levers.push({ name: '已有市场信号', score: 60, why: '有人愿为你的能力付费，你已跳过最难的验证阶段' })
  }

  levers.sort((a, b) => b.score - a.score)
  const top = levers[0]
  if (top) return `${top.name}（${top.score}/100）— ${top.why}`
  return '待激活，优势尚未达临界值，需集中一个点'
}

function inferMostDangerousPath(engineResult) {
  const scores = engineResult.scores || {}
  const np = engineResult.normalizedProfile || {}
  const cashflow = scores.cashflow || 50
  const risk = scores.risk || 50
  const safetyLevel = np.safetyMonthsRaw?.level || ''
  const debtLevel = np.debtPressureRaw?.level || ''

  const dangerPaths = []

  // 高负债 → 首先生存
  if (debtLevel === 'high' || debtLevel === 'consumer') {
    dangerPaths.push({ name: '任何需要前期投入的方向', why: '高息债务下每一分钱剩余都应先消灭利息' })
  }
  // 安全垫极端弱 + 投资
  if ((safetyLevel === 'critical' || safetyLevel === 'very_low') && cashflow <= 35) {
    dangerPaths.push({ name: '投资/交易', why: '储蓄不足时投资等于用必需生活费赌概率' })
  }
  // 现金流弱 + 创业
  if (cashflow <= 30 && risk <= 40) {
    dangerPaths.push({ name: '创业', why: '现金流紧绷时创业大概率把所有退路一次性烧掉' })
  }

  if (dangerPaths.length > 0) {
    dangerPaths.sort((a, b) => a.why.length - b.why.length)
    const top = dangerPaths[0]
    return `${top.name} — ${top.why}`
  }

  // 无致命危险路径时，基于执行力和验证状态降级
  const execLevel = np.executionStabilityRaw?.level || ''
  if (execLevel === 'unstable') {
    return '方向过多、无法聚焦 — 执行不稳定时分散精力等于把所有方向都做失败'
  }
  // 有工资 + 无市场验证 → 裸辞
  if (!_isFreelance(engineResult) && !_hasNoIncome(engineResult) && !_hasStableClients(engineResult)) {
    return '裸辞转型 — 无市场验证前放弃唯一收入来源，风险极高'
  }
  return '方向选择过多 — 需聚焦一条可验证路径'
}

function inferBestDirection(engineResult) {
  const scores = engineResult.scores || {}
  const np = engineResult.normalizedProfile || {}
  const skillLevel = np.monetizableSkillRaw?.level || ''
  const svLevel = np.skillValidationRaw?.level || ''
  const execLevel = np.executionStabilityRaw?.level || ''
  const safetyLevel = np.safetyMonthsRaw?.level || ''
  const debtLevel = np.debtPressureRaw?.level || ''
  const cashflow = scores.cashflow || 50

  // 高负债：优先现金流修复
  if (debtLevel === 'high' || debtLevel === 'consumer') {
    return '止血与现金流修复 — 先消灭高息债务，再谈进攻'
  }

  // 市场已验证 + 执行稳定
  if ((svLevel === 'market_validated' || svLevel === 'stable_clients' || _hasStableClients(engineResult)) && execLevel === 'stable') {
    return '产品化已验证的付费服务 — 把一对一时薪交付变成可复制的产品'
  }

  // 职业语义检测（Engine level 未识别时）
  if (skillLevel === 'content') {
    const timeLevel = np.weeklyTimeRaw?.level || ''
    if (timeLevel === 'high' || timeLevel === 'moderate') {
      return '密集输出内容 — 你的内容能力是杠杆，需要被人看见'
    }
  }

  // 内容/流量语义兜底检测
  if (_hasContentSemantic(engineResult)) {
    if (_hasStableClients(engineResult)) {
      return '产品化与成交闭环 — 你有客户有流量，缺的是把流量接入可复制的产品'
    }
    return '完成第一次付费验证 — 用内容吸引用户，用技能完成第一次成交'
  }

  // Engine level 识别
  if (skillLevel === 'technical' && svLevel !== 'market_validated' && svLevel !== 'stable_clients') {
    return '完成第一次付费验证 — 在平台上挂出你的服务，让别人愿付哪怕99元'
  }
  if (scores.cashflow <= 35 && skillLevel !== 'none') {
    return '用已有技能建立第二条收入线 — 先赚到第一笔副业收入'
  }
  if (skillLevel === 'content' || (np.monetizableSkillRaw?.raw || '').includes('内容')) {
    const timeLevel = np.weeklyTimeRaw?.level || ''
    if (timeLevel === 'high' || timeLevel === 'moderate') {
      return '密集输出内容 — 你的内容能力是杠杆，需要被人看见'
    }
  }
  if (scores.skill >= 65 && scores.execution >= 50) {
    return 'AI赋能路径 — 用AI放大已有能力，降低交付成本'
  }

  // 安全垫不足：建议先防守
  const months = np.safetyMonthsRaw?.value || parseFloat(np.safetyMonthsRaw?.raw) || 0
  if (safetyLevel === 'critical' || safetyLevel === 'very_low' || months < 3) {
    return '先建安全垫 — 现在最重要的不是进攻方向，是你还扛不住一次意外'
  }

  // 安全垫充足 + 有技能但无验证
  const rawSkill = np.monetizableSkillRaw?.raw || ''
  if (rawSkill && rawSkill !== '无特定变现技能' && rawSkill !== 'none') {
    return '先完成一次低成本市场验证 — 用你最擅长的技能，在30天内完成第一次付费交易'
  }

  return '先完成一次低成本市场验证 — 验证你手中最可能变现的一项能力'
}

// ═══════════════════════════════════════════════════════════════
// User Prompt (v3.1)
// ═══════════════════════════════════════════════════════════════

function buildUserPrompt(payload, engineResult) {
  const personaSummary = engineResult ? buildPersonaSummary(engineResult) : ''
  const wAnchor = HEADLINE_WORLDVIEW_ANCHORS[payload.lockedFacts?.wealthStage]

  return `${personaSummary ? `# 这是一位什么样的人

${personaSummary}

` : ''}以下是诊断引擎对一位用户的完整分析。你收到的不是"问题列表"，而是一张世界运行规则在这个具体的人身上的投影。

# 该用户所处的财富阶段
阶段代码：${payload.lockedFacts?.wealthStage || '未知'}
这个阶段的本质：${wAnchor || '数据不足'}

# 用户画像
${JSON.stringify(payload.userContext)}

# 引擎判决
${JSON.stringify(payload.judgment)}

# 锁定事实（不可修改）
${JSON.stringify(payload.lockedFacts)}

# 可写字段
${JSON.stringify(payload.writableSchema)}

请以"世界运行规则解释者"的视角，输出润色后的 JSON。
注意：headline 和 fatalDiagnosis 是你最重要的输出。忽略 baseContract 中的预设标题，基于 lockedFacts 和数据，写出真正属于这个用户的话。`
}

module.exports = {
  buildSystemPrompt,
  buildUserPrompt,
  buildPersonaSummary,
}
