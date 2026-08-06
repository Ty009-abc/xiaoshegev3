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
// Diagnosis Trace — captures full decision chain
// ═══════════════════════════════════════════════════════════════

/**
 * RC8.2: Extract full diagnosis trace from diagnosis object.
 * Captures: behavior tags → archetype → bottleneck → strategy → diagnosis
 */
function extractDiagnosisTrace(diagnosis) {
  if (!diagnosis) return { available: false, reason: 'diagnosis object is null/undefined' }

  var trace = {
    available: true,
    engineVersion: diagnosis.engineVersion || 'unknown',
    primaryGoal: diagnosis.primaryGoal || null,
    rInc001Status: diagnosis.rInc001Status || 'UNKNOWN',

    // Layer 1: behavior tags
    behaviorTags: {
      total: (diagnosis.behaviorTags || []).length,
      categories: {},
      topSignals: [],
    },

    // Layer 2: archetype
    archetype: {
      primary: (diagnosis.wealthProfile || {}).primary || 'UNDETERMINED',
      primaryTitle: (diagnosis.wealthProfile || {}).primaryTitle || '',
      secondary: (diagnosis.wealthProfile || {}).secondary || 'UNDETERMINED',
      confidence: (diagnosis.wealthProfile || {}).confidence || 0,
    },

    // Layer 3: bottleneck
    bottleneck: {
      id: (diagnosis.bottleneck || {}).id || 'UNKNOWN',
      label: (diagnosis.bottleneck || {}).label || '',
      confidence: (diagnosis.bottleneck || {}).confidence || 0,
      suppressedSingleIncome: diagnosis.rInc001Status === 'BACKGROUND_ONLY',
    },

    // Layer 4: strategy
    strategy: {
      id: (diagnosis.strategy || {}).id || 'UNKNOWN',
      label: (diagnosis.strategy || {}).strategyLabel || '',
      confidence: (diagnosis.strategy || {}).confidence || 0,
      day1Mission: (diagnosis.strategy || {}).day1Mission || '',
      milestones: (diagnosis.strategy || {}).milestones || [],
    },
  }

  // Compute category breakdown
  var tags = diagnosis.behaviorTags || []
  tags.forEach(function(t) {
    var cat = t.category || 'OTHER'
    trace.behaviorTags.categories[cat] = (trace.behaviorTags.categories[cat] || 0) + 1
  })

  // Top 5 highest-weight signals
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

/**
 * @param {Object} options
 * @param {Object} options.answers — 归一化后的 15-key answers
 * @param {Object} options.userContext — { openid, recordId }
 * @param {Object} options.diagnosis — RC8 diagnosis object (from client engine/diagnosisPipeline)
 * @param {Function} options.callAI — (systemPrompt, userMessage) => AI result
 * @returns {Object} pipeline result
 */
async function runDiagnosticV4({ answers, userContext = {}, diagnosis, callAI }) {
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
    return diagnosisFallback(diagnosis, baseContract, stages, 'STEP_4_VALIDATE_CONTRACT')
  }

  // ── STEP 5: 构建 Prompt ──
  let payload, systemPrompt, userMessage
  try {
    payload = buildPromptPayload(baseContract, engineResult)
    systemPrompt = buildSystemPrompt()
    userMessage = buildUserPrompt(payload, engineResult)
    log('STEP_5_BUILD_PROMPT', true)
  } catch (e) {
    log('STEP_5_BUILD_PROMPT', false, { error: e.message })
    return diagnosisFallback(diagnosis, baseContract, stages, 'STEP_5_BUILD_PROMPT: ' + e.message)
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
    return diagnosisFallback(diagnosis, baseContract, stages, 'STEP_6_CALL_AI: ' + e.message)
  }

  if (!aiResult.success) {
    return diagnosisFallback(diagnosis, baseContract, stages, 'STEP_6_CALL_AI: ' + (aiResult.error || 'AI returned non-success'))
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
    return diagnosisFallback(diagnosis, baseContract, stages, 'STEP_7_PARSE_AI: ' + e.message)
  }

  if (!parsedAI.ok) {
    return diagnosisFallback(diagnosis, baseContract, stages, 'STEP_7_PARSE_AI: ' + (parsedAI.code || '') + ' — ' + (parsedAI.reason || ''))
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
    return diagnosisFallback(diagnosis, baseContract, stages, 'STEP_8_MERGE: ' + e.message)
  }

  if (!mergedResult.ok) {
    const mergeViolations = (mergedResult.violations || []).join('; ')
    return diagnosisFallback(diagnosis, baseContract, stages, 'STEP_8_MERGE_VIOLATIONS: ' + mergeViolations)
  }

  // ── STEP 9: 守卫报告（结构契约） ──
  let guardResult
  try {
    guardResult = guardReportV4(baseContract, mergedResult.data)
    log('STEP_9_GUARD_REPORT', guardResult.ok, {
      violations: guardResult.ok ? undefined : (guardResult.violations || []).length,
    })
  } catch (e) {
    log('STEP_9_GUARD_REPORT', false, { error: e.message })
    return diagnosisFallback(diagnosis, baseContract, stages, 'STEP_9_GUARD: ' + e.message)
  }

  if (!guardResult.ok) {
    const guardViolations = (guardResult.violations || []).join('; ')
    return diagnosisFallback(diagnosis, baseContract, stages, 'STEP_9_GUARD_VIOLATIONS: ' + guardViolations)
  }

  // ── STEP 9.5: 内容安全门禁（硬阻断） ──
  var contentSafety = require('../config/contentSafetyGate')
  var context = { strategyId: baseContract.report?._strategyId || null }
  var safetyResult = contentSafety.contentSafetyGate(
    mergedResult.data.report,
    function() { return generateFallbackReport(baseContract).report },
    context
  )

  mergedResult.data.report = safetyResult.report
  mergedResult.data.contentValidation = safetyResult.validation

  log('STEP_9_5_CONTENT_SAFETY', safetyResult.validation.initialPass, {
    initialErrors: safetyResult.validation.initialErrors,
    repairAttempted: safetyResult.validation.repairAttempted,
    repairedPass: safetyResult.validation.repairedPass,
    fallbackUsed: safetyResult.validation.fallbackUsed,
    finalErrors: safetyResult.validation.finalErrors,
  })

  if (safetyResult.validation.fallbackUsed) {
    return diagnosisFallback(diagnosis, baseContract, stages, 'STEP_9_5_CONTENT_SAFETY: content violations unrecoverable')
  }

  // ── STEP 10: 成功返回 ──
  const finalReport = mergedResult.data
  finalReport.diagnosisTrace = extractDiagnosisTrace(diagnosis)
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
// Fallback
// ═══════════════════════════════════════════════════════════════

/**
 * RC8.2: Diagnosis-driven fallback. Uses RC8 diagnosis object (NOT legacy rule engine fatalRules)
 * to build the report. Falls back to legacy rule_fallback ONLY when diagnosis is absent/invalid.
 */
function diagnosisFallback(diagnosis, baseContract, stages, reason) {
  var reportBuilder = require('./diagnosisReportBuilder')

  var diagReport = null
  var fallbackSource = 'legacy'

  if (diagnosis) {
    try {
      diagReport = reportBuilder.buildReportFromDiagnosis(diagnosis, baseContract, 'diagnosis_fallback')
      var assert = reportBuilder.assertDiagnosisReport(diagReport)
      if (assert.ok) {
        fallbackSource = 'diagnosis'
      } else {
        console.warn('[diagnosisFallback] Diagnosis report assertion failed:', assert.errors)
        diagReport = null
      }
    } catch (e) {
      console.error('[diagnosisFallback] Failed to build diagnosis report:', e.message)
      diagReport = null
    }
  }

  if (!diagReport) {
    console.warn('[diagnosisFallback] No valid diagnosis — using legacy rule_fallback (source=legacy)')
    var legacyFallback = generateFallbackReport(baseContract)
    if (reason && legacyFallback.report) {
      legacyFallback.report._fallbackReason = reason
    }
    diagReport = legacyFallback
    fallbackSource = 'legacy'
  } else if (reason && diagReport.report) {
    diagReport.report._fallbackReason = reason
  }

  var legacy = mapV4ToLegacyFields(diagReport.report)

  // Build diagnosis trace with fallback metadata
  var trace = extractDiagnosisTrace(diagnosis)
  if (trace) {
    trace.fallbackSource = fallbackSource
    trace.fallbackReason = reason
    trace.fallbackReportSource = diagReport.report ? diagReport.report._fallbackSource : null
  }
  diagReport.diagnosisTrace = trace

  stages.push({
    stage: 'FALLBACK',
    ok: fallbackSource === 'diagnosis',
    timestamp: Date.now(),
    renderSource: fallbackSource === 'diagnosis' ? 'diagnosis_fallback' : 'rule_fallback',
    fallbackSource: fallbackSource,
    reason: reason,
  })

  return {
    code: 0,
    message: 'success',
    data: buildV4Response(diagReport, legacy, fallbackSource === 'diagnosis' ? 'diagnosis_fallback' : 'rule_fallback'),
    stages,
    _fallbackSource: fallbackSource,
  }
}

/**
 * @deprecated — Use diagnosisFallback instead. Kept for backward compat.
 */
function goFallback(baseContract, stages, reason) {
  console.warn('[goFallback] DEPRECATED — use diagnosisFallback instead')
  var fallback = generateFallbackReport(baseContract)
  if (reason && fallback.report) {
    fallback.report._fallbackReason = reason
  }
  fallback.diagnosisTrace = { available: false, reason: 'goFallback (deprecated) — no diagnosis object' }
  var legacy = mapV4ToLegacyFields(fallback.report)
  stages.push({ stage: 'FALLBACK', ok: false, timestamp: Date.now(), renderSource: 'rule_fallback', fallbackSource: 'legacy', reason })
  return {
    code: 0,
    message: 'success',
    data: buildV4Response(fallback, legacy, 'rule_fallback'),
    stages,
    _fallbackSource: 'legacy',
  }
}

// ═══════════════════════════════════════════════════════════════
// 响应构建
// ═══════════════════════════════════════════════════════════════

function buildV4Response(contract, legacy, renderSource) {
  return {
    reportId: contract.reportId,
    reportType: 'diagnostic_v4',
    diagnosticVersion: 'v4',
    engineVersion: contract.engineVersion,
    renderSource,
    report: contract.report,
    legacy,
    contentValidation: contract.contentValidation || null,
    diagnosisTrace: contract.diagnosisTrace || null,
    answersSnapshot: null,
  }
}

module.exports = {
  runDiagnosticV4,
  validateV4Answers,
  normalizeV4Input,
  mapV4ToLegacyFields,
  extractDiagnosisTrace,
  REQUIRED_V4_KEYS,
}
