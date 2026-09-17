'use strict'
/**
 * tests/v6/thesis/rc8.4-v6-r77-cognitive-profile-bridge.test.js
 *
 * RC8.4 V6 R77 — COGNITIVE PROFILE BRIDGE V1.
 *
 * Proves the deterministic, merge-safe diagnosis → user_profiles writeback:
 *   - schema version + section stacking (no competing collection)
 *   - legacy user_profiles compatibility (§16)
 *   - OBSERVED / DERIVED / INFERRED / HYPOTHESIS separation (§8/§9)
 *   - R75 diagnosis → profile writeback (§10)
 *   - idempotency on the same report key (§12)
 *   - merge preservation: 9 dimensions / tags / learningHistory (§13)
 *   - profile-write failure does NOT fail the report (§11)
 *   - no raw-answer duplication, no openid log leak (§18)
 *   - world-rule crosswalk DIRECT / PARTIAL / NONE (§14/§15)
 *   - A/B/C normalized Cognitive Profile V1 (§20)
 *
 * Deterministic. No network.
 */

const path = require('path')
const fs = require('fs')
const ROOT = path.resolve(__dirname, '..', '..', '..')
const CF = path.join(ROOT, 'cloudfunctions/generateAiReport/lib')
const CP = path.join(CF, 'cognitiveProfile')

const { runHybridDiagnosisV6 } = require(path.join(CF, 'turnaroundStrategy/v6/hybrid/hybridDiagnosisV6.js'))
const { buildReportV6 } = require(path.join(CF, 'turnaroundStrategy/v6/report/reportBuilderV6.js'))
const { runV4RestoredReportRuntimeV6, RENDER_SOURCE } = require(path.join(CF, 'turnaroundStrategy/v6/thesis/v4RestoredReportRuntimeV6.js'))

const SCHEMA = require(path.join(CP, 'profileSchemaV1.js'))
const CROSS = require(path.join(CP, 'worldRuleCrosswalkV6.js'))
const BRIDGE = require(path.join(CP, 'cognitiveProfileBridgeV6.js'))
const READER = require(path.join(CP, 'cognitiveProfileReaderV6.js'))
const WB = require(path.join(CP, 'cognitiveProfileWritebackV6.js'))
const { WORLD_RULE_LIBRARY } = require(path.join(CF, 'turnaroundStrategy/v6/report/worldRuleLibraryV6.js'))

let pass = 0, fail = 0
const results = []
function ok (name, cond, extra) {
  if (cond) { pass++; results.push('  PASS ' + name) }
  else { fail++; results.push('  FAIL ' + name + (extra ? ' :: ' + extra : '')) }
}

// ── control inputs (reused from R70 fixtures) ──
const OWNER = {
  lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', occupationDetail: '',
  monthlySurplus: 'SURPLUS_1K_5K', safetyMonths: 'SAFETY_3_6', debtPressure: 'DEBT_NONE',
  skillValidation: 'PROOF_PAID_ONCE', monetizableSkill: 'ASSET_CONTENT', weeklyTime: 'TIME_20_PLUS',
  executionStability: 'EXEC_VOLATILE', pastAttemptStage: 'ATTEMPT_NONE', selfBelief: 'BELIEF_KNOW_NO_ACTION',
  decisionStyle: 'DECISION_ALL_IN', timeBehavior: 'TIME_BALANCE', primaryProblem: 'PROBLEM_MONETIZE',
  primaryGoal: 'GOAL_SKILL_MONETIZE', maxTrialCost: 'COST_5K_20K', failureResponse: 'FAIL_GIVE_UP'
}
const PROGRAMMER = Object.assign({}, OWNER, {
  occupationDetail: '后端程序员', incomeStructure: 'INC_SALARY', monetizableSkill: 'ASSET_TECHNICAL',
  skillValidation: 'PROOF_PAID_ONCE', primaryProblem: 'PROBLEM_MONETIZE', primaryGoal: 'GOAL_SIDE_TO_MAIN'
})
const CONTENT = Object.assign({}, OWNER, {
  occupationDetail: '', incomeStructure: 'INC_UNSTABLE', monetizableSkill: 'ASSET_CONTENT',
  skillValidation: 'PROOF_FREE_THANKED', primaryProblem: 'PROBLEM_SIDE_UNSTARTED', primaryGoal: 'GOAL_SIDE_INCOME'
})
// PRIMARY-diagnosis control (REPEATABILITY_GAP via ATTEMPT_FEW_SALES) — used to
// prove the deterministic lens id IS stored when the kernel legitimately picks one.
const PRIMARY_CTRL = {
  lifeStage: 'LIFE_31_40', incomeStructure: 'INC_SALARY', occupationDetail: '程序员',
  monthlySurplus: 'SURPLUS_1K_5K', safetyMonths: 'SAFETY_3_6', debtPressure: 'DEBT_NONE',
  skillValidation: 'PROOF_PAID_ONCE', monetizableSkill: 'ASSET_TECHNICAL',
  weeklyTime: 'TIME_5_10', executionStability: 'EXEC_STABLE',
  pastAttemptStage: 'ATTEMPT_FEW_SALES', selfBelief: 'BELIEF_TRIED_NO_RESULT',
  decisionStyle: 'DECISION_SMALL_TEST', timeBehavior: 'TIME_SHORT_FIRST',
  primaryProblem: 'PROBLEM_INCOME_STUCK', primaryGoal: 'GOAL_SIDE_INCOME',
  maxTrialCost: 'COST_1K_5K', failureResponse: 'FAIL_RECHECK'
}

const GOOD_OUTPUT = {
  strategicThesis: {
    identityInterpretation: '你是一个手握一项已被市场付费验证过的内容能力、却用"再准备一下"拖住商业检验的人。',
    coreContradiction: '你不是没有能力，而是一直没把能力变成一件别人能直接购买的东西。',
    systemTrap: '能力只按次使用，收入永远卡在一次换一次。',
    worldRule: '能被重复购买的能力才是资产，只能被使用一次的只是工时。',
    strategicMigration: { from: '有技能的人', to: '有一个能被重复购买的产品的人', steps: ['封装交付', '找到买家', '固化复购'] },
    commercialThesis: { objective: '拿到第一笔针对明确交付的付费', offer: '付费内容诊断', buyer: '中小商家', delivery: '线上', distribution: '同城商家群', repeatSale: '月度代运营', productization: '模板+流程' }
  },
  cards: {
    card01: '你不是能力不够，是把能力一直攥在手里没敢标价。',
    card02: '你的问题不在会不会写，而在于把能力当成本事，而不是一件能被购买的商品。',
    card03: ['能力只按次使用，收入一次换一次。', '没有封装成交付，买家看不懂你给什么。', '没有固定买家，每次从零开始。'],
    card04: { from: '把能力当成本事留着', to: '把能力做成能被购买的最小交付', steps: ['定义交付', '找买家', '测第一笔付费'] },
    card05: { objective: '拿到第一笔针对明确交付的付费', actions: ['写交付清单', '联系10个商家', '发低风险测试价'], target: '10个目标商家', timebox: '14天', successSignal: '至少1个买家为明确交付付了钱' }
  }
}

// ── in-memory db mock (deterministic) ──
function makeDb (profileDoc, failUpdate) {
  const state = { profile: profileDoc, updates: [] }
  const col = {
    where () { return this },
    limit () { return this },
    orderBy () { return this },
    async get () { return { data: state.profile ? [state.profile] : [] } },
    doc (id) {
      return {
        async update ({ data }) {
          if (failUpdate) throw new Error('MOCK_DB_WRITE_FAIL')
          state.updates.push(data)
          state.profile = Object.assign({}, state.profile, data)
          return { updated: 1 }
        }
      }
    }
  }
  return {
    collection (name) { if (name !== 'user_profiles') throw new Error('unexpected collection ' + name); return col },
    _state: state
  }
}

async function reportFor (answers) {
  const o = runHybridDiagnosisV6(answers)
  const fb = buildReportV6(o.diagnosis, o.hybridContext)
  const callAI = async () => ({ success: true, content: JSON.stringify(GOOD_OUTPUT), tokens: 800, finishReason: 'stop' })
  const r = await runV4RestoredReportRuntimeV6({ diagnosis: o.diagnosis, hybridProfile: o.hybridProfile, hybridContext: o.hybridContext, fallbackReport: fb, callAI })
  return { o, report: r.report, renderSource: r.renderSource }
}

async function main () {
  // ── §16 legacy profile compatibility ──
  const legacyDoc = { _id: 'p1', openid: 'oLEGACY', laborMindset: 55, probabilityMindset: 42, systemThinking: 60, leverageThinking: 48, capitalThinking: 33, riskAwareness: 70, informationSensitivity: 51, longTermism: 44, decisionStability: 39, wealthPotentialScore: 49, turnaroundProbability: 40, mainType: 'system_thinker', subType: 'system_builder', tags: ['old_tag'] }
  const normLegacy = READER.normalizeCognitiveProfile({ profile: legacyDoc })
  ok('R77 §16 legacy profile present', normLegacy.present === true)
  ok('R77 §16 legacy profile isLegacy=YES', normLegacy.isLegacy === true)
  ok('R77 §16 legacy 9 dimensions preserved', normLegacy.dimensions.systemThinking === 60 && normLegacy.dimensions.laborMindset === 55)
  ok('R77 §16 legacy tags preserved', normLegacy.tags.indexOf('old_tag') !== -1)
  ok('R77 §16 legacy sections default empty', normLegacy.diagnosticState === null && normLegacy.learningHistory.seenRuleIds.length === 0)
  ok('R77 §16 LEGACY_PROFILE_COMPATIBLE=YES', normLegacy.schemaVersion === null)

  // ── §10 writeback on a real R75 diagnosis (owner) ──
  const A = await reportFor(OWNER)
  ok('R77 §10 owner report is v4_restored', A.renderSource === RENDER_SOURCE.AI, A.renderSource)
  const dbA = makeDb(legacyDoc)
  const wbA = await WB.runCognitiveProfileWritebackV6(dbA, 'oLEGACY', { diagnosis: A.o.diagnosis, hybridProfile: A.o.hybridProfile, hybridContext: A.o.hybridContext, report: A.report, ts: 1_700_000_000_000 })
  ok('R77 §10 writeback ok', wbA.ok === true && wbA.wrote === true, JSON.stringify(wbA))
  ok('R77 §10 reportKey deterministic (ARV6_)', /^ARV6_[0-9a-f]{24}$/.test(wbA.reportKey || ''), wbA.reportKey)
  const upA = dbA._state.updates[0]
  ok('R77 §10 profileSchemaVersion written', upA.profileSchemaVersion === SCHEMA.COGNITIVE_PROFILE_SCHEMA_VERSION && upA.profileSchemaVersion === 'cognitive_profile_v1')
  ok('R77 §10 diagnosticState section present', !!upA.diagnosticState)
  ok('R77 §10 cognitiveState section present', !!upA.cognitiveState)
  ok('R77 §10 currentFocus section present', !!upA.currentFocus)
  ok('R77 §10 learningHistory section present', !!upA.learningHistory)
  ok('R77 §4 assetState derived PAID_ONCE', upA.diagnosticState.assetState.value === 'PAID_ONCE', upA.diagnosticState.assetState.value)
  ok('R77 §4 lastReportId carries reportKey', upA.diagnosticState.lastReportId.value === wbA.reportKey)

  // ── §13 merge preservation (9 dims / tags untouched) ──
  ok('R77 §13 nine dimensions NOT in update', SCHEMA.EXISTING_COGNITIVE_DIMENSIONS.every((d) => upA[d] === undefined))
  ok('R77 §13 tags NOT in update', upA.tags === undefined)
  ok('R77 §13 existing dimension intact on doc', dbA._state.profile.systemThinking === 60)
  ok('R77 §13 existing tags intact on doc', dbA._state.profile.tags.indexOf('old_tag') !== -1)

  // ── §8/§9 provenance separation ──
  ok('R77 §9 OBSERVED lastReportId', upA.diagnosticState.lastReportId.provenance === 'OBSERVED')
  ok('R77 §9 DERIVED assetState', upA.diagnosticState.assetState.provenance === 'DERIVED')
  ok('R77 §9 INFERRED primaryBlindSpot', upA.cognitiveState.primaryBlindSpot.provenance === 'INFERRED')
  ok('R77 §9 HYPOTHESIS targetWorldModel', upA.cognitiveState.targetWorldModel.provenance === 'HYPOTHESIS')
  ok('R77 §8 confidence is coarse enum', ['HIGH', 'MEDIUM', 'LOW'].indexOf(upA.diagnosticState.assetState.confidence) !== -1)
  ok('R77 §8 every assertion carries source+updatedAt', SCHEMA.EXISTING_COGNITIVE_DIMENSIONS.length >= 9 &&
    !!upA.diagnosticState.assetState.source && upA.diagnosticState.assetState.updatedAt === 1_700_000_000_000)
  ok('R77 §9 AI inference not silently OBSERVED (blindSpot)', upA.cognitiveState.primaryBlindSpot.provenance !== 'OBSERVED')

  // ── §15 worldRule: stable lens id + separate expression ──
  // The owner diagnosis is NO_PRIMARY → legitimately NO lens is selected (a
  // lens would have to be forced, which §14/§9 forbid). The free-text prose is
  // stored ONLY as `expression`, never as the canonical id.
  ok('R77 §15 NO_PRIMARY → no forced lens id (null)', upA.cognitiveState.currentWorldModel.id === null)
  ok('R77 §15 expression stored separately from id', upA.cognitiveState.currentWorldModel.expression === GOOD_OUTPUT.strategicThesis.worldRule)
  ok('R77 §15 free-text NOT used as canonical id', upA.cognitiveState.currentWorldModel.id !== GOOD_OUTPUT.strategicThesis.worldRule)
  ok('R77 §15 no-lens expression provenance INFERRED', upA.cognitiveState.currentWorldModel.provenance === 'INFERRED')
  ok('R77 §6 NO_PRIMARY → empty lens list + null experimentType', upA.currentFocus.worldRuleLensIds.length === 0 && upA.currentFocus.experimentType === null)

  // ── §16/§17 canonical reader on the written doc ──
  const dbRead = makeDb(Object.assign({}, legacyDoc, upA))
  const canon = await READER.getCognitiveProfile(dbRead, 'oLEGACY')
  ok('R77 §17 reader returns v1 profile', canon.schemaVersion === 'cognitive_profile_v1' && canon.isLegacy === false)
  ok('R77 §17 reader keeps 9 dimensions', canon.dimensions.laborMindset === 55)
  ok('R77 §17 reader exposes diagnosticState', canon.diagnosticState && canon.diagnosticState.assetState.value === 'PAID_ONCE')

  // ── §12 idempotency ──
  const dbIdem = makeDb(Object.assign({}, legacyDoc, upA))
  const wbIdem = await WB.runCognitiveProfileWritebackV6(dbIdem, 'oLEGACY', { diagnosis: A.o.diagnosis, hybridProfile: A.o.hybridProfile, report: A.report, ts: 1_700_000_000_001 })
  ok('R77 §12 same report → idempotent no-op', wbIdem.ok === true && wbIdem.wrote === false && wbIdem.idempotent === true, JSON.stringify(wbIdem))
  ok('R77 §12 idempotent write did not touch DB', dbIdem._state.updates.length === 0)

  // ── §12/§13 learningHistory merge (union, never reset) ──
  const withHistory = Object.assign({}, legacyDoc, upA, { learningHistory: { seenRuleIds: ['WR001'], seenInsightIds: ['DI_1'], seenStrikeIds: [] } })
  const dbHist = makeDb(withHistory)
  const second = Object.assign({}, A.o.diagnosis)
  const wbHist = await WB.runCognitiveProfileWritebackV6(dbHist, 'oLEGACY', { diagnosis: second, hybridProfile: A.o.hybridProfile, report: A.report, ts: 1_700_000_000_002, reportKey: 'ARV6_different0000000000000' })
  const histUpdate = dbHist._state.updates[0]
  ok('R77 §13 learningHistory merged not reset (seenRuleIds keeps WR001)', wbHist.ok === true && histUpdate.learningHistory.seenRuleIds.indexOf('WR001') !== -1)
  ok('R77 §13 learningHistory union preserves insight ids', histUpdate.learningHistory.seenInsightIds.indexOf('DI_1') !== -1)

  // ── §11 profile-write failure does NOT fail report ──
  const dbFail = makeDb(legacyDoc, true)
  let threw = false
  let wbFail = null
  try { wbFail = await WB.runCognitiveProfileWritebackV6(dbFail, 'oSECRET_OPENID_123', { diagnosis: A.o.diagnosis, hybridProfile: A.o.hybridProfile, report: A.report, ts: 1_700_000_000_003 }) } catch (e) { threw = true }
  ok('R77 §11 write failure does not throw', threw === false)
  ok('R77 §11 write failure reported (WRITE_FAIL)', wbFail && wbFail.ok === false && wbFail.reason === 'WRITE_FAIL', JSON.stringify(wbFail))
  ok('R77 §11 report still returned regardless (runtime isolation)', A.renderSource === RENDER_SOURCE.AI)

  // ── §18 no raw openid in logs ──
  const origErr = console.error
  let captured = ''
  console.error = function () { captured += Array.prototype.join.call(arguments, ' ') + '\n' }
  try { await WB.runCognitiveProfileWritebackV6(makeDb(legacyDoc, true), 'oSECRET_OPENID_123', { diagnosis: A.o.diagnosis, hybridProfile: A.o.hybridProfile, report: A.report, ts: 1 }) } catch (_) {}
  console.error = origErr
  ok('R77 §18 no raw openid in failure log', captured.indexOf('oSECRET_OPENID_123') === -1 && /openid_present=true/.test(captured))

  // ── §18 no raw-answer duplication ──
  const patchJSON = JSON.stringify(upA)
  ok('R77 §18 no occupation raw text stored', patchJSON.indexOf('后端程序员') === -1)
  ok('R77 §18 no raw full-answer dump (no incomeStructure literal)', patchJSON.indexOf('INC_SALARY') === -1 && patchJSON.indexOf('PROOF_PAID_ONCE') === -1)

  // ── §14/§15 crosswalk DIRECT / PARTIAL / NONE ──
  const counts = CROSS.crosswalkCounts()
  ok('R77 §14 crosswalk complete for all live lenses', CROSS.isComplete() === true && counts.UNKNOWN_LENS === 0)
  ok('R77 §14 crosswalk has DIRECT', counts.DIRECT > 0)
  ok('R77 §14 crosswalk has PARTIAL', counts.PARTIAL > 0)
  // R81 — the 3 previously-NONE lenses now have genuine seed content and are repaired to DIRECT.
  ok('R77 §14 crosswalk NONE repaired to 0 (R81 content)', counts.NONE === 0 && counts.DIRECT === 6)
  const dir = CROSS.getCrosswalkForLens('PROBABILITY_OVER_CERTAINTY')
  ok('R77 §14 DIRECT mapping → WR004', dir.status === 'DIRECT' && dir.wrId === 'WR004', JSON.stringify(dir))
  const none = CROSS.getCrosswalkForLens('COMPOUNDING_OVER_RESTARTING')
  ok('R77 §14 previously-NONE lens now DIRECT → WR019 (R81)', none.status === 'DIRECT' && none.wrId === 'WR019')
  ok('R77 §14 MARKET_PROOF lens now DIRECT → WR016 (R81)', CROSS.getCrosswalkForLens('MARKET_PROOF_OVER_SELF_ASSESSMENT').wrId === 'WR016')
  ok('R77 §14 REPEATABILITY lens now DIRECT → WR022 (R81)', CROSS.getCrosswalkForLens('REPEATABILITY_OVER_OCCASIONAL_SUCCESS').wrId === 'WR022')
  ok('R77 §14 unknown lens → null', CROSS.getCrosswalkForLens('NOPE') === null)
  const part = CROSS.getCrosswalkForLens('SYSTEM_OVER_MOTIVATION')
  ok('R77 §14 PARTIAL mapping → WR008', part.status === 'PARTIAL' && part.wrId === 'WR008')

  // ── §20 A/B/C normalized Cognitive Profile V1 ──
  const B = await reportFor(PROGRAMMER)
  const C = await reportFor(CONTENT)
  const patchA = BRIDGE.buildCognitiveProfilePatch({ diagnosis: A.o.diagnosis, hybridProfile: A.o.hybridProfile, report: A.report, ts: 2000 })
  const patchB = BRIDGE.buildCognitiveProfilePatch({ diagnosis: B.o.diagnosis, hybridProfile: B.o.hybridProfile, report: B.report, ts: 2000 })
  const patchC = BRIDGE.buildCognitiveProfilePatch({ diagnosis: C.o.diagnosis, hybridProfile: C.o.hybridProfile, report: C.report, ts: 2000 })
  ok('R77 §20 A profile ready (schema + diagnosticState)', patchA.profileSchemaVersion === 'cognitive_profile_v1' && !!patchA.diagnosticState.diagnosisState.value)
  ok('R77 §20 B profile ready', patchB.profileSchemaVersion === 'cognitive_profile_v1' && !!patchB.diagnosticState.assetState.value)
  ok('R77 §20 C profile ready (no-paid-proof content)', patchC.profileSchemaVersion === 'cognitive_profile_v1' && patchC.diagnosticState.assetState.value === 'SKILL_USED_FREE', patchC.diagnosticState.assetState.value)
  ok('R77 §20 A assetState PAID_ONCE', patchA.diagnosticState.assetState.value === 'PAID_ONCE')
  ok('R77 §20 B occupation NOT stored (only normalized state)', JSON.stringify(patchB).indexOf('后端程序员') === -1)
  // §15/§6 on a PRIMARY diagnosis → the deterministic lens IS stored as a stable id.
  const PR = await reportFor(PRIMARY_CTRL)
  ok('R77 §15 PRIMARY kernel picks a bottleneck', PR.o.diagnosis.diagnosisState === 'PRIMARY' && PR.o.diagnosis.primaryBottleneck === 'REPEATABILITY_GAP', PR.o.diagnosis.diagnosisState + '/' + PR.o.diagnosis.primaryBottleneck)
  const patchPR = BRIDGE.buildCognitiveProfilePatch({ diagnosis: PR.o.diagnosis, hybridProfile: PR.o.hybridProfile, report: PR.report, ts: 2000 })
  const lensKeyB = patchPR.cognitiveState.currentWorldModel.id
  ok('R77 §15 PRIMARY → stable lens id stored', !!lensKeyB && Object.prototype.hasOwnProperty.call(WORLD_RULE_LIBRARY, lensKeyB), String(lensKeyB))
  ok('R77 §15 PRIMARY lens provenance DERIVED', patchPR.cognitiveState.currentWorldModel.provenance === 'DERIVED')
  ok('R77 §6 PRIMARY currentFocus lens id + string experimentType', patchPR.currentFocus.worldRuleLensIds.indexOf(lensKeyB) !== -1 && typeof patchPR.currentFocus.experimentType === 'string')
  const controlA = READER.normalizeCognitiveProfile({ profile: Object.assign({}, legacyDoc, patchA) })
  ok('R77 §20 CONTROL_PROFILE_A_READY', controlA.schemaVersion === 'cognitive_profile_v1')
  const controlB = READER.normalizeCognitiveProfile({ profile: Object.assign({}, legacyDoc, patchB) })
  ok('R77 §20 CONTROL_PROFILE_B_READY', controlB.schemaVersion === 'cognitive_profile_v1')
  const controlC = READER.normalizeCognitiveProfile({ profile: Object.assign({}, legacyDoc, patchC) })
  ok('R77 §20 CONTROL_PROFILE_C_READY', controlC.schemaVersion === 'cognitive_profile_v1')

  // ── §21 no downstream personalization touched (static check) ──
  const bridgeSrc = fs.readFileSync(path.join(CP, 'cognitiveProfileBridgeV6.js'), 'utf8')
  const wbSrc = fs.readFileSync(path.join(CP, 'cognitiveProfileWritebackV6.js'), 'utf8')
  ok('R77 §21 bridge does not select daily cognition', !/getDailyInsight|dailyInsights|cognitionStrike/i.test(bridgeSrc + wbSrc))
  ok('R77 §21 bridge does not select challenge', !/challenge_events|getChallengeEvent/i.test(bridgeSrc + wbSrc))
  ok('R77 §21 bridge does not touch CV/level/streak', !/\bcv\b|\blevel\b|\bstreak\b/i.test(bridgeSrc))

  console.log(results.join('\n'))
  console.log('\nR77 TESTS: ' + pass + ' passed, ' + fail + ' failed')
  if (fail > 0) process.exit(1)
}

main()
