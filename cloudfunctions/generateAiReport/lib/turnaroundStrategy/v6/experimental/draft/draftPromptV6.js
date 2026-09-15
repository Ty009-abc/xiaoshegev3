'use strict'
/**
 * turnaroundStrategy/v6/experimental/draft/draftPromptV6.js
 *
 * R11_V2 — AI WORLDVIEW DRAFT prompt (B2.2-v2).
 *
 * ARCHITECTURAL RULE (R11_V2):
 *   MODEL_OUTPUT != USER_FINAL_OUTPUT
 *   The model produces DRAFT MATERIAL, never final card-ready copy.
 *   A deterministic editor (reportEditorV6.js) turns material into the final
 *   five cards. Therefore this prompt deliberately does NOT ask for the final
 *   card JSON contract, and does NOT impose final UI character limits.
 *
 * BOUNDARY (inherited from B2.3 adapter contract):
 *   MODEL_DIAGNOSIS_AUTHORITY = NONE
 *   The model receives ONLY the frozen B1/B2 structured payload; it may never
 *   re-derive or contradict the diagnosis. Output is material only.
 *
 * CONSUMER LAYER NOTE: no network, no I/O. Pure prompt construction.
 */

const DRAFT_VERSION = 'turnaround_strategy_v6_worldview_draft_v1'
const DRAFT_PROMPT_VERSION = 'turnaround_strategy_v6_worldview_draft_prompt_v1'

// Draft-length policy (draft limits ONLY — final UI limits belong to the editor).
const DRAFT_LIMITS = {
  insightCandidate: 120,
  mechanismExplanation: 250,
  transitionExplanation: 180,
  actionExplanation: 180
}

// Internal vocabulary the model must never surface (mirrors the validator).
const FORBIDDEN_DRAFT_TOKENS = [
  'DIRECTION_GAP', 'ACTION_GAP', 'CONSISTENCY_GAP', 'VALIDATION_GAP', 'REPEATABILITY_GAP',
  'BELIEF_MATCH', 'BELIEF_PARTIAL', 'BELIEF_REALITY_GAP',
  'THINKING', 'RESEARCHING', 'LEARNING', 'STARTED', 'TESTING', 'EARLY_TRACTION', 'STABLE_TRACTION',
  '世界模型', 'world model', '盲区', 'blind spot', '认知维度', '模型候选',
  'MULTIPLE', 'UNIQUE', 'rule id', 'RC84V6',
  'CASHFLOW_SAFE_EXPERIMENT', 'SMALLEST_EXTERNAL_TEST', 'BUYER_FEEDBACK_COLLECTION',
  'REPEAT_SUCCESS_PATH', 'DIRECTION_NARROWING', 'CONSISTENCY_PROTECTION',
  'CASHFLOW_PRESSURE', 'LOW_SURPLUS', 'UNSTABLE_INCOME', 'TIME_PRESSURE_POSSIBLE', 'FAMILY_ENVIRONMENT_CONSTRAINT'
]

function buildDraftSystemPrompt () {
  return [
    '你不是成功学导师，也不是心理咨询师。',
    '你只负责提供“洞察素材”，不负责最终成稿。',
    '',
    '上游已经确认了用户的现实、行为和瓶颈，并给出了一个固定的下一步行动类型。',
    '你的任务：围绕这些**已确认的事实**，给出解释性的洞察素材，供后续编辑加工。',
    '',
    '=== 不可修改事实（只能解释，不能改判）===',
    'PRIMARY_BOTTLENECK / EXECUTION_STAGE / BELIEF_RELATION / REALITY_CONSTRAINT / NEXT_STAGE / FIRST_ACTION_TYPE',
    '这些只能解释，不能改判：不得发明新的瓶颈、不得重新判断阶段、不得改变信念关系、不得改变行动类型。',
    '',
    '=== 输出内容（素材，不是最终卡片）===',
    '1) insightCandidates：2–3 条“你以为……其实……”式的重新理解候选，每条 <= 120 字。',
    '   必须能从用户原始回答直接推出；给的是候选，不是定稿。',
    '2) mechanismExplanation：解释“为什么现在的做法会得到现在的结果”，<= 250 字。',
    '3) transitionExplanation：解释“为什么下一阶段的规则和现在不同”，<= 180 字。',
    '4) actionExplanation：解释“为什么给定的 FIRST_ACTION_TYPE 是正确的第一步”，<= 180 字。',
    '',
    '=== 禁止 ===',
    '禁止编造：家庭细节 / 债务金额 / 工作时长 / 未提供收入 / 未提供经历 / 人格 / 创伤 / 智力 / 动机。',
    '禁止承诺：一定翻身 / 一定赚钱 / 一定获得资源 / 收入必然增长 / 财富会增加 / 成功率 / 财富概率 / 稳赚 / 包赚 / 百分百。',
    '禁止现实否认：不要写“你不是没时间，只是…”“你不是缺资源，只是…”“问题根本不在环境…”。',
    '禁止出现任何内部字段名或枚举值（例如各种大写下划线标签、执行阶段英文、RC84V6 等）。',
    '禁止输出最终五卡片结构；只输出下面的素材 JSON。',
    '',
    '只输出严格 JSON，不要任何多余文字（不要 ``` 代码块，不要解释，不要第二个 JSON 对象）：',
    '{"draftVersion":"' + DRAFT_VERSION + '","insightCandidates":["...","..."],"mechanismExplanation":"...","transitionExplanation":"...","actionExplanation":"..."}'
  ].join('\n')
}

function buildDraftUserMessage (payload) {
  const { diagnosis, b2Report, userFacts } = payload || {}
  const d = diagnosis || {}
  const facts = userFacts || (b2Report && b2Report.sourceAnswers) || null
  const lines = []
  lines.push('=== 冻结事实（只能解释，不能改判）===')
  lines.push('PRIMARY_BOTTLENECK: ' + (d.primaryBottleneck || 'NO_PRIMARY'))
  lines.push('EXECUTION_STAGE: ' + (d.executionStage || ''))
  lines.push('BELIEF_RELATION: ' + (d.beliefRelation && d.beliefRelation.relation || ''))
  lines.push('BELIEF_SUBTYPE: ' + (d.beliefRelation && d.beliefRelation.subType || ''))
  lines.push('REALITY_CONSTRAINT: ' + JSON.stringify((d.realityConstraint && d.realityConstraint.types) || []))
  lines.push('NEXT_STAGE: ' + (d.recommendedNextStage || ''))
  lines.push('FIRST_ACTION_TYPE: ' + (d.firstActionType || ''))
  lines.push('')
  if (facts) {
    lines.push('=== 用户原始回答（DIRECT_USER_FACTS）===')
    for (const k of Object.keys(facts)) lines.push(k + ': ' + facts[k])
    lines.push('')
  }
  if (b2Report && b2Report.cards) {
    lines.push('=== 上游确定性报告草稿（事实不得变，可作为素材基础）===')
    const c = b2Report.cards
    lines.push('C01: ' + (c.fatalInsight && c.fatalInsight.text || ''))
    lines.push('C02: ' + (c.coreProblem && c.coreProblem.text || ''))
    lines.push('C03: ' + ((c.systemLoop && c.systemLoop.steps) || []).join(' / '))
    lines.push('C04: ' + (c.turnaroundPath && ((c.turnaroundPath.from || '') + ' → ' + (c.turnaroundPath.to || '')) || ''))
    lines.push('C05: ' + (c.firstAction && c.firstAction.action || ''))
  }
  lines.push('')
  lines.push('请按上述“素材 JSON”契约输出洞察素材（不是最终卡片）。')
  return lines.join('\n')
}

function buildDraftPrompt (payload) {
  return {
    systemPrompt: buildDraftSystemPrompt(),
    userMessage: buildDraftUserMessage(payload),
    promptVersion: DRAFT_PROMPT_VERSION
  }
}

module.exports = {
  DRAFT_VERSION,
  DRAFT_PROMPT_VERSION,
  DRAFT_LIMITS,
  FORBIDDEN_DRAFT_TOKENS,
  buildDraftSystemPrompt,
  buildDraftUserMessage,
  buildDraftPrompt
}
