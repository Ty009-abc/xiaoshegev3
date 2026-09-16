'use strict'
/**
 * turnaroundStrategy/v6/thesis/thesisPromptV6.js
 *
 * RC8.4 V6 R57 — ONE-CALL shared-strategic-thesis prompt (bounded).
 *
 * The prompt hands the model a DETERMINISTIC THESIS ENVELOPE and asks for ONE
 * output containing BOTH the strategic thesis and the five cards. The model may
 * INTERPRET inside the envelope (bold structural inference + strategic
 * hypothesis) but may NOT change facts / B1 / proof / scope / conflict state.
 *
 * No second AI rewriting call. CONSUMER LAYER ONLY. No I/O.
 */

const PROMPT_VERSION = 'turnaround_strategy_v6_thesis_prompt_v1'

// Internal vocabulary the model must never surface in user-visible copy.
const FORBIDDEN_TOKENS = [
  'DIRECTION_GAP', 'ACTION_GAP', 'CONSISTENCY_GAP', 'VALIDATION_GAP', 'REPEATABILITY_GAP',
  'BELIEF_MATCH', 'BELIEF_PARTIAL', 'BELIEF_REALITY_GAP',
  'THINKING', 'RESEARCHING', 'LEARNING', 'STARTED', 'TESTING', 'EARLY_TRACTION', 'STABLE_TRACTION',
  '世界模型', 'world model', '盲区', 'blind spot', '认知维度', '模型候选',
  'MULTIPLE', 'UNIQUE', 'rule id', 'RC84V6', 'envelope', 'ENVELOPE',
  'CASHFLOW_SAFE_EXPERIMENT', 'SMALLEST_EXTERNAL_TEST', 'BUYER_FEEDBACK_COLLECTION',
  'REPEAT_SUCCESS_PATH', 'DIRECTION_NARROWING', 'CONSISTENCY_PROTECTION',
  'CASHFLOW_PRESSURE', 'LOW_SURPLUS', 'UNSTABLE_INCOME', 'TIME_PRESSURE_POSSIBLE', 'FAMILY_ENVIRONMENT_CONSTRAINT'
]

function buildSystemPrompt () {
  return [
    '你是一位看得很透、说话很直接的现实分析师——不是成功学导师，也不是心理医生。',
    '你的任务：基于系统已经确认的“信封”（事实、诊断、能力/市场证据、策略范围），给出一个统一的战略判断（strategicThesis），再写成五张卡片。',
    '',
    '== 写作姿态 ==',
    '要有观点、有力度、有身份洞察，不要每句话都加“可能、也许、或许、不妨”。',
    '但力度来自“结构判断”，不是来自把推测说成事实。',
    '允许大胆的结构性推断（structuralInference）与战略假设（strategicHypothesis）；',
    '不允许编造用户没有提供的事实（经历、客户、收入、家庭、职业、证书）。',
    '',
    '== 三种语句权限（内部纪律，不要写进正文）==',
    'FACT：只能来自信封 facts[]。',
    'STRUCTURAL_INFERENCE：可以从事实推出解释（例如“技术只被当作工时卖”）。',
    'STRATEGIC_HYPOTHESIS：可以提出建议型假设（服务打包、报价测试、目标客户、第二次付费），语气自信但必须像“值得验证的方向”，不是“你已经做到”。',
    '',
    '== 禁止 ==',
    '禁止把推测写成事实；禁止发明职业/经历/客户/收入/家庭/证书。',
    '禁止绝对化预言：永远 / 一定 / 必然 / 注定 / 迟早 / 肯定 / 一定会被淘汰 / 一定赚不到 / 必然失败。',
    '允许结构性、条件式表达，例如“只按工时出售技术，收入就很难脱离你的时间上限”。',
    '禁止编造精确价格数字（299/500/999/5000 等）；如提到价格，只能用“低风险测试价”这类说法。',
    '禁止年龄/行业的宿命式判断（例如“35岁程序员一定被淘汰”）。',
    '禁止出现任何内部字段名、枚举值、英文大写标签（如各种 _GAP / PROOF_ / ASSET_ / RC84V6）。',
    '',
    '== 信封约束（必须遵守）==',
    'worldRule 必须从 allowedWorldRules 里选一个（id + expression）。',
    'strategicMigration 必须落在 allowedTargetPositions 范围内。',
    'commercialHypothesis 只能来自 allowedStrategyHypotheses。',
    'experimentClass 决定第五张卡要验证什么。',
    'crossAxisScope=UNPROVEN 时：只能验证“能力 ↔ 当前目标”的连接，禁止“扩大/复制/系统化这项能力”。',
    'diagnosisState=NO_PRIMARY 时：禁止宣称“你真正的瓶颈就是…”。',
    '',
    '== 五张卡的职责（同一套 thesis）==',
    'card01 致命一句话：coreContradiction 的锋利碰撞（<=45字）。',
    'card02 核心问题：identityInterpretation + currentValuePosition（<=140字）。',
    'card03 系统困局：structuralMechanism + worldRule（最多5条，<=220字）。',
    'card04 翻身路径：strategicMigration（from → to + logic，<=160字）。',
    'card05 行动建议：ONE 主实验 + 2–3 条支撑步骤，含 TARGET / TIMEBOX / SUCCESS SIGNAL（<=260字）。',
    '',
    '== 输出契约 ==',
    '只输出一个严格 JSON，不要任何多余文字、不要 ``` 代码块、不要第二个对象：',
    '{"strategicThesis":{"identityInterpretation":"...","coreContradiction":"...","structuralMechanism":"...",',
    '"worldRule":{"id":"<allowedWorldRules 里的 id>","expression":"..."},',
    '"strategicMigration":{"from":"...","to":"...","logic":"..."},',
    '"commercialHypothesis":"...","actionThesis":"..."},',
    '"cards":{"card01":"...","card02":"...","card03":["...","...","...","..."],"card04":{"from":"...","to":"...","logic":"..."},',
    '"card05":{"primary":"...","supporting":["...","..."],"target":"...","timebox":"...","successSignal":"..."}}}'
  ].join('\n')
}

function buildUserMessage (envelope, fallbackCards) {
  const e = envelope || {}
  const lines = []
  lines.push('== THESIS ENVELOPE（机器约束，只能解释，不能改）==')
  lines.push('diagnosisState: ' + (e.diagnosisState || ''))
  lines.push('primaryBottleneck: ' + (e.primaryBottleneck || 'NONE'))
  lines.push('executionStage: ' + (e.executionStage || ''))
  lines.push('beliefRealityGap: ' + (e.beliefRealityGap || ''))
  lines.push('firstActionType: ' + (e.firstActionType || ''))
  lines.push('assetState: ' + (e.assetState || ''))
  lines.push('marketProof: ' + JSON.stringify(e.marketProof || {}))
  lines.push('crossAxisScope: ' + (e.crossAxisScope || ''))
  lines.push('currentValuePosition: ' + (e.currentValuePosition || ''))
  lines.push('experimentClass: ' + (e.experimentClass || ''))
  lines.push('allowedWorldRules: ' + JSON.stringify((e.allowedWorldRules || [])))
  lines.push('allowedTargetPositions: ' + JSON.stringify((e.allowedTargetPositions || [])))
  lines.push('allowedStrategyHypotheses: ' + JSON.stringify((e.allowedStrategyHypotheses || [])))
  lines.push('realityConstraints: ' + JSON.stringify(e.realityConstraints || {}))
  lines.push('')
  lines.push('== FACTS（用户真实提供，禁止扩大或编造）==')
  for (const f of (e.facts || [])) lines.push(f.field + ': ' + String(f.value) + '  [' + f.id + ']')
  lines.push('（未出现在上面的字段＝用户没有提供＝不得推断或补全）')
  if (e.diagnosisState === 'NO_PRIMARY') {
    lines.push('')
    lines.push('== EVIDENCE CLUSTERS（NO_PRIMARY：这些是观察到的力量，不是瓶颈）==')
    for (const c of (e.evidenceClusters || [])) {
      lines.push('- ' + (c.id || '') + ' | ' + (c.why || '') + ' | tension: ' + (c.tension || ''))
    }
    if (e.proofQuestion) lines.push('proofQuestion(nextUncertainty): ' + e.proofQuestion)
  }
  lines.push('')
  lines.push('== 上游确定性报告草稿（事实与结构不得变，可作为素材基础）==')
  const c = fallbackCards || {}
  if (c) {
    lines.push('C01: ' + ((c.fatalInsight && c.fatalInsight.text) || ''))
    lines.push('C02: ' + ((c.coreProblem && c.coreProblem.text) || ''))
    lines.push('C03: ' + (((c.systemLoop && c.systemLoop.steps) || []).join(' / ')))
    lines.push('C04: ' + ((c.turnaroundPath && ((c.turnaroundPath.from || '') + ' → ' + (c.turnaroundPath.to || ''))) || ''))
    lines.push('C05: ' + ((c.firstAction && (c.firstAction.hypothesis || c.firstAction.action)) || ''))
  }
  lines.push('')
  lines.push('请输出 strategicThesis + cards 的严格 JSON（同一套 thesis 贯穿五张卡）。')
  return lines.join('\n')
}

function buildThesisPrompt (envelope, fallbackCards) {
  return {
    systemPrompt: buildSystemPrompt(),
    userMessage: buildUserMessage(envelope, fallbackCards),
    promptVersion: PROMPT_VERSION
  }
}

module.exports = { PROMPT_VERSION, FORBIDDEN_TOKENS, buildSystemPrompt, buildUserMessage, buildThesisPrompt }
