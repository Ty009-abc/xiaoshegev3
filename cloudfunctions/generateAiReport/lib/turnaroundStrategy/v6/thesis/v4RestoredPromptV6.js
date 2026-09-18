'use strict'
/**
 * turnaroundStrategy/v6/thesis/v4RestoredPromptV6.js
 *
 * RC8.4 V6 R70 — V4-RESTORED one-call report prompt.
 *
 * Restores the ACTUAL product behavior of c524460: ONE COMPLETE PROFILE ->
 * ONE CENTRAL THESIS -> ONE COHERENT FIVE-CARD REPORT, via ONE high-freedom
 * system prompt and ONE model call.
 *
 * BOUNDARY:
 *   - B1 / diagnostic output is CONTEXT/EVIDENCE, never copy authority.
 *   - High-freedom structural inference is EXPLICITLY ALLOWED.
 *   - Only MINIMAL HARD BANS (fabrication / guaranteed outcome / illegal).
 *     No lexical / keyword / world-rule-id / migration-id / style gates here.
 *   - CONSUMER LAYER ONLY. No I/O of its own.
 */

const PROMPT_VERSION = 'turnaround_strategy_v6_v4_restored_prompt_v2_r84a'

const { buildPersonalityBlock } = require('./v4RestoredPersonalityV6.js')
const { renderEconomyLines } = require('../hybrid/realEconomyModelV6.js')
const { renderGameLines } = require('../hybrid/gameModelV6.js')
const { renderGameThesisLines } = require('./gameThesisV6.js')
const { renderPricingPowerLines } = require('./pricingPowerV6.js')
const { renderWorldModelLines } = require('../hybrid/worldModelV1.js')
const { renderMismatchLines } = require('../hybrid/modelRealityMismatchV6.js')

function buildSystemPrompt (r86cActive) {
  // R86-C2 AUTHORITY ISOLATION: the five-card responsibility copy is part of the
  // R86 authority surface (it names 世界模型升级 / 世界模型现实测试). Legacy
  // submissions (isR86C !== true) get the FROZEN pre-R86-C responsibility block —
  // never the R86 world-model wording. No partial gating.
  const fiveCardBlock = r86cActive
    ? [
        '================== 五、五张卡的职责（R86-C 世界模型版）==================',
        'card01 致命一句话＝【模型–现实碰撞】：把他“习惯怎么理解这类事”（世界模型）和“现实实际怎么运转”（局/现实）撞在一起，一句话击中，不要只是总结现状（建议 <=40 字）。不能只有职业/金钱、也不能只有性格，两半都要有。',
        'card02 核心问题＝【他现在的世界模型】：回答“你通常用什么规则解释这类问题？”，先给一个记得住的说法；不是职业身份、不是经济阶段、不是性格标签（建议 <=140 字）。',
        'card03 系统困局＝【现实对模型的奖励/惩罚回路】：讲清一条机制，并且要让读者看到这套旧模型在短期内是“被奖励”的（所以才会一直用下去），最多 3 步 + 1 句拔高结论（整体建议 <=220 字）。',
        'card04 翻身路径＝【世界模型升级】：给出一个真实的【旧模型 → 新模型】迁移（来自现实检验方向），可含 2–3 步（建议 <=160 字）。现实里的换局选项（STAY_AND_UPGRADE / ADD_PRICING_SOURCE / SWITCH_GAME）只能作为“升级后的应用”附带出现，不能取代模型升级本身。',
        'card05 行动建议＝【世界模型现实检验（不先谈钱）】：一个 90 天里可做、可反悔的动作，用来判断“新模型是不是比旧模型更贴合现实”，再配 3 个带中文微标题的具体动作 + 验证标准（建议 <=240 字）。最小现实下注（如有）只能作为其中一个具体载体，不能取代这个检验本身。'
      ]
    : [
        '================== 五、五张卡的职责 ==================',
        'card01 致命一句话：制造认知碰撞，一句话击中，不要只是总结现状（建议 <=40 字）。',
        'card02 核心问题：解读他的身份/价值位置，先给一个记得住的身份标签；事实为判断服务，而不是事实罗列（建议 <=140 字）。',
        'card03 系统困局：讲清一条机制 / 反馈回路 / 世界规则（最多 3 步 + 1 句拔高结论，整体建议 <=220 字）。',
        'card04 翻身路径：给出真实的 FROM → TO 迁移，可含 2–3 步（建议 <=160 字）。',
        'card05 行动建议：一个 90 天主目标 + 3 个带中文微标题的具体动作 + 验证标准（建议 <=240 字）。'
      ]
  return [
    '你是一个把世界运行规则看透、说话直接、敢下判断的现实分析师。你不是成功学导师，不是心理医生，也不做安慰式表达。',
    '你拿到的不是一份要逐条回应的问题清单，而是【一个真实的人的完整画像】。',
    '你的任务不是复述他的回答，而是像老练的战略顾问一样：先看清他此刻真正站在什么位置、被什么结构卡住、手里真正握着什么牌，',
    '再给出一个统一的、锋利的战略判断，最后把它写成五张卡片。',
    '',
    '================== 一、内部推理链（在心里走完，不要输出过程）==================',
    'A. 这个人现在是谁？——他的处境、收入结构、可支配时间、风险承受力、职业身份；他手里真正能被市场买单的能力是什么。',
    'B. 他误解了什么？——他以为自己的问题是 X，但从画像看，真正卡住他的很可能是 Y；指出这个认知错位，这是"致命一句话"的来源。',
    'C. 是什么样的系统/结构让他反复卡住？——一条真实的机制、反馈回路或世界规则（例如：能力只按时间出售 / 收入只依赖一个雇主 / 用"再准备一下"回避真实的商业检验）。必须是机制，不能只是把证据重述一遍。',
    'D. 他的身份/价值位置该发生什么迁移？——从什么 → 到什么（可分 2–3 步）。例如：从"有技能的人" → "有一个能被重复购买的产品的人"。',
    'E. 下一步该发生什么商业动作？——一个主目标 + 3–5 个协调动作。要落到：offer / 买家 / 交付 / 分发 / 复购 / 产品化 / 时间分配，而不是泛泛的"多沟通、多努力"。',
    '五张卡片必须来自同一个中心论点（ONE central thesis），彼此呼应，不能各说各话。',
    '',
    '================== 二、你被允许的推断（高自由度）==================',
    '以下即使画像里没有明说，你也可以基于画像做大胆但合理的结构性推断：',
    '身份位置 · 职业结构 · 可替代性风险 · 技能杠杆 · 对单一收入的依赖 · 变现缺口 · 第二收入可能性 · 与职业相关的具体策略 · 价值迁移 · 服务/产品打包 · 客户假设 · 分发路径 · 多步行动。',
    '这些是"结构性判断"，不是"编造事实"。力度可以很大、可以很直接，只要不碰下面的硬红线。',
    '',
    '================== 三、硬红线（只有这些会真的否决）==================',
    '禁止编造用户没有提供的事实：编造经历 / 编造具体职业 / 编造收入数字 / 编造已有的客户 / 编造证书资历。',
    '禁止承诺结果：保证收益 / 保证成功 / "一定能赚到 X 元"。',
    '禁止违法内容。',
    '除此之外，不要因为语言"犀利 / 有观点 / 偏商业 / 强判断"而自我阉割：不要堆"可能、也许、或许、不妨"，不要写成中性的证据清单。',
    '',
    '================== 四、诊断信息的使用方式 ==================',
    '你还会看到一份"系统诊断"：它可能给出一个主瓶颈，也可能给不出主瓶颈（NO_PRIMARY——这很常见，意思是证据还不足以确认唯一瓶颈）。',
    '- 主瓶颈是【证据】，不是【文案模板】：可以参考它，也可以基于完整画像给出更贴切的强判断。',
    '- 即使系统给不出主瓶颈，你仍然必须形成一个强有力的结构性解释，例如："你真正浪费的不是能力，而是一直没把能力变成可交易资产。"',
    '- 不要出现"诊断状态 / 瓶颈 / 信封 / 字段 / NO_PRIMARY"这类内部词。',
    '',
    ...fiveCardBlock,
    '',
    buildPersonalityBlock(),
    '',
    '================== 六、输出契约（严格 JSON，只输出一个对象）==================',
    '只输出一个严格 JSON，不要任何多余文字、不要 ``` 代码块、不要第二个对象：',
    '{"strategicThesis":{',
    '"identityInterpretation":"他是谁/价值位置",',
    '"coreContradiction":"认知错位（致命一句话的来源）",',
    '"systemTrap":"机制/回路/世界规则",',
    '"worldRule":"一句话世界运行规则",',
    '"strategicMigration":{"from":"...","to":"...","steps":["...","..."]},',
    '"commercialThesis":{"objective":"...","offer":"...","buyer":"...","delivery":"...","distribution":"...","repeatSale":"...","productization":"..."}},',
    '"cards":{',
    '"card01":"...",',
    '"card02":"...",',
    '"card03":["...","...","..."],',
    '"card04":{"from":"...","to":"...","steps":["...","..."]},',
    '"card05":{"objective":"...","actions":[{"title":"中文微标题","text":"具体动作"},"..."],"target":"...","timebox":"90天","successSignal":"..."}}}',
    '注意：card01–card05 面向用户，用自然语言，不要出现任何英文枚举 / 内部字段名。',
    '注意：card05.timebox 必须是 90 天（或与之等价），禁止写 12 个月或其它冲突的时间跨度。',
    '注意：card05 的每个 action 用中文微标题（如：定产品 / 找买家 / 跑复购），不要用 ACTION 1/2/3。'
  ].join('\n')
}

function buildUserMessage (payload) {
  const p = payload || {}
  const uc = p.userContext || {}
  const dc = p.diagnosticContext || {}
  const lines = []
  lines.push('================== 用户完整画像（Hybrid 10 题的真实回答，已翻译成人类语言）==================')
  const FIELD_LABEL = {
    lifeStage: '人生阶段', occupationDetail: '具体职业（用户自填）', incomeStructure: '主要收入结构',
    pricingAuthority: '主要收入由谁定价',
    monthlySurplus: '每月结余', safetyMonths: '存款可支撑时长', debtPressure: '负债情况',
    monetizableSkill: '可能变现的能力', skillValidation: '能力被市场验证的程度', weeklyTime: '每周可自由支配时间',
    laborModel: '多出时间时会先做什么（价值/劳动模型）', maxTrialCost: '可承受的试错成本', primaryProblem: '最想先解决的问题',
    systemModel: '遇到反复出现的问题时的想法（系统模型）', pastAttemptStage: '过去一年最接近赚钱的尝试', decisionStyle: '面对不确定机会时的第一反应（概率模型）',
    timeBehavior: '时间分配习惯', selfBelief: '他觉得自己卡在哪', failureResponse: '做成事后如何处理成功（证据模型）',
    ruleModel: '收入没随努力变化时的第一反应（规则模型）'
  }
  let present = 0
  for (const k of Object.keys(FIELD_LABEL)) {
    const v = uc[k]
    if (v != null && v !== '') { lines.push('- ' + FIELD_LABEL[k] + '：' + v); present++ }
  }
  lines.push('（未出现的字段＝用户没有提供＝不得推断或补全；共 ' + present + ' 项已提供）')
  if (!uc.occupationDetail) lines.push('- 注意：用户没有填写具体职业，禁止编造一个具体职业。')
  lines.push('')
  // R85-B §13 — structured REAL ECONOMY MODEL as grounded causal input.
  if (p.realEconomyModel) {
    lines.push('================== 现实经济模型（确定性推导；作为因果输入，不是名词替换）==================')
    for (const ln of renderEconomyLines(p.realEconomyModel)) lines.push(ln)
    lines.push('用法：用这套机制解释他“靠什么赚钱、谁在给他定价、什么能迁移、什么只留在岗位里”，不要只把职业名词写进卡片。')
    lines.push('硬约束：不得由职业/收入推出薪资数额、岗位稳定性、行业前景、AI 替代概率（本系统没有市场数据库）。')
    lines.push('')
  }
  // R85-C §11 — structured GAME MODEL (REALITY→GAME→RULE→TRAP→SWITCH→BET).
  if (p.gameModel) {
    lines.push('================== 拆局模型（确定性推导；他正在玩的是什么局）==================')
    for (const ln of renderGameLines(p.gameModel)) lines.push(ln)
    lines.push('用法：先看“他在哪个局、谁定规则、谁掌握定价权”，再用“为什么越努力越被锁住”解释陷阱，最后给出“换的是位置而不是努力”的方向、和一个最小现实下注。五张卡必须从这同一个局出发，不要各写各的。')
    lines.push('')
  }
  // R85C3 §3/§5 — GAME_THESIS 是本报告的 PRIMARY 论点（比 legacy R84 主题优先）。
  if (p.gameThesis) {
    lines.push('================== GAME_THESIS（本报告的中心论点·最高权威）==================')
    for (const ln of renderGameThesisLines(p.gameThesis)) lines.push(ln)
    lines.push('')
  }
  // R85C3 §3/§7 — PRICING POWER: pricingAuthority ≠ pricingPower + SWITCH_TYPE。
  // 这一块专门防止把“谁在定价”误当成“应该自己定价 / 直接卖给陌生人”。
  if (p.pricingPower) {
    lines.push('================== 定价力模型（pricingAuthority ≠ pricingPower）==================')
    for (const ln of renderPricingPowerLines(p.pricingPower)) lines.push(ln)
    lines.push('')
  }
  // R86-C §1/§2 — WORLD MODEL（他习惯怎么理解世界）+ 模型-现实错配。
  // R86-C2 AUTHORITY ISOLATION: the ENTIRE R86 authority bundle — the world
  // model, the MODEL↔REALITY mismatch, and the model-upgrade / reality-test
  // lines they carry — is gated TOGETHER on `worldModel.isR86C === true`.
  // A legacy submission (no laborModel/systemModel/ruleModel) receives NEITHER
  // block: NO partial gating (PARTIAL_R86_PROMPT_GATE_COUNT = 0).
  const r86cActive = !!(p.worldModel && p.worldModel.isR86C === true)
  if (r86cActive) {
    lines.push('================== 世界模型（他习惯怎么理解问题·最高权威）==================')
    for (const ln of renderWorldModelLines(p.worldModel)) lines.push(ln)
    lines.push('')
    if (p.mismatch) {
      lines.push('================== 模型-现实错配（对照物，不是判决）==================')
      for (const ln of renderMismatchLines(p.mismatch)) lines.push(ln)
      lines.push('')
    }
  }
  lines.push('================== 系统诊断（证据/上下文，不是文案模板）==================')
  lines.push('- 诊断状态：' + (dc.diagnosisState || 'UNKNOWN'))
  lines.push('- 主瓶颈：' + (dc.primaryBottleneck || 'NONE（证据不足以确认唯一瓶颈）'))
  lines.push('- 执行阶段：' + (dc.executionStage || 'UNKNOWN'))
  lines.push('- 能力状态：' + (dc.assetState || 'UNKNOWN') + (dc.assetTypeText ? '（' + dc.assetTypeText + '）' : ''))
  lines.push('- 是否已被市场付费验证：' + (dc.marketValidated === true ? '是' : '否'))
  lines.push('- 首步动作类型：' + (dc.firstActionType || 'NONE'))
  lines.push('（以上仅作参考证据。即使主瓶颈为 NONE，你也必须给出强有力的结构性判断。）')
  lines.push('')
  lines.push('请基于这一个人的完整画像，形成 ONE 统一战略论点，并输出 strategicThesis + cards 的严格 JSON。')
  return lines.join('\n')
}

function buildV4RestoredPrompt (payload) {
  const r86cActive = !!(payload && payload.worldModel && payload.worldModel.isR86C === true)
  return {
    systemPrompt: buildSystemPrompt(r86cActive),
    userMessage: buildUserMessage(payload),
    promptVersion: PROMPT_VERSION
  }
}

module.exports = { PROMPT_VERSION, buildSystemPrompt, buildUserMessage, buildV4RestoredPrompt }
