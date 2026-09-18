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
const GT = require(path.join(TH, 'gameThesisV6.js'))
const PP = require(path.join(TH, 'pricingPowerV6.js'))
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
  { name: 'PROGRAMMER', occ: '后端程序员', cat: 'OCC_TECH', inc: 'INC_SALARY', price: 'PRICE_EMPLOYER', skill: 'ASSET_TECHNICAL', game: 'EMPLOYER_PRICED', pricing: 'EMPLOYER', rule: 'EMPLOYER', bet: 'FIRST_EXTERNAL_QUOTE' },
  { name: 'CHEF', occ: '厨师', cat: 'OCC_SERVICE', inc: 'INC_SALARY', price: 'PRICE_EMPLOYER', skill: 'ASSET_CRAFT', game: 'EMPLOYER_PRICED', pricing: 'EMPLOYER', rule: 'EMPLOYER', bet: 'FIRST_DIRECT_PAID_SAMPLE' },
  { name: 'SALES', occ: '房产销售', cat: 'OCC_SALES', inc: 'INC_COMMISSION', price: 'PRICE_MIXED', skill: 'ASSET_NETWORK', game: 'COMMISSION_PRICED', pricing: 'MIXED', rule: 'MIXED', bet: 'FIRST_EXTERNAL_PRICING_SIGNAL' },
  { name: 'DELIVERY RIDER', occ: '外卖骑手', cat: 'OCC_PLATFORM_LABOR', inc: 'INC_UNSTABLE', price: 'PRICE_PLATFORM', skill: 'ASSET_UNCLEAR', game: 'PLATFORM_PRICED', pricing: 'PLATFORM', rule: 'PLATFORM', bet: 'FIRST_PORTABLE_SKILL_VALIDATION' },
  { name: 'CONTENT CREATOR', occ: '短视频运营', cat: 'OCC_CONTENT_CREATIVE', inc: 'INC_CONTENT', price: 'PRICE_SELF', skill: 'ASSET_CONTENT', game: 'SELF_PRICED', pricing: 'USER', rule: 'USER', bet: 'FIRST_PACKAGED_PAID_DELIVERABLE' }
]
function rawFor (c) {
  return Object.assign({}, BASE, { occupationDetail: c.occ, occupationCategory: c.cat, incomeStructure: c.inc, pricingAuthority: c.price, monetizableSkill: c.skill })
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
function betSentence (betType) {
  return ({
    FIRST_EXTERNAL_QUOTE: '拿到一个来自雇主体制之外的、外部买家给出的真实报价，并完成一次交付。',
    FIRST_EXTERNAL_PRICING_SIGNAL: '让一个外部买家为这份成交能力直接付费，独立于公司体系。',
    FIRST_DIRECT_PAID_SAMPLE: '让一个顾客绕过中间环节，直接为你的手艺付费。',
    FIRST_REPEAT_PURCHASE: '让同一个买家出现第二次真实付费。',
    FIRST_PORTABLE_SKILL_VALIDATION: '让这份能力离开平台后，仍被客户直接付费。',
    FIRST_PACKAGED_PAID_DELIVERABLE: '做出一个能被直接购买、不靠平台分发的交付。',
    FIRST_DIRECT_CUSTOMER_CONVERSATION: '直接和真实买家谈一次并拿到明确答复。'
  })[betType] || '拿到一次真实的、外部的市场反馈。'
}
function neutralOutput (occ, gm) {
  const auth = gm && gm.pricingAuthority ? gm.pricingAuthority.value : 'UNKNOWN'
  const betType = gm && gm.smallBetType ? gm.smallBetType.value : null
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
          { title: '找买家', text: '找一个真实的外部买家，给出一个明确报价。' },
          { title: '拿反馈', text: '记录对方愿不愿意付、以及为什么。' }
        ],
        target: '1个真实买家', timebox: '7天', successSignal: betSentence(betType)
      }
    }
  }
}

async function main () {
  // ── §3/§4 GAME MODEL (deterministic; small taxonomy) ──
  ok('R85C §3 gameModelV6 version marker present', GM.GAME_VERSION === 'r85c1_game_model_v1')
  ok('R85C §4 game taxonomy small (≤7 types incl UNKNOWN)', GM.GAME_TYPES.length === 7 && GM.GAME_TYPES.join(',') === 'EMPLOYER_PRICED,PLATFORM_PRICED,CLIENT_PRICED,COMMISSION_PRICED,SELF_PRICED,MIXED,UNKNOWN')
  const gP = gameFor(CONTROLS[0])
  const gP2 = gameFor(CONTROLS[0])
  ok('R85C §3 game model is deterministic (identical on repeat)', GM.gameSignature(gP) === GM.gameSignature(gP2))
  ok('R85C §3 no model/LLM dependency in the game layer (pure fn of answers)', typeof GM.computeGameModelV6 === 'function' && !/openai|axios|http/.test(fs.readFileSync(path.join(HY, 'gameModelV6.js'), 'utf8')))

  // ── §3 field shape: value + sourceEvidence[] + confidence ──
  const FIELDS = ['gameType', 'valueExchange', 'pricingAuthority', 'ruleOwner', 'customerDistance', 'dependencyStructure', 'marketProofState', 'repeatabilityState', 'leverageState', 'gameRule', 'trapMechanism', 'switchDirection', 'smallBetType']
  const shapeOk = FIELDS.every((k) => {
    const x = gP[k]
    return x && x.value != null && Array.isArray(x.sourceEvidence) && typeof x.confidence === 'string'
  })
  ok('R85C §3 every game field has value + sourceEvidence[] + confidence', shapeOk)
  ok('R85C §3 evidence classifications are among OBSERVED/DERIVED/INFERRED/UNKNOWN', GM.EVIDENCE.OBSERVED === 'OBSERVED' && GM.EVIDENCE.DERIVED === 'DERIVED' && GM.EVIDENCE.INFERRED === 'INFERRED' && GM.EVIDENCE.UNKNOWN === 'UNKNOWN')

  // ── §5 VALUE EXCHANGE ──
  ok('R85C §5 value exchange vocabulary present (10 incl MIXED/UNKNOWN)', GM.VALUE_EXCHANGE.join(',') === 'TIME,PHYSICAL_LABOR,TECHNICAL_SKILL,SALES_RESULT,CONTENT,SERVICE,CAPITAL,SYSTEM,MIXED,UNKNOWN')
  ok('R85C §5 programmer exchanges TECHNICAL_SKILL', gv(gP, 'valueExchange') === 'TECHNICAL_SKILL')
  ok('R85C §5 rider exchanges PHYSICAL_LABOR', gv(gameFor(CONTROLS[3]), 'valueExchange') === 'PHYSICAL_LABOR')
  ok('R85C §5 sales exchanges SALES_RESULT', gv(gameFor(CONTROLS[2]), 'valueExchange') === 'SALES_RESULT')

  // ── §6 PRICING AUTHORITY ──
  ok('R85C §6 pricing-authority vocabulary present (7)', GM.PRICING_AUTHORITY.join(',') === 'EMPLOYER,PLATFORM,CLIENT,USER,MARKET,MIXED,UNKNOWN')
  for (const c of CONTROLS) ok('R85C §6 ' + c.name + ': pricingAuthority = ' + c.pricing, gv(gameFor(c), 'pricingAuthority') === c.pricing)

  // ── §9 RULE OWNER (who controls the critical rule / pricing position) ──
  ok('R85C §9 rule-owner vocabulary present (6)', GM.RULE_OWNER.join(',') === 'EMPLOYER,PLATFORM,CLIENT,USER,MIXED,UNKNOWN')
  for (const c of CONTROLS) ok('R85C §9 ' + c.name + ': ruleOwner = ' + c.rule, gv(gameFor(c), 'ruleOwner') === c.rule)
  // R85C1 §9/§11 — a MIXED direct answer is NOT resolved to the employer: the
  // rule owner is never inferred to be stronger than the evidence. The employer
  // only retains the SETTLEMENT channel (dependency), not the pricing authority.
  ok('R85C1 §9/§11 commission (PRICE_MIXED) → ruleOwner stays MIXED (never over-inferred to EMPLOYER)',
    gv(gameFor(CONTROLS[2]), 'pricingAuthority') === 'MIXED' && gv(gameFor(CONTROLS[2]), 'ruleOwner') === 'MIXED')

  // ── §7 GAME RULE ──
  ok('R85C §7 programmer rule names the employer as rule-holder', /雇主|公司/.test(gv(gP, 'gameRule')))
  ok('R85C §7 rider rule names the platform as rule-holder', /平台/.test(gv(gameFor(CONTROLS[3]), 'gameRule')))
  ok('R85C §7 rules are DISTINCT across the 5 controls', new Set(CONTROLS.map((c) => gv(gameFor(c), 'gameRule'))).size >= 4)

  // ── §8 TRAP MECHANISM (rule → behavior → outcome → lock-in) ──
  const trap = gameFor(CONTROLS[0]).trapMechanism.value
  ok('R85C §8 trap is a 4-step lock loop (rule→behavior→outcome→lock-in)', Array.isArray(trap) && trap.length === 4)
  ok('R85C §8 programmer trap: more skill → employer-internal value → employer-dependent settlement → external pricing still empty',
    /技术越熟练/.test(trap[0]) && /岗位内越值钱/.test(trap[1]) && /雇主/.test(trap[2]) && /外部/.test(trap[3]))
  ok('R85C §8 trap does not assert a market fact (no salary/ceiling/AI)', !/薪资|天花板|淘汰|失业/.test(GM.trapSignature(gameFor(CONTROLS[0]))))

  // ── §9 SWITCH DIRECTION (position, not forced entrepreneurship) ──
  ok('R85C §9 programmer switch moves pricing authority outward', gameFor(CONTROLS[0]).switchDirection.axis === 'PRICING_AUTHORITY' && /外部客户直接定价/.test(gv(gameFor(CONTROLS[0]), 'switchDirection')))
  ok('R85C §9 rider switch is more portable value (not "start a company")', gameFor(CONTROLS[3]).switchDirection.axis === 'PORTABLE_VALUE' && !/创业|开公司|自己开店/.test(gv(gameFor(CONTROLS[3]), 'switchDirection')))
  ok('R85C §9 no switch direction forces entrepreneurship', !CONTROLS.some((c) => /创业|开公司|当老板/.test(gv(gameFor(c), 'switchDirection'))))

  // ── §10 SMALL REALITY BET ──
  const BET_TYPES = ['FIRST_EXTERNAL_QUOTE', 'FIRST_DIRECT_CUSTOMER_CONVERSATION', 'FIRST_PAID_SAMPLE', 'FIRST_DIRECT_PAID_SAMPLE', 'FIRST_REPEAT_PURCHASE', 'FIRST_PORTABLE_SKILL_VALIDATION', 'FIRST_PACKAGED_PAID_DELIVERABLE', 'FIRST_EXTERNAL_PRICING_SIGNAL']
  ok('R85C §10 every control bet is a bounded first-experiment type', CONTROLS.every((c) => BET_TYPES.indexOf(gv(gameFor(c), 'smallBetType')) !== -1))
  for (const c of CONTROLS) ok('R85C §10 ' + c.name + ': small bet = ' + c.bet, gv(gameFor(c), 'smallBetType') === c.bet)
  ok('R85C §10 no literalism gambling language in bet type', !CONTROLS.some((c) => /赌|押注|梭哈/.test(gv(gameFor(c), 'smallBetType'))))

  // ── §13/§17 CONTROL GAME TYPES ──
  for (const c of CONTROLS) ok('R85C §17 ' + c.name + ': gameType = ' + c.game, gv(gameFor(c), 'gameType') === c.game)

  // ── §18 DISTINCTNESS (same other answers; only occupation varies) ──
  const games = CONTROLS.map((c) => gv(gameFor(c), 'gameType'))
  const rules = CONTROLS.map((c) => gv(gameFor(c), 'gameRule'))
  const traps = CONTROLS.map((c) => GM.trapSignature(gameFor(c)))
  const switches = CONTROLS.map((c) => gv(gameFor(c), 'switchDirection'))
  const bets = CONTROLS.map((c) => gv(gameFor(c), 'smallBetType'))
  const dGame = new Set(games).size, dRule = new Set(rules).size, dTrap = new Set(traps).size, dSwitch = new Set(switches).size, dBet = new Set(bets).size
  ok('R85C §27 DISTINCT_GAME_COUNT >= 4', dGame >= 4, 'd=' + dGame + ' ' + games.join(','))
  ok('R85C §27 DISTINCT_RULE_COUNT >= 4', dRule >= 4, 'd=' + dRule)
  ok('R85C §27 DISTINCT_TRAP_COUNT >= 4', dTrap >= 4, 'd=' + dTrap)
  ok('R85C §27 DISTINCT_SWITCH_COUNT >= 4', dSwitch >= 4, 'd=' + dSwitch)
  ok('R85C §27 DISTINCT_BET_COUNT >= 4', dBet >= 4, 'd=' + dBet)
  ok('R85C §27 game signature is structural (not noun substitution)', new Set(CONTROLS.map((c) => GM.gameSignature(gameFor(c)))).size >= 4)
  ok('R85C §27 trap is NOT the same skeleton reworded (>=4 distinct mechanisms)', dTrap >= 4)

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
  ok('R85C §11 personality version unchanged; R85C marker added', P.PERSONALITY_VERSION === 'r84d_personality_v1' && P.R85C_VERSION === 'r85c1_game_model_v1')

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

  // ── §4/§22 QUESTIONNAIRE (pricing authority is the ONE new controlled field) ──
  ok('R85C §4/§22 questionnaire adds ONE pricing-authority field (visible screens stay 10)', C.HYBRID_RAW_FIELD_COUNT === 21 && C.HYBRID_SCREEN_COUNT === 10 && C.ALL_FIELD_KEYS.indexOf('pricingAuthority') !== -1)
  ok('R86C world-model fields added; legacy executionStability/primaryGoal removed (R86-C)', ['laborModel', 'systemModel', 'ruleModel'].every((k) => C.ALL_FIELD_KEYS.indexOf(k) !== -1) && C.ALL_FIELD_KEYS.indexOf('executionStability') === -1 && C.ALL_FIELD_KEYS.indexOf('primaryGoal') === -1)
  ok('R85C §4 pricingAuthority is REQUIRED and lives on the existing S2 screen', C.REQUIRED_FIELD_KEYS.indexOf('pricingAuthority') !== -1 && C.SCREENS.find((s) => s.key === 'incomeStructure').secondary2.key === 'pricingAuthority')
  ok('R85C §4 pricing-authority ids present (6)', C.PRICING_AUTHORITY_IDS.length === 6 && CLIENT.getScreensHybridV10().find((s) => s.key === 'incomeStructure').secondary2.options.map((o) => o.optionId).join(',') === C.PRICING_AUTHORITY_IDS.join(','))
  ok('R85C §4 no 11th screen was added', CLIENT.getScreensHybridV10().length === 10 && C.SCREENS.length === 10)

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

  // ── §28 OWNER CASE (from actual answers only; no fabrication) ──
  const ownerRaw = {
    lifeStage: 'LIFE_31_40', occupationDetail: '自由内容创作者', occupationCategory: 'OCC_CONTENT_CREATIVE',
    incomeStructure: 'INC_SALARY', pricingAuthority: 'PRICE_EMPLOYER', monthlySurplus: 'SURPLUS_1K_5K', safetyMonths: 'SAFETY_3_6', debtPressure: 'DEBT_MORTGAGE',
    monetizableSkill: 'ASSET_CONTENT', skillValidation: 'PROOF_PAID_ONCE', weeklyTime: 'TIME_20_PLUS',
    executionStability: 'EXEC_VOLATILE', maxTrialCost: 'COST_5K_20K', primaryProblem: 'PROBLEM_MONETIZE',
    primaryGoal: 'GOAL_SKILL_MONETIZE', pastAttemptStage: 'ATTEMPT_FEW_SALES', decisionStyle: 'DECISION_SMALL_TEST',
    timeBehavior: 'TIME_PROTECT_LONG', selfBelief: 'BELIEF_KNOW_NO_ACTION', failureResponse: 'FAIL_RECHECK'
  }
  const op = runHybridDiagnosisV6(ownerRaw).hybridProfile
  const ownerGame = GM.computeGameModelV6(op.realEconomyModel, op)
  ok('R85C §28 owner: game = EMPLOYER_PRICED (stated salary pricing authority)', gv(ownerGame, 'gameType') === 'EMPLOYER_PRICED' && gv(ownerGame, 'pricingAuthority') === 'EMPLOYER')
  ok('R85C §28 owner: mortgage surfaces only as a fixed-cost constraint (no safety-net claim)', !/安全网|麻醉|兜底/.test(GM.trapSignature(ownerGame)))
  ok('R85C §28 owner: missing pricing authority falls back to income (never fabricated)', gv(GM.computeGameModelV6(op.realEconomyModel, runHybridDiagnosisV6(Object.assign({}, ownerRaw, { pricingAuthority: '' })).hybridProfile), 'pricingAuthority') === 'EMPLOYER')
  const ownerBlank = runHybridDiagnosisV6(Object.assign({}, ownerRaw, { occupationDetail: '' }))
  ok('R85C §28 owner: missing occupation is ABSENT, never fabricated', ownerBlank.hybridProfile.reality.occupation === null)

  // ── §36 SEVEN-QUESTION REPORT GATE (structural answerability of the game layer) ──
  const GATE_FIELDS = ['gameType', 'ruleOwner', 'valueExchange', 'pricingAuthority', 'trapMechanism', 'switchDirection', 'smallBetType']
  let gateOk = true
  for (const c of CONTROLS) {
    const g = gameFor(c)
    for (const f of GATE_FIELDS) {
      const x = g[f]
      if (!x || x.value == null || x.value === '' || (Array.isArray(x.value) && x.value.length === 0)) gateOk = false
    }
  }
  ok('R85C §36 SEVEN_QUESTION_GATE_PASS: every control answers 局/规则/换钱/定价权/锁死/换位置/实验', gateOk)
  ok('R85C §36 the gate covers 7 distinct questions', GATE_FIELDS.length === 7)

  // ═══════════════════════════════════════════════════════════════════════
  // R85C1 — GAME MODEL AUTHORITY RECOVERY (no unsupported authority jumps)
  // ═══════════════════════════════════════════════════════════════════════
  const mkGame = (over, price) => {
    const p = runHybridDiagnosisV6(Object.assign({}, BASE, over, price == null ? {} : { pricingAuthority: price })).hybridProfile
    return GM.computeGameModelV6(p.realEconomyModel, p)
  }
  const CONTENT = { occupationDetail: '短视频运营', occupationCategory: 'OCC_CONTENT_CREATIVE', incomeStructure: 'INC_CONTENT', monetizableSkill: 'ASSET_CONTENT' }

  // ── §4 DIRECT ANSWER OUTRANKS INFERENCE ──
  ok('R85C1 §4 direct PRICE_PLATFORM overrides content-income default → PLATFORM_PRICED',
    gv(mkGame(CONTENT, 'PRICE_PLATFORM'), 'gameType') === 'PLATFORM_PRICED' && gv(mkGame(CONTENT, 'PRICE_PLATFORM'), 'pricingAuthority') === 'PLATFORM')
  ok('R85C1 §4/§11 a DIRECT pricing answer is classified OBSERVED',
    mkGame(CONTENT, 'PRICE_PLATFORM').pricingAuthority.sourceEvidence.some((e) => e.class === 'OBSERVED'))

  // ── §5 UNKNOWN IS VALID; never fabricated ──
  ok('R85C1 §5 PRICE_UNKNOWN → gameType UNKNOWN (not fabricated to SELF/PLATFORM)',
    gv(mkGame(CONTENT, 'PRICE_UNKNOWN'), 'gameType') === 'UNKNOWN' && gv(mkGame(CONTENT, 'PRICE_UNKNOWN'), 'ruleOwner') === 'UNKNOWN')
  ok('R85C1 §5 CONTENT income without a direct answer → UNKNOWN (content cannot decide pricing)',
    gv(mkGame(CONTENT), 'gameType') === 'UNKNOWN')

  // ── §6 OCCUPATION NEVER DEFINES PRICING AUTHORITY ──
  ok('R85C1 §6 pricing authority is a function of the ANSWER, not the occupation',
    gv(mkGame({ occupationDetail: '程序员', occupationCategory: 'OCC_TECH', incomeStructure: 'INC_SALARY', monetizableSkill: 'ASSET_UNCLEAR' }, 'PRICE_EMPLOYER'), 'pricingAuthority') ===
    gv(mkGame({ occupationDetail: '外卖骑手', occupationCategory: 'OCC_PLATFORM_LABOR', incomeStructure: 'INC_SALARY', monetizableSkill: 'ASSET_UNCLEAR' }, 'PRICE_EMPLOYER'), 'pricingAuthority'))

  // ── §7 CONTENT_CREATOR must NOT be forced to SELF_PRICED ──
  ok('R85C1 §7 content creator + PRICE_PLATFORM → PLATFORM_PRICED (not SELF_PRICED)', gv(mkGame(CONTENT, 'PRICE_PLATFORM'), 'gameType') === 'PLATFORM_PRICED')
  ok('R85C1 §7 content creator + PRICE_CLIENT → CLIENT_PRICED', gv(mkGame(CONTENT, 'PRICE_CLIENT'), 'gameType') === 'CLIENT_PRICED')
  ok('R85C1 §7 content creator + PRICE_SELF → SELF_PRICED', gv(mkGame(CONTENT, 'PRICE_SELF'), 'gameType') === 'SELF_PRICED')

  // ── §8 CHEF "顾客认店不认你" unsupported recognition claim is blocked ──
  ok('R85C1 §8 unsupported recognition claim is blocked', !!G.detectCustomerRecognitionClaim('顾客只认餐厅不认你。'))
  ok('R85C1 §8 supported recognition wording is allowed', G.detectCustomerRecognitionClaim('顾客认可你的手艺。') === null)

  // ── §9 SALES "客户归属在公司" unsupported ownership claim is blocked ──
  ok('R85C1 §9 unsupported customer-ownership claim is blocked', !!G.detectCustomerOwnershipClaim('客户归属在公司，你只是个执行者。'))
  ok('R85C1 §9 directional customer-ownership wording is allowed', G.detectCustomerOwnershipClaim('你可以试着把客户变成自己掌握的。') === null)

  // ── §15 SAME OCCUPATION, DIFFERENT GAME (CONTENT_CREATOR_DISTINCT_GAME_COUNT >= 3) ──
  const contentGames = ['PRICE_PLATFORM', 'PRICE_CLIENT', 'PRICE_SELF', 'PRICE_UNKNOWN'].map((pr) => gv(mkGame(CONTENT, pr), 'gameType'))
  const dContent = new Set(contentGames).size
  ok('R85C1 §15 CONTENT_CREATOR_DISTINCT_GAME_COUNT >= 3', dContent >= 3, 'd=' + dContent + ' ' + contentGames.join(','))

  // ── §16 DIRECT-SIGNAL OVERRIDE (only the answer varies) ──
  const SALESBASE = { occupationDetail: '房产销售', occupationCategory: 'OCC_SALES', incomeStructure: 'INC_COMMISSION', monetizableSkill: 'ASSET_NETWORK' }
  ok('R85C1 §16 PRICE_CLIENT overrides the commission default → CLIENT_PRICED', gv(mkGame(SALESBASE, 'PRICE_CLIENT'), 'gameType') === 'CLIENT_PRICED')
  ok('R85C1 §16 PRICE_SELF overrides the commission default → SELF_PRICED', gv(mkGame(SALESBASE, 'PRICE_SELF'), 'gameType') === 'SELF_PRICED')

  // ── §17 AUTHORITY GATE — no claim stronger than its strongest evidence ──
  let authViol = 0
  for (const c of CONTROLS) authViol += GM.authorityGateViolations(gameFor(c)).length
  ok('R85C1 §17 AUTHORITY_GATE_VIOLATION_COUNT = 0 across all controls', authViol === 0, 'v=' + authViol)
  ok('R85C1 §17 authority gate is deterministic (INFERRED caps at MEDIUM)', GM.allowedConfidence([{ class: 'INFERRED' }]) === 'MEDIUM' && GM.allowedConfidence([{ class: 'OBSERVED' }]) === 'HIGH')

  // ── §14 FIVE-CONTROL MATRIX (value + sourceEvidence[] + confidence on every field) ──
  const MX = ['gameType', 'ruleOwner', 'valueExchange', 'pricingAuthority', 'trapMechanism', 'switchDirection', 'smallBetType']
  ok('R85C1 §14 five-control matrix: every field carries value + sourceEvidence[] + confidence',
    CONTROLS.every((c) => { const g = gameFor(c); return MX.every((f) => g[f] && g[f].value != null && Array.isArray(g[f].sourceEvidence) && !!g[f].confidence) }))

  // ── §18 R84-D NORTH STAR GROUNDING PRESERVED ──
  ok('R85C1 §18 R84-D grounding version + evidence classes still frozen', G.GROUNDING_VERSION === 'r84d_grounding_v1' && G.EVIDENCE_CLASSES.join(',') === 'OBSERVED,DERIVED,INFERRED,HYPOTHESIS')
  ok('R85C1 §18 occupation → market-outlook claim still blocked', !!G.classifyClause('程序员未来会被AI淘汰。', gCtx))

  // ═══════════════════════════════════════════════════════════════════════
  // R85C2 — GAME AUTHORITY FINAL TIGHTEN (scope + ownership separation)
  // ═══════════════════════════════════════════════════════════════════════

  // ── §3 CHEF RECOGNITION — CUSTOMER_RECOGNITION_INFERENCE_COUNT = 0 ──
  ok('R85C2 §3 chef trap does NOT claim the customer does not recognise the person',
    !/不认|不认你|只认(店|餐|门|平台)/.test(GM.trapSignature(gameFor(CONTROLS[1]))))
  ok('R85C2 §3 chef trap scopes to the CURRENT transaction/settlement channel',
    /当前|经过|店家\/雇主体系/.test(GM.trapSignature(gameFor(CONTROLS[1]))))

  // ── §4 SALES CUSTOMER OWNERSHIP — UNSUPPORTED_CLIENT_OWNERSHIP_COUNT = 0 ──
  ok('R85C2 §4 no control switch uses CLIENT_OWNERSHIP', CONTROLS.every((c) => gameFor(c).switchDirection.axis !== 'CLIENT_OWNERSHIP'))
  ok('R85C2 §4 no control switch claims owning/掌握客户', !CONTROLS.some((c) => /掌握客户|拥有客户|自己的客户|客户属于/.test(gv(gameFor(c), 'switchDirection'))))
  ok('R85C2 §4 sales switch is INDEPENDENT_PRICING (pricing only, not ownership)', gameFor(CONTROLS[2]).switchDirection.axis === 'INDEPENDENT_PRICING')
  ok('R85C2 §4 no bet asserts owning a customer', !CONTROLS.some((c) => /OWNED_CUSTOMER|属于自己的客户/.test(gv(gameFor(c), 'smallBetType'))))
  ok('R85C2 §4 SWITCH_AXES excludes CLIENT_OWNERSHIP', GM.SWITCH_AXES.indexOf('CLIENT_OWNERSHIP') === -1)

  // ── §5 PLATFORM PERSON-LEVEL ASSET — PERSON_LEVEL_NO_ASSET_CLAIM_COUNT = 0 ──
  ok('R85C2 §5 rider trap no longer claims "no carry-away asset"', !/带不走的资产|能带走的资产|可带走的资产/.test(GM.trapSignature(gameFor(CONTROLS[3]))))
  ok('R85C2 §5 rider trap scopes to the income MECHANISM', /机制/.test(GM.trapSignature(gameFor(CONTROLS[3]))))

  // ── §6 SCOPE DISCIPLINE — SCOPE_OVERREACH_COUNT = 0 ──
  let scopeOver = 0
  for (const c of CONTROLS) scopeOver += GM.countScopeOverreach(gameFor(c))
  ok('R85C2 §6 SCOPE_OVERREACH_COUNT = 0 across all controls', scopeOver === 0, 'v=' + scopeOver)
  ok('R85C2 §6 scope detector flags a person-level absence claim', GM.checkClaimScope('你没有自己的客户').overreach === true)
  ok('R85C2 §6 scope detector passes a mechanism-scoped claim', GM.checkClaimScope('这份平台收入机制本身不会自动形成可脱离平台兑现的收入来源').overreach === false)

  // ── §7 PRICING AUTHORITY ≠ CUSTOMER OWNERSHIP ──
  ok('R85C2 §7 customerOwnership is ALWAYS UNKNOWN (no direct signal, never modelled)',
    CONTROLS.every((c) => gv(gameFor(c), 'customerOwnership') === 'UNKNOWN'))
  ok('R85C2 §7 customerOwnership is marked not-modelled', CONTROLS.every((c) => gameFor(c).customerOwnership.modelled === false))
  const authNoOwn = runHybridDiagnosisV6(Object.assign({}, BASE, { occupationDetail: '房产销售', occupationCategory: 'OCC_SALES', incomeStructure: 'INC_COMMISSION', pricingAuthority: 'PRICE_CLIENT', monetizableSkill: 'ASSET_NETWORK' })).hybridProfile
  ok('R85C2 §7 a DIRECT PRICE_CLIENT answer still leaves customerOwnership UNKNOWN',
    GM.computeGameModelV6(authNoOwn.realEconomyModel, authNoOwn).customerOwnership.value === 'UNKNOWN')

  // ── §9 FIVE-CONTROL READBACK: zero unsupported claims ──
  let unsupportedGame = 0, unsupportedOwn = 0, recognition = 0, personAsset = 0
  for (const c of CONTROLS) {
    const g = gameFor(c)
    if (g.switchDirection.axis === 'CLIENT_OWNERSHIP' || /客户属于|掌握客户/.test(g.switchDirection.value)) unsupportedOwn++
    if (/不认|只认(店|餐厅)/.test(GM.trapSignature(g))) recognition++
    if (/带不走的资产|没有资产|没有任何技能/.test(GM.trapSignature(g))) personAsset++
    if (GM.authorityGateViolations(g).length) unsupportedGame++
  }
  ok('R85C2 §9 UNSUPPORTED_CLIENT_OWNERSHIP_COUNT = 0', unsupportedOwn === 0)
  ok('R85C2 §9 CUSTOMER_RECOGNITION_INFERENCE_COUNT = 0', recognition === 0)
  ok('R85C2 §9 PERSON_LEVEL_NO_ASSET_CLAIM_COUNT = 0', personAsset === 0)
  ok('R85C2 §9 UNSUPPORTED_GAME_CLAIM_COUNT = 0 (authority gate clean)', unsupportedGame === 0)

  // ═══════════════════════════════════════════════════════════════════════
  // R85C3 — GAME_THESIS AUTHORITY AND FIVE-CARD BINDING
  // ═══════════════════════════════════════════════════════════════════════
  ok('R85C3 §3 GAME_THESIS version marker present', GT.GAME_THESIS_VERSION === 'r85c3_game_thesis_v1')
  ok('R85C3 §3 frozen authority order GAME>RULE>TRAP>REALITY>SWITCH>BET>B1',
    GT.AUTHORITY_ORDER.join('>') === 'GAME>RULE_PRICING_AUTHORITY>TRAP>REALITY_EVIDENCE>SWITCH>BET>B1_PERSONALITY')
  ok('R85C3 §3 game-thesis layer is pure (no LLM/http/network)',
    typeof GT.buildGameThesis === 'function' && !/openai|axios|http|fetch/.test(fs.readFileSync(path.join(TH, 'gameThesisV6.js'), 'utf8')))

  // ── §4 the ONE central contradiction is CURRENT game vs DESIRED position ──
  const gtP = GT.buildGameThesis(gameFor(CONTROLS[0]), profileFor(CONTROLS[0]), runHybridDiagnosisV6(rawFor(CONTROLS[0])).hybridContext)
  ok('R85C3 §4 game thesis exposes ONE contradiction (reality vs current position)',
    gtP && gtP.contradiction && /现实|定价权/.test(gtP.contradiction.text))
  ok('R85C3 §4 contradiction names the current game + pricing position',
    /雇主定价|局/.test(gtP.contradiction.position) && /定价权不在你手里|由|只有/.test(gtP.contradiction.position))
  ok('R85C3 §4 game thesis carries whoSetsPrice / whatUserSells / trap / switch / bet',
    !!(gtP.whoSetsPrice && gtP.whatUserSells && gtP.trap && gtP.switch && gtP.bet))

  // ── §6/§7 Card01 must carry a game signal; a behavioral Card01 is repaired ──
  ok('R85C3 §6 a pure-behavioral Card01 has NO game signal', GT.card01GameSignalPresent('市场已经给过你一次答案，你却还在等自己准备好。') === false)
  ok('R85C3 §6 a game-native Card01 HAS a game signal', GT.card01GameSignalPresent('你不是技术不够，是你的技术现在只有公司一个定价者。') === true)
  const behavioralOut = neutralOutput(CONTROLS[0].occ, gameFor(CONTROLS[0]))
  behavioralOut.cards.card01 = '市场已经给过你一次答案，你却还在等自己准备好。'
  {
    const o = runHybridDiagnosisV6(rawFor(CONTROLS[0]))
    const fb = buildReportV6(o.diagnosis, o.hybridContext)
    const call = stubOnce(behavioralOut)
    const r = await runV4RestoredReportRuntimeV6({ diagnosis: o.diagnosis, hybridProfile: o.hybridProfile, hybridContext: o.hybridContext, fallbackReport: fb, callAI: call })
    const v = r.report.visibleCards
    const g3 = r.report.visibleStats.r85c3Guard
    ok('R85C3 §6 a behavioral Card01 is repaired to a game-native sentence',
      g3.CARD01_GAME_SIGNAL_MISSING_COUNT === 1 && GT.card01GameSignalPresent(v.card01) === true, v.card01)
    ok('R85C3 §6 repaired Card01 is <=40 chars and names a real pricing party',
      v.card01.length <= 40 && /雇主|公司|定价者/.test(v.card01), v.card01)
  }

  // ── §7 the deterministic fallback is game-native + authority-faithful ──
  ok('R85C3 §7 EMPLOYER_PRICED fallback names the employer (never the market)',
    /你的雇主|公司/.test(GT.card01For('EMPLOYER', 'TECHNICAL_SKILL', 'ASSET_TECHNICAL', true)))
  ok('R85C3 §7 MIXED authority is NEVER over-inferred to a single employer',
    !/雇主|公司|老板/.test(GT.card01For('MIXED', 'SALES_RESULT', 'ASSET_NETWORK', true)))
  ok('R85C3 §7 USER authority fallback does NOT name an external payer',
    !/雇主|公司|平台|客户|甲方/.test(GT.card01For('USER', 'CONTENT', 'ASSET_CONTENT', true)))
  ok('R85C3 §7 every fallback frame is <=40 chars',
    [['EMPLOYER', 'TECHNICAL_SKILL', 'ASSET_TECHNICAL', true], ['PLATFORM', 'PHYSICAL_LABOR', 'ASSET_UNCLEAR', true], ['CLIENT', 'CONTENT', 'ASSET_CONTENT', true], ['MIXED', 'SALES_RESULT', 'ASSET_NETWORK', true], ['USER', 'CONTENT', 'ASSET_CONTENT', true], ['UNKNOWN', 'UNKNOWN', 'ASSET_UNCLEAR', false]]
      .every((a) => GT.card01For.apply(null, a).length <= 40))

  // ── §12/§13/§16 five-control readback through the runtime ──
  let legacyOverrides = 0, card01Missing = 0, loopFails = 0, c3Calls = 0
  for (const c of CONTROLS) {
    const o = runHybridDiagnosisV6(rawFor(c))
    const fb = buildReportV6(o.diagnosis, o.hybridContext)
    const call = stubOnce(neutralOutput(c.occ, gameFor(c)))
    const r = await runV4RestoredReportRuntimeV6({ diagnosis: o.diagnosis, hybridProfile: o.hybridProfile, hybridContext: o.hybridContext, fallbackReport: fb, callAI: call })
    const v = r.report.visibleCards
    const g3 = r.report.visibleStats.r85c3Guard
    c3Calls += call.calls()
    card01Missing += g3.CARD01_GAME_SIGNAL_MISSING_COUNT
    legacyOverrides += g3.LEGACY_THEME_OVERRIDES_GAME_COUNT
    loopFails += g3.CARD01_CARD05_GAME_LOOP_FAIL_COUNT
    ok('R85C3 §16 ' + c.name + ': Card01–05 all derive from the game (loop PASS)',
      GT.card05TestsGame(v.card01, v.card05, GT.buildGameThesis(gameFor(c), profileFor(c), o.hybridContext)) === true, c.name)
  }
  ok('R85C3 §13 LEGACY_THEME_OVERRIDES_GAME_COUNT = 0 across controls', legacyOverrides === 0, 'v=' + legacyOverrides)
  ok('R85C3 §6 CARD01_GAME_SIGNAL_MISSING_COUNT = 0 across controls', card01Missing === 0, 'v=' + card01Missing)
  ok('R85C3 §12/§16 CARD01_CARD05_GAME_LOOP_FAIL_COUNT = 0 across controls', loopFails === 0, 'v=' + loopFails)
  ok('R85C3 §12 a generic Card05 (no pricing/bet axis) IS flagged for the loop',
    GT.card05TestsGame('你不是技术不够，是你的技术现在只有公司一个定价者。',
      { goal: '完善你的产品，坚持做好内容。', actions: [], acceptance: '自己觉得满意。' },
      GT.buildGameThesis(gameFor(CONTROLS[0]), profileFor(CONTROLS[0]), runHybridDiagnosisV6(rawFor(CONTROLS[0])).hybridContext)) === false)
  ok('R85C3 §27 MODEL_CALL_COUNT_MAX = 1 across controls', c3Calls === CONTROLS.length, 'calls=' + c3Calls)

  // ── §19 legacy-theme override detector ──
  ok('R85C3 §13 legacy-theme override detector flags a legacy-only card',
    GT.legacyThemeOverride('你还没把第二次验证做出来。', gtP) === true)
  ok('R85C3 §13 legacy-theme override detector passes a game-native card',
    GT.legacyThemeOverride('你的收入主要由公司定价，定价权不在你手里。', gtP) === false)

  // ── §3 DETERMINISTIC_TARGETS carries the R85C3 zero targets ──
  ok('R85C3 §3 personality DETERMINISTIC_TARGETS include the three game-thesis zero counts',
    P.DETERMINISTIC_TARGETS.CARD01_GAME_SIGNAL_MISSING_COUNT === 0 &&
    P.DETERMINISTIC_TARGETS.LEGACY_THEME_OVERRIDES_GAME_COUNT === 0 &&
    P.DETERMINISTIC_TARGETS.CARD01_CARD05_GAME_LOOP_FAIL_COUNT === 0)
  ok('R85C3 §3 personality exposes the R85C3 version + authority block',
    P.R85C3_VERSION === 'r85c3_game_thesis_v1' && /GAME_THESIS/.test(P.buildPersonalityBlock()))
  ok('R85C3 §3 frozen prompt + personality versions unchanged',
    PROMPT_VERSION === 'turnaround_strategy_v6_v4_restored_prompt_v2_r84a' && P.PERSONALITY_VERSION === 'r84d_personality_v1')

  // ── §26 R84-D grounding freeze preserved (incl. widened recognition detector) ──
  ok('R85C3 §26 R84-D grounding version still frozen', G.GROUNDING_VERSION === 'r84d_grounding_v1')
  ok('R85C3 §26 recognition detector now catches the「记住的是店，不是你」variant',
    !!G.detectCustomerRecognitionClaim('顾客记住的是店，不是你。'))
  ok('R85C3 §26 recognition detector still allows legitimate recognition',
    G.detectCustomerRecognitionClaim('顾客认可你的手艺。') === null)
  ok('R85C3 §15 card04 grounding fallback is direction-correct (from ≠ to)',
    G.NEUTRAL_FALLBACK.card04from !== G.NEUTRAL_FALLBACK.card04to &&
    /还在被单一体系定价/.test(G.NEUTRAL_FALLBACK.card04from))
  ok('R85C3 §15 card04 target fallback does NOT force disintermediation',
    !/绕过|脱离|摆脱平台|脱离平台/.test(G.NEUTRAL_FALLBACK.card04to))

  // ═══════════════════════════════════════════════════════════════════════
  // R85C3 — PRICING POWER (pricingAuthority ≠ pricingPower) + SWITCH_TYPE
  // ═══════════════════════════════════════════════════════════════════════
  ok('R85C3 §3 pricing-power version marker present', PP.PRICING_POWER_VERSION === 'r85c3_pricing_power_v1')
  ok('R85C3 §3 SWITCH_TYPE taxonomy is exactly the 3 rational moves + UNKNOWN',
    PP.SWITCH_TYPES.join(',') === 'STAY_AND_UPGRADE,ADD_PRICING_SOURCE,SWITCH_GAME,UNKNOWN')
  ok('R85C3 §3 cardinal rule = 让用户拥有更多被重新定价的选择', /更多被重新定价的选择/.test(PP.CARDINAL_RULE))
  ok('R85C3 §3 pricing-power layer is pure (no LLM/http/network)',
    typeof PP.computePricingPowerV6 === 'function' && !/openai|axios|http|fetch/.test(fs.readFileSync(path.join(TH, 'pricingPowerV6.js'), 'utf8')))

  // ── §3/§4 pricingAuthority and pricingPower are SEPARATE objects ──
  const ppP = PP.computePricingPowerV6(gameFor(CONTROLS[0]), profileFor(CONTROLS[0]))
  ok('R85C3 §3 pricingPower exposes authority AND power as separate fields',
    !!(ppP.authority && ppP.concentration && ppP.alternativeRoutes && ppP.level && ppP.switchType))
  ok('R85C3 §3 authority mirrors pricingAuthority; power is a DIFFERENT structure',
    ppP.authority.value === gv(gameFor(CONTROLS[0]), 'pricingAuthority') &&
    typeof ppP.alternativeRoutes.value === 'number' && ppP.level.value !== ppP.authority.value)

  // ── §4 every control yields a valid SWITCH_TYPE (never forced to SELF) ──
  for (const c of CONTROLS) {
    const pp = PP.computePricingPowerV6(gameFor(c), profileFor(c))
    ok('R85C3 §4 ' + c.name + ': valid SWITCH_TYPE (' + pp.switchType.value + ')',
      PP.SWITCH_TYPES.indexOf(pp.switchType.value) !== -1)
  }

  // ── §5 ACCEPTANCE: EMPLOYER_PRICED reaches all three moves ──
  const empBase = { occupationDetail: '后端程序员', occupationCategory: 'OCC_TECH', incomeStructure: 'INC_SALARY', pricingAuthority: 'PRICE_EMPLOYER', monetizableSkill: 'ASSET_TECHNICAL' }
  const mkEmp = (over) => runHybridDiagnosisV6(Object.assign({}, BASE, empBase, over))
  const ppAdd = PP.computePricingPowerV6(GM.computeGameModelV6(mkEmp({}).hybridProfile.realEconomyModel, mkEmp({}).hybridProfile), mkEmp({}).hybridProfile)
  const ppStay = PP.computePricingPowerV6(GM.computeGameModelV6(mkEmp({ weeklyTime: 'TIME_2_5', monthlySurplus: 'SURPLUS_ZERO' }).hybridProfile.realEconomyModel, mkEmp({ weeklyTime: 'TIME_2_5', monthlySurplus: 'SURPLUS_ZERO' }).hybridProfile), mkEmp({ weeklyTime: 'TIME_2_5', monthlySurplus: 'SURPLUS_ZERO' }).hybridProfile)
  const mkEmpSvc = (over) => runHybridDiagnosisV6(Object.assign({}, BASE, { occupationDetail: '仓库分拣工', occupationCategory: 'OCC_PLATFORM_LABOR', incomeStructure: 'INC_SALARY', pricingAuthority: 'PRICE_EMPLOYER', monetizableSkill: 'ASSET_UNCLEAR' }, over))
  const ppSwitch = PP.computePricingPowerV6(GM.computeGameModelV6(mkEmpSvc({}).hybridProfile.realEconomyModel, mkEmpSvc({}).hybridProfile), mkEmpSvc({}).hybridProfile)
  const empMoves = new Set([ppAdd.switchType.value, ppStay.switchType.value, ppSwitch.switchType.value])
  ok('R85C3 §5 EMPLOYER_PRICED_EMPLOYER_GAME_SWITCH_TYPE_COUNT >= 3', empMoves.size >= 3, '[' + [...empMoves].join(',') + ']')
  ok('R85C3 §5 EMPLOYER_PRICED can reach STAY_AND_UPGRADE', empMoves.has('STAY_AND_UPGRADE'))
  ok('R85C3 §5 EMPLOYER_PRICED can reach ADD_PRICING_SOURCE', empMoves.has('ADD_PRICING_SOURCE'))
  ok('R85C3 §5 EMPLOYER_PRICED can reach SWITCH_GAME', empMoves.has('SWITCH_GAME'))

  // ── §6/§7 SELF_PRICED is NOT privileged: presence of a second route ≠ self-pricing ──
  const ppSelf = PP.computePricingPowerV6(gameFor(CONTROLS[4]), profileFor(CONTROLS[4]))
  ok('R85C3 §6 SELF_PRICED still gets a switch (never assumed optimal)', ppSelf.switchType.value !== 'UNKNOWN' && PP.SWITCH_TYPES.indexOf(ppSelf.switchType.value) !== -1)
  ok('R85C3 §6 SELF_PRICED does NOT automatically become STAY_AND_UPGRADE', ppSelf.switchType.value !== 'STAY_AND_UPGRADE' || ppSelf.alternativeRoutes.value === 0)

  // ── §5 STRICT-BAN detectors ──
  ok('R85C3 §5 no switch copy forces disintermediation', !CONTROLS.some((c) => { const pp = PP.computePricingPowerV6(gameFor(c), profileFor(c)); return PP.guardNoDisintermediation(pp.switchType.reason) || PP.guardNoDisintermediation((PP.SWITCH_TYPE_META[pp.switchType.value] || {}).move) }))
  ok('R85C3 §5 no switch copy forces entrepreneurship', !CONTROLS.some((c) => { const pp = PP.computePricingPowerV6(gameFor(c), profileFor(c)); return PP.guardNoEntrepreneurship(pp.switchType.reason || '') }))
  ok('R85C3 §5 disintermediation detector flags a universal leave-only claim', PP.guardNoDisintermediation('只有绕过公司自己干才能算翻身') === true)
  ok('R85C3 §5 disintermediation detector passes a neutral switch', PP.guardNoDisintermediation('在现有局之外增加一个独立付款人') === false)
  ok('R85C3 §5 entrepreneurship detector flags「你该去创业」', PP.guardNoEntrepreneurship('你该去创业') === true)
  ok('R85C3 §5 psychology-as-trap detector flags「你却认为是自己能力不够」', PP.guardMechanismNotPsychology('你却认为是自己能力不够') === true)
  ok('R85C3 §5 psychology-as-trap detector passes a mechanism sentence', PP.guardMechanismNotPsychology('技术越熟练→在岗位内越值钱→内部兑现越依赖雇主') === false)

  // ── §6 the prompt carries the pricing-power block + the three moves ──
  const ppPayload = buildV4RestoredPayload(runHybridDiagnosisV6(rawFor(CONTROLS[0])).hybridProfile, runHybridDiagnosisV6(rawFor(CONTROLS[0])).diagnosis, runHybridDiagnosisV6(rawFor(CONTROLS[0])).hybridContext)
  const ppPrompt = buildV4RestoredPrompt(ppPayload).userMessage
  ok('R85C3 §3 payload carries the pricingPower object', !!(ppPayload.pricingPower && ppPayload.pricingPower.switchType))
  ok('R85C3 §3 prompt renders the pricingAuthority ≠ pricingPower distinction', /定价力模型（pricingAuthority ≠ pricingPower）/.test(ppPrompt))
  ok('R85C3 §6 prompt lists all THREE switch moves', /STAY_AND_UPGRADE/.test(ppPrompt) && /ADD_PRICING_SOURCE/.test(ppPrompt) && /SWITCH_GAME/.test(ppPrompt))
  ok('R85C3 §6 prompt forbids the self-pricing default', /自己定价/.test(ppPrompt) && /SELF-PRICED 并不天然高于/.test(ppPrompt))

  // ── §10 card04 selects + card05 tests the SAME switch type (with a compliant model output) ──
  {
    const o = runHybridDiagnosisV6(rawFor(CONTROLS[0]))
    const fb = buildReportV6(o.diagnosis, o.hybridContext)
    const pp = PP.computePricingPowerV6(GM.computeGameModelV6(o.hybridProfile.realEconomyModel, o.hybridProfile), o.hybridProfile)
    const meta = PP.SWITCH_TYPE_META[pp.switchType.value]
    const out = neutralOutput(CONTROLS[0].occ, GM.computeGameModelV6(o.hybridProfile.realEconomyModel, o.hybridProfile))
    out.cards.card04 = { from: '被单一' + '公司/雇主' + '定价的人', to: meta.card04to, steps: ['留在现有体系', '拿到更高一档定价'] }
    out.cards.card05 = { objective: '检验换法', actions: [{ title: '拿信号', text: meta.card05test }], target: '1次', timebox: '7天', successSignal: meta.card05test }
    const call = stubOnce(out)
    const r = await runV4RestoredReportRuntimeV6({ diagnosis: o.diagnosis, hybridProfile: o.hybridProfile, hybridContext: o.hybridContext, fallbackReport: fb, callAI: call })
    const pw = r.report.visibleStats.r85c3PowerGuard
    ok('R85C3 §10 switch-type-compliant cards → SWITCH_TYPE_MISSING_COUNT = 0', pw.SWITCH_TYPE_MISSING_COUNT === 0, JSON.stringify(pw))
    ok('R85C3 §10 runtime exposes the selected switch type', r.report.visibleStats.r85c3SwitchType === pp.switchType.value)
    ok('R85C3 §10 zero universal-bias defects on a clean report',
      pw.FORCED_DISINTERMEDIATION_COUNT === 0 && pw.ENTREPRENEURSHIP_BIAS_COUNT === 0 && pw.PSYCHOLOGY_AS_TRAP_COUNT === 0 && pw.FABRICATED_TRANSACTION_COUNT === 0)
  }

  // ── §10 a card04 that ignores the switch type IS flagged ──
  {
    const o = runHybridDiagnosisV6(rawFor(CONTROLS[0]))
    const fb = buildReportV6(o.diagnosis, o.hybridContext)
    const bad = neutralOutput(CONTROLS[0].occ, GM.computeGameModelV6(o.hybridProfile.realEconomyModel, o.hybridProfile))
    bad.cards.card04 = { from: 'X', to: '一个更努力的人', steps: ['更努力'] }
    bad.cards.card05 = { objective: '更努力', actions: [{ title: 'A', text: '继续加油。' }], target: '1', timebox: '7天', successSignal: '自己满意。' }
    const call = stubOnce(bad)
    const r = await runV4RestoredReportRuntimeV6({ diagnosis: o.diagnosis, hybridProfile: o.hybridProfile, hybridContext: o.hybridContext, fallbackReport: fb, callAI: call })
    ok('R85C3 §10 switch-agnostic card04/card05 → SWITCH_TYPE_MISSING_COUNT >= 1', r.report.visibleStats.r85c3PowerGuard.SWITCH_TYPE_MISSING_COUNT >= 1)
  }

  // ── §5 FABRICATED_TRANSACTION depends on paid proof ──
  ok('R85C3 §5 fabricated transaction IS flagged without paid proof',
    PP.countFabricatedTransactions({ card01: '市场已经为你付过钱。' }, { marketProofState: { value: 'NO_PROOF' } }) === 1)
  ok('R85C3 §5 paid claim is allowed when proof exists',
    PP.countFabricatedTransactions({ card01: '市场已经为你付过钱。' }, { marketProofState: { value: 'PAID_ONCE' } }) === 0)

  // ── §6 personality carries the pricing-power authority block + targets ──
  ok('R85C3 §6 personality exposes the PRICING_POWER authority block',
    /PRICING_POWER_AUTHORITY_BLOCK/.test(Object.keys(P).join(',')) && /定价权 ≠ 定价力/.test(P.buildPersonalityBlock()))
  ok('R85C3 §6 personality DETERMINISTIC_TARGETS include the six pricing-power zero counts',
    P.DETERMINISTIC_TARGETS.PRICING_AUTHORITY_PRICING_POWER_COLLAPSE_COUNT === 0 &&
    P.DETERMINISTIC_TARGETS.SWITCH_TYPE_MISSING_COUNT === 0 &&
    P.DETERMINISTIC_TARGETS.FORCED_DISINTERMEDIATION_COUNT === 0 &&
    P.DETERMINISTIC_TARGETS.ENTREPRENEURSHIP_BIAS_COUNT === 0 &&
    P.DETERMINISTIC_TARGETS.PSYCHOLOGY_AS_TRAP_COUNT === 0 &&
    P.DETERMINISTIC_TARGETS.FABRICATED_TRANSACTION_COUNT === 0)
  ok('R85C3 §5 personality forbids the forced-disintermediation default', /强制去中介化/.test(P.buildPersonalityBlock()))

  // ── §27 infra freezes ──
  ok('R85C3 §27 frozen prompt + personality versions unchanged',
    PROMPT_VERSION === 'turnaround_strategy_v6_v4_restored_prompt_v2_r84a' && P.PERSONALITY_VERSION === 'r84d_personality_v1' && GM.GAME_VERSION === 'r85c1_game_model_v1')
  ok('R85C3 §27 pricing power is RUNTIME ONLY (not in the cognitive profile patch)', !/pricingPower|pricing_power/.test(JSON.stringify(BRIDGE.buildCognitiveProfilePatch({ diagnosis: runHybridDiagnosisV6(rawFor(CONTROLS[0])).diagnosis, hybridProfile: runHybridDiagnosisV6(rawFor(CONTROLS[0])).hybridProfile, hybridContext: runHybridDiagnosisV6(rawFor(CONTROLS[0])).hybridContext, report: { visibleCards: {} }, reportId: 'ARV6_pp', ts: 1 }))))

  console.log(results.join('\n'))
  console.log('\nR85-C TESTS: ' + pass + ' passed, ' + fail + ' failed')
  console.log('DISTINCT_GAME_COUNT=' + dGame + ' DISTINCT_RULE_COUNT=' + dRule + ' DISTINCT_TRAP_COUNT=' + dTrap + ' DISTINCT_SWITCH_COUNT=' + dSwitch + ' DISTINCT_BET_COUNT=' + dBet)
  if (fail > 0) process.exit(1)
}

main().catch((e) => { console.error('R85-C TEST ERROR', e); process.exit(2) })
