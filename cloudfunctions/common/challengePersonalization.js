'use strict'
/**
 * cloudfunctions/common/challengePersonalization.js
 *
 * RC8_10B — PERSONALIZED 30-DAY CHALLENGE SELECTOR.
 *
 * Given the shared user context (userContextBuilder), the latest 6Q authority,
 * the user's occupation / capital constraint / root problem / explicit goal /
 * world-model scores / prior challenge answers, produce a DETERMINISTIC ordered
 * plan over the (unchanged) challenge_events bank.
 *
 * Steps (spec Phase 3):
 *   1 filter contraindicated events (occupation gate)
 *   2 prefer occupation-adjacent events
 *   3 cover cognition dimensions
 *   4 maintain difficulty progression
 *   5 avoid duplicate themes
 *
 * Ratio target: universal 40–60% / personalized 40–60%.
 * Adaptive (Phase 4): every 5 days re-evaluate using ACTUAL prior choices.
 *
 * Pure + deterministic: same (events, ctx, priorChoices) ⇒ same plan.
 * Never rewrites past events, never invents progress, never alters scores.
 *
 * @version rc8_10b_v1
 */

const catalog = require('./challengeEventCatalog.js')

const RATIO_MIN = 0.4
const RATIO_MAX = 0.6
const WARMUP = 5            // first N positions are warmup — no capital-heavy
const CAPITAL_HEAVY_MAX_RATIO = 0.3
const ADAPTIVE_WINDOW = 5   // re-evaluate every 5 days

// occupation → likely domains (the user's own domain, used for adjacentness)
const OCCUPATION_DOMAINS = {
  厨师: ['business', 'content', 'service'],
  外卖员: ['career', 'service'],
  快递员: ['career', 'service'],
  销售: ['sales', 'career', 'content'],
  白领: ['career', 'management', 'ai'],
  个体老板: ['business', 'management', 'sales'],
  宝妈: ['content', 'service', 'business'],
  学生: ['career', 'content', 'ai'],
  技术人员: ['technical', 'ai', 'career'],
  内容创作者: ['content', 'business'],
  老板: ['business', 'management'],
  个体户: ['business', 'sales'],
  创业者: ['business', 'management'],
  客服: ['service', 'sales'],
  服务员: ['service'],
  设计师: ['content', 'technical'],
  运营: ['content', 'business', 'ai'],
  主播: ['content', 'sales'],
  程序员: ['technical', 'ai'],
}

// 6Q / goal keyword → domain expansion (only from the user's OWN words)
const KEYWORD_DOMAINS = [
  { re: /副业|第二收入|兼职|搞钱|变现|收入/, dom: ['content', 'business'] },
  { re: /开店|门店|生意|创业|老板|做生意/, dom: ['business', 'management'] },
  { re: /销售|客户|业绩|谈判|成交/, dom: ['sales'] },
  { re: /短视频|自媒体|直播|内容|粉丝|IP/i, dom: ['content'] },
  { re: /AI|人工智能|自动化|大模型/i, dom: ['ai'] },
  { re: /投资|理财|理财|股票|基金/, dom: ['money'] },
  { re: /管理|团队|带人|组织/, dom: ['management'] },
  { re: /技术|编程|开发|设备|维修/, dom: ['technical'] },
  { re: /服务|客户服务|接待/, dom: ['service'] },
]

function clamp (n, lo, hi) { return Math.max(lo, Math.min(hi, n)) }
function unique (arr) { return Array.from(new Set(arr)) }

/** Domains the user plausibly lives in — from occupation + own 6Q/message text. */
function deriveUserDomains (ctx) {
  const c = ctx || {}
  const ep = c.explicitProfile || {}
  const occ = ep.occupation || ''
  let dom = OCCUPATION_DOMAINS[occ] ? OCCUPATION_DOMAINS[occ].slice() : []
  const text = ((c.sixQText || '') + ' ' + (c.message || '') + ' ' + (ep.goal || ''))
  for (const k of KEYWORD_DOMAINS) if (k.re.test(text)) dom = dom.concat(k.dom)
  if (!dom.length) dom = ['career', 'business', 'ai', 'content']
  return unique(dom)
}

/** Unknown/limited capital → treat as low so capital-heavy events are down-weighted. */
function capitalLevel (ctx) {
  const ep = (ctx && ctx.explicitProfile) || {}
  if (ep.capital && ep.capital.known && ep.capital.level) return ep.capital.level
  const inc = ep.income
  if (inc != null && inc >= 15000) return 'medium'
  if (inc != null && inc >= 8000) return 'low'
  return 'low' // unknown income ⇒ conservative (low-capital)
}

/** Weak cognitive dimensions — from world-model profile and/or challenge evidence. */
function weakDimensions (ctx) {
  const c = ctx || {}
  const out = []
  if (c.profile && Array.isArray(c.profile.weakDimensions)) for (const d of c.profile.weakDimensions) out.push(d.key)
  if (c.challengeEvidence && Array.isArray(c.challengeEvidence.weakDimensions)) for (const d of c.challengeEvidence.weakDimensions) out.push(d.key)
  return unique(out)
}

/**
 * Deterministic profile version → cache key. Changes on new 6Q, memory toggle,
 * challenge completion, new report, explicit profile update (spec Phase 6).
 */
function computeProfileVersion (ctx, openid, opts) {
  const c = ctx || {}
  const o = opts || {}
  const sig = [
    (openid || '').slice(-8),
    (c.sixQ && c.sixQ.reportId) || 'no6q',
    c.memoryEnabled === false ? 'mem0' : 'mem1',
    String(o.completedCount || 0),
    String(o.reportCount || 0),
    (c.explicitProfile && c.explicitProfile.occupation) || 'noocc',
  ].join('|')
  let h = 5381
  for (let i = 0; i < sig.length; i++) h = ((h << 5) + h + sig.charCodeAt(i)) >>> 0
  return 'pv_' + h.toString(36)
}

/** Themes already demonstrated by the user's ACTUAL prior choices. */
function priorAnswerSignals (priorChoices, eventsById) {
  const tags = new Set()
  let risky = false, shortTerm = false
  for (const ch of (priorChoices || [])) {
    const ev = eventsById && eventsById[ch.eventId]
    if (!ev) continue
    const choice = (ev.choices || []).find((c) => c.key === ch.choice)
    if (!choice) continue
    for (const t of (choice.tags || [])) tags.add(t)
    const eff = choice.effects || {}
    // negative risk/decision = repeated impulsive behaviour → reinforce
    if ((eff.riskAwareness || 0) < 0 || (eff.decisionStability || 0) < 0) risky = true
    if ((eff.longTermism || 0) < 0) shortTerm = true
  }
  return { tags, risky, shortTerm }
}

/**
 * Build the personalized plan (ordered eventIds) — pure/deterministic.
 * @param {Array} events   raw challenge_events docs [{eventId, day, difficulty, ...}]
 * @param {object} ctx     userContextBuilder context
 * @param {Array} priorChoices [{eventId, choice}]
 * @param {object} opts    { openid }
 * @returns {{plan:Array, filteredOut:Array, metrics:object, profileVersion:string}}
 */
function buildPersonalizedPlan (events, ctx, priorChoices, opts) {
  const o = opts || {}
  const list = (events || []).slice()
  const occupation = (ctx && ctx.explicitProfile && ctx.explicitProfile.occupation) || ''
  const userDomains = deriveUserDomains(ctx)
  const weak = weakDimensions(ctx)
  const capLevel = capitalLevel(ctx)
  const eventsById = {}
  for (const ev of list) eventsById[ev.eventId] = ev
  const signals = priorAnswerSignals(priorChoices, eventsById)
  const completedCount = priorChoices ? priorChoices.length : 0
  const adaptPhase = Math.floor(completedCount / ADAPTIVE_WINDOW) // 0,1,2…

  const filteredOut = []
  const kept = []
  for (const raw of list) {
    const ev = catalog.decorateEvent(raw)
    // STEP_1 filter contraindicated events
    if (occupation && ev.contraindications.includes(occupation)) {
      filteredOut.push({ eventId: ev.eventId, reasonCode: 'CONTRAINDICATED_OCCUPATION', domains: ev.domains })
      continue
    }
    // score
    let score = 10
    const adjacent = ev.occupationAffinity.includes(occupation)
    const domainHit = ev.domains.some((d) => userDomains.includes(d))
    const isUniversal = ev.domains.includes('universal') || ev.occupationAffinity.includes('universal')
    if (adjacent) score += 9
    if (domainHit) score += 5
    if (isUniversal) score += 2
    // STEP_3 cover cognition dimensions
    if (ev.cognitiveDimension && weak.includes(ev.cognitiveDimension)) score += 3
    // STEP_4/adaptive — reinforce themes the user actually mis-handled
    if (signals.tags.size && ev.scenarioTags.some((t) => signals.tags.has(t))) score += 4
    if (signals.risky && ev.domains.includes('money')) score += 2
    if (signals.shortTerm && ev.cognitiveDimension === 'longTermism') score += 2
    // capital discipline — a low-capital user must not be biased capital-heavy
    if (capLevel === 'low') {
      if (ev.capitalRequirement === 'high') score -= 5
      else if (ev.capitalRequirement === 'medium') score -= 2
    }
    ev._score = score
    // "personalized" band = an APPLIED (domain-specific) event; "universal" band
    // = the abstract cognition-principle events. Occupation relevance is already
    // enforced by the contraindication gate + the capital/theme scoring above.
    ev._personal = ev.domains.some((d) => d !== 'universal')
    kept.push(ev)
  }

  // STEP_5 avoid duplicate themes: greedy pick by score, skip a theme already used.
  kept.sort((a, b) => (b._score - a._score) || (a.day - b.day))
  const personal = [], universal = []
  const usedThemes = new Set()
  for (const ev of kept) {
    const theme = (ev.scenarioTags && ev.scenarioTags[0]) || ev.cognitiveDimension
    const dup = theme && usedThemes.has(theme)
    if (dup) continue
    if (theme) usedThemes.add(theme)
    ;(ev._personal ? personal : universal).push(ev)
  }
  // stable progression inside each band
  personal.sort((a, b) => (a.difficulty - b.difficulty) || (a.day - b.day))
  universal.sort((a, b) => (a.difficulty - b.difficulty) || (a.day - b.day))
  // adaptive: bump events matching demonstrated weakness to the FRONT of the
  // tail band (positions ≥ WARMUP) so day6+ reacts to prior choices.
  if (adaptPhase >= 1) {
    const bump = (arr) => arr.sort((a, b) => {
      const am = signals.tags.size && a.scenarioTags.some((t) => signals.tags.has(t)) ? 0 : 1
      const bm = signals.tags.size && b.scenarioTags.some((t) => signals.tags.has(t)) ? 0 : 1
      return (am - bm) || (a.difficulty - b.difficulty) || (a.day - b.day)
    })
    bump(personal); bump(universal)
  }

  // interleave to hit the target ratio, universal-first warmup
  const total = personal.length + universal.length
  const targetPersonal = clamp(Math.round(total * 0.5), Math.ceil(total * RATIO_MIN), Math.floor(total * RATIO_MAX))
  let pi = 0, ui = 0
  const plan = []
  while (pi < personal.length || ui < universal.length) {
    const remaining = total - plan.length
    const needPersonal = targetPersonal - pi
    // take universal first (warmup gentler); switch to personal when we must
    const takePersonal = (ui >= universal.length) || (needPersonal >= remaining) || (plan.length >= WARMUP && (pi < needPersonal))
    if (takePersonal && pi < personal.length) plan.push(personal[pi++])
    else if (ui < universal.length) plan.push(universal[ui++])
    else if (pi < personal.length) plan.push(personal[pi++])
  }

  // WARMUP: no capital-heavy event in the first WARMUP positions (swap later)
  const capHeavy = (ev) => ev.capitalRequirement === 'high' || ev.capitalRequirement === 'medium'
  for (let i = 0; i < Math.min(WARMUP, plan.length); i++) {
    if (capHeavy(plan[i])) {
      const j = plan.findIndex((e, k) => k >= WARMUP && !capHeavy(e))
      if (j > i) { const t = plan[i]; plan[i] = plan[j]; plan[j] = t }
    }
  }

  const capitalHeavyCount = plan.filter(capHeavy).length
  const capHeavyRatio = total ? capitalHeavyCount / total : 0
  const metrics = {
    total: plan.length,
    personalizedCount: personal.length,
    universalCount: universal.length,
    personalizedRatio: total ? +(personal.length / total).toFixed(3) : 0,
    capitalHeavyCount,
    capitalHeavyRatio: +capHeavyRatio.toFixed(3),
    filteredOutCount: filteredOut.length,
    adaptPhase,
    domains: userDomains,
    profileVersion: computeProfileVersion(ctx, o.openid, { completedCount }),
  }
  if (capHeavyRatio > CAPITAL_HEAVY_MAX_RATIO) metrics.capitalBias = 'HIGH'
  return { plan, filteredOut, metrics, profileVersion: metrics.profileVersion }
}

/** Resolve the event at a plan index → the underlying raw event (or null). */
function selectEventForIndex (plan, index, eventsById) {
  if (!plan || index < 0 || index >= plan.length) return null
  const id = plan[index].eventId || plan[index]
  return (eventsById && eventsById[id]) || null
}

module.exports = {
  RATIO_MIN, RATIO_MAX, WARMUP, CAPITAL_HEAVY_MAX_RATIO, ADAPTIVE_WINDOW,
  OCCUPATION_DOMAINS, deriveUserDomains, capitalLevel, weakDimensions,
  computeProfileVersion, priorAnswerSignals, buildPersonalizedPlan, selectEventForIndex,
}
