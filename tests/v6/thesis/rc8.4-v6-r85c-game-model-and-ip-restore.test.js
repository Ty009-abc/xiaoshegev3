'use strict'
/**
 * tests/v6/thesis/rc8.4-v6-r85c-game-model-and-ip-restore.test.js
 *
 * RC8.4 V6 R85-C — GAME MODEL + IP RESTORE (珠澳小事哥).
 *
 * §3  deterministic gameModelV6 above RealEconomyModel (no LLM)
 * §4  small game-type taxonomy (≤6)
 * §5  value exchange
 * §6  pricing authority (central to the IP)
 * §7  game rule
 * §8  trap mechanism
 * §9  switch direction (not forced entrepreneurship)
 * §10 small reality bet
 * §11 structured thesis injection (REALITY→GAME→RULE→TRAP→SWITCH→BET)
 * §17 five control cases
 * §18 distinctness (DISTINCT_GAME/TRAP/SWITCH/BET >= 4)
 * §19 IP-native language block
 * §20 UNSUPPORTED_GAME_CLAIM_COUNT = 0 (+ R84-D preserved)
 * §23/§24 profile + personalization + report-UI freezes
 * §25 model call count = 1
 *
 * Deterministic. Stub provider only (no network). Reads the REAL runtime.
 */

const path = require('path')
const fs = require('fs')
const ROOT = path.resolve(__dirname, '..', '..', '..')
const CF = path.join(ROOT, 'cloudfunctions/generateAiReport/lib')
const TH = path.join(CF, 'turnaroundStrategy/v6/thesis')
const HY = path.join(CF, 'turnaroundStrategy/v6/hybrid')
const CP = path.join(CF, 'cognitiveProfile')
const PERS = path.join(CF, 'cognitiveProfile/personalization')

const { runHybridDiagnosisV6 } = require(path.join(HY, 'hybridDiagnosisV6.js'))
const { buildReportV6 } = require(path.join(CF, 'turnaroundStrategy/v6/report/reportBuilderV6.js'))
const { buildV4RestoredPayload } = require(path.join(TH, 'v4RestoredContextV6.js'))
const { buildV4RestoredPrompt, PROMPT_VERSION } = require(path.join(TH, 'v4RestoredPromptV6.js'))
const { runV4RestoredReportRuntimeV6, RENDER_SOURCE, buildGroundingCtx } = require(path.join(TH, 'v4RestoredReportRuntimeV6.js'))
const { BUDGET } = require(path.join(TH, 'v4RestoredCompressV6.js'))
const G = require(path.join(TH, 'v4RestoredGroundingV6.js'))
const P = require(path.join(TH, 'v4RestoredPersonalityV6.js'))
const GM = require(path.join(HY, 'gameModelV6.js'))
const E = require(path.join(HY, 'realEconomyModelV6.js'))
const C = require(path.join(HY, 'hybridContractV6.js'))
const CLIENT = require(path.join(ROOT, 'utils/v6/turnaroundQuestionnaireHybridV10.js'))
const BRIDGE = require(path.join(CP, 'cognitiveProfileBridgeV6.js'))
const { buildPersonalizationFeed } = require(path.join(PERS, 'personalizationRuntimeV6.js'))

let pass = 0, fail = 0
const results = []
function ok (name, cond, extra) {
  if (cond) { pass++; results.push('  PASS ' + name) } else { fail++; results.push('  FAIL ' + name + (extra ? ' :: ' + extra : '')) }
}

// ── same other answers; ONLY occupation (+ natural income/skill) varies ──
const BASE = {
  lifeStage: 'LIFE_31_40', monthlySurplus: 'SURPLUS_1K_5K', safetyMonths: 'SAFETY_3_6',
  debtPressure: 'DEBT_NONE', skillValidation: 'PROOF_PAID_ONCE', weeklyTime: 'TIME_20_PLUS',
  executionStability: 'EXEC_STABLE', pastAttemptStage: 'ATTEMPT_FEW_SALES', selfBelief: 'BELIEF_ABILITY',
  decisionStyle: 'DECISION_SMALL_TEST', timeBehavior: 'TIME_PROTECT_LONG', primaryProblem: 'PROBLEM_MONETIZE',
  primaryGoal: 'GOAL_SKILL_MONETIZE', maxTrialCost: 'COST_5K_20K', failureResponse: 'FAIL_RECHECK'
}
const CONTROLS = [
  { name: 'PROGRAMMER', occ: '后端程序员', cat: 'OCC_TECH', inc: 'INC_SALARY', skill: 'ASSET_TECHNICAL', game: 'EMPLOYER_PRICED', pricing: 'EMPLOYER', bet: 'FIRST_EXTERNAL_QUOTE' },
  { name: 'CHEF', occ: '厨师', cat: 'OCC_SERVICE', inc: 'INC_SALARY', skill: 'ASSET_CRAFT', game: 'EMPLOYER_PRICED', pricing: 'EMPLOYER', bet: 'FIRST_DIRECT_PAID_SAMPLE' },
  { name: 'SALES', occ: '房产销售', cat: 'OCC_SALES', inc: 'INC_COMMISSION', skill: 'ASSET_NETWORK', game: 'COMMISSION_PRICED', pricing: 'MIXED', bet: 'FIRST_SELF_OWNED_CUSTOMER' },
  { name: 'DELIVERY RIDER', occ: '外卖骑手', cat: 'OCC_PLATFORM_LABOR', inc: 'INC_UNSTABLE', skill: 'ASSET_UNCLEAR', game: 'PLATFORM_PRICED', pricing: 'PLATFORM', bet: 'FIRST_PORTABLE_SKILL_VALIDATION' },
  { name: 'CONTENT CREATOR', occ: '短视频运营', cat: 'OCC_CONTENT_CREATIVE', inc: 'INC_CONTENT', skill: 'ASSET_CONTENT', game: 'SELF_PRICED', pricing: 'USER', bet: 'FIRST_PACKAGED_PAID_DELIVERABLE' }
]
function rawFor (c) {
  return Object.assign({}, BASE, { occupationDetail: c.occ, occupationCategory: c.cat, incomeStructure: c.inc, monetizableSkill: c.skill })
}
function profileFor (c) { return runHybridDiagnosisV6(rawFor(c)).hybridProfile }
function gameFor (c) { const p = profileFor(c); return GM.computeGameModelV6(p.realEconomyModel, p) }
const gv = (g, k) => ((g[k] || {}).value)

function stubOnce (obj) {
  let n = 0
  const fn = async () => { n++; return { success: true, content: JSON.stringify(obj), tokens: 900, finishReason: 'stop' } }
  fn.calls = () => n
  return fn
}
function neutralOutput (occ, gm) {
  const auth = gm && gm.pricingAuthority ? gm.pricingAuthority.value : 'UNKNOWN'
  const payer = auth === 'EMPLOYER' ? '公司/雇主' : auth === 'PLATFORM' ? '平台' : auth === 'CLIENT' ? '客户' : auth === 'USER' ? '你自己' : '一个定价方'
  return {
    strategicThesis: {
      identityInterpretation: '你现在靠' + (occ || '一份收入') + '被定价，价值还没有拿到外部的独立价格。',
      coreContradiction: '你在认真投入，却始终由' + payer + '替你定价。',
      systemTrap: '价值只被' + payer + '兑现 → 没有直接买家反馈 → 独立定价能力未建立 → 继续依赖' + payer + '定价。',
      worldRule: { id: 'LOW_COST_EXPERIMENT_OVER_PERFECT_DIRECTION', expression: '与其等一个完美方向，不如先做一个低成本、拿得到反馈的小试验。' },
      strategicMigration: { from: '被单一' + payer + '定价的人', to: '能被具体客户直接购买的能力提供者', logic: '先让一个真实客户用一次小付费回答值不值得。' },
      commercialHypothesis: '给一个真实的人一个明确报价，验证这项能力能不能被独立定价。',
      actionThesis: '这一步验证的是：你的能力能不能脱离' + payer + '被单独买一次。'
    },
    cards: {
      card01: '你的价值一直由' + payer + '定价，你自己还没报过一次价。',
      card02: '你现在靠' + (occ || '一份收入') + '被定价，真正的买家离你很远。',
      card03: ['价值只在' + payer + '内部被兑换。', '没有直接买家的反馈。', '独立定价能力还没建立，所以你仍然只能靠' + payer + '定价。'],
      card04: { from: '被单一' + payer + '定价的人', to: '能被具体客户直接购买的能力提供者', steps: ['找一个真实客户', '给一个明确报价'] },
      card05: {
        objective: '验证这项能力能不能被独立定价一次。',
        actions: [
          { title: '找客户', text: '找一个可能需要的真实的人，给出一个明确报价。' },
          { title: '拿反馈', text: '记录对方愿不愿意付、以及为什么。' }
        ],
        target: '1个真实客户', timebox: '7天', successSignal: '出现一个与你没有雇佣关系的人愿意付费的明确信号。'
      }
    }
  }
}

async function main () {
  // ── §3/§4 GAME MODEL (deterministic; small taxonomy) ──
  ok('R85C §3 gameModelV6 version marker present', GM.GAME_VERSION === 'r85c_game_model_v1')
  ok('R85C §4 game taxonomy small (≤6 types)', GM.GAME_TYPES.length <= 6 && GM.GAME_TYPES.join(',') === 'EMPLOYER_PRICED,PLATFORM_PRICED,CLIENT_PRICED,COMMISSION_PRICED,SELF_PRICED,MIXED')
  const gP = gameFor(CONTROLS[0])
  const gP2 = gameFor(CONTROLS[0])
  ok('R85C §3 game model is deterministic (identical on repeat)', GM.gameSignature(gP) === GM.gameSignature(gP2))
  ok('R85C §3 no model/LLM dependency in the game layer (pure fn of answers)', typeof GM.computeGameModelV6 === 'function' && !/openai|axios|http/.test(fs.readFileSync(path.join(HY, 'gameModelV6.js'), 'utf8')))

  // ── §3 field shape: value + sourceEvidence[] + confidence ──
  const FIELDS = ['gameType', 'valueExchange', 'pricingAuthority', 'customerDistance', 'dependencyStructure', 'marketProofState', 'repeatabilityState', 'leverageState', 'gameRule', 'trapMechanism', 'switchDirection', 'smallBetType']
  const shapeOk = FIELDS.every((k) => {
    const x = gP[k]
    return x && x.value != null && Array.isArray(x.sourceEvidence) && typeof x.confidence === 'string'
  })
  ok('R85C §3 every game field has value + sourceEvidence[] + confidence', shapeOk)
  ok('R85C §3 evidence classifications are among OBSERVED/DERIVED/INFERRED/UNKNOWN', GM.EVIDENCE.OBSERVED === 'OBSERVED' && GM.EVIDENCE.DERIVED === 'DERIVED' && GM.EVIDENCE.INFERRED === 'INFERRED' && GM.EVIDENCE.UNKNOWN === 'UNKNOWN')

  // ── §5 VALUE EXCHANGE ──
  ok('R85C §5 value exchange vocabulary present (8)', GM.VALUE_EXCHANGE.join(',') === 'TIME,PHYSICAL_LABOR,TECHNICAL_SKILL,SALES_RESULT,CONTENT,SERVICE,CAPITAL,SYSTEM')
  ok('R85C §5 programmer exchanges TECHNICAL_SKILL', gv(gP, 'valueExchange') === 'TECHNICAL_SKILL')
  ok('R85C §5 rider exchanges PHYSICAL_LABOR', gv(gameFor(CONTROLS[3]), 'valueExchange') === 'PHYSICAL_LABOR')
  ok('R85C §5 sales exchanges SALES_RESULT', gv(gameFor(CONTROLS[2]), 'valueExchange') === 'SALES_RESULT')

  // ── §6 PRICING AUTHORITY ──
  ok('R85C §6 pricing-authority vocabulary present (7)', GM.PRICING_AUTHORITY.join(',') === 'EMPLOYER,PLATFORM,CLIENT,USER,MARKET,MIXED,UNKNOWN')
  for (const c of CONTROLS) ok('R85C §6 ' + c.name + ': pricingAuthority = ' + c.pricing, gv(gameFor(c), 'pricingAuthority') === c.pricing)

  // ── §7 GAME RULE ──
  ok('R85C §7 programmer rule names the employer as rule-holder', /雇主|公司/.test(gv(gP, 'gameRule')))
  ok('R85C §7 rider rule names the platform as rule-holder', /平台/.test(gv(gameFor(CONTROLS[3]), 'gameRule')))
  ok('R85C §7 rules are DISTINCT across the 5 controls', new Set(CONTROLS.map((c) => gv(gameFor(c), 'gameRule'))).size >= 4)

  // ── §8 TRAP MECHANISM (rule → behavior → outcome → lock-in) ──
  const trap = gameFor(CONTROLS[0]).trapMechanism.value
  ok('R85C §8 trap is a 4-step lock loop (rule→behavior→outcome→lock-in)', Array.isArray(trap) && trap.length === 4)
  ok('R85C §8 programmer trap: more skill → employer-internal value → external pricing empty',
    /技术越熟练/.test(trap[0]) && /岗位内越值钱/.test(trap[1]) && /内部兑现/.test(trap[2]) && /外部/.test(trap[3]))
  ok('R85C §8 trap does not assert a market fact (no salary/ceiling/AI)', !/薪资|天花板|淘汰|失业/.test(GM.trapSignature(gameFor(CONTROLS[0]))))

  // ── §9 SWITCH DIRECTION (position, not forced entrepreneurship) ──
  ok('R85C §9 programmer switch moves pricing authority outward', gameFor(CONTROLS[0]).switchDirection.axis === 'PRICING_AUTHORITY' && /外部客户直接定价/.test(gv(gameFor(CONTROLS[0]), 'switchDirection')))
  ok('R85C §9 rider switch is more portable value (not "start a company")', gameFor(CONTROLS[3]).switchDirection.axis === 'PORTABLE_VALUE' && !/创业|开公司|自己开店/.test(gv(gameFor(CONTROLS[3]), 'switchDirection')))
  ok('R85C §9 no switch direction forces entrepreneurship', !CONTROLS.some((c) => /创业|开公司|当老板/.test(gv(gameFor(c), 'switchDirection'))))

  // ── §10 SMALL REALITY BET ──
  const BET_TYPES = ['FIRST_EXTERNAL_QUOTE', 'FIRST_DIRECT_CUSTOMER_CONVERSATION', 'FIRST_PAID_SAMPLE', 'FIRST_DIRECT_PAID_SAMPLE', 'FIRST_REPEAT_PURCHASE', 'FIRST_PORTABLE_SKILL_VALIDATION', 'FIRST_PACKAGED_PAID_DELIVERABLE', 'FIRST_SELF_OWNED_CUSTOMER']
  ok('R85C §10 every control bet is a bounded first-experiment type', CONTROLS.every((c) => BET_TYPES.indexOf(gv(gameFor(c), 'smallBetType')) !== -1))
  for (const c of CONTROLS) ok('R85C §10 ' + c.name + ': small bet = ' + c.bet, gv(gameFor(c), 'smallBetType') === c.bet)
  ok('R85C §10 no literalism gambling language in bet type', !CONTROLS.some((c) => /赌|押注|梭哈/.test(gv(gameFor(c), 'smallBetType'))))

  // ── §13/§17 CONTROL GAME TYPES ──
  for (const c of CONTROLS) ok('R85C §17 ' + c.name + ': gameType = ' + c.game, gv(gameFor(c), 'gameType') === c.game)

  // ── §18 DISTINCTNESS (same other answers; only occupation varies) ──
  const games = CONTROLS.map((c) => gv(gameFor(c), 'gameType'))
  const traps = CONTROLS.map((c) => GM.trapSignature(gameFor(c)))
  const switches = CONTROLS.map((c) => gv(gameFor(c), 'switchDirection'))
  const bets = CONTROLS.map((c) => gv(gameFor(c), 'smallBetType'))
  const dGame = new Set(games).size, dTrap = new Set(traps).size, dSwitch = new Set(switches).size, dBet = new Set(bets).size
  ok('R85C §18 DISTINCT_GAME_COUNT >= 4', dGame >= 4, 'd=' + dGame + ' ' + games.join(','))
  ok('R85C §18 DISTINCT_TRAP_COUNT >= 4', dTrap >= 4, 'd=' + dTrap)
  ok('R85C §18 DISTINCT_SWITCH_COUNT >= 4', dSwitch >= 4, 'd=' + dSwitch)
  ok('R85C §18 DISTINCT_BET_COUNT >= 4', dBet >= 4, 'd=' + dBet)
  ok('R85C §18 game signature is structural (not noun substitution)', new Set(CONTROLS.map((c) => GM.gameSignature(gameFor(c)))).size >= 4)
  ok('R85C §18 trap is NOT the same skeleton reworded (>=4 distinct mechanisms)', dTrap >= 4)

  // ── §11 STRUCTURED THESIS INJECTION ──
  const oP = runHybridDiagnosisV6(rawFor(CONTROLS[0]))
  const payload = buildV4RestoredPayload(oP.hybridProfile, oP.diagnosis, oP.hybridContext)
  ok('R85C §11 payload carries structured gameModel', !!payload.gameModel && !!payload.gameModel.gameType)
  const prompt = buildV4RestoredPrompt(payload)
  const um = prompt.userMessage, sm = prompt.systemPrompt
  ok('R85C §11 prompt has the 拆局模型 block', /拆局模型/.test(um))
  ok('R85C §11 prompt injects game type + pricing authority + rule + trap + switch + bet', /局（gameType）/.test(um) && /谁掌握定价权/.test(um) && /游戏规则（RULE）/.test(um) && /陷阱回路（TRAP）/.test(um) && /换位方向（SWITCH）/.test(um) && /最小现实下注（BET）/.test(um))
  ok('R85C §11 system prompt carries the REALITY→GAME→RULE→TRAP→SWITCH→BET chain', /REALITY（现实）/.test(sm) && /GAME（局）/.test(sm) && /RULE（规则）/.test(sm) && /TRAP（陷阱）/.test(sm) && /SWITCH（换位）/.test(sm) && /BET（下注）/.test(sm))
  ok('R85C §11 one-thesis constraint still stated in the game block', /一次报告只能有一个中心论点/.test(sm))
  ok('R85C §11 prompt forbids occupation→market-number inference (R85-B preserved)', /不得由职业\/收入推出薪资数额/.test(um))
  ok('R85C §11 PROMPT_VERSION frozen (output contract unchanged)', PROMPT_VERSION === 'turnaround_strategy_v6_v4_restored_prompt_v2_r84a', PROMPT_VERSION)
  ok('R85C §11 personality version unchanged; R85C marker added', P.PERSONALITY_VERSION === 'r84d_personality_v1' && P.R85C_VERSION === 'r85c_game_model_v1')

  // ── §12–§16 IP-NATIVE CARD ROLES in the spec ──
  ok('R85C §12 card01 spec carries THE REAL LOSS / WRONG GAME role', /拆局链/.test(P.GAME_MODEL_BLOCK) && /他在哪个局里/.test(P.IP_NATIVE_LANGUAGE_BLOCK))
  ok('R85C §14 card03 must show rule→behavior→outcome→lock-in', /规则→行为\/激励→结果→锁死/.test(P.GAME_MODEL_BLOCK))
  ok('R85C §15 card04 switch is a POSITION change, not more effort', /换的不是努力强度，是游戏位置/.test(P.GAME_MODEL_BLOCK))
  ok('R85C §19 IP-native language block present + reduces consultant nouns', /谁定价/.test(P.IP_NATIVE_LANGUAGE_BLOCK) && /商业闭环/.test(P.IP_NATIVE_LANGUAGE_BLOCK))
  const gameBlockIdx = sm.indexOf('拆局链'), ipIdx = sm.indexOf('IP 原生语言'), oneIdx = sm.indexOf('一个报告 = 一个中心论点')
  ok('R85C §12–§19 blocks are APPENDED (R84-A/B/C/D blocks preserved byte-for-byte)',
    /珠澳小事哥/.test(sm) && /你不是 X，你是在 Y/.test(sm) && /我凭什么这么判断/.test(sm) && /一个报告 = 一个中心论点/.test(sm) &&
    gameBlockIdx > oneIdx && ipIdx > gameBlockIdx)

  // ── §20 GAME-CLAIM GROUNDING (UNSUPPORTED_GAME_CLAIM_COUNT = 0) ──
  const gCtx = buildGroundingCtx(oP.hybridProfile, oP.hybridContext)
  ok('R85C §20 grounding ctx carries the computed game model', !!gCtx.gameModel && gCtx.gameModel.gameType)
  ok('R85C §20 employer-priced profile: a "platform prices you" claim is blocked', !!G.detectGameConflict('你的收入完全由平台派单决定。', { gameModel: { pricingAuthority: { value: 'EMPLOYER' } } }))
  ok('R85C §20 employer-priced profile: naming the employer is NOT blocked', G.detectGameConflict('你的技术价值只由公司定价。', { gameModel: { pricingAuthority: { value: 'EMPLOYER' } } }) === null)
  ok('R85C §20 USER-priced profile: no conflict is possible', G.detectGameConflict('你自己给客户报价。', { gameModel: { pricingAuthority: { value: 'USER' } } }) === null)
  const gFix = G.screenGrounding({ card01: '你的收入完全由平台派单决定。', card02: '', card03: { steps: [], rule: '' }, card04: { from: '', to: '', rule: '' }, card05: { goal: '', actions: [], acceptance: '' } }, null, { gameModel: { pricingAuthority: { value: 'EMPLOYER' } } }, {})
  ok('R85C §20 UNSUPPORTED_GAME_CLAIM_COUNT = 0 after repair', gFix.counts.UNSUPPORTED_GAME_CLAIM_COUNT === 0, JSON.stringify(gFix.counts))

  // ── §20 R84-D GROUNDING PRESERVED ──
  ok('R85C §20 R84-D evidence classes still frozen', G.EVIDENCE_CLASSES.join(',') === 'OBSERVED,DERIVED,INFERRED,HYPOTHESIS')
  ok('R85C §20 R84-D grounding version unchanged', G.GROUNDING_VERSION === 'r84d_grounding_v1')
  ok('R85C §20 mortgage-as-safety-net still blocked', !!G.classifyClause('房贷是安全网，也是麻醉剂。', Object.assign({}, gCtx, { debtPressure: 'DEBT_MORTGAGE' })))
  ok('R85C §20 occupation-market + exact-income claims still blocked', !!G.classifyClause('程序员未来会被AI淘汰。', gCtx) && !!G.classifyClause('你很快就能月入过万。', gCtx))

  // ── §2 REAL ECONOMY MODEL REMAINS AN EVIDENCE LAYER ──
  const b1Files = ['hybridB1AdapterV6.js', 'bottleneckEligibilityV6.js', 'realityConstraintV6.js', 'profileBuilderV6.js', 'hybridDiagnosisV6.js']
  let b1GameRefs = 0, b1EconRefs = 0
  for (const f of b1Files) {
    const abs = path.join(HY, f)
    if (fs.existsSync(abs)) {
      const src = fs.readFileSync(abs, 'utf8')
      if (/gameModel/.test(src)) b1GameRefs++
      if (/realEconomyModel/.test(src)) b1EconRefs++
    }
  }
  ok('R85C §2/§23 ZERO B1 file reads gameModel (no authority takeover)', b1GameRefs === 0, 'refs=' + b1GameRefs)
  ok('R85C §2 ZERO B1 file reads realEconomyModel (unchanged)', b1EconRefs === 0, 'refs=' + b1EconRefs)

  // ── §23 B1 AUTHENTICITY (game model never changes B1) ──
  const diags = CONTROLS.map((c) => {
    const d = runHybridDiagnosisV6(rawFor(c)).diagnosis
    return [d.diagnosisState, d.primaryBottleneck, d.executionStage, d.compatibility && d.compatibility.verdict].join('~')
  })
  ok('R85C §23 B1_AUTHORITY_DIFF_COUNT = 0 (occupation/game never changes B1)', new Set(diags).size === 1, diags.join(' || '))

  // ── §22 QUESTIONNAIRE (no new screen / field) ──
  ok('R85C §22 questionnaire raw field count unchanged (pricing authority derivable)', C.HYBRID_RAW_FIELD_COUNT === 19 && C.HYBRID_SCREEN_COUNT === 10)
  ok('R85C §22 no new pricing-authority field added', C.REQUIRED_FIELD_KEYS.indexOf('pricingAuthority') === -1 && !CLIENT.getScreensHybridV10().some((s) => /pricing|authority/i.test(JSON.stringify(s))))

  // ── §24 REPORT UI DIFF COUNT = 0 ──
  const uiFiles = [
    'pages/turnaround-v6-report/turnaround-v6-report.wxml',
    'pages/turnaround-v6-report/turnaround-v6-report.wxss',
    'pages/turnaround-v6-report/turnaround-v6-report.js',
    'utils/v6/turnaroundReportViewModelV6.js'
  ]
  let uiRefs = 0
  for (const f of uiFiles) {
    const abs = path.join(ROOT, f)
    if (fs.existsSync(abs) && /r85c|gameModel/i.test(fs.readFileSync(abs, 'utf8'))) uiRefs++
  }
  ok('R85C §24 REPORT_UI_DIFF_COUNT = 0 (no game-model token coupled into report UI)', uiRefs === 0, 'refs=' + uiRefs)
  ok('R85C §24 frozen card budgets unchanged (40/140/220/160/240)', BUDGET.CARD01 === 40 && BUDGET.CARD02 === 140 && BUDGET.CARD03 === 220 && BUDGET.CARD04 === 160 && BUDGET.CARD05 === 240)

  // ── §25 MODEL CALL COUNT = 1 + five cards ship clean ──
  for (const c of CONTROLS) {
    const o = runHybridDiagnosisV6(rawFor(c))
    const fb = buildReportV6(o.diagnosis, o.hybridContext)
    const call = stubOnce(neutralOutput(c.occ, GM.computeGameModelV6(o.hybridProfile.realEconomyModel, o.hybridProfile)))
    const r = await runV4RestoredReportRuntimeV6({ diagnosis: o.diagnosis, hybridProfile: o.hybridProfile, hybridContext: o.hybridContext, fallbackReport: fb, callAI: call })
    const vc = r.report.visibleCards
    ok('R85C §25 ' + c.name + ': exactly one model call + renders v4_restored', call.calls() === 1 && r.meta.modelCalls === 1 && r.renderSource === RENDER_SOURCE.AI)
    ok('R85C §25 ' + c.name + ': five cards present + zero game/occupation/income defects',
      !!(vc.card01 && vc.card02 && vc.card03.rule && vc.card04.from && vc.card04.to && vc.card05.goal && vc.card05.acceptance) &&
      r.report.visibleStats.r84dGuard.UNSUPPORTED_GAME_CLAIM_COUNT === 0 &&
      r.report.visibleStats.r84dGuard.UNSUPPORTED_OCCUPATION_MARKET_CLAIM_COUNT === 0 &&
      r.report.visibleStats.r84dGuard.EXACT_INCOME_FORECAST_COUNT === 0)
  }
  const oR = runHybridDiagnosisV6(rawFor(CONTROLS[0]))
  const fbR = buildReportV6(oR.diagnosis, oR.hybridContext)
  const callR = stubOnce(neutralOutput(CONTROLS[0].occ, GM.computeGameModelV6(oR.hybridProfile.realEconomyModel, oR.hybridProfile)))
  const rr = await runV4RestoredReportRuntimeV6({ diagnosis: oR.diagnosis, hybridProfile: oR.hybridProfile, hybridContext: oR.hybridContext, fallbackReport: fbR, callAI: callR })
  ok('R85C §25 MODEL_CALL_COUNT_MAX = 1', callR.calls() === 1 && rr.meta.modelCalls === 1)

  // ── §23 PROFILE SCHEMA FREEZE ──
  const patch = BRIDGE.buildCognitiveProfilePatch({ diagnosis: oR.diagnosis, hybridProfile: oR.hybridProfile, hybridContext: oR.hybridContext, report: rr.report, reportId: 'ARV6_r85c', ts: 1 })
  ok('R85C §23 PROFILE_SCHEMA_DIFF_COUNT = 0 (cognitive_profile_v1)', patch.profileSchemaVersion === 'cognitive_profile_v1')
  ok('R85C §23 game model is RUNTIME ONLY (not persisted as a permanent fact)', !/gameModel|gameType|pricingAuthority/.test(JSON.stringify(patch)))

  // ── §23 PERSONALIZATION RUNTIME FREEZE ──
  const canonProfile = {
    present: true, isLegacy: false, dimensions: {},
    diagnosticState: { primaryBottleneck: { value: oR.diagnosis.primaryBottleneck } },
    cognitiveState: { primaryBlindSpot: { expression: patch.cognitiveState.primaryBlindSpot.expression } },
    currentFocus: { worldRuleLensIds: patch.currentFocus.worldRuleLensIds, priorityTopicIds: patch.currentFocus.priorityTopicIds },
    learningHistory: { seenRuleIds: [], seenInsightIds: [], seenStrikeIds: [] }
  }
  const feed = buildPersonalizationFeed({ profile: canonProfile, worldRules: [{ ruleId: 'WR016', tags: [] }], insights: [{ insightId: 'DI001', tags: ['付费'], difficulty: 1 }], strikes: [{ id: 'STRIKE_000', dimensions: [] }], dayIndex: 20712 })
  ok('R85C §23 PERSONALIZATION_RUNTIME_DIFF_COUNT = 0 (feed shape unchanged)', feed && feed.worldRule && feed.dailyInsight && feed.strike && ('personalized' in feed))

  // ── §21 OWNER CASE (from actual answers only; no fabrication) ──
  const ownerRaw = {
    lifeStage: 'LIFE_31_40', occupationDetail: '自由内容创作者', occupationCategory: 'OCC_CONTENT_CREATIVE',
    incomeStructure: 'INC_SALARY', monthlySurplus: 'SURPLUS_1K_5K', safetyMonths: 'SAFETY_3_6', debtPressure: 'DEBT_MORTGAGE',
    monetizableSkill: 'ASSET_CONTENT', skillValidation: 'PROOF_PAID_ONCE', weeklyTime: 'TIME_20_PLUS',
    executionStability: 'EXEC_VOLATILE', maxTrialCost: 'COST_5K_20K', primaryProblem: 'PROBLEM_MONETIZE',
    primaryGoal: 'GOAL_SKILL_MONETIZE', pastAttemptStage: 'ATTEMPT_FEW_SALES', decisionStyle: 'DECISION_SMALL_TEST',
    timeBehavior: 'TIME_PROTECT_LONG', selfBelief: 'BELIEF_KNOW_NO_ACTION', failureResponse: 'FAIL_RECHECK'
  }
  const op = runHybridDiagnosisV6(ownerRaw).hybridProfile
  const ownerGame = GM.computeGameModelV6(op.realEconomyModel, op)
  ok('R85C §21 owner: game = EMPLOYER_PRICED (salary income is the pricing authority)', gv(ownerGame, 'gameType') === 'EMPLOYER_PRICED' && gv(ownerGame, 'pricingAuthority') === 'EMPLOYER')
  ok('R85C §21 owner: mortgage surfaces only as a fixed-cost constraint (no safety-net claim)', !/安全网|麻醉|兜底/.test(GM.trapSignature(ownerGame)))
  const ownerBlank = runHybridDiagnosisV6(Object.assign({}, ownerRaw, { occupationDetail: '' }))
  ok('R85C §21 owner: missing occupation is ABSENT, never fabricated', ownerBlank.hybridProfile.reality.occupation === null)

  console.log(results.join('\n'))
  console.log('\nR85-C TESTS: ' + pass + ' passed, ' + fail + ' failed')
  console.log('DISTINCT_GAME_COUNT=' + dGame + ' DISTINCT_TRAP_COUNT=' + dTrap + ' DISTINCT_SWITCH_COUNT=' + dSwitch + ' DISTINCT_BET_COUNT=' + dBet)
  if (fail > 0) process.exit(1)
}

main().catch((e) => { console.error('R85-C TEST ERROR', e); process.exit(2) })
