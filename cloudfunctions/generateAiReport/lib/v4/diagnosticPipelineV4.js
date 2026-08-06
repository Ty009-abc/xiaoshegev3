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
 *
 * ALL failure paths route through routeFinalFallback (fallbackRouter.js).
 * No individual catch block may construct its own fallback response.
 */

const { analyze } = require('../engine/turnaroundEngineV4')
const { mapEngineToReport } = require('../report/reportMapperV4')
const { createReportContract } = require('../report/reportContractV4')
const { assertValid } = require('../report/reportValidatorV4')
const { buildPromptPayload } = require('../prompt-v4/promptPayloadV4')
const { buildSystemPrompt, buildUserPrompt } = require('../prompt-v4/diagnosticPromptV4')
const { parseAIOutput } = require('../prompt-v4/aiOutputParserV4')
const { mergeReportV4 } = require('../prompt-v4/reportMergeV4')
const { guardReportV4 } = require('../prompt-v4/reportGuardV4')

// ── Single unified fallback router ──
const { routeFinalFallback } = require('./fallbackRouter')

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
  return { valid: missing.length === 0, missingKeys: missing }
}

function normalizeV4Input(event) {
  if (event.answers && typeof event.answers === 'object') {
    if (event.diagnosticVersion === 'v4' || event.answers.diagnosticVersion === 'v4') {
      return event.answers.answers || event.answers
    }
  }
  if (event.diagnosticVersion === 'v4') {
    return event
  }
  return null
}

// ═══════════════════════════════════════════════════════════════
// Diagnosis Trace
// ═══════════════════════════════════════════════════════════════

function extractDiagnosisTrace(diagnosis) {
  if (!diagnosis) return { available: false, reason: 'diagnosis object is null/undefined' }

  var trace = {
    available: true,
    engineVersion: diagnosis.engineVersion || 'unknown',
    primaryGoal: diagnosis.primaryGoal || null,
    rInc001Status: diagnosis.rInc001Status || 'UNKNOWN',

    behaviorTags: {
      total: (diagnosis.behaviorTags || []).length,
      categories: {},
      topSignals: [],
    },

    archetype: {
      primary: (diagnosis.wealthProfile || {}).primary || 'UNDETERMINED',
      primaryTitle: (diagnosis.wealthProfile || {}).primaryTitle || '',
      secondary: (diagnosis.wealthProfile || {}).secondary || 'UNDETERMINED',
      confidence: (diagnosis.wealthProfile || {}).confidence || 0,
    },

    bottleneck: {
      id: (diagnosis.bottleneck || {}).id || 'UNKNOWN',
      label: (diagnosis.bottleneck || {}).label || '',
      confidence: (diagnosis.bottleneck || {}).confidence || 0,
      suppressedSingleIncome: diagnosis.rInc001Status === 'BACKGROUND_ONLY',
    },

    strategy: {
      id: (diagnosis.strategy || {}).id || 'UNKNOWN',
      label: (diagnosis.strategy || {}).strategyLabel || '',
      confidence: (diagnosis.strategy || {}).confidence || 0,
      day1Mission: (diagnosis.strategy || {}).day1Mission || '',
      milestones: (diagnosis.strategy || {}).milestones || [],
    },
  }

  var tags = diagnosis.behaviorTags || []
  tags.forEach(function(t) {
    var cat = t.category || 'OTHER'
    trace.behaviorTags.categories[cat] = (trace.behaviorTags.categories[cat] || 0) + 1
  })

  var sorted = [].concat(tags)
    .sort(function(a, b) { return (b.weight || 0) - (a.weight || 0) })
    .slice(0, 5)
    .map(function(t) {
      return {
        id: t.id,
        label: t.label || t.id,
        weight: t.weight || 0,
        category: t.category || 'OTHER',
        signal: t.signal || 'NEUTRAL',
      }
    })
  trace.behaviorTags.topSignals = sorted

  return trace
}

// ═══════════════════════════════════════════════════════════════
// 主管线
// ═══════════════════════════════════════════════════════════════

async function runDiagnosticV4({ answers, userContext = {}, diagnosis, callAI }) {
  const stages = []
  const log = (stage, ok, extra = {}) => {
    stages.push({ stage, ok, timestamp: Date.now(), ...extra })
  }

  // ── STEP 1 ──
  const validation = validateV4Answers(answers)
  if (!validation.valid) {
    log('STEP_1_VALIDATE_INPUT', false, { missingKeys: validation.missingKeys })
    return { code: 4004, message: 'V4_DIAGNOSTIC_INPUT_INVALID', data: { missingKeys: validation.missingKeys }, stages }
  }
  log('STEP_1_VALIDATE_INPUT', true)

  // ── STEP 2 ──
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
    return routeFinalFallback({ diagnosis, baseContract: null, stages, stage: 'STEP_2_RUN_ENGINE', reasonCode: 'ENGINE_EXCEPTION', reason: e.message })
  }

  // ── STEP 3 ──
  let baseContract
  try {
    const skeleton = mapEngineToReport(engineResult)
    baseContract = createReportContract(engineResult, skeleton)
    log('STEP_3_MAP_CONTRACT', true)
  } catch (e) {
    log('STEP_3_MAP_CONTRACT', false, { error: e.message })
    return routeFinalFallback({ diagnosis, baseContract, stages, stage: 'STEP_3_MAP_CONTRACT', reasonCode: 'CONTRACT_MAP_ERROR', reason: e.message })
  }

  // ── STEP 4 ──
  try {
    assertValid(baseContract)
    log('STEP_4_VALIDATE_CONTRACT', true)
  } catch (e) {
    log('STEP_4_VALIDATE_CONTRACT', false, { error: e.message })
    return routeFinalFallback({ diagnosis, baseContract, stages, stage: 'STEP_4_VALIDATE_CONTRACT', reasonCode: 'REPORT_CONTRACT_INVALID', reason: e.message })
  }

  // ── STEP 5 ──
  let payload, systemPrompt, userMessage
  try {
    payload = buildPromptPayload(baseContract, engineResult)
    systemPrompt = buildSystemPrompt()
    userMessage = buildUserPrompt(payload, engineResult)
    log('STEP_5_BUILD_PROMPT', true)
  } catch (e) {
    log('STEP_5_BUILD_PROMPT', false, { error: e.message })
    return routeFinalFallback({ diagnosis, baseContract, stages, stage: 'STEP_5_BUILD_PROMPT', reasonCode: 'PROMPT_BUILD_FAILED', reason: e.message })
  }

  // ── STEP 6 ──
  let aiResult
  var providerTrace = null
  try {
    aiResult = await callAI({ systemPrompt, userMessage })
    providerTrace = aiResult.providerTrace || null
    log('STEP_6_CALL_AI', aiResult.success, {
      tokens: aiResult.tokens || 0,
      finishReason: aiResult.finishReason || null,
      outputLength: aiResult.content ? aiResult.content.length : 0,
      httpStatus: aiResult.httpStatus || null,
      providerErrorCode: aiResult.providerErrorCode || null,
      truncated: aiResult.truncated || false,
    })
  } catch (e) {
    log('STEP_6_CALL_AI', false, { error: e.message })
    return routeFinalFallback({ diagnosis, baseContract, stages, stage: 'STEP_6_CALL_AI', reasonCode: 'AI_CALL_EXCEPTION', reason: e.message, guardErrors: [], providerTrace: null })
  }
  if (!aiResult.success) {
    // ── RC8.2: Classified provider error → structured fallback ──
    var pCode = aiResult.providerErrorCode || 'AI_PROVIDER_ERROR'
    return routeFinalFallback({
      diagnosis, baseContract, stages,
      stage: 'STEP_6_CALL_AI',
      reasonCode: pCode,
      reason: (aiResult.error || 'AI returned non-success') + ' | httpStatus=' + (aiResult.httpStatus || 'N/A'),
      guardErrors: [],
      providerTrace: providerTrace,
    })
  }

  // ── STEP 7 ──
  let parsedAI
  var aiMeta = {
    finishReason: aiResult.finishReason || null,
    responseTruncated: aiResult.finishReason === 'length' || aiResult.truncated === true,
    maxTokens: aiResult.maxTokens || null,
  }
  try {
    parsedAI = parseAIOutput(aiResult.content || '', aiMeta)
    log('STEP_7_PARSE_AI_OUTPUT', parsedAI.ok, {
      rawLength: parsedAI.rawLength || 0,
      extractionMethod: parsedAI.parseTrace ? parsedAI.parseTrace.extractionMethod : 'UNKNOWN',
      parseAttempts: parsedAI.parseTrace ? parsedAI.parseTrace.parseAttempts : 0,
      repairAttempted: parsedAI.parseTrace ? parsedAI.parseTrace.repairAttempted : false,
      repairSucceeded: parsedAI.parseTrace ? parsedAI.parseTrace.repairSucceeded : false,
      responseTruncated: aiMeta.responseTruncated,
    })
  } catch (e) {
    log('STEP_7_PARSE_AI_OUTPUT', false, { error: e.message })
    return routeFinalFallback({ diagnosis, baseContract, stages, stage: 'STEP_7_PARSE_AI', reasonCode: 'AI_PARSE_EXCEPTION', reason: e.message })
  }

  // Attach parse trace to stages for observability
  if (parsedAI.parseTrace) {
    parsedAI.parseTrace.finishReason = aiMeta.finishReason
    parsedAI.parseTrace.responseTruncated = aiMeta.responseTruncated
    stages[stages.length - 1].aiParseTrace = parsedAI.parseTrace
  }

  if (!parsedAI.ok) {
    var parseCode = parsedAI.code || 'V4_AI_JSON_PARSE_FAILED'

    // ── RC8.2: Hard assertion — diagnosis MUST be available at parse failure ──
    if (!diagnosis) {
      console.error('[RC8][DIAGNOSIS_CONTEXT_LOST]', JSON.stringify({
        traceId: 'V4_' + (baseContract ? baseContract.reportId : 'UNKNOWN'),
        stage: 'STEP_7_PARSE_AI',
        parseCode: parseCode,
        diagnosisCreatedEarlier: false,
        diagnosisVariableType: typeof diagnosis,
      }))
    } else {
      console.log('[RC8][DIAGNOSIS_AVAILABLE_AT_PARSE_FAIL]', JSON.stringify({
        traceId: 'V4_' + (baseContract ? baseContract.reportId : 'UNKNOWN'),
        stage: 'STEP_7_PARSE_AI',
        parseCode: parseCode,
        bottleneck: diagnosis.bottleneck ? diagnosis.bottleneck.id : 'NONE',
        strategy: diagnosis.strategy ? diagnosis.strategy.id : 'NONE',
      }))
    }

    return routeFinalFallback({
      diagnosis, baseContract, stages,
      stage: 'STEP_7_PARSE_AI',
      reasonCode: parseCode,
      reason: (parsedAI.reason || '') + ' | method=' + (parsedAI.parseTrace ? parsedAI.parseTrace.extractionMethod : 'NONE'),
      guardErrors: [],
      aiParseTrace: parsedAI.parseTrace || null,
    })
  }

  // ── STEP 8 ──
  let mergedResult
  try {
    mergedResult = mergeReportV4(baseContract, parsedAI.data)
    log('STEP_8_MERGE_REPORT', mergedResult.ok, { violations: mergedResult.ok ? undefined : (mergedResult.violations || []).length })
  } catch (e) {
    log('STEP_8_MERGE_REPORT', false, { error: e.message })
    return routeFinalFallback({ diagnosis, baseContract, stages, stage: 'STEP_8_MERGE', reasonCode: 'REPORT_MERGE_EXCEPTION', reason: e.message })
  }
  if (!mergedResult.ok) {
    return routeFinalFallback({ diagnosis, baseContract, stages, stage: 'STEP_8_MERGE', reasonCode: 'REPORT_MERGE_VIOLATION', reason: (mergedResult.violations || []).join('; '), guardErrors: mergedResult.violations || [] })
  }

  // ── STEP 9 ──
  let guardResult
  try {
    guardResult = guardReportV4(baseContract, mergedResult.data)
    log('STEP_9_GUARD_REPORT', guardResult.ok, { violations: guardResult.ok ? undefined : (guardResult.violations || []).length })
  } catch (e) {
    log('STEP_9_GUARD_REPORT', false, { error: e.message })
    return routeFinalFallback({ diagnosis, baseContract, stages, stage: 'STEP_9_GUARD', reasonCode: 'REPORT_CONTRACT_EXCEPTION', reason: e.message })
  }
  if (!guardResult.ok) {
    return routeFinalFallback({ diagnosis, baseContract, stages, stage: 'STEP_9_GUARD', reasonCode: 'REPORT_CONTRACT_FAILED', reason: (guardResult.violations || []).join('; '), guardErrors: guardResult.violations || [] })
  }

  // ── STEP 9.5 ──
  var contentSafety = require('../config/contentSafetyGate')
  var reportBuilder = require('./diagnosisReportBuilder')
  var csCtx = {
    strategyId: baseContract.report && baseContract.report._strategyId || (diagnosis && diagnosis.strategy && diagnosis.strategy.id) || null,
  }

  var safetyResult = contentSafety.contentSafetyGate(
    mergedResult.data.report,
    function() {
      // Fallback: diagnosis exists → safe_minimal; else legacy
      if (diagnosis) {
        return reportBuilder.buildSafeMinimalFromDiagnosis(diagnosis)
      }
      var { generateFallbackReport } = require('../prompt-v4/reportGuardV4')
      return generateFallbackReport(baseContract)
    },
    csCtx
  )
  mergedResult.data.report = safetyResult.report
  mergedResult.data.contentValidation = safetyResult.validation

  log('STEP_9_5_CONTENT_SAFETY', safetyResult.validation.initialPass, {
    initialErrors: safetyResult.validation.initialErrors,
    initialViolations: safetyResult.validation.initialViolations,
    repairAttempted: safetyResult.validation.repairAttempted,
    repairViolations: safetyResult.validation.repairViolations,
    repairedPass: safetyResult.validation.repairedPass,
    fallbackAttempted: safetyResult.validation.fallbackAttempted,
    fallbackValidationViolations: safetyResult.validation.fallbackValidationViolations,
    fallbackUsed: safetyResult.validation.fallbackUsed,
    finalPass: safetyResult.validation.finalPass,
    finalErrors: safetyResult.validation.finalErrors,
    finalViolations: safetyResult.validation.finalViolations,
  })

  if (safetyResult.validation.fallbackUsed) {
    var safetyErrors = (safetyResult.validation.initialViolations || []).map(function(v) { return v.code + '(' + v.path + '): ' + v.matchedText })
    return routeFinalFallback({
      diagnosis, baseContract, stages,
      stage: 'STEP_9_5_CONTENT_SAFETY',
      reasonCode: 'CONTENT_SAFETY_VIOLATION',
      reason: 'Content safety unrecoverable: ' + safetyResult.validation.initialErrors + ' AI violations',
      guardErrors: safetyErrors,
    })
  }

  // ── STEP 10: success ──
  var finalReport = mergedResult.data
  finalReport.diagnosisTrace = extractDiagnosisTrace(diagnosis)
  if (finalReport.diagnosisTrace) {
    finalReport.diagnosisTrace.fallbackSource = 'none'
  }
  var legacy = mapV4ToLegacyFields(finalReport.report)

  // Build response directly (no router needed for success path)
  log('STEP_10_COMPLETE', true, { renderSource: 'ai_rendered' })

  return {
    code: 0,
    message: 'success',
    data: {
      reportId: finalReport.reportId,
      reportType: 'diagnostic_v4',
      diagnosticVersion: 'v4',
      engineVersion: finalReport.engineVersion,
      renderSource: 'ai_rendered',
      report: finalReport.report,
      legacy: legacy,
      contentValidation: finalReport.contentValidation || null,
      diagnosisTrace: finalReport.diagnosisTrace || null,
      diagnosticSnapshot: finalReport.diagnosticSnapshot || null,
      fallbackRouterTrace: null,
      aiParseTrace: parsedAI ? parsedAI.parseTrace : null,
      providerTrace: aiResult ? aiResult.providerTrace : null,
      fallbackSource: null,
      fallbackReasonCode: null,
      legacyFallbackInvoked: false,
      answersSnapshot: null,
    },
    stages,
  }
}

// ═══════════════════════════════════════════════════════════════
// Map V4 report → legacy fields (for backward compat)
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

  const stageLabelMap = {
    SURVIVAL: '生存模式', STABLE: '稳定模式', ACCUMULATION: '积累模式',
    LEVERAGE: '杠杆模式', SYSTEM: '系统模式', FREEDOM: '自由模式',
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
// Backward compat: fallback() and routeFallback() delegate to routeFinalFallback
// ═══════════════════════════════════════════════════════════════

function routeFallback(params) {
  return routeFinalFallback(params)
}

function fallback({ diagnosis, baseContract, stages, err }) {
  return routeFinalFallback({
    diagnosis: diagnosis,
    baseContract: baseContract,
    stages: stages,
    stage: (err && err.stage) || 'UNKNOWN',
    reasonCode: (err && err.reasonCode) || 'UNKNOWN',
    reason: (err && err.reason) || '',
    guardErrors: (err && err.guardErrors) || [],
  })
}

module.exports = {
  runDiagnosticV4,
  validateV4Answers,
  normalizeV4Input,
  mapV4ToLegacyFields,
  extractDiagnosisTrace,
  routeFallback,
  fallback,
  REQUIRED_V4_KEYS,
}
