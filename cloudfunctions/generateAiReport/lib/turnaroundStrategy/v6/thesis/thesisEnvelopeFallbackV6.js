'use strict'
/**
 * turnaroundStrategy/v6/thesis/thesisEnvelopeFallbackV6.js
 *
 * RC8.4 V6 R68 — PRODUCT-GRADE DETERMINISTIC THESIS-ENVELOPE FALLBACK.
 *
 * When the AI thesis is rejected (validator) or fails (provider / parse) BUT the
 * deterministic ThesisEnvelope itself is valid, the user must NOT silently get
 * the low-value legacy R53 report (§20: VALID_ENVELOPE_TO_R53_FALLBACK_COUNT=0).
 * Instead a COMPLETE, product-grade five-card report is derived purely from the
 * envelope's frozen semantics:
 *
 *   currentValuePosition · allowedWorldRules[0] · allowedTargetPositions[0]
 *   experimentClass · crossAxisScope · assetState · marketProof · primaryProblem
 *   evidenceClusters
 *
 * HARD RULES:
 *   - ZERO new diagnosis: it INVENTS nothing the envelope does not already carry.
 *   - CARD04 always shows the REAL FROM -> TO migration (100%).
 *   - CARD05 is aligned to experimentClass (behavioural, never a generic
 *     willingness interview by default).
 *   - Consumer-safe copy ONLY: no internal enum names / ontology leakage.
 *   - Deterministic. No AI. No I/O. No network.
 */

const { WORLD_RULE_LIBRARY } = require('../report/worldRuleLibraryV6.js')

const VERSION = 'turnaround_strategy_v6_thesis_envelope_fallback_v1'

const len = (s) => (s == null ? 0 : [...String(s)].length)

// ── value position -> { position (card02), contradiction (card01) } ──
const VALUE_COPY = {
  VALUE_NONE_YET: {
    position: '你现在还没有一项被真实的人检验过的具体能力。',
    contradiction: '你想找到一个值得投入的方向，却还没有任何一项能力被真实的人检验过。'
  },
  VALUE_UNVALIDATED_SKILL: {
    position: '你有一项说得清的具体能力，但它还没有被市场回答过一次。',
    contradiction: '你手里有一项具体能力，却还没有让任何一个真实的人为它给出反馈。'
  },
  VALUE_UNPAID_PROVEN_HELP: {
    position: '你有一项被人认可过的能力，却一直以“帮忙”的形式流通，从没被真正定价。',
    contradiction: '你的能力被认可过，却从来没有被定过价，收入也就一直没法从它身上长出来。'
  },
  VALUE_ONE_OFF_PAID: {
    position: '你现在的位置：一项已经有人付过一次钱的能力。这一次付费证明了“这件事有人愿意买单”，但它只成交过一次——既不稳定，也还没证明能重复。',
    contradiction: '你已经拿到过一次真实的付费结果，却还没有把这一次成交，接回你眼下真正想走的那条路。'
  },
  VALUE_REPEATABLE_PAID: {
    position: '你已经有能重复付费的客户，这件事本身已经跑通，缺的是把它固定成不依赖你临场发挥的方法。',
    contradiction: '你已经能重复成交，却一直没有把“为什么会成”变成别人也能照着做的步骤。'
  },
  VALUE_UNCLEAR: {
    position: '你手上已经有一些真实线索，但它们还没有被单独验证过。',
    contradiction: '你手上已经有真实线索，却一直没有把它单独拿出来，交给现实回答一次。'
  }
}

// ── CARD03 mechanism steps, scope-aware (one allowed rule lens) ──
function mechanismSteps (env) {
  const scope = env.crossAxisScope
  const vp = env.currentValuePosition
  if (env.diagnosisState === 'NO_PRIMARY' && scope === 'UNPROVEN') {
    return [
      '你已经让市场为它付过一次钱，这说明它真的能换钱。',
      '但你眼下想解决的问题是另一个：一次成交只能证明“它卖得掉”，证明不了“它就是这条路”。',
      '如果把一次成交直接当成方向去做大，等于用一个还没验证的假设，替代一次真实的检验。',
      '所以真正要验证的，不是这项能力行不行，而是它和你当前目标之间到底连不连得上。'
    ]
  }
  if (vp === 'VALUE_ONE_OFF_PAID' || vp === 'VALUE_REPEATABLE_PAID') {
    return [
      '你已经让市场为它付过钱，说明这件事本身跑得通。',
      '但它能不能继续，取决于“为什么会有这次结果”有没有被说清楚。',
      '说不清的部分如果一直没被单独验证，下一次就只能继续靠运气。',
      '所以下一步不是再成交一次，而是把这次成交的原因变成可重复的做法。'
    ]
  }
  if (vp === 'VALUE_UNPAID_PROVEN_HELP' || vp === 'VALUE_UNVALIDATED_SKILL') {
    return [
      '这项能力一直停在“被认可”，从来没有进入过一次真实的交易。',
      '没有交易，就拿不到价格信号；没有价格信号，方向只能靠猜。',
      '把能力说得好没有用，市场只看有没有人愿意为它付出代价。',
      '所以先让它第一次进入交易，用一次真实的付费或拒绝来回答。'
    ]
  }
  return [
    '你手上已经有真实的线索，但它们还没有被单独拿走、验证过一次。',
    '这些线索放在一起时方向并不唯一，所以没有一个原因清楚到可以先行动。',
    '与其继续整体纠结，不如先挑一条最具体的线索，交给现实回答一次。',
    '一条新的真实信息，就能让下一步比现在更清楚。'
  ]
}

// ── CARD05 — experiment aligned to experimentClass (behavioural) ──
const EXPERIMENT_COPY = {
  LINK_TEST: {
    primary: '选1个正在做你目标方向那件事的人，用这项已经被付过钱的能力，帮他把其中一件具体的事往前推一小步，看他是不是真的需要、并愿意为这一步付出真实代价。',
    supporting: ['先写下你目标方向里最关键的一件具体的事', '再把这项能力对应的一种最小做法写清楚'],
    target: '1个正在做你目标方向那件事的人',
    timebox: '3天内完成',
    successSignal: '对方真的让你做了这一小步，并愿意为此付出时间、资源或钱，而不只是口头说“用得上”。'
  },
  FIRST_PAID_PROOF: {
    primary: '把这项能力做成一个具体、可交付、说得清结果的最小交付，向1个曾经认可过你的人正式提出一次低风险测试价，看他是不是真的付费。',
    supporting: ['把交付结果写成一句“帮你做到什么”', '价格先定成一个低风险测试价，不追求数字'],
    target: '1个曾经认可或帮过的你的人',
    timebox: '7天内完成',
    successSignal: '对方真的为这次交付付了钱，或给出一个明确的付费条件。'
  },
  WILLINGNESS_TO_PAY: {
    primary: '不要只问意愿：把这项能力做成一个具体的最小交付，向目标的人正式提出一次低风险测试价，用他是否付费来判断。',
    supporting: ['把交付写成一个能当场兑现的小结果', '先定一个低风险测试价'],
    target: '1个你实实在在帮过的人',
    timebox: '24小时内完成',
    successSignal: '对方真的付了钱，或明确拒绝——而不是含糊地说“可以”。'
  },
  REPEAT: {
    primary: '回到已经付过钱的那1个人身上，用一次新的、具体的交付再成交一次，验证第一次付费能不能重复出现。',
    supporting: ['先复述他上一次为什么买', '再照着同样的理由做一次新的交付'],
    target: '已经付过钱的那个人',
    timebox: '7天内完成',
    successSignal: '对方为第二次交付再次付费，或明确不会再买。'
  },
  PATTERN: {
    primary: '把已经成交过的对象和场景排一遍，找出成交最多的那一类，再去找1个同类的新人验证这类人是不是更容易重复成交。',
    supporting: ['把现有成交对象按类型分一分', '挑出现次数最多的那一类'],
    target: '成交最多的那一类里的1个新人',
    timebox: '24小时内完成',
    successSignal: '同类新人给出一致的反馈，能与老客户的说法对照。'
  },
  SYSTEMATIZE: {
    primary: '把已经稳定成交的那套动作写成一步步的清单，交给另1个人照着走一遍，看这套流程能不能脱离你本人复现。',
    supporting: ['把有效那次的步骤逐条写下来', '找一个能替你执行的人照着试一遍'],
    target: '1个能替你执行的人',
    timebox: '7天内完成',
    successSignal: '这份清单能被另一个人照着走通，或拿到1条明确的卡点反馈。'
  },
  BUYER_SIGNAL: {
    primary: '把东西做到能被真实的人评估的程度，先向1个真实目标用户要一次明确的买单或拒绝反馈。',
    supporting: ['把结果做到可以拿给人看', '直接要一个明确的买或不买'],
    target: '1个真实的目标用户',
    timebox: '3天内完成',
    successSignal: '对方给出明确的买单或拒绝，而不是“再看看”。'
  },
  SMALLEST_EXTERNAL_TEST: {
    primary: '挑一个最小、最省成本的版本，直接交给1个真实的人试用一次，换回一条外部反馈。',
    supporting: ['把测试缩到一步能做完', '只换一条反馈就停'],
    target: '1个真实的人',
    timebox: '3天内完成',
    successSignal: '拿到1条来自真实反馈，而不是自己推演出来的结论。'
  },
  NARROW_DIRECTION: {
    primary: '从几个可能的方向里只挑一个，先做一次能做到的最小动作，用一次真实反馈判断这个方向值不值得继续。',
    supporting: ['把备选方向收敛到一个', '只设计一个能做到的最小动作'],
    target: '1个真实的人或1次真实反馈',
    timebox: '7天内完成',
    successSignal: '拿到1条能用来判断方向去留的真实反馈。'
  },
  CONSISTENCY_CADENCE: {
    primary: '把这件事绑进一个固定的时间点，先连续做满一周不断档，用“有没有断”来判断能不能走远。',
    supporting: ['定一个固定时段', '只记录做没做，不做别的判断'],
    target: '你自己，连续一周',
    timebox: '连续7天，每天固定时段',
    successSignal: '一周结束没有断档，拿到一个稳定的小结果。'
  },
  CASHFLOW_SAFE_TEST: {
    primary: '用一个几乎不花钱、不影响现金流的方式，先做一次最小的真实测试，只换回一条判断信息。',
    supporting: ['把成本压到接近零', '只求一条能判断去留的信息'],
    target: '1个真实的人或场景',
    timebox: '7天内完成',
    successSignal: '在不伤现金流的前提下，拿到一条能判断去留的真实反馈。'
  }
}

// ── helpers ──
function firstWorldRule (env) {
  const ids = env.allowedWorldRules || []
  const id = ids[0] || null
  const lib = id && WORLD_RULE_LIBRARY[id]
  return {
    id: id,
    statement: (lib && lib.statement) || '先把判断交给真实的人，而不是交给脑子里的推演。'
  }
}

function migrationOf (env) {
  const pos = (env.allowedTargetPositions || [])[0]
  if (pos && pos.from && pos.to) return { id: pos.id || null, from: pos.from, to: pos.to }
  // Fail-safe generic one-step (still truthful, no new diagnosis).
  return { id: null, from: '停在“想清楚再做”的状态', to: '先用一次最小的真实动作换回一条反馈' }
}

function experimentOf (env) {
  const ec = env.experimentClass
  return EXPERIMENT_COPY[ec] || EXPERIMENT_COPY.SMALLEST_EXTERNAL_TEST
}

function valueCopy (env) {
  return VALUE_COPY[env.currentValuePosition] || VALUE_COPY.VALUE_UNCLEAR
}

function clamp (s, n) {
  const a = [...String(s)]
  return a.length <= n ? String(s) : a.slice(0, n - 1).join('') + '…'
}

/**
 * Build the product-grade deterministic Thesis-Envelope fallback report.
 * @param {Object} envelope valid ThesisEnvelope
 * @param {Object} [fallbackReport] R53 report (for provenance/reportVersion)
 * @returns {Object} five-card report (same shape the thesis path maps to)
 */
function buildEnvelopeFallbackReport (envelope, fallbackReport) {
  const env = envelope || {}
  const fb = fallbackReport || {}
  const fc = fb.cards || {}
  const prov = (k) => (fc[k] && fc[k].provenance) || { sourceFields: [], sourceQuestionIds: [], sourceRuleIds: [] }

  const vc = valueCopy(env)
  const rule = firstWorldRule(env)
  const mig = migrationOf(env)
  const exp = experimentOf(env)

  const card01 = clamp(vc.contradiction, 50)
  const card02 = clamp(vc.position, 160)
  const steps = mechanismSteps(env).map((s) => s)
  const card03 = steps
  const card04From = mig.from
  const card04To = mig.to
  const card04Logic = `先用一次最小的真实动作，把“${card04To}”验证出来，再决定要不要继续往前。`

  const cards = {
    fatalInsight: { title: '致命一句话', text: card01, provenance: prov('fatalInsight') },
    coreProblem: { title: '核心问题', text: card02, provenance: prov('coreProblem') },
    systemLoop: {
      title: '系统困局',
      steps: card03,
      insight: card03[card03.length - 1],
      family: (fc.systemLoop && fc.systemLoop.family) || null,
      shape: (fc.systemLoop && fc.systemLoop.shape) || null,
      header: (fc.systemLoop && fc.systemLoop.header) || null,
      form: (fc.systemLoop && fc.systemLoop.form) || null,
      text: card03.join('\n'),
      provenance: prov('systemLoop')
    },
    turnaroundPath: {
      title: '翻身路径',
      from: card04From,
      to: card04To,
      logic: card04Logic,
      display: card04To,
      worldRuleLine: rule.statement,
      specificity: (fc.turnaroundPath && fc.turnaroundPath.specificity) || '',
      text: [card04From, card04To, card04Logic].filter(Boolean).join('\n'),
      provenance: prov('turnaroundPath')
    },
    firstAction: {
      title: '现在就做',
      action: exp.primary,
      hypothesis: exp.primary,
      target: exp.target,
      checks: exp.supporting.slice(),
      timebox: exp.timebox,
      verifyWith: exp.target,
      done: exp.successSignal,
      decision: exp.successSignal,
      specificity: (fc.firstAction && fc.firstAction.specificity) || '',
      externalSignal: true,
      eventPrimary: true,
      text: [exp.primary, (exp.supporting || []).join(' / '), exp.target, exp.timebox, exp.successSignal].filter(Boolean).join('\n'),
      provenance: prov('firstAction')
    }
  }

  return {
    reportVersion: fb.reportVersion || 'turnaround_strategy_v6_report_v1',
    reportState: fb.reportState || (env.diagnosisState || 'NO_PRIMARY'),
    fallbackLayer: VERSION,
    cards: cards,
    strategicThesis: {
      identityInterpretation: card02,
      coreContradiction: card01,
      structuralMechanism: card03.join(' '),
      worldRule: { id: rule.id, expression: rule.statement },
      strategicMigration: { id: mig.id, from: mig.from, to: mig.to, logic: card04Logic },
      commercialHypothesis: { class: null, intent: '', text: exp.primary },
      actionThesis: { experimentClass: env.experimentClass || null, testTarget: exp.target, successSignal: exp.successSignal, text: exp.successSignal }
    },
    provenance: fb.provenance || {}
  }
}

module.exports = {
  buildEnvelopeFallbackReport,
  VERSION,
  EXPERIMENT_COPY,
  VALUE_COPY,
  mechanismSteps
}
