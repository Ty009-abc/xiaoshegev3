'use strict'
/**
 * turnaroundStrategy/v6/experimental/worldview/modelAdapterWorldviewV6.js
 *
 * B2.3 EXPERIMENTAL ISOLATED MODEL ADAPTER — not production authority.
 *
 * BOUNDARY (frozen by mission RC8.4_V6_B2_2_FREEZE_AND_B2_3…):
 *   MODEL_DIAGNOSIS_AUTHORITY = NONE
 *   - This adapter receives ONLY: frozen B1/B2 structured payload + the B2.2 core prompt.
 *   - It may return ONLY: turnaround_strategy_v6_worldview_v1.
 *   - It MUST NOT import/call any diagnosis function (no eligibility, no selection,
 *     no belief inference, no stage inference, no action-type derivation).
 *   - The model is NEVER trusted to echo diagnosis fields; the pipeline re-attaches
 *     the frozen diagnosis AFTER validation.
 *
 * The provider client is INJECTED (default = existing lib/ai.js callAI) so the
 * experiment can run against the existing DeepSeek provider OR a stub. No new
 * provider is introduced here.
 *
 * NOT wired into generateAiReport/index.js. Experimental only.
 */

// NOTE: deliberately NO require of any diagnosis module. The diagnosis is INPUT.
const DEFAULT_CALL_AI = (() => {
  try { return require('../../../../ai.js').callAI } catch (_) { return null }
})()

const WORLDVIEW_REPORT_VERSION = 'turnaround_strategy_v6_worldview_v1'
const PROMPT_VERSION = 'turnaround_strategy_v6_worldview_prompt_v1'

// ── frozen titles (must match B2 / prompt spec) ────────────────
const TITLES = {
  fatalInsight: '致命一句话',
  coreProblem: '核心问题',
  systemLoop: '系统困局',
  turnaroundPath: '翻身路径',
  firstAction: '现在就做'
}

// ── internal tokens that must never be user-visible ────────────
const FORBIDDEN_USER_TOKENS = [
  'DIRECTION_GAP', 'ACTION_GAP', 'CONSISTENCY_GAP', 'VALIDATION_GAP', 'REPEATABILITY_GAP',
  'BELIEF_MATCH', 'BELIEF_PARTIAL', 'BELIEF_REALITY_GAP',
  'THINKING', 'RESEARCHING', 'LEARNING', 'STARTED', 'TESTING', 'EARLY_TRACTION', 'STABLE_TRACTION',
  '世界模型', 'world model', '盲区', 'blind spot', '认知维度', '模型候选',
  'MULTIPLE', 'UNIQUE', 'evidence strength', 'rule id', 'RC84V6'
]

// ─────────────────────────────────────────────────────────────
// PROMPT BUILDING (from docs/design/RC8.4_V6_WORLDVIEW_EXPRESSION_PROMPT_V1.md)
// ─────────────────────────────────────────────────────────────

function buildWorldviewSystemPrompt () {
  return [
    '你不是成功学导师。',
    '你不是心理咨询师。',
    '你不是重新诊断模型。',
    '',
    '你的任务：把上游已经确认的用户现实、行为和瓶颈，放进“系统 / 反馈 / 市场 / 杠杆 / 可复制性”的世界里解释，',
    '让用户看懂三件事：',
    '1. 为什么一直卡在这里；',
    '2. 今天的规则是什么；',
    '3. 下一步该改变什么。',
    '',
    '世界观（只作解释工具，禁止机械强推）：',
    '很多人不是不努力，而是在用旧时代的方法面对已经改变的规则。',
    '现代机会越来越依赖：反馈速度 / 市场验证 / 平台 / 流量 / AI / 注意力 / 信息差 / 商业模式 / 可复制系统 / 杠杆。',
    '以上工具，只有在和当前用户阶段/瓶颈直接相关时才能出现。',
    '',
    '=== 不可修改事实 ===',
    '下面给出的 PRIMARY_BOTTLENECK / EXECUTION_STAGE / BELIEF_RELATION / REALITY_CONSTRAINT / NEXT_STAGE / FIRST_ACTION_TYPE，',
    '只能解释，不能改判：不得发明新的瓶颈、不得重新判断阶段、不得改变信念关系、不得改变行动类型。',
    '',
    '允许有冲击力：你以为……其实…… / 真正拖住你的不是……而是…… / 你现在的问题已经不是…… / 你缺的不是更多……而是……',
    '只要：有用户答案支持，且与给定诊断一致。不要把所有句子都改成 可能/也许/或许/似乎。',
    '',
    '禁止编造：家庭细节 / 债务金额 / 工作时长 / 未提供收入 / 未提供经历 / 人格 / 创伤 / 智力 / 动机。',
    '禁止承诺：一定翻身 / 一定赚钱 / 一定获得资源 / 收入必然增长 / 财富会增加 / 成功率 / 财富概率 / 未来收入 / 保证 / 必然 / 稳赚 / 包赚 / 百分百。',
    '禁止现实否认：不要写“你不是没时间，只是…”“你不是缺资源，只是…”“问题根本不在环境…”。',
    '',
    '【通用原理 ≠ 这个用户的事实】（强制）',
    '世界观只是解释工具。可以写通用原理，例如：“人在现金流紧时容易把准备当成安全感。”',
    '但只有当用户回答里有直接证据时，才能写成关于“你”的具体历史事实，例如：“你一直把准备当成安全感。”',
    '任何关于用户过去经历 / 时长 / 次数 / 金额 / 坚持多久的具体断言，都必须能从用户原始回答直接推出；否则只能停留在通用原理，或改写为不带时间/次数/金额的判断。',
    '',
    '【内部标签不可出现在正文】（强制）',
    '输出里绝对不得出现任何内部字段名或枚举值，包括但不限于：',
    'ACTION_GAP / DIRECTION_GAP / CONSISTENCY_GAP / VALIDATION_GAP / REPEATABILITY_GAP /',
    'BELIEF_MATCH / BELIEF_PARTIAL / BELIEF_REALITY_GAP /',
    'THINKING / RESEARCHING / LEARNING / STARTED / TESTING / EARLY_TRACTION / STABLE_TRACTION /',
    'diagnosisState / primaryBottleneck / rule id / RC84V6 / REALITY_CONSTRAINT。',
    '这些只是上游输入里给你看的内部字段，只能用自然语言转述（例如：把“EXECUTION_STAGE: LEARNING”写成“你现在还在学习、准备阶段”；把“PRIMARY_BOTTLENECK: ACTION_GAP”写成“你卡在想得多、做得少”；把 repeatability 写成“能不能重复做出来”）。',
    '不要逐字回显上面“冻结事实”里的大写字段，也不要在 CARD04 的逻辑里写“你现在在 X 阶段，瓶颈是 Y”。',
    '',
    '五张卡片职责：',
    'CARD01 致命一句话 = 最强、最值得重新理解的结论；',
    'CARD02 核心问题 = 解释“为什么这么努力还没结果”，连接 现实 + 行为 + 今天的规则；',
    'CARD03 系统困局 = 5 步真实循环（现实压力 → 用户反应 → 无效机制 → 缺失反馈/积累 → 旧解释强化）；',
    'CARD04 翻身路径 = 战略切换（准备→外部反馈 / 产品打磨→市场验证 / 一次成交→可复制流程）；',
    'CARD05 现在就做 = 保持给定 FIRST_ACTION_TYPE，只说得更具体、更像人话，24–48 小时内可执行，只一个主行动。',
    '',
    '只输出严格 JSON，不要任何多余文字：',
    '{"reportVersion":"' + WORLDVIEW_REPORT_VERSION + '","cards":{"fatalInsight":{"title":"致命一句话","text":"..."},"coreProblem":{"title":"核心问题","text":"..."},"systemLoop":{"title":"系统困局","steps":["...","...","...","...","..."]},"turnaroundPath":{"title":"翻身路径","from":"...","to":"...","logic":"..."},"firstAction":{"title":"现在就做","action":"...","checks":["...","..."]}}}'
  ].join('\n')
}

function buildWorldviewUserMessage (payload) {
  const { diagnosis, b2Report, userFacts } = payload
  const d = diagnosis || {}
  const facts = userFacts || (b2Report && b2Report.sourceAnswers) || null
  const lines = []
  lines.push('=== 冻结事实（只能解释，不能改判） ===')
  lines.push('PRIMARY_BOTTLENECK: ' + (d.primaryBottleneck || 'NO_PRIMARY'))
  lines.push('EXECUTION_STAGE: ' + (d.executionStage || ''))
  lines.push('BELIEF_RELATION: ' + (d.beliefRelation && d.beliefRelation.relation || ''))
  lines.push('BELIEF_SUBTYPE: ' + (d.beliefRelation && d.beliefRelation.subType || ''))
  lines.push('REALITY_CONSTRAINT: ' + JSON.stringify((d.realityConstraint && d.realityConstraint.types) || []))
  lines.push('NEXT_STAGE: ' + (d.recommendedNextStage || ''))
  lines.push('FIRST_ACTION_TYPE: ' + (d.firstActionType || ''))
  lines.push('')
  if (facts) {
    lines.push('=== 用户原始回答（DIRECT_USER_FACTS） ===')
    for (const k of Object.keys(facts)) lines.push(k + ': ' + facts[k])
    lines.push('')
  }
  if (b2Report && b2Report.cards) {
    lines.push('=== 上游确定性报告草稿（可作为基础改写，事实不得变） ===')
    const c = b2Report.cards
    lines.push('C01: ' + (c.fatalInsight && c.fatalInsight.text || ''))
    lines.push('C02: ' + (c.coreProblem && c.coreProblem.text || ''))
    lines.push('C03: ' + ((c.systemLoop && c.systemLoop.steps) || []).join(' / '))
    lines.push('C04: ' + (c.turnaroundPath && (c.turnaroundPath.from + ' → ' + c.turnaroundPath.to) || ''))
    lines.push('C05: ' + (c.firstAction && c.firstAction.action || ''))
  }
  lines.push('')
  lines.push('请按上述 JSON 契约输出 world-view 版五卡片。')
  return lines.join('\n')
}

function buildWorldviewPrompt (payload) {
  return { systemPrompt: buildWorldviewSystemPrompt(), userMessage: buildWorldviewUserMessage(payload), promptVersion: PROMPT_VERSION }
}

// ─────────────────────────────────────────────────────────────
// OUTPUT PARSING / SHAPE
// ─────────────────────────────────────────────────────────────

function extractJson (text) {
  if (!text) return { ok: false, error: 'EMPTY' }
  let s = String(text).trim()
  // strip ```json fences if present
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const i = s.indexOf('{'); const j = s.lastIndexOf('}')
  if (i < 0 || j < 0 || j < i) return { ok: false, error: 'NO_JSON_OBJECT' }
  try { return { ok: true, value: JSON.parse(s.slice(i, j + 1)) } } catch (e) { return { ok: false, error: 'JSON_PARSE_ERROR: ' + e.message } }
}

/**
 * Run the isolated adapter. callAI is INJECTED; defaults to the existing lib/ai.js.
 * Returns { ok, report, raw, error, meta }.
 */
async function runWorldviewAdapter (payload, opts) {
  const o = opts || {}
  const callAI = o.callAI || DEFAULT_CALL_AI
  if (typeof callAI !== 'function') return { ok: false, error: 'NO_CALL_AI', report: null }
  const prompt = buildWorldviewPrompt(payload)
  const ai = await callAI({
    systemPrompt: prompt.systemPrompt,
    userMessage: prompt.userMessage,
    maxTokens: o.maxTokens || 1600,
    temperature: o.temperature != null ? o.temperature : 0,
    forceModel: o.forceModel
  })
  if (!ai || !ai.success) {
    return { ok: false, error: (ai && ai.error) || 'AI_CALL_FAILED', report: null, meta: { promptVersion: PROMPT_VERSION } }
  }
  const parsed = extractJson(ai.content)
  if (!parsed.ok) return { ok: false, error: parsed.error, raw: ai.content, report: null, meta: { promptVersion: PROMPT_VERSION } }
  return {
    ok: true,
    report: parsed.value,
    raw: ai.content,
    meta: { promptVersion: PROMPT_VERSION, tokens: ai.tokens || 0, finishReason: ai.finishReason || null }
  }
}

module.exports = {
  WORLDVIEW_REPORT_VERSION,
  PROMPT_VERSION,
  TITLES,
  FORBIDDEN_USER_TOKENS,
  buildWorldviewPrompt,
  buildWorldviewSystemPrompt,
  buildWorldviewUserMessage,
  extractJson,
  runWorldviewAdapter
}
