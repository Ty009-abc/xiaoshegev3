/**
 * lib/v4/fallbackRouter.js
 *
 * RC8.2: Unified Fallback Router — the single choke point for every
 * failure path in the V4 pipeline. No other code may return a
 * fallback response directly.
 *
 * RULES (in priority order):
 *   1. diagnosis EXISTS → SAFE_MINIMAL_DIAGNOSIS
 *   2. diagnosis EXISTS but safe_minimal fails → safe_minimal_retry (assertion error)
 *   3. diagnosis ABSENT → legacy compatibility (rule_fallback)
 *
 * ABSOLUTELY FORBIDDEN:
 *   - Any code returning legacy_fallback when diagnosis is available
 *   - Any code bypassing this router to call generateFallbackReport directly
 *   - Any code constructing its own response that says "legacy_fallback"
 */

var reportBuilder = require('./diagnosisReportBuilder')
var contentSafety = require('../config/contentSafetyGate')
var { generateFallbackReport } = require('../prompt-v4/reportGuardV4')

/**
 * Unified fallback router — single exit point for ALL failure paths.
 *
 * @param {{
 *   diagnosis: Object|null,
 *   baseContract: Object|null,
 *   stages: Array,
 *   stage: string,       // e.g. "STEP_7_PARSE_AI"
 *   reasonCode: string,  // e.g. "V4_AI_JSON_PARSE_FAILED"
 *   reason: string,      // human-readable reason
 *   guardErrors: Array<string>,
 *   aiParseTrace: Object|null,
 * }} params
 * @returns pipeline result object
 */
function routeFinalFallback(params) {
  var diagnosis = params.diagnosis || null
  var baseContract = params.baseContract || null
  var stages = params.stages || []
  var stage = params.stage || 'UNKNOWN'
  var reasonCode = params.reasonCode || 'UNKNOWN'
  var reason = params.reason || ''
  var guardErrors = params.guardErrors || []
  var aiParseTrace = params.aiParseTrace || null

  // ── Router trace (diagnostic metadata) ──
  var routerTrace = {
    routerVersion: 'RC8.2',
    stage: stage,
    reasonCode: reasonCode,
    diagnosisAvailable: !!diagnosis,
    selectedFallback: 'PENDING',
    legacyAllowed: !diagnosis,
    finalSource: 'PENDING',
    safeMinimalBuilt: false,
    safeMinimalValidated: false,
    diagnosisReportBuilt: false,
    diagnosisReportValidated: false,
    legacyFallbackInvoked: false,
  }

  var diagReport = null
  var renderSource = 'PENDING'

  // ════════════════════════════════════════════════════════
  // PATH A: Diagnosis EXISTS → SAFE_MINIMAL_DIAGNOSIS
  // ════════════════════════════════════════════════════════
  if (diagnosis) {
    routerTrace.legacyAllowed = false

    // Try full diagnosis report first (richer output)
    try {
      diagReport = reportBuilder.buildReportFromDiagnosis(diagnosis, baseContract, 'diagnosis_fallback')
      var assertResult = reportBuilder.assertDiagnosisReport(diagReport)
      routerTrace.diagnosisReportBuilt = true

      if (assertResult.ok) {
        // Full report structurally valid — run safety on it
        var csResult = contentSafety.contentSafetyGate(
          diagReport.report,
          function() {
            // If full report fails safety, use safe_minimal
            routerTrace.selectedFallback = 'SAFE_MINIMAL_DIAGNOSIS'
            return reportBuilder.buildSafeMinimalFromDiagnosis(diagnosis)
          },
          { strategyId: (diagnosis.strategy || {}).id || null }
        )

        diagReport.report = csResult.report
        diagReport.report.contentValidation = csResult.validation

        routerTrace.diagnosisReportValidated = csResult.validation.finalPass

        if (!csResult.validation.finalPass && csResult.validation.fallbackUsed) {
          // Full report failed safety → safe_minimal
          routerTrace.selectedFallback = 'SAFE_MINIMAL_DIAGNOSIS'
          routerTrace.finalSource = 'SAFE_MINIMAL_DIAGNOSIS'
          routerTrace.safeMinimalBuilt = true
          routerTrace.safeMinimalValidated = true
          renderSource = 'safe_minimal_diagnosis'
          diagReport._fallbackSource = 'SAFE_MINIMAL_DIAGNOSIS'
        } else {
          // Full report passed safety — use it
          routerTrace.selectedFallback = 'diagnosis_fallback'
          routerTrace.finalSource = 'diagnosis_fallback'
          renderSource = 'diagnosis_fallback'
          diagReport._fallbackSource = 'diagnosis'
        }
      } else {
        // Full report structural assertion failed → safe_minimal directly
        routerTrace.selectedFallback = 'SAFE_MINIMAL_DIAGNOSIS'
        routerTrace.finalSource = 'SAFE_MINIMAL_DIAGNOSIS'
        renderSource = 'safe_minimal_diagnosis'

        diagReport = reportBuilder.buildSafeMinimalFromDiagnosis(diagnosis)
        routerTrace.safeMinimalBuilt = true

        // Validate safe_minimal too (should always pass)
        var smValidation = contentSafety.validateFullReport(diagReport.report, {})
        routerTrace.safeMinimalValidated = smValidation.passed
        if (!smValidation.passed) {
          console.error('[routeFinalFallback] CRITICAL: safe_minimal template failed validation!', smValidation.violations)
          // Still use it — it's the best we have
        }
        diagReport._fallbackSource = 'SAFE_MINIMAL_DIAGNOSIS'
      }
    } catch (e) {
      // Exception building full report → safe_minimal
      console.error('[routeFinalFallback] Exception building diagnosis report:', e.message)
      routerTrace.selectedFallback = 'SAFE_MINIMAL_DIAGNOSIS'
      routerTrace.finalSource = 'SAFE_MINIMAL_DIAGNOSIS'
      renderSource = 'safe_minimal_diagnosis'

      diagReport = reportBuilder.buildSafeMinimalFromDiagnosis(diagnosis)
      routerTrace.safeMinimalBuilt = true
      diagReport._fallbackSource = 'SAFE_MINIMAL_DIAGNOSIS'
    }
  }

  // ════════════════════════════════════════════════════════
  // PATH B: Diagnosis ABSENT → legacy compatibility ONLY
  // ════════════════════════════════════════════════════════
  if (!diagReport) {
    if (routerTrace.diagnosisAvailable) {
      // Should not happen: diagnosis available but couldn't build even safe_minimal
      console.error('[routeFinalFallback] DIAGNOSIS AVAILABLE but no report built — falling to legacy as ABSOLUTE LAST RESORT')
    }
    routerTrace.selectedFallback = 'legacy_fallback'
    routerTrace.finalSource = 'legacy_fallback'
    routerTrace.legacyFallbackInvoked = true
    routerTrace.legacyAllowed = true
    renderSource = 'legacy_fallback'

    var lf = null
    try {
      lf = generateFallbackReport(baseContract)
    } catch (e) {
      console.error('[routeFinalFallback] generateFallbackReport failed:', e.message)
      // Build absolute minimal fallback
      lf = {
        reportId: 'fallback_' + Date.now(),
        report: {
          headline: { title: '报告生成遇阻', subtitle: '请重新尝试' },
          wealthStage: 'STABLE',
          fatalDiagnosis: { mainProblem: '系统暂时无法生成完整报告', reason: '请重新提交诊断请求', severity: 'warning', confidence: 0.1, matchedRuleIds: [] },
          fatalRules: [],
          advantageRules: [{ ruleId: 'FALLBACK_DEFAULT', title: '重新尝试', description: '请重新提交诊断', weight: 100 }],
          opportunityRules: [],
          scoreCard: { cashflow: 50, skill: 50, execution: 50, time: 50, risk: 50, overall: 50 },
          wealthProbability: { today: 50, after30: 55, after90: 60, after365: 70 },
          potentialIndex: { today: 50, after30: 55, after90: 60, after365: 70 },
          wealthPath: [{ name: '重新诊断', recommend: 'recommended', score: 100, reason: '请重新完成诊断' }],
          actionPlan: { day1: { goal: '重新完成诊断', tasks: ['重新诊断'], checkpoint: '提交' } },
          stopDoing: { priority: 'LOW', items: [] },
          identityUpgrade: { current: '待诊断', target: '重新诊断', bridge: '提交 → 获取报告' },
          finalStrike: '重新完成诊断以获取报告',
          version: 'RC8.2',
          engineVersion: 'RC8.2',
          generatedAt: new Date().toISOString(),
        },
        engineVersion: 'RC8.2',
      }
    }
    if (reason && lf.report) {
      lf.report._fallbackReason = reason
    }
    diagReport = lf
    diagReport._fallbackSource = 'legacy_fallback'
  }

  // ── Inject metadata into report ──
  if (reason && diagReport.report) {
    diagReport.report._fallbackReason = reason
  }
  diagReport.report._fallbackSource = diagReport.report._fallbackSource || routerTrace.finalSource

  // ── Build legacy field mapping (for backward compat) ──
  var legacyFields = mapV4ToLegacyFields(diagReport.report)

  // ── Build diagnosis trace ──
  var trace = extractDiagnosisTrace(diagnosis)
  if (trace) {
    trace.fallbackSource = routerTrace.finalSource
    trace.fallbackStage = routerTrace.stage
    trace.fallbackReasonCode = routerTrace.reasonCode
    trace.fallbackReason = reason
    trace.fallbackGuardErrors = guardErrors
    trace.fallbackReportSource = diagReport.report ? diagReport.report._fallbackSource : null
    trace.contentValidation = diagReport.report ? diagReport.report.contentValidation : null
  }
  diagReport.diagnosisTrace = trace

  // ── Inject router trace ──
  diagReport.fallbackRouterTrace = routerTrace

  // ── Stage log entry ──
  if (stages) {
    stages.push({
      stage: 'FALLBACK_ROUTER',
      ok: routerTrace.finalSource !== 'legacy_fallback',
      timestamp: Date.now(),
      renderSource: renderSource,
      fallbackRouterTrace: routerTrace,
    })
  }

  // ── Build response ──
  return {
    code: 0,
    message: 'success',
    data: buildV4Response(diagReport, legacyFields, renderSource, routerTrace, aiParseTrace),
    stages: stages,
    _fallbackSource: routerTrace.finalSource,
  }
}

// ═══════════════════════════════════════════════════════════════
// Helpers (imported from diagnosticPipelineV4 for self-containment)
// ═══════════════════════════════════════════════════════════════

function mapV4ToLegacyFields(report) {
  var h = report.headline || {}
  var fd = report.fatalDiagnosis || {}
  var frs = report.fatalRules || []
  var wps = report.wealthPath || []
  var ap = report.actionPlan || {}
  var sd = report.stopDoing || {}
  var wpSorted = [].concat(wps).sort(function(a, b) { return b.score - a.score })
  var bestPath = wpSorted[0]

  var stageLabelMap = {
    SURVIVAL: '生存模式', STABLE: '稳定模式', ACCUMULATION: '积累模式',
    LEVERAGE: '杠杆模式', SYSTEM: '系统模式', FREEDOM: '自由模式',
  }
  var stageLabel = stageLabelMap[report.wealthStage] || '待评估'

  return {
    position: stageLabel + ' · ' + (h.subtitle || ''),
    trapped_by: fd.mainProblem || '',
    forbidden: (sd.items ? [].concat(sd.items) : []).concat(
      wps.filter(function(p) { return p.recommend === 'not_recommended' }).map(function(p) { return p.name + '路径（当前不建议）' })
    ),
    path: bestPath ? bestPath.name + ': score=' + bestPath.score + ' ' + bestPath.recommend : '待系统评估',
    next90days: [
      ap.day1 ? ap.day1.goal + '（' + ap.day1.checkpoint + '）' : '',
      ap.day3 ? ap.day3.goal + '（' + ap.day3.checkpoint + '）' : '',
      ap.day7 ? ap.day7.goal + '（' + ap.day7.checkpoint + '）' : '',
      ap.day15 ? ap.day15.goal + '（' + ap.day15.checkpoint + '）' : '',
      ap.day30 ? ap.day30.goal + '（' + ap.day30.checkpoint + '）' : '',
    ].filter(Boolean),
    fatal_sentence: h.title || '',
    core_problem: fd.reason || '',
    system_trap: frs.slice(0, 3).map(function(r) { return r.title + ': ' + r.description }).join(' | '),
    strategy_path: bestPath ? bestPath.name + ': score=' + bestPath.score : '',
    advice: [
      ap.day1 ? ap.day1.goal + ': ' + (ap.day1.tasks || []).join('、') : '',
      ap.day7 ? ap.day7.goal + ': ' + (ap.day7.tasks || []).join('、') : '',
      ap.day30 ? ap.day30.goal + ': ' + (ap.day30.tasks || []).join('、') : '',
    ].filter(Boolean),
  }
}

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
      return { id: t.id, label: t.label || t.id, weight: t.weight || 0, category: t.category || 'OTHER', signal: t.signal || 'NEUTRAL' }
    })
  trace.behaviorTags.topSignals = sorted

  return trace
}

function buildV4Response(contract, legacy, renderSource, routerTrace, aiParseTrace) {
  return {
    reportId: contract.reportId,
    reportType: 'diagnostic_v4',
    diagnosticVersion: 'v4',
    engineVersion: contract.engineVersion,
    renderSource: renderSource,
    report: contract.report,
    legacy: legacy,
    contentValidation: contract.report ? contract.report.contentValidation : (contract.contentValidation || null),
    diagnosisTrace: contract.diagnosisTrace || null,
    diagnosticSnapshot: contract.diagnosticSnapshot || null,
    fallbackTrace: contract.fallbackTrace || null,
    fallbackRouterTrace: routerTrace || null,
    aiParseTrace: aiParseTrace || contract.aiParseTrace || (contract.report ? contract.report.aiParseTrace : null) || null,
    fallbackSource: contract._fallbackSource || (contract.report ? contract.report._fallbackSource : renderSource),
    fallbackReasonCode: routerTrace ? routerTrace.reasonCode : null,
    legacyFallbackInvoked: routerTrace ? routerTrace.legacyFallbackInvoked : false,
    answersSnapshot: null,
  }
}

module.exports = { routeFinalFallback }
