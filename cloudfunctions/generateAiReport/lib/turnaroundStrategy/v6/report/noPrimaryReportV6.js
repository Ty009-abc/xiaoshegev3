'use strict'
/**
 * turnaroundStrategy/v6/report/noPrimaryReportV6.js
 *
 * RC8.4 V6 R51 — FIRST-CLASS NO_PRIMARY REPORT (evidence-grounded).
 *
 * CONTEXT (R50 accepted): NO_PRIMARY is structurally common (pruned raw sweep
 * 52.83% of the legal Hybrid answer space). It is NOT an edge case and NOT a
 * failure: it means B1 could not truthfully establish ONE sufficiently supported
 * primary bottleneck. It does NOT mean there is no useful evidence, no strategy,
 * or that the system failed.
 *
 * WHAT THIS FILE DOES
 *   Builds a COMPLETE, deterministic five-card report for the NO_PRIMARY state,
 *   grounded in the SAME user evidence the Hybrid profile already carries:
 *   reality · occupation · income · surplus · asset · marketProof ·
 *   primaryProblem · selfBelief · executionStage · uncertaintyResponse ·
 *   timeAllocation · noResultResponse · weeklyTime · maxTrialCost.
 *
 * WHAT THIS FILE NEVER DOES
 *   - NEVER converts NO_PRIMARY into a primary bottleneck
 *     (NO_PRIMARY_TO_PRIMARY_MUTATION_COUNT = 0).
 *   - NEVER emits internal engine vocabulary ("没有单一瓶颈" / "暂时分不出主次"
 *     / stage names / bottleneck ids) into user copy
 *     (NO_PRIMARY_INTERNAL_STATE_LEAK_COUNT = 0).
 *   - NEVER treats a stated belief as a proven diagnosis.
 *   - ZERO AI. ZERO model calls (NO_PRIMARY_MODEL_CALL_COUNT = 0).
 *   - ZERO diagnosis authority. No eligibility, no selection, no scoring.
 *
 * EVIDENCE CLUSTERS (R51 §5/§6): up to TWO strongest evidence clusters are
 * derived deterministically from user evidence. They are NOT bottlenecks — they
 * are the two strongest observed forces, each carrying SOURCE_FIELDS,
 * EVIDENCE_STRENGTH and WHY_INCLUDED. If evidence ties, the selection is a
 * documented deterministic order (group priority + fixed id order), never a
 * faked ranking. One cluster -> a single focus. None -> evidence-minimal reality
 * framing (never internal diagnostic language).
 *
 * CARD MAP (R51 §7–§12):
 *   01 核心矛盾            strongest evidence-grounded tension (no bottleneck claim)
 *   02 现在的位置          reality + occupation + asset + market-proof position
 *   03 为什么会卡住        FACT A -> FACT B -> TENSION -> CONSEQUENCE
 *   04 下一步先验证什么    CURRENT CERTAINTY -> NEXT UNCERTAINTY TO REMOVE
 *   05 一个可逆实验        ONE action aligned to the CARD04 uncertainty
 *
 * CONSUMER LAYER ONLY. Deterministic. No AI. No I/O. No network.
 */

const copy = require('./reportCopyV6.js')
const {
  evaluateNoPrimaryCrossAxisScope,
  noPrimaryLinkKind,
  SCOPE_UNPROVEN
} = require('../hybrid/noPrimaryCrossAxisV6.js')

// ── Evidence strength (R51 §6) ──────────────────────────────────────────
const STRENGTH_VALUE = { STRONG: 3, MEDIUM: 2, WEAK: 1 }
const GROUP_ORDER = { MARKET: 0, DIRECTION: 1, BEHAVIOR: 2, REALITY: 3 }

/**
 * Evidence-cluster definitions. Each cluster is an OBSERVED FORCE, never a
 * bottleneck. `c01`/`c03fact`/`c04now` are consumer-safe clause templates;
 * `tag`/`tension`/`consequence` shape CARD03.
 */
const CLUSTER_DEFS = {
  MarketProofPresentButUnstable: {
    group: 'MARKET', strength: 'STRONG',
    sourceFields: ['asset.marketProof'],
    why: '已经有付费结果，但还没有形成稳定、可重复的成交',
    c01: '已经有结果，却还没稳定',
    c03fact: '你已经让市场为它付过钱，这说明它真的能换钱。',
    c04now: '已经有人付过钱，但结果还不稳定',
    tension: '这两件事叠在一起，就成了一个循环：已有的结果因为不稳定而说不清，说不清的部分又一直没被单独验证。',
    consequence: '所以你不是没有结果，而是还没有把“为什么会有这个结果”验证清楚。'
  },
  RepeatablePaidPresent: {
    group: 'MARKET', strength: 'STRONG',
    sourceFields: ['asset.marketProof'],
    why: '已经有能重复付费的客户',
    c01: '已经能重复成交，却还没把它变成方法',
    c03fact: '你已经有了会重复付费的客户，说明这件事本身跑得通。',
    c04now: '已经有能重复付费的客户，但还没变成可复制的方法',
    tension: '这两件事叠在一起，你一直能重复成交，却没把“为什么会成”变成别人也能照着做的步骤。',
    consequence: '所以下一步不是再成交一次，而是把其中一部分固定成方法。'
  },
  EarlyTractionWithoutRepeatability: {
    group: 'MARKET', strength: 'STRONG',
    sourceFields: ['executionStage'],
    why: '已经开始有付费，但结果不稳定',
    c01: '已经有人付钱，但结果还不稳',
    c03fact: '你已经进入有人愿意付钱的阶段，但这份结果还不稳定。',
    c04now: '已经有人付钱，但还不稳定',
    tension: '这两件事叠在一起，已经出现的付费因为不稳定而说不清，说不清的部分又一直没被单独验证。',
    consequence: '所以你不是没有结果，而是还没有把“为什么会有这个结果”验证清楚。'
  },
  UnprovenAsset: {
    group: 'MARKET', strength: 'MEDIUM',
    sourceFields: ['asset.marketProof', 'asset.type'],
    why: '有一个具体能力，但还没有被市场用付费验证过',
    c01: '有一个具体能力，但它还没被市场验证',
    c03fact: '你已经有一个具体的能力，但还没有人为此付过钱。',
    c04now: '有一个具体能力，但还没被市场验证',
    tension: '这两件事叠在一起，你手里的能力一直没有被单独拿出来，交给市场回答一次。',
    consequence: '所以现在最该做的，是让这项能力先被市场回答一次。'
  },
  DirectionUncertainty: {
    group: 'DIRECTION', strength: 'MEDIUM',
    sourceFields: ['userBelief.perceivedRootCause', 'desiredChange.primaryProblem'],
    why: '方向本身还不清晰，也还没被现实验证过',
    c01: '方向还没定下来，也没被真实验证过',
    c03fact: '你一直没把方向定下来，也还没让任何一个方向被现实检验过。',
    c04now: '方向还没定，也还没被现实验证',
    tension: '这两件事叠在一起，方向就更难靠“想”定下来，只能靠一次次小试验逼近。',
    consequence: '所以你要的不是再想一个更好的方向，而是先试出一个能用的反馈。'
  },
  SwitchingAfterNoResult: {
    group: 'DIRECTION', strength: 'MEDIUM',
    sourceFields: ['behavior.noResultResponse', 'userBelief.perceivedRootCause'],
    why: '一遇到没有结果，就倾向换个方向重来',
    c01: '一没结果就想换个方向',
    c03fact: '一遇到没有结果，你就倾向换个方向重来。',
    c04now: '遇到没有结果时容易换方向',
    tension: '这两件事叠在一起，一遇到没结果就想换个方向，等于把已经投入的部分清零重来。',
    consequence: '所以在换方向之前，先给当前这一条一次完整的验证。'
  },
  ActionDelay: {
    group: 'BEHAVIOR', strength: 'MEDIUM',
    sourceFields: ['behavior.uncertaintyResponse'],
    why: '一遇到不确定，倾向先等更多信息再动',
    c01: '不确定时倾向先等更多信息',
    c03fact: '一遇到不确定，你会先等更多信息，再决定要不要动。',
    c04now: '不确定时倾向先等更多信息',
    tension: '这两件事叠在一起，每一次“再等等”，都让真实的反馈来得更晚。',
    consequence: '所以卡住你的不是想法不够多，而是还没有把想法交出去一次。'
  },
  ShortTermDominance: {
    group: 'BEHAVIOR', strength: 'MEDIUM',
    sourceFields: ['behavior.timeAllocation', 'capacity.weeklyTime'],
    why: '时间优先给了马上能看到结果的事',
    c01: '时间先给了马上有结果的事',
    c03fact: '你的时间优先给了马上能看到结果的事，长期那件总被往后放。',
    c04now: '时间优先给了短期的事，长期那件被往后放',
    tension: '这两件事叠在一起，长期那件事就一直在给短期的事让路。',
    consequence: '所以这件事一直没被稳定推进，也就一直没有积累。'
  },
  TimeScatter: {
    group: 'BEHAVIOR', strength: 'MEDIUM',
    sourceFields: ['behavior.timeAllocation'],
    why: '两头都想兼顾，长期推进不稳定',
    c01: '两头都想兼顾',
    c03fact: '你两头都想安排，结果长期这件事一直没被稳定推进。',
    c04now: '两头都想兼顾，长期那件推进不稳',
    tension: '这两件事叠在一起，长期那件事一直在“两头兼顾”里被往后放。',
    consequence: '所以它一直没有积累，也就一直停在原地。'
  },
  AbilityDoubt: {
    group: 'DIRECTION', strength: 'WEAK',
    sourceFields: ['userBelief.perceivedRootCause'],
    why: '你把原因归到“能力不够”（仅是一条证据，未被证明）',
    c01: '把原因归到「能力还不够」',
    c03fact: '你自己把原因归到“能力还不够”。',
    c04now: '你把原因归到“能力还不够”',
    tension: '这两件事叠在一起，你把原因归到“能力还不够”，却还没有用一次真实验证去检验它。',
    consequence: '所以不妨先把“能力够不够”换成一次能拿到答案的小验证。'
  },
  RealityConstraint: {
    group: 'REALITY', strength: 'MEDIUM',
    sourceFields: ['reality.monthlySurplus', 'capacity.maxTrialCost'],
    why: '现金流 / 试错预算的硬约束',
    c01: '能投入的钱和时间都很有限',
    c03fact: '你眼下可以动用的钱和时间都很有限，这限制了你能做的尝试。',
    c04now: '可投入的钱和时间有限',
    tension: '这两件事叠在一起，你能做的尝试必须足够小，才不至于伤到现金流。',
    consequence: '所以下一步要小到几乎不花钱，但仍能拿到一条真实反馈。'
  },
  CashflowTight: {
    group: 'REALITY', strength: 'WEAK',
    sourceFields: ['reality.monthlySurplus'],
    why: '每月结余偏紧',
    c01: '每月结余不多',
    c03fact: '你每月的结余不多，能用来试的空间需要控制得很小。',
    c04now: '每月结余不多',
    tension: '这两件事叠在一起，你能用来试的空间必须控制得很小。',
    consequence: '所以下一步要先用几乎不花钱的方式，拿到一条真实反馈。'
  }
}

const CLUSTER_IDS = Object.keys(CLUSTER_DEFS)

/**
 * Deterministically derive the observed evidence clusters from normalized
 * evidence. Pure lookup over the user's own answers. No AI, no scoring.
 * @param {Object} ev normalized evidence (see mergeEvidence)
 * @returns {Array<Object>} observed clusters
 */
function deriveEvidenceClusters (ev) {
  const out = []
  const seen = {}
  const push = (id) => { if (!seen[id]) { seen[id] = true; out.push(Object.assign({ id }, CLUSTER_DEFS[id], { strengthValue: STRENGTH_VALUE[CLUSTER_DEFS[id].strength] })) } }

  const idx = (typeof ev.assetIndex === 'number') ? ev.assetIndex : null
  const validated = ev.marketValidated === true
  const stage = ev.stage || null
  const belief = ev.selfBelief || null
  const problem = ev.primaryProblem || null
  const uncert = ev.uncertaintyResponse || null
  const decision = ev.decisionStyle || null
  const time = ev.timeAllocation || null
  const noResult = ev.noResultResponse || null
  const weekly = ev.weeklyTime || null
  const surplus = ev.monthlySurplus || null
  const cost = ev.maxTrialCost || null
  const income = ev.incomeMode || null

  // ── MARKET / asset-proof axis (only when the asset axis is known) ──
  const marketByAsset = (idx !== null)
  if (marketByAsset) {
    if (idx === 6) push('RepeatablePaidPresent')
    else if (idx === 4 || idx === 5) push('MarketProofPresentButUnstable')
    else if (idx >= 0 && idx <= 3) push('UnprovenAsset')
  } else if (stage === 'EARLY_TRACTION' || stage === 'STABLE_TRACTION') {
    // Native path (no asset axis): the stage itself is the market evidence.
    push('EarlyTractionWithoutRepeatability')
  }

  // ── DIRECTION axis ──
  if (belief === 'BELIEF_NO_DIRECTION' || belief === 'BELIEF_SWITCHING' ||
      problem === 'PROBLEM_CAREER_SWITCH' || problem === 'PROBLEM_NO_FUTURE') {
    push('DirectionUncertainty')
  }
  if (noResult === 'NORESULT_SWITCH' || belief === 'BELIEF_SWITCHING') {
    push('SwitchingAfterNoResult')
  }
  if (belief === 'BELIEF_ABILITY') push('AbilityDoubt')

  // ── BEHAVIOR axis ──
  if (uncert === 'UNCERT_WAIT' || uncert === 'UNCERT_ANALYZE' ||
      decision === 'DECISION_WAIT_OTHERS' || decision === 'DECISION_LEARN_FIRST' || decision === 'DECISION_AVOID') {
    push('ActionDelay')
  }
  if (time === 'TIME_SHORT_FIRST' || weekly === 'TIME_UNDER_2' || weekly === 'TIME_2_5') {
    push('ShortTermDominance')
  } else if (time === 'TIME_BALANCE') {
    push('TimeScatter')
  }

  // ── REALITY axis ──
  if (surplus === 'SURPLUS_NONE' || cost === 'COST_ZERO' || income === 'INCOME_NONE') {
    push('RealityConstraint')
  } else if (surplus === 'SURPLUS_UNDER_1K' || surplus === 'SURPLUS_1K_5K' || cost === 'COST_UNDER_1K') {
    push('CashflowTight')
  }

  return out
}

/**
 * Deterministic selection of up to TWO strongest clusters (R51 §6).
 * Ordering = strength DESC -> group priority -> fixed id order. When strengths
 * tie the order is documented, not invented. The second cluster is chosen from a
 * DIFFERENT group when possible so the two describe a genuine tension.
 * @param {Array<Object>} clusters
 * @returns {Array<Object>} [A] or [A, B]
 */
function selectEvidenceClusters (clusters) {
  if (!Array.isArray(clusters) || !clusters.length) return []
  const sorted = clusters.slice().sort((a, b) => {
    if (b.strengthValue !== a.strengthValue) return b.strengthValue - a.strengthValue
    const go = (GROUP_ORDER[a.group] || 0) - (GROUP_ORDER[b.group] || 0)
    if (go) return go
    return CLUSTER_IDS.indexOf(a.id) - CLUSTER_IDS.indexOf(b.id)
  })
  const A = sorted[0]
  const B = sorted.find(c => c.id !== A.id && c.group !== A.group && c.strengthValue >= 2) ||
    sorted.find(c => c.id !== A.id && c.strengthValue >= 2) || null
  return B ? [A, B] : [A]
}

// ── NEXT-UNCERTAINTY SELECTOR (R51 §10/§11) ─────────────────────────────
// Selects ONE highest-information, reversible question. Proof state selects the
// SCOPE of the next experiment — it never diagnoses a bottleneck.
const NEXT_UNCERTAINTY = {
  WHICH_SKILL_TO_TEST: {
    proofStage: 'NO_PROOF', progression: 'IDENTIFY_BUILD',
    question: '先把哪一个能力拿出来试？',
    action: '先把你会做的三件事各写一句“为谁解决什么问题”，挑其中一件，直接去问1个这样的人：这件事你需不需要？',
    target: '你身边1个真实的人（先问1个）',
    timebox: '今天内完成',
    done: '对方明确回一句“需要”或“不需要”，而不是“还行”。',
    decision: '只要拿到1句明确回答，就用它决定先试哪一件，不再靠自己猜。'
  },
  WILLINGNESS_TO_PAY_FOR_USED: {
    proofStage: 'FREE_HELPED', progression: 'WILLINGNESS_TO_PAY',
    question: '被认可过的这件事，别人愿不愿意为它付钱？',
    action: '今天找1个你用这件事帮过的人，直接问他：如果换成收费，你愿意为它付多少钱？',
    target: '1个你免费帮过的人',
    timebox: '今天内完成',
    done: '对方给出一个具体金额或明确的“不会付”，而不是含糊的“应该可以”。',
    decision: '只要出现一个明确的价格或拒绝，就用它判断这件事值不值得继续。'
  },
  WILLINGNESS_TO_PAY: {
    proofStage: 'PROBLEM_SOLVING', progression: 'WILLINGNESS_TO_PAY',
    question: '别人愿不愿意为这个结果付钱？',
    action: '今天找1个你实实在在帮过的人，说清楚这次要收费，问他愿不愿意为这个结果付钱。',
    target: '1个你实实在在帮过的人',
    timebox: '24小时内完成',
    done: '对方明确说“愿意付”并给出金额，或明确说“不愿意”。',
    decision: '只要拿到一次真实的付费意愿，就用它决定要不要把它做成能卖的东西。'
  },
  WHY_BOUGHT_AND_REPEAT: {
    proofStage: 'PAID_ONCE', progression: 'REPEAT',
    question: '为什么这次有人买，以及这个原因能不能再次出现？',
    action: '今天找已经付过钱的那1个人，问清楚：当初为什么买、如果再来一次还会不会买。',
    target: '已经付过钱的那个人',
    timebox: '今天内完成',
    done: '他讲清当初买的原因，并说明还会不会再买。',
    decision: '只要“为什么买”能被复述出来，就把它固定成下一次的做法。'
  },
  WHICH_CUSTOMER_REPEATS: {
    proofStage: 'OCCASIONAL_PAID', progression: 'PATTERN',
    question: '哪些客户或场景更容易重复成交？',
    action: '今天把最近成交过的人排一遍，找出成交最多的那一类，再去找1个同类的新人验证。',
    target: '成交最多的那一类客户里的1个新人',
    timebox: '24小时内完成',
    done: '新人明确表示要不要，且能与老客户的反馈对照。',
    decision: '只要同类新人给出一致的反馈，就把这类客户设为主攻方向。'
  },
  WHICH_PART_TO_SYSTEMATIZE: {
    proofStage: 'REPEATABLE_PAID', progression: 'SYSTEMATIZE',
    question: '哪一部分流程值得固定下来？',
    action: '今天把已经稳定成交的那套流程写成一步步的清单，拿给1个新人照着走一遍。',
    target: '1个新客户，或1个能替你执行的人',
    timebox: '今天内完成',
    done: '这份清单能被另一个人照着走通，或拿到1条明确反馈。',
    decision: '只要流程能被别人照着走通，就把它固定成标准，不再靠你临场发挥。'
  },
  FINISH_ONE_TESTABLE_THING: {
    proofStage: 'NO_PROOF', progression: 'IDENTIFY_BUILD',
    question: '能不能先把同一件事完整做满一次？',
    action: '先把同一件事连续做满一周，做出一个可以被别人看到的最小结果。',
    target: '你自己，加上至少1个能看到结果的人',
    timebox: '连续一周，每天固定一个时段',
    done: '一周结束时有一个能被外人看到的结果，并收到1条真实回应。',
    decision: '只要拿到1条真实回应，就用它判断要不要继续。'
  },
  // ── R53 — UNPROVEN scope: test the LINK, never scale the proven asset ──
  TEST_LINK_TO_NEW_DIRECTION: {
    proofStage: 'LINK_TEST', progression: 'LINK',
    question: '这项已经有人付过钱的能力，能不能解决你这次真正想改变的问题？',
    action: '今天找1个已经走在你目标方向里的人（或你目标方向的1个客户），问清楚：他现在做的那件事，能不能用上你这项已经有人付过钱的能力？',
    target: '1个已经走在你目标方向里的人',
    timebox: '3天内完成',
    done: '对方明确说出这件事用得上、或完全用不上你现有的这项能力。',
    decision: '只要这个连接被证实或证伪，就用它决定要不要把这项能力带进新方向。'
  },
  TEST_INCREMENTAL_INCOME_LINK: {
    proofStage: 'LINK_TEST', progression: 'LINK',
    question: '这项已经有人付钱的能力，能不能先变成你眼下这笔收入的来源？',
    action: '今天找1个最近为这项能力付过钱的人，直接问他：如果现在让你用这项能力多解决一个具体问题，你愿不愿意再付一次？',
    target: '1个最近为这项能力付过钱的人',
    timebox: '24小时内完成',
    done: '对方明确给出愿意再付、或明确不愿意。',
    decision: '只要你拿到一次明确的再付费意愿，就用它判断这项能力能不能带来增量收入。'
  }
}

const PROOF_STAGE_BY_INDEX = {
  0: 'NO_PROOF', 1: 'NO_PROOF', 2: 'FREE_HELPED', 3: 'PROBLEM_SOLVING',
  4: 'PAID_ONCE', 5: 'OCCASIONAL_PAID', 6: 'REPEATABLE_PAID'
}

/**
 * Deterministic selector for the ONE next uncertainty to remove (R51 §11).
 * @param {Object} ev
 * @returns {{id:string, proofStage:string, progression:string, question:string,
 *   action:string, target:string, timebox:string, done:string, decision:string}}
 */
function selectNextUncertainty (ev, scope) {
  // ── R53 — UNPROVEN scope forces a LINK test, never an asset-scale step ──
  if (scope === SCOPE_UNPROVEN) {
    const linkKey = noPrimaryLinkKind(ev) === 'LINK_DIRECTION'
      ? 'TEST_LINK_TO_NEW_DIRECTION'
      : 'TEST_INCREMENTAL_INCOME_LINK'
    return Object.assign({ id: linkKey, proofStage: 'LINK_TEST' }, NEXT_UNCERTAINTY[linkKey])
  }
  const idx = (typeof ev.assetIndex === 'number') ? ev.assetIndex : null
  let key
  if (idx === 6) key = 'WHICH_PART_TO_SYSTEMATIZE'
  else if (idx === 5) key = 'WHICH_CUSTOMER_REPEATS'
  else if (idx === 4) key = 'WHY_BOUGHT_AND_REPEAT'
  else if (idx === 3) key = 'WILLINGNESS_TO_PAY'
  else if (idx === 2) key = 'WILLINGNESS_TO_PAY_FOR_USED'
  else if (idx === 0 || idx === 1) key = 'WHICH_SKILL_TO_TEST'
  else {
    const s = ev.stage
    if (s === 'STABLE_TRACTION') key = 'WHICH_PART_TO_SYSTEMATIZE'
    else if (s === 'EARLY_TRACTION') key = 'WHY_BOUGHT_AND_REPEAT'
    else if (s === 'TESTING') key = 'WILLINGNESS_TO_PAY'
    else if (s === 'STARTED') key = 'FINISH_ONE_TESTABLE_THING'
    else key = 'WHICH_SKILL_TO_TEST'
  }
  const proofStage = idx !== null
    ? PROOF_STAGE_BY_INDEX[idx]
    : (NEXT_UNCERTAINTY[key].proofStage)
  return Object.assign({ id: key, proofStage }, NEXT_UNCERTAINTY[key])
}

/**
 * R53 — attach the deterministic NO_PRIMARY cross-axis scope to the evidence.
 * Fail-closed: when the link between the proven asset and the current desired
 * change can not be proven, scope = UNPROVEN. Zero diagnosis authority.
 * @param {Object} ev
 * @returns {Object} ev with `noPrimaryScope` and `provenAsset`
 */
function addNoPrimaryScope (ev) {
  const provenAsset = ev.marketValidated === true
  const scope = evaluateNoPrimaryCrossAxisScope({
    marketValidated: provenAsset,
    primaryProblem: ev.primaryProblem,
    primaryGoal: ev.primaryGoal,
    occupation: ev.occupation,
    monetizableSkill: ev.monetizableSkill,
    assetNamed: ev.assetNamed,
    incomeStructure: ev.incomeMode,
    pastAttemptStage: ev.pastAttemptStage
  })
  return Object.assign({}, ev, { noPrimaryScope: scope, provenAsset })
}

// ── Evidence normalization (diagnosis + optional hybrid context) ────────
function mergeEvidence (diagnosis, hy) {
  const p = (diagnosis && diagnosis.profile) || {}
  const reality = p.reality || {}
  const dc = p.desiredChange || {}
  const ub = p.userBelief || {}
  const beh = p.behavior || {}
  const ex = (hy && hy.evidence) || {}
  const occ = (reality.occupation && String(reality.occupation).trim()) || ex.occupation || null
  return {
    stage: (p.executionStage && p.executionStage.currentStage) || (diagnosis && diagnosis.executionStage) || null,
    primaryProblem: dc.primaryProblem || ex.primaryProblem || null,
    selfBelief: ub.perceivedRootCause || ex.selfBelief || null,
    uncertaintyResponse: beh.uncertaintyResponse || null,
    timeAllocation: beh.timeAllocation || null,
    noResultResponse: beh.noResultResponse || null,
    incomeMode: reality.incomeMode || ex.incomeStructure || null,
    monthlySurplus: reality.monthlySurplus || ex.monthlySurplus || null,
    occupation: occ,
    weeklyTime: ex.weeklyTime || null,
    maxTrialCost: ex.maxTrialCost || null,
    decisionStyle: ex.decisionStyle || null,
    // R53 — desired-change / asset-identity evidence for the NO_PRIMARY
    // cross-axis scope. Not bottleneck authority.
    primaryGoal: dc.primaryGoal || ex.primaryGoal || null,
    monetizableSkill: ex.monetizableSkill || null,
    assetNamed: (ex.assetNamed === true) || !!(ex.monetizableSkill && ex.monetizableSkill !== 'ASSET_UNCLEAR'),
    assetIndex: (typeof (hy && hy.assetIndex) === 'number') ? hy.assetIndex : null,
    assetState: (hy && hy.assetState) || null,
    marketValidated: (hy && typeof hy.marketValidated === 'boolean') ? hy.marketValidated : null,
    assetTypeText: (hy && hy.assetTypeText) || null,
    realityLine: (hy && hy.realityLine) || '',
    assetLine: (hy && hy.assetLine) || '',
    sizingLine: (hy && hy.sizingLine) || '',
    goalLine: (hy && hy.goalLine) || ''
  }
}

// ── CARD01 — 核心矛盾 (no bottleneck claim) ─────────────────────────────
function buildCard01 (ev, clusters) {
  let text
  if (clusters.length >= 2) {
    text = `你${clusters[0].c01}，${clusters[1].c01}。`
  } else if (clusters.length === 1) {
    text = `你${clusters[0].c01}，先用一步把它验证清楚。`
  } else {
    text = '先把已经发生的现实摆清楚，再来决定下一步。'
  }
  if ([...text].length > 40) {
    // Deterministic safety: keep the strongest cluster only.
    const c = clusters[0] || null
    text = c ? `你${c.c01}，先用一步把它验证清楚。` : '先把已经发生的现实摆清楚。'
  }
  const fields = []
  for (const c of clusters) for (const f of c.sourceFields) if (fields.indexOf(f) === -1) fields.push(f)
  return {
    title: '核心矛盾',
    text,
    provenance: prov(fields, qidsFor(clusters))
  }
}

// ── CARD02 — 现在的位置 (reality + occupation + asset + market-proof) ───
function buildCard02 (ev, hy) {
  const problem = copy.getProblemRealization(ev.primaryProblem)
  const hasHybrid = !!(hy && (ev.realityLine || ev.assetLine || ev.occupation || ev.assetState))
  let text
  if (hasHybrid) {
    const beliefClause = beliefContrast(ev)
    // R53 §6 — UNPROVEN: state the asset FACT only; NEVER infer it is the path.
    const linkClause = (ev.noPrimaryScope === SCOPE_UNPROVEN && ev.provenAsset)
      ? '它和这次想解决的问题之间有没有直接关系，还没有被验证过。'
      : ''
    text = `${ev.realityLine}${ev.assetLine}现在最想解决的是${problem}。${linkClause}${beliefClause}`
  } else {
    text = `你现在${copy.getIncomeShort(ev.incomeMode)}，最想解决的是${problem}。`
  }
  const fields = ['reality.incomeMode', 'desiredChange.primaryProblem']
  if (ev.occupation) fields.push('reality.occupation')
  if (ev.monthlySurplus) fields.push('reality.monthlySurplus')
  if (ev.assetState) fields.push('asset.state', 'asset.marketProof')
  return { title: '现在的位置', text, provenance: prov(fields, ['Q2', 'Q4', 'Q5']) }
}

/**
 * R51 §16 — self-belief is used as ONE evidence source only. It may CONTRAST the
 * stated belief with a known fact; it never asserts the belief is the diagnosis.
 */
function beliefContrast (ev) {
  if (ev.selfBelief === 'BELIEF_ABILITY' && ev.marketValidated === true) {
    return '至少从已经发生的付费看，问题不只是“会不会”。'
  }
  return ''
}

// ── CARD03 — 为什么会卡住 (FACT A -> FACT B -> TENSION -> CONSEQUENCE) ──
function buildCard03 (ev, clusters) {
  const closing = '下一步不需要一个完美答案，只需要一条新的信息。'
  let steps
  // R53 §7 — UNPROVEN: name BOTH the proven asset and the separate desired
  // change, WITHOUT merging them into one causal path.
  if (ev.noPrimaryScope === SCOPE_UNPROVEN && ev.provenAsset) {
    const assetFact = clusters.length && clusters[0].group === 'MARKET'
      ? clusters[0].c03fact
      : '你手上已经有一项让市场付过钱的能力。'
    steps = [
      assetFact,
      '但你现在想解决的，是另一个问题——它不一定和这项能力是同一条路。',
      '你手上明明有已经被市场认过的东西，却很难把它直接用来解决眼前这个问题。',
      '所以真正还没被验证的，不是这项能力行不行，而是它和你这次想解决的问题该不该连在一起。',
      closing
    ]
    return {
      title: '为什么会卡住',
      steps,
      insight: '所以真正还没被验证的，不是这项能力行不行，而是它和你这次想解决的问题该不该连在一起。',
      text: steps.join('\n'),
      provenance: prov(['asset.marketProof', 'desiredChange.primaryProblem', 'desiredChange.primaryGoal'], ['Q4', 'Q5', 'Q6'])
    }
  }
  if (clusters.length >= 2) {
    steps = [clusters[0].c03fact, clusters[1].c03fact, clusters[0].tension, clusters[0].consequence, closing]
  } else if (clusters.length === 1) {
    const c = clusters[0]
    steps = [c.c03fact, c.tension, c.consequence, '先把这一点单独验证一次，会比继续整体纠结更有用。', closing]
  } else {
    steps = [
      '你手上已经有一些真实的线索，但它们还没有被单独验证过。',
      '这些线索放在一起时，方向并不唯一，所以没有一个原因明显到可以先行动。',
      '与其继续整体纠结，不如先挑一条最具体的线索去验证。',
      '一条新的信息，就能让下一步比现在更清楚。',
      closing
    ]
  }
  const insight = clusters.length ? clusters[0].consequence : '先拿到一条新的信息，下一步就会比现在更清楚。'
  const fields = []
  for (const c of clusters) for (const f of c.sourceFields) if (fields.indexOf(f) === -1) fields.push(f)
  return {
    title: '为什么会卡住',
    steps,
    insight,
    text: steps.join('\n'),
    provenance: prov(fields.concat(['executionStage']), qidsFor(clusters).concat(['Q6']))
  }
}

// ── CARD04 — 下一步先验证什么 (CERTAINTY -> NEXT UNCERTAINTY) ───────────
function buildCard04 (ev, clusters, nextU) {
  const certainty = certaintyLine(ev, clusters)
  const to = `只验证一个问题：${nextU.question}`
  let worldRule = '先去掉一个不确定，比先找一个答案更有用。'
  if (ev.uncertaintyResponse === 'UNCERT_WAIT' || ev.uncertaintyResponse === 'UNCERT_ANALYZE') {
    worldRule = '这一次不等更确定的信号，就用这条回答来判断。'
  }
  // R53 §8 — UNPROVEN: the next step must be a LINK test, never a scale/重复 step.
  if (ev.noPrimaryScope === SCOPE_UNPROVEN && ev.provenAsset) {
    worldRule = '已经有市场验证，也不等于它就是要走的那条路；先把两者的连接验证出来。'
  }
  const text = [`现在：${certainty}。`, `接下来：${to}。`, worldRule].join('\n')
  const fields = ['asset.marketProof', 'executionStage'].concat(clusters.length ? clusters[0].sourceFields : [])
  return {
    title: '下一步先验证什么',
    from: certainty,
    to,
    worldRuleLine: worldRule,
    specificity: '',
    text,
    alignKey: nextU.id,
    provenance: prov(fields, ['Q6', 'Q7'])
  }
}

function certaintyLine (ev, clusters) {
  if (clusters.length && clusters[0].c04now) return clusters[0].c04now
  if (ev.assetState) {
    return {
      NO_CLEAR_ASSET: '还没有一个被市场验证过的可售能力',
      SKILL_IDENTIFIED_UNPROVEN: '有一个具体能力，但还没有人为它付过钱',
      SKILL_USED_FREE: '能力被人认可过，却一直没有产生收入',
      PROBLEM_SOLVING_PROOF: '能力解决过问题，但还没有人为此付过钱',
      PAID_ONCE: '已经有人为它付过一次钱，但还没证明能重复',
      OCCASIONAL_PAID: '已经有人零星付费，但一直不稳定',
      REPEATABLE_PAID: '已经有了能重复付费的客户，但还没形成体系'
    }[ev.assetState] || '已经有了一个可以继续推进的起点'
  }
  return `你已经${copy.getStageLead(ev.stage)}`
}

// ── CARD05 — 一个可逆实验 (aligned to CARD04) ───────────────────────────
function buildCard05 (ev, nextU) {
  const exp = NEXT_UNCERTAINTY[nextU.id]
  const occ = ev.occupation
  const lead = occ ? `先从你「${occ}」这个身份出发，` : ''
  let action = `${lead}${exp.action}`
  // Reality may RESIZE the action (never replace it): a no-budget squeeze.
  if (ev.maxTrialCost === 'COST_ZERO') {
    action = `${action}（这一步不额外花钱。）`
  }
  // Capacity sizing from the Hybrid context (weekly time + trial budget).
  const specificity = ev.sizingLine || ''
  const fields = ['asset.marketProof', 'capacity.weeklyTime', 'capacity.maxTrialCost']
  if (occ) fields.push('reality.occupation')
  return {
    title: '一个可逆实验',
    action,
    target: exp.target,
    verifyWith: exp.target,
    timebox: exp.timebox,
    done: exp.done,
    decision: exp.decision,
    specificity,
    externalSignal: true,
    eventPrimary: true,
    text: [
      `怎么做：${action}`,
      `找谁：${exp.target}；多久：${exp.timebox}`,
      `看什么：${exp.done}`,
      `怎么用它：${exp.decision}`
    ].join('\n'),
    alignKey: nextU.id,
    provenance: prov(fields, ['Q6', 'Q7'])
  }
}

function qidsFor (clusters) {
  const ids = []
  for (const c of clusters) {
    if (c.group === 'MARKET') { ids.push('Q6'); continue }
    if (c.id === 'DirectionUncertainty') { ids.push('Q4', 'Q5'); continue }
    if (c.id === 'SwitchingAfterNoResult') { ids.push('Q9', 'Q5'); continue }
    if (c.id === 'AbilityDoubt') { ids.push('Q5'); continue }
    if (c.id === 'ActionDelay') { ids.push('Q7'); continue }
    if (c.id === 'ShortTermDominance' || c.id === 'TimeScatter') { ids.push('Q8'); continue }
    if (c.id === 'RealityConstraint' || c.id === 'CashflowTight') { ids.push('Q3'); continue }
  }
  return ids.length ? ids : ['Q5', 'Q6']
}

function prov (fields, qids) {
  const f = []
  for (const x of fields) if (f.indexOf(x) === -1) f.push(x)
  const q = []
  for (const x of qids) if (x && q.indexOf(x) === -1) q.push(x)
  return { sourceFields: f, sourceQuestionIds: q, sourceRuleIds: [] }
}

/**
 * Build the first-class NO_PRIMARY five-card report.
 * @param {Object} diagnosis V6 diagnosis (diagnosisState = NO_PRIMARY)
 * @param {Object} [hybridContext] additive Hybrid report context (or null)
 * @returns {{cards:Object, evidenceClusters:Array, nextUncertainty:string,
 *   proofStage:string, proofStageProgression:string}}
 */
function buildNoPrimaryReportV6 (diagnosis, hybridContext) {
  const hy = hybridContext || null
  const ev = addNoPrimaryScope(mergeEvidence(diagnosis, hy))
  const clusters = selectEvidenceClusters(deriveEvidenceClusters(ev))
  const nextU = selectNextUncertainty(ev, ev.noPrimaryScope)

  const cards = {
    fatalInsight: buildCard01(ev, clusters),
    coreProblem: buildCard02(ev, hy),
    systemLoop: buildCard03(ev, clusters),
    turnaroundPath: buildCard04(ev, clusters, nextU),
    firstAction: buildCard05(ev, nextU)
  }

  const evidenceClusters = clusters.map((c, i) => ({
    slot: i === 0 ? 'evidenceClusterA' : 'evidenceClusterB',
    id: c.id,
    GROUP: c.group,
    EVIDENCE_STRENGTH: c.strength,
    SOURCE_FIELDS: c.sourceFields.slice(),
    WHY_INCLUDED: c.why
  }))

  return {
    cards,
    evidenceClusters,
    nextUncertainty: nextU.id,
    proofStage: nextU.proofStage,
    proofStageProgression: nextU.progression,
    noPrimaryScope: ev.noPrimaryScope,
    provenAsset: ev.provenAsset === true
  }
}

module.exports = {
  buildNoPrimaryReportV6,
  deriveEvidenceClusters,
  selectEvidenceClusters,
  selectNextUncertainty,
  addNoPrimaryScope,
  mergeEvidence,
  CLUSTER_DEFS,
  CLUSTER_IDS,
  NEXT_UNCERTAINTY,
  PROOF_STAGE_BY_INDEX
}
