'use strict'
/**
 * getPersonalizedContent — RC8.4 V6 R78
 *
 * Profile-driven World Rule recommendation + Daily Cognition / 认知暴击 ranking.
 *
 * §2  Reads the CANONICAL Cognitive Profile V1 via getCognitiveProfile(db, openid).
 *     It NEVER reconstructs profile state from ai_reports / challenge_records /
 *     user_memory / raw questionnaire answers.
 * §3  Priority: lens ids → topic ids → blind spot → bottleneck → legacy dims → date.
 * §15 When an item is actually OPENED, merge its id into learningHistory (seen).
 * §27 Logs carry reason codes / content ids / coarse signal only — never openid,
 *     full profile dump, raw answers, or full thesis.
 *
 * Product pages keep their existing functions (getDailyInsight / getWorldRules /
 * getWorldRuleDetail) UNCHANGED and un-deployed, so legacy / no-profile behavior
 * is preserved by construction.
 */

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const { ok, fail, CODES } = require('./lib/response.js')
const { getCognitiveProfile } = require('./lib/cognitiveProfile/cognitiveProfileReaderV6.js')
const { buildPersonalizationFeed, toSafeLog } = require('./lib/cognitiveProfile/personalization/personalizationRuntimeV6.js')
const { markSeen, SEEN_KINDS } = require('./lib/cognitiveProfile/personalization/learningHistoryV6.js')
const { STRIKE_POOL } = require('./lib/content/cognitionStrikePoolV6.js')

const now = () => Date.now()

function startOfDay (ts) {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
function dayIndex (ts) { return Math.floor(startOfDay(ts) / 86400000) }

/** Read the EXISTING content libraries (read-only). */
async function readContent () {
  const [wr, ins] = await Promise.all([
    db.collection('world_rules').where({ status: 'active' }).orderBy('sort', 'asc').limit(500).get().then((r) => r.data || []).catch(() => []),
    db.collection('daily_insights').where({ status: 'active' }).orderBy('sort', 'asc').limit(500).get().then((r) => r.data || []).catch(() => [])
  ])
  return { worldRules: wr, insights: ins, strikes: STRIKE_POOL }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return fail(CODES.AUTH_FAILED)

  const action = (event && event.action) || 'feed'
  const ts = now()
  console.log('[getPersonalizedContent] openid_present=' + (openid ? 'true' : 'false') + ' action=' + action)

  try {
    // §2 CANONICAL reader — the ONLY profile input.
    const profile = await getCognitiveProfile(db, openid)

    // §15 view accounting — mark SEEN only on an actual open event.
    if (action === 'view') {
      const kind = event.kind
      const id = event.id
      const r = await markSeen(db, openid, kind, id, ts)
      return ok({ seen: { kind: kind, id: id, ok: !!r.ok, wrote: !!r.wrote, idempotent: !!r.idempotent } })
    }

    const content = await readContent()
    const feed = buildPersonalizationFeed({
      profile: profile,
      worldRules: content.worldRules,
      insights: content.insights,
      strikes: content.strikes,
      dayIndex: dayIndex(ts)
    })

    // §27 privacy-safe internal log.
    console.log('[getPersonalizedContent] feed ' + JSON.stringify(toSafeLog(feed)))

    const isLegacy = !!profile.isLegacy
    const fallback = !feed.personalized

    return ok({
      personalized: feed.personalized,
      fallback: fallback,
      isLegacy: isLegacy,
      // §14 label ONLY when genuinely profile-driven.
      label: feed.label,
      worldRule: {
        ruleId: feed.worldRule.wrId,
        reasonCode: feed.worldRule.reasonCode,
        sourceSignal: feed.worldRule.sourceSignal,
        personalized: feed.worldRule.personalized,
        label: feed.worldRule.personalized ? '根据你最近的认知诊断推荐' : null,
        content: feed.worldRule.item || null
      },
      dailyInsight: {
        insightId: feed.dailyInsight.contentId,
        reasonCode: feed.dailyInsight.reasonCode,
        sourceSignal: feed.dailyInsight.sourceSignal,
        personalized: feed.dailyInsight.personalized,
        label: feed.dailyInsight.label,
        content: feed.dailyInsight.item ? feed.dailyInsight.item._raw || feed.dailyInsight.item : null
      },
      strike: {
        contentId: feed.strike.contentId,
        reasonCode: feed.strike.reasonCode,
        sourceSignal: feed.strike.sourceSignal,
        personalized: feed.strike.personalized,
        label: feed.strike.label,
        content: feed.strike.item ? feed.strike.item._raw || feed.strike.item : null
      },
      // §13 internal metadata bucket (no raw ids leak to UI by contract).
      meta: {
        worldRuleReason: feed.worldRule.reasonCode,
        dailyReason: feed.dailyInsight.reasonCode,
        strikeReason: feed.strike.reasonCode
      }
    })
  } catch (err) {
    console.error('[getPersonalizedContent] 异常:', err && err.message ? err.message : err)
    return fail(CODES.DB_ERROR, err && err.message ? err.message : 'error')
  }
}

module.exports.SEEN_KINDS = SEEN_KINDS
