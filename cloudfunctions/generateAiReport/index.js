/**
 * generateAiReport - AI 报告生成
 *
 * 根据用户画像 + 挑战结果 + 标签生成认知报告
 * 免费用户仅返回 summary + locked=true
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const { ok, fail, CODES } = require('./lib/response.js')
const { checkVip } = require('./lib/permission.js')
const { callAI, buildReportPrompt, buildCoachingPrompt } = require('./lib/ai.js')
const { generateReportId, now } = require('./lib/order.js')

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  const { type = 'challenge_final', recordId = '', message = '', personality = '', personalityEmoji = '', personalityStyle = '' } = event
  const ts = now()
  console.log(`[generateAiReport] openid=${openid} type=${type} recordId=${recordId} message=${(message||'').substring(0,40)} personality=${personality}`)

  try {
    // 1. 查用户
    const userRes = await db.collection('users').where({ openid }).limit(1).get()
    if (!userRes.data[0]) return fail(CODES.AUTH_FAILED, '用户不存在')

    // 2. 查 profile
    const profRes = await db.collection('user_profiles').where({ openid }).limit(1).get()
    const profile = profRes.data[0]

    // ═══ coaching 快捷分支：AI 对话模式（非报告生成） ═══
    if (type === 'coaching') {
      const promptInput = message || ''
      if (!promptInput) return fail(CODES.PARAM_ERROR, '请提供要分析的话题')

      const { systemPrompt, userMessage, personality: pMeta } = buildCoachingPrompt(promptInput, personality, personalityStyle)
      const coachingModel = process.env.AI_MODEL_FLASH || 'v4-flash'
      const aiResult = await callAI({ systemPrompt, userMessage, maxTokens: 2048, temperature: 0.7 })

      if (!aiResult.success) return fail(CODES.AI_ERROR, aiResult.error || 'AI 调用失败')

      const replyText = aiResult.content || '换个说法试试？'

      // 写入 ai_logs
      await db.collection('ai_logs').add({ data: {
        openid, action: 'coaching', type: 'coaching',
        tokens: aiResult.tokens || 0, success: aiResult.success,
        errorMessage: aiResult.error || '', createdAt: ts,
        personality: pMeta?.name || 'unknown',
      }}).catch(() => {})

      return ok({
        content: replyText,
        personality: pMeta ? { name: pMeta.name, emoji: pMeta.emoji } : undefined,
      })
    }

    // ═══ diagnostic 分支 ═══
    if (type === 'diagnostic') {
      const { answers = {}, personality: dPersonality, personalityEmoji, personalityStyle: dStyle } = event

      // ═══ V4 分流 ═══
      const diagnosticVersion = event.diagnosticVersion || (event.answers && event.answers.diagnosticVersion)
      if (diagnosticVersion === 'v4' || diagnosticVersion === 'world_model_v1') {
        return await runDiagnosticV4Branch({ event, openid, ts, db })
      }

      // ═══ V3 原有链路（不变）═══
      const { buildDiagnosticPrompt } = require('./lib/ai.js')

      const { systemPrompt, userMessage, personality: usedPersonality, engineResult } = buildDiagnosticPrompt(answers, dPersonality, dStyle)
      const diagModel = process.env.AI_MODEL_PRO || 'v4-pro'
      const diagResult = await callAI({ systemPrompt, userMessage, forceModel: diagModel, maxTokens: 2048, temperature: 0.65 })

      if (!diagResult.success) {
        // AI 失败时返回规则引擎的冷数据
        const np = engineResult?.normalizedProfile
        const fpForDisplay = (forbiddenPaths?.length)
          ? forbiddenPaths.map(f => typeof f === 'object' ? f.path : f)
          : ['系统暂时无法分析，请重试']
        const apFirst = allowedPaths?.[0]
          ? (typeof allowedPaths[0] === 'object' ? allowedPaths[0].path : allowedPaths[0])
          : '请重新测试'
        return ok({
          position: `${np?.occupation || '未知职业'}·${np?.ageGroup || '未知年龄段'}`,
          trapped_by: constraintAnalysis?.cashFlowHealth === 'critical' ? '现金流断裂风险' : '系统分析中断',
          forbidden: fpForDisplay,
          path: apFirst,
          next90days: ['重新测试获取完整报告'],
          personality: usedPersonality ? { name: usedPersonality.name, emoji: usedPersonality.emoji } : undefined,
          engineResult,
        })
      }

      // 解析 5 字段 JSON — 强容错清洗
      const rawContent = diagResult.content || ''
      let parsed = null
      const { constraintAnalysis, allowedPaths, forbiddenPaths } = engineResult || {}
      const fallbackDiagnostic = {
        position: '系统信号中断，请稍后再试',
        trapped_by: '暂时无法分析，点击重试',
        forbidden: forbiddenPaths?.length ? forbiddenPaths.map(f => typeof f === 'object' ? f.path : f).slice(0,3) : ['不建议任何高风险行为'],
        path: allowedPaths?.[0] ? (typeof allowedPaths[0] === 'object' ? allowedPaths[0].path : allowedPaths[0]) : '重新测试以获取精准策略',
        next90days: ['点击重试按钮重新测试', '或联系客服反馈问题'],
      }
      try {
        let jsonStr = rawContent
          .replace(/```json\s*/gi, '')
          .replace(/```\s*/g, '')
          .trim()

        const bracketMatch = jsonStr.match(/\{[\s\S]*\}/)
        if (bracketMatch) {
          jsonStr = bracketMatch[0]
        } else {
          throw new Error('NO_BRACKET_FOUND')
        }

        jsonStr = jsonStr
          .replace(/\/\/.*$/gm, '')
          .replace(/,(\s*[}\]])/g, '$1')

        parsed = JSON.parse(jsonStr)

        // 字段完整性兜底
        parsed.position = parsed.position || fallbackDiagnostic.position
        parsed.trapped_by = parsed.trapped_by || fallbackDiagnostic.trapped_by
        parsed.forbidden = Array.isArray(parsed.forbidden) ? parsed.forbidden : fallbackDiagnostic.forbidden
        parsed.path = parsed.path || fallbackDiagnostic.path
        parsed.next90days = Array.isArray(parsed.next90days) ? parsed.next90days :
                            (Array.isArray(parsed.advice) ? parsed.advice : fallbackDiagnostic.next90days)

        // 如果 AI 返回了禁止路径但规则引擎有更严格的禁止项，以规则引擎为准
        if (forbiddenPaths?.length && (!parsed.forbidden || parsed.forbidden.length < forbiddenPaths.length)) {
          const engineForbidden = forbiddenPaths.map(f => typeof f === 'object' ? f.path : f)
          parsed.forbidden = [...new Set([...parsed.forbidden, ...engineForbidden.slice(0, 5)])]
        }
      } catch (parseErr) {
        console.error('【diagnostic JSON清洗失败】错误:', parseErr.message)
        console.error('【diagnostic 原始AI返回】:', rawContent.substring(0, 800))
        try {
          parsed = {
            position: (rawContent.match(/position["']?\s*[:：]\s*["']([^"']+)["']/) || [])[1] || fallbackDiagnostic.position,
            trapped_by: (rawContent.match(/trapped_by["']?\s*[:：]\s*["']([^"']+)["']/) || [])[1] || fallbackDiagnostic.trapped_by,
            forbidden: fallbackDiagnostic.forbidden,
            path: (rawContent.match(/path["']?\s*[:：]\s*["']([^"']+)["']/) || [])[1] || fallbackDiagnostic.path,
            next90days: fallbackDiagnostic.next90days,
          }
        } catch (_) {
          parsed = fallbackDiagnostic
        }
      }

      // 写入 ai_logs
      await db.collection('ai_logs').add({ data: {
        openid, action: 'diagnostic', type: 'diagnostic',
        tokens: diagResult.tokens || 0, success: diagResult.success,
        errorMessage: diagResult.error || '', createdAt: ts,
        personality: usedPersonality?.name || 'unknown',
      }}).catch(() => {})

      return ok({
        // v3 新字段
        position: parsed.position || '',
        trapped_by: parsed.trapped_by || '',
        forbidden: Array.isArray(parsed.forbidden) ? parsed.forbidden : [],
        path: parsed.path || '',
        next90days: Array.isArray(parsed.next90days) ? parsed.next90days : [],
        // v2 兼容字段
        system_trap: parsed.trapped_by || parsed.system_trap || '',
        core_problem: parsed.position || parsed.core_problem || '',
        fatal_sentence: parsed.forbidden?.[0] || parsed.fatal_sentence || '',
        strategy_path: parsed.path || parsed.strategy_path || '',
        advice: Array.isArray(parsed.next90days) ? parsed.next90days :
                (Array.isArray(parsed.advice) ? parsed.advice : []),
        personality: usedPersonality ? { name: usedPersonality.name, emoji: usedPersonality.emoji } : undefined,
        engineResult,
      })
    }

    // 3. 查挑战记录
    let scores = profile || {}
    let tags = []
    let choicesSummary = ''

    let rawScoresRef = null;
    let scoringVer = 'legacy_v1';
    if (type === 'challenge_final' && recordId) {
      const recRes = await db.collection('challenge_records').where({ recordId, openid }).limit(1).get()
      const record = recRes.data[0]
      if (record) {
        scores = record.scores || {}
        rawScoresRef = record.rawScores || null;
        scoringVer = record.scoringVersion || 'legacy_v1';
        tags = record.tags || []
        if (record.choices && record.choices.length) {
          choicesSummary = record.choices.map((c, i) => `${i + 1}. [${c.choice}] ${c.choiceText || ''}`).join('\n')
        }
        // 如有 rawScores，重新计算 normalized scores
        if (rawScoresRef) {
          try {
            const { normalizeScores } = require('./lib/scoring.js')
            scores = normalizeScores(rawScoresRef)
          } catch (_) { /* fallback to record.scores */ }
        }
      }
    }

    // 4. 构造 Prompt & 调 AI（报告必须走 Pro tier）
    const { systemPrompt, userMessage } = buildReportPrompt(scores, tags, choicesSummary)
    const reportModel = process.env.AI_MODEL_PRO || 'v4-pro'
    const aiResult = await callAI({ systemPrompt, userMessage, forceModel: reportModel })

    // 5. 解析 AI 结果 — 强容错清洗
    let aiContent = aiResult.content || ''
    let parsedReport = null
    try {
      let jsonStr = aiContent
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim()

      const bracketMatch = jsonStr.match(/\{[\s\S]*\}/)
      if (bracketMatch) {
        jsonStr = bracketMatch[0]
      }

      jsonStr = jsonStr.replace(/\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '$1')
      parsedReport = JSON.parse(jsonStr)
    } catch (parseErr) {
      console.error('【challenge_final JSON清洗失败】错误:', parseErr.message)
      console.error('【challenge_final 原始AI返回】:', aiContent.substring(0, 800))
      parsedReport = {
        rawContent: aiContent,
        oneSentence: '报告生成中，请稍后重试',
        worldModelType: '系统信号中断',
        whyNotRich: '暂时无法解析，点击重试',
        biggestCognitiveGap: '重试获取分析',
        turnaroundProbability: 0,
        threeYearRisk: '请重试',
        bestPath: '重新测试以获取结果',
        thirtyDayActions: ['重试报告生成'],
        finalStrike: '⚠️ 系统暂时无法审判你，再试一次',
      }
    }

    // 6. 保存到 ai_reports
    const reportId = generateReportId()
    const isVip = await checkVip(db, openid)

    await db.collection('ai_reports').add({
      data: {
        reportId,
        openid,
        type,
        recordId,
        scores,
        tags,
        content: parsedReport,
        rawPrompt: { systemPrompt, userMessage },
        rawScores: rawScoresRef,
        scoringVersion: scoringVer,
        aiModel: reportModel,
        aiTokens: aiResult.tokens || 0,
        isPaid: isVip, // VIP 自动解锁
        unlockOrderId: '',
        createdAt: ts,
        updatedAt: ts,
      },
    })

    // 7. 写入 ai_logs
    await db.collection('ai_logs').add({
      data: {
        openid,
        action: 'generate_report',
        type,
        reportId,
        recordId,
        tokens: aiResult.tokens || 0,
        success: aiResult.success,
        errorMessage: aiResult.error || '',
        createdAt: ts,
      },
    })

    // 8. 返回：免费用户仅 summary + locked
    if (isVip) {
      return ok({
        reportId,
        reportType: 'challenge_final',
        isPaid: true,
        locked: false,
        content: parsedReport,
      })
    }

    return ok({
      reportId,
      isPaid: false,
      locked: true,
      summary: {
        oneSentence: parsedReport.oneSentence || '',
        worldModelType: parsedReport.worldModelType || '',
        turnaroundProbability: parsedReport.turnaroundProbability || 0,
      },
      preview: '完整报告需解锁认知操作系统会员或单独购买。',
    })
  } catch (err) {
    console.error('[generateAiReport] 异常:', err)
    return fail(CODES.AI_ERROR, err.message)
  }
}

// ═══════════════════════════════════════════════════════════════
// V4 诊断分支
// ═══════════════════════════════════════════════════════════════

async function runDiagnosticV4Branch({ event, openid, ts, db }) {
  const { runDiagnosticV4, normalizeV4Input } = require('./lib/v4/diagnosticPipelineV4')
  const { callAI } = require('./lib/ai.js')

  // 🔖 版本标记：每次部署必须递增
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('[V4Diagnostic] CLOUD FUNCTION VERSION: v4.0-rc8-router-audit')
  console.log('[V4Diagnostic] Deploy/build SHA: 94ceca4')
  console.log('[V4Diagnostic] Router version: RC8.3 | fallbackRouterVersion: 2.0')
  console.log('[V4Diagnostic] Engine version: RC8.3 | diagnosis version: 2.0')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // ── RC8.3 Phase-2 003B: Whitelist Authorization ──
  var { isWorldModelAuthorized, getAllowlistFromEnv } = require('./lib/config/worldModelWhitelist')
  var requestedEngine = event.diagnosticVersion || (event.answers && event.answers.diagnosticVersion) || 'v4'
  var authorizationDecision = 'LEGACY_REQUEST'
  var effectiveEngine = 'v4'

  if (requestedEngine === 'world_model_v1') {
    try {
      var wxContext = cloud.getWXContext()
      var trustedOpenid = wxContext && wxContext.OPENID ? wxContext.OPENID : null
      var rawAllowlist = getAllowlistFromEnv()

      if (!trustedOpenid) {
        authorizationDecision = 'NO_SERVER_IDENTITY'
        effectiveEngine = 'v4'
      } else if (isWorldModelAuthorized(trustedOpenid, rawAllowlist)) {
        authorizationDecision = 'AUTHORIZED'
        effectiveEngine = 'world_model_v1'
      } else {
        authorizationDecision = 'NOT_WHITELISTED'
        effectiveEngine = 'v4'
      }

      console.log('[V4Diagnostic][AUTH] requested=' + requestedEngine +
        ' effective=' + effectiveEngine +
        ' decision=' + authorizationDecision +
        ' openid=' + (trustedOpenid ? 'present' : 'missing'))
    } catch (authError) {
      authorizationDecision = 'AUTH_HELPER_EXCEPTION'
      effectiveEngine = 'v4'
      console.error('[V4Diagnostic][AUTH] Exception:', authError.message)
    }
  } else if (requestedEngine !== 'v4') {
    // Unknown requested engine → safe legacy fallback
    authorizationDecision = 'INVALID_REQUESTED_ENGINE'
    effectiveEngine = 'v4'
    console.log('[V4Diagnostic][AUTH] Unknown requested engine: ' + requestedEngine + ' → legacy')
  }

  // ── RC8.3 Phase-2 003D: Rollout mode ──
  var { parseRolloutMode, getRolloutModeFromEnv } = require('./lib/config/rolloutMode')
  var rolloutMode = parseRolloutMode(getRolloutModeFromEnv())

  // 归一化输入 (MUST precede any downstream consumers including WM primary)
  const answers = normalizeV4Input(event)
  if (!answers) {
    return fail(CODES.PARAM_ERROR, 'V4_DIAGNOSTIC_INPUT_INVALID: answers 缺失或 diagnosticVersion 不合法')
  }

  // ── RC8.3 Phase-2 003D-R1: WM primary execution (after answers resolved) ──
  var primaryEngine = 'v4'
  var wmPrimaryResult = null
  var wmPrimaryFallbackReason = null

  if (effectiveEngine === 'world_model_v1' && rolloutMode === 'SELECTIVE_PRIMARY') {
    console.log('[V4Diagnostic][SELECTIVE_PRIMARY] Attempting WM primary path')
    try {
      var { runWorldModelPipeline } = require('./lib/engine/worldModel/worldModelPipeline')
      var wmProfile = {
        signals: (answers || {}).signals || [],
        occupation: (answers || {}).occupation || '',
        yearsOfExperience: (answers || {}).yearsOfExperience || 0,
      }
      var wmPipelineResult = runWorldModelPipeline({ inputProfile: wmProfile, evidenceTrace: [], context: {} })

      if (wmPipelineResult && wmPipelineResult.valid !== false && wmPipelineResult.diagnosis) {
        var { validateWorldModelOutput } = require('./lib/engine/worldModel/validators')
        var validation = validateWorldModelOutput(wmPipelineResult.diagnosis)
        if (validation.valid) {
          var { adaptWorldModelToLegacyDiagnosis } = require('./lib/engine/worldModel/legacyDiagnosisAdapter')
          var adapted = adaptWorldModelToLegacyDiagnosis(wmPipelineResult.diagnosis)
          if (adapted && !adapted.adapterError && adapted.worldModelDiagnosis) {
            wmPrimaryResult = adapted.worldModelDiagnosis
            primaryEngine = 'world_model_v1'
            console.log('[V4Diagnostic][SELECTIVE_PRIMARY] WM primary accepted')
          } else {
            wmPrimaryFallbackReason = 'WM_ADAPTER_FAILURE'
            console.log('[V4Diagnostic][SELECTIVE_PRIMARY] Adapter failed, falling back to legacy')
          }
        } else {
          wmPrimaryFallbackReason = 'WM_CONTRACT_INVALID'
          console.log('[V4Diagnostic][SELECTIVE_PRIMARY] Contract invalid, falling back to legacy')
        }
      } else {
        wmPrimaryFallbackReason = 'WM_PIPELINE_FALLBACK'
        console.log('[V4Diagnostic][SELECTIVE_PRIMARY] Pipeline returned invalid result, falling back to legacy')
      }
    } catch (wmError) {
      wmPrimaryFallbackReason = 'WM_PRIMARY_EXCEPTION'
      console.error('[V4Diagnostic][SELECTIVE_PRIMARY] Exception:', wmPrimaryFallbackReason)
    }
  }

  // ── RC8.3 Phase-2 003D-R1: Cache namespace follows final primaryEngine ──
  var cacheType = primaryEngine === 'world_model_v1' ? 'diagnostic_world_model_v1' : 'diagnostic_v4'
  console.log('[V4Diagnostic][CACHE] cacheType=' + cacheType + ' primaryEngine=' + primaryEngine + ' effectiveEngine=' + effectiveEngine)

  // 幂等检查
  const recordId = event.recordId || ''
  const forceRegenerate = event.forceRegenerate === true
  const skipCache = event.skipCache === true || event.debug?.skipCache === true
  const requestNonce = event.requestNonce || event.debug?.requestNonce || ''
  let cacheStatus = 'GENERATED_NEW'

  // ── RC8.2: Version-aware cache key ──
  var CURRENT_CACHE_VERSION = {
    diagnosticVersion: 'v4',
    diagnosisEngineVersion: 'RC8.3',
    rulesetVersion: 'RC8.2',
    promptVersion: 'RC8.2',
    fallbackRouterVersion: '2.0',
    worldModelVersion: '1.0',
  }

  // ── RC8.2: skipCache + stale-cache-migration ──
  console.log('[V4Diagnostic] skipCache=' + skipCache + ' nonce=' + (requestNonce ? 'present' : 'none') + ' recordId=' + recordId)
  if (skipCache) {
    console.log('[V4Diagnostic] CACHE_SKIPPED by client request')
    cacheStatus = 'SKIPPED_BY_REQUEST'
  }
  if (requestNonce && !skipCache) {
    console.log('[V4Diagnostic] NONCE_SEEN but skipCache=false, cache may be used')
  }

  var cachedReportCreatedAt = null
  var cachedRenderSource = null
  var cachedCloudBuild = null
  var cachedDiagnosisPresent = false
  var cachedSnapshotVersion = null

  if (recordId && !forceRegenerate && !skipCache) {
    try {
      const existing = await db.collection('ai_reports')
        .where({ recordId, openid, type: cacheType })
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get()
      if (existing.data.length > 0) {
        console.log('[V4Diagnostic] CACHE_HIT for recordId=' + recordId)
        cacheStatus = 'CACHE_HIT'

        var cachedDoc = existing.data[0]
        var cachedContent = cachedDoc.content

        // ── RC8.2: Record cache metadata ──
        cachedReportCreatedAt = cachedDoc.createdAt || null
        cachedRenderSource = cachedDoc.renderSource || null
        cachedCloudBuild = cachedDoc.cloudBuildSha || null
        cachedDiagnosisPresent = !!(cachedContent && cachedContent.diagnosis)
        cachedSnapshotVersion = (cachedDoc.diagnosticSnapshot && cachedDoc.diagnosticSnapshot.engineVersions)
          ? cachedDoc.diagnosticSnapshot.engineVersions.snapshotVersion
          : null

        console.log('[V4Diagnostic][CACHE_META]', JSON.stringify({
          createdAt: cachedReportCreatedAt,
          cloudBuildSha: cachedCloudBuild,
          renderSource: cachedRenderSource,
          diagnosisPresent: cachedDiagnosisPresent,
          snapshotVersion: cachedSnapshotVersion,
        }))

        // ── RC8.2: Version-aware cache invalidation ──
        var cachedVersion = cachedDoc.cacheVersion || null
        var versionMismatch = false
        if (cachedVersion) {
          var cv = JSON.parse(typeof cachedVersion === 'string' ? cachedVersion : JSON.stringify(cachedVersion))
          for (var vk in CURRENT_CACHE_VERSION) {
            if (cv[vk] !== CURRENT_CACHE_VERSION[vk]) {
              versionMismatch = true
              console.log('[V4Diagnostic][CACHE_STALE] Version mismatch: ' + vk + ' cached=' + cv[vk] + ' current=' + CURRENT_CACHE_VERSION[vk])
            }
          }
        } else {
          // No cacheVersion field → pre-router era → definitely stale
          versionMismatch = true
          console.log('[V4Diagnostic][CACHE_STALE] No cacheVersion field → pre-router cache, forced invalidation')
        }

        if (versionMismatch) {
          console.log('[V4Diagnostic][CACHE_INVALIDATED] Version mismatch — regenerating')
          cacheStatus = 'REGENERATED_STALE_CACHE'
          // Fall through to fresh generation (don't return from cache)
        } else {
          // Cache is valid — serve it
          // ── RC8.2: Normalize old cache with after365=100 → clamp to 90 ──
          try {
            var normalizeFn = require('./lib/config/reportUtils').normalizePotentialIndex
            if (cachedContent.report && cachedContent.report.wealthProbability) {
              var rawWp = cachedContent.report.wealthProbability
              if (rawWp.after365 > 90 || rawWp.today > 90) {
                console.warn('[V4Diagnostic][CACHE_NORMALIZE] legacy wealthProbability had value >90, clamping')
                cachedContent.report.wealthProbability = normalizeFn(rawWp)
                // Also maintain legacy alias
                if (cachedContent.report.potentialIndex) {
                  cachedContent.report.potentialIndex = normalizeFn(cachedContent.report.potentialIndex)
                }
              }
            }
          } catch (e) {
            console.error('[V4Diagnostic][CACHE_NORMALIZE_FAILED]', e.message)
          }
          return ok({
            ...cachedContent,
            _cache: cacheStatus,
            // ── RC8.2 Runtime Architecture Trace (cache hit path) ──
            runtimeArchitectureTrace: {
              traceId: 'CACHE_' + recordId + '_' + Date.now(),
              stagesVisited: ['CACHE_HIT'],
              firstFailedStage: null,
              routerEntered: false,
              routerDecision: 'NOT_ENTERED_CACHE_BYPASS',
              finalReturnId: 'RETURN_17_CACHE_HIT',
              finalRenderSource: cachedRenderSource || 'UNDEFINED_CACHE',
              diagnosisAvailableAtReturn: cachedDiagnosisPresent,
              cacheHit: true,
              cloudBuildSha: '94ceca4',
              deploymentEnvId: 'fanshex-d2g0adgv7dfbc9bdc',
              cachedReportCreatedAt: cachedReportCreatedAt,
              cachedRenderSource: cachedRenderSource,
              cachedCloudBuildSha: cachedCloudBuild,
              cachedDiagnosisPresent: cachedDiagnosisPresent,
              cachedSnapshotVersion: cachedSnapshotVersion,
            },
          })
        }
      }
    } catch (e) {
      console.log('[V4Diagnostic] 缓存查询失败，继续生成:', e.message)
    }
  }

  if (forceRegenerate) {
    cacheStatus = 'FORCE_REGENERATED'
  }

  // 运行 V4 管线
  // ── RC8.2: Server-side diagnosis handoff validation ──

  function hashAnswers(ans) {
    if (!ans || typeof ans !== 'object') return 'empty'
    var keys = Object.keys(ans).sort()
    var seed = 0
    for (var i = 0; i < keys.length; i++) {
      var v = String(ans[keys[i]] || '')
      for (var j = 0; j < v.length; j++) {
        seed = ((seed << 5) - seed + v.charCodeAt(j)) | 0
      }
    }
    return 'h_' + (seed >>> 0).toString(36).slice(0, 8) + '_k' + keys.length
  }

  var handoffTrace = {
    clientDiagnosisReceived: false,
    schemaValid: false,
    inputHashMatched: false,
    versionCompatible: false,
    acceptedSource: 'NONE',
    rejectedReason: null,
    clientDiagnosisVersion: null,
    clientDiagnosisEngineVersion: null,
    clientDiagnosisInputHash: null,
  }

  var acceptedDiagnosis = null
  var clientDiagnosis = event.diagnosis

  if (clientDiagnosis && typeof clientDiagnosis === 'object') {
    handoffTrace.clientDiagnosisReceived = true
    handoffTrace.clientDiagnosisEngineVersion = clientDiagnosis.engineVersion || null

    // Validate: has minimum required fields
    var hasFields = (
      clientDiagnosis.behaviorTags &&
      clientDiagnosis.wealthProfile &&
      clientDiagnosis.bottleneck &&
      clientDiagnosis.strategy
    )
    handoffTrace.schemaValid = !!hasFields

    // Validate: version compatibility
    var versionMatch = (
      clientDiagnosis.engineVersion === 'RC8.1' ||
      clientDiagnosis.engineVersion === 'RC8.2' || clientDiagnosis.engineVersion === 'RC8.3'
    )
    handoffTrace.versionCompatible = !!versionMatch

    // Validate: input hash consistency (if present)
    if (clientDiagnosis.inputHash) {
      var computedHash = hashAnswers(answers)
      handoffTrace.clientDiagnosisInputHash = clientDiagnosis.inputHash
      handoffTrace.inputHashMatched = (clientDiagnosis.inputHash === computedHash)
      handoffTrace.computedInputHash = computedHash
    } else {
      // No input hash → accept if schema is valid
      handoffTrace.inputHashMatched = true
    }

    if (handoffTrace.schemaValid && handoffTrace.versionCompatible && handoffTrace.inputHashMatched) {
      handoffTrace.acceptedSource = 'CLIENT_VERIFIED'
      acceptedDiagnosis = clientDiagnosis
      console.log('[RC8][DIAGNOSIS_HANDOFF]', JSON.stringify({
        source: 'CLIENT',
        tags: (clientDiagnosis.behaviorTags || []).length,
        archetype: (clientDiagnosis.wealthProfile || {}).primary,
        bottleneck: (clientDiagnosis.bottleneck || {}).id,
        strategy: (clientDiagnosis.strategy || {}).id,
      }))
    } else {
      handoffTrace.rejectedReason = 'SCHEMA_INVALID_OR_VERSION_MISMATCH'
      console.error('[RC8][DIAGNOSIS_HANDOFF_REJECTED]', JSON.stringify(handoffTrace))
      // Fall through — will be null → pipeline falls back to legacy
    }
  } else {
    handoffTrace.rejectedReason = 'NOT_PROVIDED_BY_CLIENT'
    console.log('[RC8][DIAGNOSIS_HANDOFF]', JSON.stringify(handoffTrace))
  }

  var pipelineResult = null
  var code, message, data, stages

  if (wmPrimaryResult) {
    // WM primary path — skip legacy V4 pipeline
    code = 0
    message = 'wm_primary'
    // Build minimal report contract compatible with client normalization
    var wmDiagnosis = wmPrimaryResult.worldModelDiagnosis || wmPrimaryResult
    var wmBS = wmDiagnosis.cognitiveBlindSpot || {}
    var wmStrat = wmDiagnosis.worldStrategy || {}
    data = {
      reportId: event.reportId || null,
      engineVersion: 'world_model_v1',
      renderSource: 'wm_primary',
      report: {
        wealthProbability: 75,
        potentialIndex: 75,
        label: wmBS.label || '',
        primaryBlindSpot: wmBS.id || wmBS.primary || null,
        strategy: wmStrat.label || '',
        engine: 'world_model_v1',
        source: 'wm_primary',
      },
      legacy: null,
      diagnosis: wmDiagnosis,
      worldModelDiagnosis: wmDiagnosis,
      inputHash: '', // computed below
      fallbackRouterTrace: null,
    }
    stages = [{ stage: 'wm_primary', ok: true }]
    console.log('[V4Diagnostic][SELECTIVE_PRIMARY] Using WM primary result, skipping legacy V4 pipeline')
  } else {
    // Legacy V4 pipeline (normal path or fallback)
    pipelineResult = await runDiagnosticV4({
      answers,
      userContext: { openid, recordId },
      diagnosis: acceptedDiagnosis,
      callAI: async (opts) => {
        return await callAI({
          systemPrompt: opts.systemPrompt,
          userMessage: opts.userMessage,
          maxTokens: 2048,
          temperature: 0.65,
        })
      },
    })
    var _res = pipelineResult
    code = _res.code; message = _res.message; data = _res.data; stages = _res.stages
  }

  // 构建答案快照（MUST precede shadow execution — fix TDZ）
  const answersSnapshot = {}
  const { REQUIRED_V4_KEYS } = require('./lib/v4/diagnosticPipelineV4')
  for (const key of REQUIRED_V4_KEYS) {
    answersSnapshot[key] = answers[key] || ''
  }

  // ── RC8.3 Phase-2: World Model Shadow Execution ──
  var shadowExecuted = false
  var shadowSucceeded = false
  var shadowFailureClass = null

  if (effectiveEngine === 'world_model_v1' && code === 0 && data) {
    try {
      var { runWorldModelPipeline } = require('./lib/engine/worldModel/worldModelPipeline')
      var shadowProfile = {
        signals: (answersSnapshot || answers || {}).signals || [],
        occupation: (answers || {}).occupation || '',
        yearsOfExperience: (answers || {}).yearsOfExperience || 0,
      }
      var shadowResult = runWorldModelPipeline({ inputProfile: shadowProfile, evidenceTrace: [], context: {} })
      shadowExecuted = true
      shadowSucceeded = shadowResult && shadowResult.valid !== false
      if (!shadowSucceeded) shadowFailureClass = 'VALIDATION_FAILED'

      // Record observability without mutating legacy diagnosis
      console.log('[V4Diagnostic][SHADOW] world_model_v1 shadow executed. Succeeded=' + shadowSucceeded)
    } catch (shadowError) {
      shadowExecuted = true
      shadowSucceeded = false
      shadowFailureClass = shadowError.message ? shadowError.message.split('\n')[0].substring(0, 100) : 'UNKNOWN'
      console.error('[V4Diagnostic][SHADOW] world_model_v1 shadow failed:', shadowFailureClass)
    }
  }
  // ── End Shadow Execution ──

  // 记录管线日志（非敏感）
  console.log('[V4DiagnosticPipeline] stages:', JSON.stringify(stages.map(s => ({
    stage: s.stage,
    ok: s.ok,
    error: s.error,
    fatalCount: s.fatalCount,
    matchedCount: s.matchedCount,
    ruleCount: s.ruleCount,
    tokens: s.tokens,
    renderSource: s.renderSource,
    code: s.code,
  }))))

  // 输入验证失败
  if (code === 4004) {
    return fail(CODES.PARAM_ERROR, message)
  }

  // Engine/Contract 错误
  if (code >= 5000) {
    return fail(CODES.AI_ERROR, message)
  }

  // 存储报告
  const reportData = {
    reportId: data.reportId,
    openid,
    type: cacheType,
    recordId,
    reportVersion: 'v4',
    diagnosticVersion: 'v4',
    engineVersion: data.engineVersion,
    renderSource: data.renderSource,
    content: {
      report: data.report,
      legacy: data.legacy,
      diagnosis: data.diagnosis || null,
    },
    // ── RC8.2: Diagnostic Snapshot — persisted for cross-entry consistency ──
    diagnosticSnapshot: {
      normalizedAnswers: answersSnapshot,
      diagnosis: data.diagnosis || null,
      engineVersions: {
        diagnosisEngineVersion: data.engineVersion || 'v4',
        snapshotVersion: '2.0'
      },
      inputHash: data.inputHash || '',
      snapshotSource: 'SERVER_SNAPSHOT',
      createdAt: ts
    },
    answersSnapshot,
    pipelineStages: stages.map(s => ({
      stage: s.stage,
      ok: s.ok,
      error: s.error,
      fatalCount: s.fatalCount,
      matchedCount: s.matchedCount,
      ruleCount: s.ruleCount,
    })),
    createdAt: ts,
    updatedAt: ts,
    // ── RC8.3: Cache version from single source of truth ──
    cacheVersion: {
      diagnosticVersion: CURRENT_CACHE_VERSION.diagnosticVersion,
      diagnosisEngineVersion: CURRENT_CACHE_VERSION.diagnosisEngineVersion,
      rulesetVersion: CURRENT_CACHE_VERSION.rulesetVersion,
      promptVersion: CURRENT_CACHE_VERSION.promptVersion,
      fallbackRouterVersion: CURRENT_CACHE_VERSION.fallbackRouterVersion || '2.0',
      worldModelVersion: CURRENT_CACHE_VERSION.worldModelVersion || '1.0',
    },
    cloudBuildSha: '94ceca4',
    // ── RC8.3 Phase-2: World Model Shadow Observability ──
    shadowWorldModel: {
      worldModelVersion: 'v1',
      shadowExecuted: shadowExecuted,
      shadowSucceeded: shadowSucceeded,
      shadowFailureClass: shadowFailureClass,
      requestedEngine: requestedEngine,
      effectiveEngine: effectiveEngine,
      authorizationDecision: authorizationDecision,
      primaryEngine: primaryEngine,
      rolloutMode: rolloutMode,
      wmPrimaryFallbackReason: wmPrimaryFallbackReason,
    },
  }

  try {
    await db.collection('ai_reports').add({ data: reportData })
  } catch (e) {
    console.error('[V4Diagnostic] 存储失败:', e.message)
    // 不阻塞返回
  }

  // ── RC8.2: Assertion — snapshot must be saved before returning success ──
  if (!reportData.diagnosticSnapshot || !reportData.diagnosticSnapshot.normalizedAnswers) {
    console.error('[V4Diagnostic][RC8_SNAPSHOT_PERSIST_FAILED] snapshot is null or missing normalizedAnswers')
    // Still return OK — client can recover from answersSnapshot
  }

  // ── RC8.2: Assertion — potentialIndex must be ≤ MAX_POTENTIAL_INDEX ──
  const { assertPotentialIndex, normalizePotentialIndex } = require('./lib/config/reportUtils')
  if (data.report && !assertPotentialIndex(data.report?.wealthProbability)) {
    console.error('[V4Diagnostic][POTENTIAL_INDEX_OUT_OF_RANGE] auto-clamping report.wealthProbability')
    if (data.report) {
      data.report.wealthProbability = normalizePotentialIndex(data.report.wealthProbability)
    }
  }
  // ── RC8.2: Always add potentialIndex alias alongside wealthProbability (legacy) ──
  if (data.report && data.report.wealthProbability && !data.report.potentialIndex) {
    data.report.potentialIndex = data.report.wealthProbability
  }

  // 写入 ai_logs
  try {
    await db.collection('ai_logs').add({
      data: {
        openid,
        action: 'diagnostic_v4',
        type: cacheType,
        reportId: data.reportId,
        recordId,
        renderSource: data.renderSource,
        success: true,
        createdAt: ts,
      },
    })
  } catch (_) { /* ignore */ }

  return ok({
    reportId: data.reportId,
    reportType: 'diagnostic_v4',
    diagnosticVersion: 'v4',
    engineVersion: data.engineVersion,
    renderSource: data.renderSource,
    report: data.report,
    legacy: data.legacy,
    diagnosticSnapshot: reportData.diagnosticSnapshot,
    _cache: cacheStatus,
    // ── RC8.2 Runtime Architecture Trace (instrumentation only) ──
    runtimeArchitectureTrace: {
      traceId: 'V4_' + (data.reportId || 'UNKNOWN') + '_' + Date.now(),
      stagesVisited: stages.map(function(s) { return s.stage }),
      firstFailedStage: stages.find(function(s) { return !s.ok }) ? stages.find(function(s) { return !s.ok }).stage : null,
      routerEntered: stages.some(function(s) { return s.stage === 'FALLBACK_ROUTER' }),
      routerDecision: data.fallbackRouterTrace ? data.fallbackRouterTrace.finalSource : 'NOT_ENTERED',
      finalReturnId: data.fallbackRouterTrace ? 'RETURN_02-14_FALLBACK' : 'RETURN_15_SUCCESS',
      finalRenderSource: data.renderSource,
      diagnosisAvailableAtReturn: !!(data.diagnosisTrace && data.diagnosisTrace.available),
      cacheHit: cacheStatus === 'CACHE_HIT',
      cloudBuildSha: '94ceca4',
      deploymentEnvId: 'fanshex-d2g0adgv7dfbc9bdc',
    },
    // ── RC8.2: Diagnosis Handoff Trace ──
    diagnosisHandoffTrace: handoffTrace || { acceptedSource: 'NONE', rejectedReason: 'HANDOFF_NOT_INITIALIZED' },
  })
}
