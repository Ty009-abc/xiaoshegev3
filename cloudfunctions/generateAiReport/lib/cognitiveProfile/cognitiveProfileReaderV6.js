'use strict'
/**
 * lib/cognitiveProfile/cognitiveProfileReaderV6.js
 *
 * RC8.4 V6 R77 §16/§17 — CANONICAL COGNITIVE PROFILE READER.
 *
 * One normalized accessor so future consumers do NOT each re-assemble
 *   user_profiles + ai_reports + user_memory + challenge_records.
 *
 *   normalizeCognitiveProfile({ profile, latestReport, memory, challengeRecord })
 *   getCognitiveProfile(db, openid)   // DB-backed, fail-safe
 *
 * BACKWARD COMPATIBILITY (§16): a LEGACY user_profiles doc that carries ONLY the
 * nine cognitive dimensions STILL normalizes cleanly — `isLegacy=true`, the nine
 * dimensions are returned as-is, and the R77 sections are empty defaults.
 *
 * READ-ONLY. No writes. No AI. CONSUMER LAYER ONLY.
 */

const {
  COGNITIVE_PROFILE_SCHEMA_VERSION,
  PROVENANCE,
  CONFIDENCE,
  emptyLearningHistory
} = require('./profileSchemaV1.js')

const DIMENSION_KEYS = [
  'laborMindset', 'probabilityMindset', 'systemThinking',
  'leverageThinking', 'capitalThinking', 'riskAwareness',
  'informationSensitivity', 'longTermism', 'decisionStability'
]
const DERIVED_KEYS = [
  'wealthPotentialScore', 'turnaroundProbability', 'mainType', 'subType'
]

function pickDimensions (src) {
  const s = src || {}
  const dims = {}
  for (const k of DIMENSION_KEYS) dims[k] = (s[k] === undefined ? null : s[k])
  return dims
}

function pickDerived (src) {
  const s = src || {}
  const d = {}
  for (const k of DERIVED_KEYS) d[k] = (s[k] === undefined ? null : s[k])
  return d
}

/** Empty section defaults for a legacy / never-bridged profile. */
function emptySections () {
  return {
    diagnosticState: null,
    cognitiveState: null,
    currentFocus: null,
    learningHistory: emptyLearningHistory(0)
  }
}

/**
 * Normalize a raw bundle into the canonical Cognitive Profile V1 shape.
 * @param {Object} sources { profile, latestReport, memory, challengeRecord }
 * @returns {Object} canonical normalized profile (never throws)
 */
function normalizeCognitiveProfile (sources) {
  const s = sources || {}
  const p = s.profile && typeof s.profile === 'object' ? s.profile : null
  if (!p) {
    return {
      schemaVersion: null,
      isLegacy: true,
      present: false,
      dimensions: pickDimensions(null),
      derived: pickDerived(null),
      tags: [],
      diagnosticState: null,
      cognitiveState: null,
      currentFocus: null,
      learningHistory: emptyLearningHistory(0),
      latestReport: null,
      memory: null,
      challenge: null,
      provenance: { source: 'absent', confidence: CONFIDENCE.LOW, updatedAt: null }
    }
  }

  const schemaVersion = p.profileSchemaVersion || null
  const isLegacy = !schemaVersion || schemaVersion !== COGNITIVE_PROFILE_SCHEMA_VERSION
  const sections = emptySections()

  if (!isLegacy) {
    if (p.diagnosticState) sections.diagnosticState = p.diagnosticState
    if (p.cognitiveState) sections.cognitiveState = p.cognitiveState
    if (p.currentFocus) sections.currentFocus = p.currentFocus
    if (p.learningHistory) {
      sections.learningHistory = {
        seenRuleIds: Array.isArray(p.learningHistory.seenRuleIds) ? p.learningHistory.seenRuleIds.slice() : [],
        seenInsightIds: Array.isArray(p.learningHistory.seenInsightIds) ? p.learningHistory.seenInsightIds.slice() : [],
        seenStrikeIds: Array.isArray(p.learningHistory.seenStrikeIds) ? p.learningHistory.seenStrikeIds.slice() : [],
        provenance: p.learningHistory.provenance || PROVENANCE.OBSERVED,
        confidence: p.learningHistory.confidence || CONFIDENCE.HIGH,
        source: p.learningHistory.source || 'profile',
        updatedAt: p.learningHistory.updatedAt != null ? p.learningHistory.updatedAt : null
      }
    }
  }

  const lr = s.latestReport && typeof s.latestReport === 'object' ? s.latestReport : null
  const mem = s.memory && typeof s.memory === 'object' ? s.memory : null
  const ch = s.challengeRecord && typeof s.challengeRecord === 'object' ? s.challengeRecord : null

  return {
    schemaVersion: schemaVersion || null,
    isLegacy: isLegacy,
    present: true,
    dimensions: pickDimensions(p),
    derived: pickDerived(p),
    tags: Array.isArray(p.tags) ? p.tags.slice() : [],
    diagnosticState: sections.diagnosticState,
    cognitiveState: sections.cognitiveState,
    currentFocus: sections.currentFocus,
    learningHistory: sections.learningHistory,
    latestReport: lr ? {
      reportId: lr.reportId || null,
      type: lr.type || null,
      reportState: (lr.content && lr.content.reportState) || lr.reportState || null,
      createdAt: lr.createdAt != null ? lr.createdAt : null
    } : null,
    memory: mem ? {
      coreGoals: Array.isArray(mem.coreGoals) ? mem.coreGoals.slice() : (mem.userMemory && mem.userMemory.coreGoals) || [],
      riskFlags: Array.isArray(mem.riskFlags) ? mem.riskFlags.slice() : (mem.userMemory && mem.userMemory.riskFlags) || [],
      stableTraits: Array.isArray(mem.stableTraits) ? mem.stableTraits.slice() : (mem.userMemory && mem.userMemory.stableTraits) || []
    } : null,
    challenge: ch ? {
      latestRecordId: ch.recordId || null,
      status: ch.status || null,
      finalType: ch.finalType || null
    } : null,
    provenance: {
      source: isLegacy ? 'legacy_user_profiles' : 'cognitive_profile_v1',
      confidence: isLegacy ? CONFIDENCE.LOW : CONFIDENCE.HIGH,
      updatedAt: (p._profileMeta && p._profileMeta.updatedAt) || p.updatedAt || null
    }
  }
}

/**
 * DB-backed canonical reader. Reads the four sources and normalizes them.
 * Fail-safe: any read error degrades to whatever is available (never throws).
 * @param {Object} db cloud database handle
 * @param {string} openid
 */
async function getCognitiveProfile (db, openid) {
  const out = { profile: null, latestReport: null, memory: null, challengeRecord: null }
  if (!db || !openid) return normalizeCognitiveProfile(out)
  try {
    const r = await db.collection('user_profiles').where({ openid }).limit(1).get()
    out.profile = (r.data && r.data[0]) || null
  } catch (e) { /* degrade */ }
  try {
    const r = await db.collection('ai_reports').where({ openid }).orderBy('createdAt', 'desc').limit(1).get()
    out.latestReport = (r.data && r.data[0]) || null
  } catch (e) { /* degrade */ }
  try {
    const r = await db.collection('user_memory').where({ openid }).limit(1).get()
    out.memory = (r.data && r.data[0]) || null
  } catch (e) { /* degrade */ }
  try {
    const r = await db.collection('challenge_records').where({ openid }).orderBy('createdAt', 'desc').limit(1).get()
    out.challengeRecord = (r.data && r.data[0]) || null
  } catch (e) { /* degrade */ }
  return normalizeCognitiveProfile(out)
}

module.exports = {
  normalizeCognitiveProfile,
  getCognitiveProfile,
  DIMENSION_KEYS,
  DERIVED_KEYS
}
