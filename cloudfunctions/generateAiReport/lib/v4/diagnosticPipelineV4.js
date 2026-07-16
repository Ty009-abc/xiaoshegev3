/**
 * lib/v4/diagnosticPipelineV4.js
 *
 * V4 诊断完整管线。
 *
 * 步骤 (固定 10 步):
 *   STEP_1: 验证输入
 *   STEP_2: 运行引擎
 *   STEP_3: 映射 Contract
 *   STEP_4: 验证 Contract
 *   STEP_5: 构建 Prompt
 *   STEP_6: 调用 AI
 *   STEP_7: 解析 AI 输出
 *   STEP_8: 合并报告
 *   STEP_9: 守卫报告
 *   STEP_10: 返回或 fallback
 */

const { analyze } = require('../engine/turnaroundEngineV4')
const { mapEngineToReport } = require('../report/reportMapperV4')
const { createReportContract } = require('../report/reportContractV4')
const { assertValid } = require('../report/reportValidatorV4')
const { buildPromptPayload } = require('../prompt-v4/promptPayloadV4')
const { buildSystemPrompt, buildUserPrompt } = require('../prompt-v4/diagnosticPromptV4')
const { parseAIOutput } = require('../prompt-v4/aiOutputParserV4')
const { mergeReportV4 } = require('../prompt-v4/reportMergeV4')
const { guardReportV4, generateFallbackReport } = require('../prompt-v4/reportGuardV4')

// ═══════════════════════════════════════════════════════════════
// 必需字段
// ═══════════════════════════════════════════════════════════════

const REQUIRED_V4_KEYS = [
  'lifeStage',
  'incomeStructure',
  'occupationDetail',
  'monthlySurplus',
  'safetyMonths',
  'debtPressure',
  'skillValidation',
  'monetizableSkill',
  'weeklyTime',
  'executionStability',
  'pastAttemptStage',
  'decisionStyle',
  'primaryGoal',
  'maxTrialCost',
  'failureResponse',
]

// ═══════════════════════════════════════════════════════════════
// 输入验证
// ═══════════════════════════════════════════════════════════════

function validateV4Answers(answers) {
  const missing = REQUIRED_V4_KEYS.filter(k => {
    const v = answers[k]
    return v === undefined || v === null || String(v).trim() === ''
  })
  return {
    valid: missing.length === 0,
    missingKeys: missing,
  }
}

/**
 * 归一化输入 answers — 支持嵌套和扁平
 */
function normalizeV4Input(event) {
  // 嵌套优先: event = { diagnosticVersion:'v4', answers:{ lifeStage:..., ... } }
  if (event.answers && typeof event.answers === 'object') {
    // 检查是 event.diagnosticVersion === 'v4' 还是 event.answers.diagnosticVersion === 'v4'
    if (event.diagnosticVersion === 'v4' || event.answers.diagnosticVersion === 'v4') {
      // event.answers 里的字段就是 answers（或可能有嵌套 answers.answers）
      return event.answers.answers || event.answers
    }
  }
  // 扁平结构: event = { diagnosticVersion:'v4', lifeStage:..., ... }
  if (event.diagnosticVersion === 'v4') {
    return event
  }
  return null
}

// ═══════════════════════════════════════════════════════════════
// 旧字段映射
// ═══════════════════════════════════════════════════════════════

function mapV4ToLegacyFields(report) {
  const h = report.headline || {}
  const fd = report.fatalDiagnosis || {}
  const frs = report.fatalRules || []
  const wps = report.wealthPath || []
  const ap = report.actionPlan || {}
  const sd = report.stopDoing || {}
  const wpSorted = [...wps].sort((a, b) => b.score - a.score)
  const bestPath = wpSorted[0]

  // 融合 headline 和 wealthStage
  const stageLabelMap = {
    SURVIVAL: '生存模式',
    STABLE: '稳定模式',
    ACCUMULATION: '积累模式',
    LEVERAGE: '杠杆模式',
    SYSTEM: '系统模式',
    FREEDOM: '自由模式',
  }
  const stageLabel = stageLabelMap[report.wealthStage] || '待评估'

  return {
    position: `${stageLabel} · ${h.subtitle || ''}`,
    trapped_by: fd.mainProblem || '',
    forbidden: [
      ...(sd.items || []),
      ...wps.filter(p => p.recommend === 'not_recommended').map(p => `${p.name}路径（当前不建议）`),
    ],
    path: bestPath ? `${bestPath.name}: score=${bestPath.score} ${bestPath.recommend}` : '待系统评估',
    next90days: [
      ap.day1 ? `${ap.day1.goal}（${ap.day1.checkpoint}）` : '',
      ap.day3 ? `${ap.day3.goal}（${ap.day3.checkpoint}）` : '',
      ap.day7 ? `${ap.day7.goal}（${ap.day7.checkpoint}）` : '',
      ap.day15 ? `${ap.day15.goal}（${ap.day15.checkpoint}）` : '',
      ap.day30 ? `${ap.day30.goal}（${ap.day30.checkpoint}）` : '',
    ].filter(Boolean),
    fatal_sentence: h.title || '',
    core_problem: fd.reason || '',
    system_trap: frs.slice(0, 3).map(r => `${r.title}: ${r.description}`).join(' | '),
    strategy_path: bestPath ? `${bestPath.name}: score=${bestPath.score}` : '',
    advice: [
      ap.day1 ? `${ap.day1.goal}: ${(ap.day1.tasks || []).join('、')}` : '',
      ap.day7 ? `${ap.day7.goal}: ${(ap.day7.tasks || []).join('、')}` : '',
      ap.day30 ? `${ap.day30.goal}: ${(ap.day30.tasks || []).join('、')}` : '',
    ].filter(Boolean),
  }
}

// ═══════════════════════════════════════════════════════════════
// 主管线
// ═══════════════════════════════════════════════════════════════

/**
 * @param {Object} options
 * @param {Object} options.answers — 归一化后的 15-key answers
 * @param {Object} options.userContext — { openid, recordId }
 * @param {Function} options.callAI — (systemPrompt, userMessage) => AI result
 * @returns {Object} pipeline result
 */
async function runDiagnosticV4({ answers, userContext = {}, callAI }) {
  const stages = []
  const log = (stage, ok, extra = {}) => {
    stages.push({ stage, ok, timestamp: Date.now(), ...extra })
  }

  // ── STEP 1: 验证输入 ──
  const validation = validateV4Answers(answers)
  if (!validation.valid) {
    log('STEP_1_VALIDATE_INPUT', false, { missingKeys: validation.missingKeys })
    return {
      code: 4004,
      message: 'V4_DIAGNOSTIC_INPUT_INVALID',
      data: { missingKeys: validation.missingKeys },
      stages,
    }
  }
  log('STEP_1_VALIDATE_INPUT', true)

  // ── STEP 2: 运行引擎 ──
  let engineResult
  try {
    engineResult = analyze(answers)
    log('STEP_2_RUN_ENGINE', true, {
      ruleCount: engineResult.meta.ruleCount,
      matchedCount: engineResult.meta.matchedCount,
      fatalCount: engineResult.meta.fatalCount,
      advantageCount: engineResult.meta.advantageCount,
    })
  } catch (e) {
    log('STEP_2_RUN_ENGINE', false, { error: e.message })
    return { code: 5000, message: 'V4_ENGINE_ERROR', data: { error: e.message }, stages }
  }

  // ── STEP 3: 映射 Contract ──
  let baseContract
  try {
    const skeleton = mapEngineToReport(engineResult)
    baseContract = createReportContract(engineResult, skeleton)
    log('STEP_3_MAP_CONTRACT', true)
  } catch (e) {
    log('STEP_3_MAP_CONTRACT', false, { error: e.message })
    return { code: 5001, message: 'V4_CONTRACT_MAP_ERROR', data: { error: e.message }, stages }
  }

  // ── STEP 4: 验证 Contract ──
  try {
    assertValid(baseContract)
    log('STEP_4_VALIDATE_CONTRACT', true)
  } catch (e) {
    log('STEP_4_VALIDATE_CONTRACT', false, { error: e.message })
    // Contract 无效 → 使用 fallback
    const fallback = generateFallbackReport(baseContract)
    const legacy = mapV4ToLegacyFields(fallback.report)
    return {
      code: 0,
      message: 'success',
      data: buildV4Response(fallback, legacy, 'rule_fallback'),
      stages,
    }
  }

  // ── STEP 5: 构建 Prompt ──
  let payload, systemPrompt, userMessage
  try {
    payload = buildPromptPayload(baseContract, engineResult)
    systemPrompt = buildSystemPrompt()
    userMessage = buildUserPrompt(payload)
    log('STEP_5_BUILD_PROMPT', true)
  } catch (e) {
    log('STEP_5_BUILD_PROMPT', false, { error: e.message })
    return goFallback(baseContract, stages)
  }

  // ── STEP 6: 调用 AI ──
  let aiResult
  try {
    aiResult = await callAI({ systemPrompt, userMessage })
    log('STEP_6_CALL_AI', aiResult.success, {
      tokens: aiResult.tokens || 0,
      errorCode: aiResult.error ? 'AI_ERROR' : undefined,
    })
  } catch (e) {
    log('STEP_6_CALL_AI', false, { error: e.message })
    return goFallback(baseContract, stages)
  }

  if (!aiResult.success) {
    return goFallback(baseContract, stages)
  }

  // ── STEP 7: 解析 AI 输出 ──
  let parsedAI
  try {
    parsedAI = parseAIOutput(aiResult.content || '')
    log('STEP_7_PARSE_AI_OUTPUT', parsedAI.ok, {
      rawLength: parsedAI.rawLength || 0,
      errorCode: parsedAI.ok ? undefined : parsedAI.code,
    })
  } catch (e) {
    log('STEP_7_PARSE_AI_OUTPUT', false, { error: e.message })
    return goFallback(baseContract, stages)
  }

  if (!parsedAI.ok) {
    return goFallback(baseContract, stages)
  }

  // ── STEP 8: 合并报告 ──
  let mergedResult
  try {
    mergedResult = mergeReportV4(baseContract, parsedAI.data)
    log('STEP_8_MERGE_REPORT', mergedResult.ok, {
      violations: mergedResult.ok ? undefined : (mergedResult.violations || []).length,
    })
  } catch (e) {
    log('STEP_8_MERGE_REPORT', false, { error: e.message })
    return goFallback(baseContract, stages)
  }

  if (!mergedResult.ok) {
    return goFallback(baseContract, stages)
  }

  // ── STEP 9: 守卫报告 ──
  let guardResult
  try {
    guardResult = guardReportV4(baseContract, mergedResult.data)
    log('STEP_9_GUARD_REPORT', guardResult.ok, {
      violations: guardResult.ok ? undefined : (guardResult.violations || []).length,
    })
  } catch (e) {
    log('STEP_9_GUARD_REPORT', false, { error: e.message })
    return goFallback(baseContract, stages)
  }

  if (!guardResult.ok) {
    return goFallback(baseContract, stages)
  }

  // ── STEP 10: 成功返回 ──
  const finalReport = mergedResult.data
  const legacy = mapV4ToLegacyFields(finalReport.report)
  log('STEP_10_COMPLETE', true, { renderSource: 'ai_rendered' })

  return {
    code: 0,
    message: 'success',
    data: buildV4Response(finalReport, legacy, 'ai_rendered'),
    stages,
  }
}

// ═══════════════════════════════════════════════════════════════
// 辅助
// ═══════════════════════════════════════════════════════════════

function goFallback(baseContract, stages) {
  const fallback = generateFallbackReport(baseContract)
  const legacy = mapV4ToLegacyFields(fallback.report)
  stages.push({ stage: 'FALLBACK', ok: true, timestamp: Date.now(), renderSource: 'rule_fallback' })
  return {
    code: 0,
    message: 'success',
    data: buildV4Response(fallback, legacy, 'rule_fallback'),
    stages,
  }
}

function buildV4Response(contract, legacy, renderSource) {
  return {
    reportId: contract.reportId,
    reportType: 'diagnostic_v4',
    diagnosticVersion: 'v4',
    engineVersion: contract.engineVersion,
    renderSource,
    report: contract.report,
    legacy,
    answersSnapshot: null, // 由调用方填充
  }
}

module.exports = {
  runDiagnosticV4,
  validateV4Answers,
  normalizeV4Input,
  mapV4ToLegacyFields,
  REQUIRED_V4_KEYS,
}
