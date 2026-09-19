'use strict'
/**
 * turnaroundStrategy/v6/thesis/cognitiveOsCardSchemaV2.js
 *
 * RC8.4 V6 R86-E — COGNITIVE OS CARD SCHEMA V2 (deterministic, NO LLM).
 *
 * Makes REPORTABLE_WORLD_MODEL + MODEL_REALITY_MISMATCH the true semantic owner
 * of the final visible five cards. R85 lower layers (RealEconomy / GameModel /
 * PricingPower) remain useful ONLY as REALITY_EVIDENCE / CONTEXT / APPLICATION.
 *
 * Every visible semantic unit is a STRUCTURED SLOT:
 *   { text, producer, authority, evidenceClass, supported, sourceEvidence[] }
 * An unsupported slot is NOT rendered (never a freeform legacy fill).
 *
 * AUTHORITY PRIORITY V2 (§17):
 *   1 reportable WorldModel/mismatch · 2 WorldModel reinforcement mechanism
 *   3 Model Upgrade · 4 WorldModel Reality Test · 5 Reality/Game evidence
 *   6 economic application · 7 B1 · 8 LLM style
 *
 * BOUNDARY: pure deterministic. No I/O. No AI. No network. No persistence.
 */

const { AXES, WORLD_MODEL_STATE_TEXT } = require('../hybrid/worldModelV1.js')
const COGNITIVE_SCHEMA_VERSION = 'r86e_cognitive_card_schema_v2'

// ── §19 deterministic producer tags ──────────────────────────────────────────
const PRODUCER = Object.freeze({
  WORLD_MODEL: 'WORLD_MODEL',
  MISMATCH: 'MISMATCH',
  REALITY: 'REALITY',
  GAME_MODEL: 'GAME_MODEL',
  PRICING_POWER: 'PRICING_POWER',
  B1: 'B1',
  LLM_STYLE: 'LLM_STYLE',
  LEGACY_TEMPLATE: 'LEGACY_TEMPLATE'
})

// Producers allowed to OWN a model-authority slot. Everything else is context.
const MODEL_AUTHORITY_PRODUCERS = Object.freeze([PRODUCER.WORLD_MODEL, PRODUCER.MISMATCH])
const CONTEXT_PRODUCERS = Object.freeze([PRODUCER.REALITY, PRODUCER.GAME_MODEL, PRODUCER.PRICING_POWER, PRODUCER.B1])

// ── §20 protected slots — legacy producers may NOT own these ─────────────────
const PROTECTED_SLOTS = Object.freeze({
  'CARD02.DEFAULT_MODEL': [PRODUCER.WORLD_MODEL],
  'CARD02.HOW_IT_INTERPRETS': [PRODUCER.WORLD_MODEL],
  'CARD03.MODEL': [PRODUCER.WORLD_MODEL],
  'CARD03.SHORT_TERM_REWARD': [PRODUCER.WORLD_MODEL, PRODUCER.REALITY],
  'CARD03.APPARENT_CONFIRMATION': [PRODUCER.WORLD_MODEL, PRODUCER.REALITY],
  'CARD03.REINFORCEMENT': [PRODUCER.WORLD_MODEL],
  'CARD03.LONG_TERM_COST': [PRODUCER.WORLD_MODEL, PRODUCER.MISMATCH],
  'CARD04.OLD_MODEL': [PRODUCER.WORLD_MODEL],
  'CARD04.NEW_MODEL': [PRODUCER.WORLD_MODEL, PRODUCER.MISMATCH],
  'CARD05.HYPOTHESIS': [PRODUCER.WORLD_MODEL],
  'CARD05.REALITY_TEST': [PRODUCER.WORLD_MODEL],
  'CARD05.OBSERVE': [PRODUCER.WORLD_MODEL],
  'CARD05.UPDATE_RULE': [PRODUCER.WORLD_MODEL]
})

/** §19/§20 — a protected slot is only valid when owned by an authorised producer. */
function slotAuthorized (slotName, producer) {
  const allowed = PROTECTED_SLOTS[slotName]
  if (!allowed) return true // non-protected slots have no producer restriction
  return allowed.indexOf(producer) !== -1
}

/** Build one structured slot (never invents; marks support explicitly). */
function slot (text, producer, evidenceClass, supported, sourceEvidence) {
  return {
    text: text == null ? '' : String(text),
    producer: producer,
    authority: (MODEL_AUTHORITY_PRODUCERS.indexOf(producer) !== -1) ? 'MODEL' : (producer === PRODUCER.LEGACY_TEMPLATE ? 'LEGACY' : 'CONTEXT'),
    evidenceClass: evidenceClass || 'DERIVED',
    supported: supported !== false,
    sourceEvidence: Array.isArray(sourceEvidence) ? sourceEvidence.slice() : []
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Per-axis deterministic content tables (driven by the REPORTABLE axis only).
// These are the WORLD_MODEL_REINFORCEMENT_MECHANISM + reality-test material.
// ────────────────────────────────────────────────────────────────────────────

// §11/§13 — why an incomplete model survives because reality rewards it SHORT TERM.
const REINFORCEMENT = Object.freeze({
  LABOR: {
    TIME_LINEAR: {
      reward: '投入更多时间，短期确实能看到更多产出与「我很努力」的踏实感',
      confirm: '产出随投入增加，被看成「这样就对了」',
      reuse: '于是下次遇到问题，第一反应还是继续加时间',
      cost: '时间被锁死在兑换里，一旦停下来，价值也跟着停'
    },
    REUSABLE_ASSET: {
      reward: '整理成可复用的东西，短期就让下一次省了力',
      confirm: '同样的做法能被重复调用，被看成「方法对了」',
      reuse: '于是更愿意沉淀而不是硬拼时间',
      cost: '可复用物还太少时，收益爬得偏慢，容易怀疑自己'
    },
    LEVERAGED: {
      reward: '把一部分交给别人或工具，短期产量上去了',
      confirm: '总产出明显增加，被看成「杠杆有效」',
      reuse: '于是倾向再放大杠杆而不是先确认真实需求',
      cost: '放大的方向若没验证，规模会把错误一起放大'
    },
    PRICING_POSITION: {
      reward: '先找更愿出价的人，短期单价看起来更高',
      confirm: '出现更高的报价，被看成「找对人了」',
      reuse: '于是到处找高价买家，而不是先固化价值',
      cost: '没有可重复交付时，高价依赖单次机会，不稳定'
    }
  },
  PROBABILITY: {
    BASE_RATE_AWARE: {
      reward: '先看比例，短期避开了明显不划算的赌注',
      confirm: '躲过几次明显冒险，被看成「判断稳」',
      reuse: '于是更依赖现成比例，而不是自己试出数据',
      cost: '只借用别人的比例，容易错过只有试过才知道的机会'
    },
    EXPERIMENT_FIRST: {
      reward: '先小步试，短期就拿到一点真实反馈',
      confirm: '试出来的小结果，被看成「方向能走」',
      reuse: '于是更愿意用可逆的小实验推进',
      cost: '实验若没有统一标准，容易积累一堆没法比较的结果'
    },
    CERTAINTY_SEEKING: {
      reward: '等到更确定再动，短期确实避开了踩错的风险',
      confirm: '没出手时也就没错，被看成「谨慎/稳」',
      reuse: '于是下一次仍然选择再等等',
      cost: '越等越拿不到能证伪的证据，确定性永远等不到'
    },
    RESULT_BIASED: {
      reward: '看到别人有结果就跟，短期省了自己判断的成本',
      confirm: '偶尔跟对一次，被看成「选得准」',
      reuse: '于是继续用别人的结果代替自己的判断',
      cost: '结果是你看到时已经发生的，轮到你时往往已过季'
    },
    RISK_BOUNDED: {
      reward: '先算占用与代价，短期避免了超支',
      confirm: '没被拖垮，被看成「理性」',
      reuse: '于是先算代价再谈机会',
      cost: '只算代价不算上行，容易把值得试的机会一起挡在门外'
    }
  },
  SYSTEM: {
    STRUCTURAL_FEEDBACK: {
      reward: '先看流程和激励，短期就能解释反复出现的现象',
      confirm: '用结构解释得通，被看成「看得透」',
      reuse: '于是更多去找机制而不是找人',
      cost: '结构解释若停在嘴上，不落到改法，仍然原地打转'
    },
    PERSON_ATTRIBUTION: {
      reward: '把问题归到「某个人不行」，短期情绪上立刻说得通',
      confirm: '换人后暂时顺一点，被看成「果然是人的问题」',
      reuse: '于是下次出事还是先找那个人',
      cost: '规则和激励没变，换了人结果还会重演'
    },
    PER_EVENT: {
      reward: '每次当独立事件看，短期不用总结就能接着做',
      confirm: '不用回头看，被看成「不纠结」',
      reuse: '于是继续每次从头判断',
      cost: '同样的坑反复踩，经验没法沉淀成规则'
    },
    NO_AWARENESS: {
      reward: '没细想过，短期也不用为解释负责',
      confirm: '不去想，就少了一层自我怀疑',
      reuse: '于是遇到反复出现的问题仍然不去想',
      cost: '反复出现的事一直没有可复用的解释'
    }
  },
  RULE: {
    RULE_AWARE: {
      reward: '先看谁定规则、谁定价，短期就少做了无效功',
      confirm: '避开了定错方向的努力，被看成「会看局」',
      reuse: '于是决策前先找规则制定者',
      cost: '只看不动时，看清规则却不改变位置，收益照样不变'
    },
    EFFORT_DEFAULT: {
      reward: '努力一点、做好一点，短期确实会有正反馈',
      confirm: '更好的交付换来夸奖或小涨，被看成「努力有用」',
      reuse: '于是下次还是先加努力',
      cost: '价格不由你定，努力抬高的是标准，不是定价权'
    },
    DEMAND_ROLE: {
      reward: '先看市场缺不缺人，短期更容易找到活',
      confirm: '有需求就有活，被看成「跟对风口」',
      reuse: '于是继续追下一个缺口',
      cost: '哪里缺人就去哪里，价值仍由对方按需求定价'
    },
    NO_AWARENESS: {
      reward: '不多想先把活干好，短期最省心',
      confirm: '活干好了暂时没人挑刺，被看成「踏实」',
      reuse: '于是继续只顾把活干好',
      cost: '不关心规则归属，就一直是别人在定价'
    }
  },
  EVIDENCE: {
    REPEATABLE_EVIDENCE: {
      reward: '用能不能重复来判断，短期避开了自我安慰',
      confirm: '重复验证通过，被看成「靠谱」',
      reuse: '于是更多依赖可重复的证据',
      cost: '只认重复证据时，早期只有一次的机会容易被自己否掉'
    },
    PRAISE_BASED: {
      reward: '靠别人的评价判断，短期就能拿到「我挺行」的确认',
      confirm: '被夸、被认可，被看成「做对了」',
      reuse: '于是下次还是先看别人怎么说',
      cost: '评价是别人给的，随人数和场合变，你无法拿它去定价'
    },
    LUCK_DISMISS: {
      reward: '把成绩归给运气，短期免了「下次还得再来一次」的压力',
      confirm: '不认领功劳，也就不会被要求复刻',
      reuse: '于是下一次仍然不追问「这次为什么成」',
      cost: '不追问就无法把偶然变成方法，成过也带不走'
    },
    UNREFLECTIVE: {
      reward: '不回头看直接做下一件，短期效率感最强',
      confirm: '一直在动，被看成「有行动力」',
      reuse: '于是继续不停下',
      cost: '不回头看，就分不清哪次是真进步、哪次只是忙碌'
    }
  }
})

// §16 — Card05 HYPOTHESIS / REALITY_TEST / OBSERVE / UPDATE_RULE per axis.
const REALITY_TEST_V2 = Object.freeze({
  LABOR: {
    hypothesis: '「投入更多时间」这套，是不是在别处也就不成立了？',
    test: '把手停几天：不再往里投入时间，看还剩什么在自动运转。',
    observe: '停手后仍然能带走、能复用、能被别人接着用的部分。',
    update: '若几乎什么都不剩，说明缺的不是更努力，而是可沉淀的东西。'
  },
  PROBABILITY: {
    hypothesis: '「先确定结果再行动」，是不是反而让你永远拿不到确定？',
    test: '在结果出来之前，先写下你的预测和把握程度，再对照结果。',
    observe: '你的判断命中的比例，以及把握程度和实际结果差多少。',
    update: '若把握很高却常常落空，说明该换的是「用样本比例试错」而不是继续等。'
  },
  SYSTEM: {
    hypothesis: '「换个人/这次不一样」，是不是在解释一件反复发生的事？',
    test: '动手改变之前，先画出这件事的激励结构与反馈回路：谁因此得到什么。',
    observe: '同一结果是否在你什么都没换的情况下又出现了。',
    update: '若换了人结果照旧，说明该看的是机制，不是人。'
  },
  RULE: {
    hypothesis: '「努力就是解法」，是不是在解释一件价格根本不由你定的事？',
    test: '行动之前，先分清：规则是谁定的、收益归谁、风险谁担。',
    observe: '你的投入增加时，价格的决定权有没有跟着移动。',
    update: '若努力只抬高了标准、没动到定价，说明该看的是规则和位置。'
  },
  EVIDENCE: {
    hypothesis: '「靠别人的评价/运气」，是不是在判断一件其实可以重复验证的事？',
    test: '先说清楚：什么情况出现，就说明你现在的看法是错的。',
    observe: '同样的判断在不同场合、由不同人给出时，是否一致。',
    update: '若只在自己被夸时才成立，说明该换成能被重复、能被推翻的证据。'
  }
})

function axisFor (wm) {
  if (!wm) return null
  if (wm.primaryAxis) return wm.primaryAxis
  return null
}

/**
 * §9 — Card01 MODEL↔REALITY COLLISION as TWO structured slots. Model half =
 * the reportable axis's own model; reality half = the mismatch code's grounded
 * reality note. Never only 定价者/买家/收入/职业/第二付款人.
 */
function card01Slots (wm, mismatch, v) {
  const axis = axisFor(wm)
  if (!axis) return null
  const ax = wm.axes[axis]
  const code = mismatch && mismatch.primaryCode
  const ev = mismatch && mismatch.evidence && mismatch.evidence[code]
  const realityNote = (ev && ev.note) || ''
  const reality = realityNote ? ('可现实里，' + realityNote) : '可现实并不按这套规则回报'
  // R85-D — when the XSG voice produced the shipped verdict, the COLLISION slot
  // text IS that verdict (structure unchanged; only the TEXT is XSG).
  const text = (v && v.card01) ? String(v.card01) : ('你习惯用「' + ax.stateText + '」理解这类事，' + reality + '。')
  return {
    COLLISION: slot(text, PRODUCER.WORLD_MODEL, 'OBSERVED', true, ax.primaryEvidence),
    REALITY_EVIDENCE: slot(reality, PRODUCER.REALITY, 'DERIVED', true, (ev && ev.reality) || []),
    text: text
  }
}

/** §9 — does Card01 carry a MODEL signal (not just economic nouns)? */
const CARD01_MODEL_PAT = /习惯|模型|理解|解释|判断|方式|规则|看法|标准/
const CARD01_ECON_ONLY_PAT = /^(?=.*(定价者|买家|付款人|收入|工资|职业|岗位))(?![^]*习惯|[^]*模型|[^]*理解|[^]*解释)/

function card01ModelSignalPresent (text) {
  const t = String(text || '')
  if (!t.trim()) return false
  return CARD01_MODEL_PAT.test(t)
}
function card01EconomicOnly (text) {
  const t = String(text || '')
  if (!t.trim()) return false
  return CARD01_ECON_ONLY_PAT.test(t)
}

/** §10 — Card02 DEFAULT_MODEL from the reportable axis (never UNKNOWN/MIXED).
 * Names the AXIS domain + the axis's own STATE so the SAME reality with a
 * DIFFERENT model yields a structurally different card (§26). */
const AXIS_DOMAIN = Object.freeze({
  LABOR: '这件事怎么才算有价值',
  PROBABILITY: '该在多确定的时候才出手',
  SYSTEM: '出问题时先看哪里',
  RULE: '事情按什么规则运转',
  EVIDENCE: '怎么判断自己做得对不对'
})
function card02DefaultModel (wm, v) {
  const axis = axisFor(wm)
  if (!axis) return null
  if (v && v.card02) return { text: String(v.card02), axis }
  const domain = AXIS_DOMAIN[axis] || '这类问题'
  return { text: '遇到「' + domain + '」这类问题，你通常用「' + wm.axes[axis].stateText + '」来解释。', axis }
}

// §10 — leak tokens that must NEVER appear as user identity.
const LEAK_TOKENS = /还看不清|你的模型是未知|未知模型|MIXED/

/** §11/§12/§13 — Card03 structured reinforcement-mechanism slots. */
function card03Slots (wm, v) {
  const axis = axisFor(wm)
  if (!axis) return null
  const st = wm.axes[axis].state
  const table = REINFORCEMENT[axis]
  const m = table && (table[st] || null)
  if (!m) return null
  const ax = wm.axes[axis]
  // R85-D — when the XSG voice produced the shipped reveal, the structured slots
  // carry the XSG steps/rule (structure unchanged; only the TEXT is XSG).
  if (v && v.card03) {
    const steps = Array.isArray(v.card03.steps) ? v.card03.steps : []
    return {
      MODEL: slot(steps[0] || ax.stateText, PRODUCER.WORLD_MODEL, 'OBSERVED', true, ax.primaryEvidence),
      SHORT_TERM_REWARD: slot(steps[1] || m.reward, PRODUCER.REALITY, 'DERIVED', true, []),
      APPARENT_CONFIRMATION: slot(steps[2] || m.confirm, PRODUCER.REALITY, 'DERIVED', true, []),
      REINFORCEMENT: slot(steps[3] || m.reuse, PRODUCER.WORLD_MODEL, 'DERIVED', true, ax.supportingEvidence),
      LONG_TERM_COST: slot(v.card03.rule || m.cost, PRODUCER.WORLD_MODEL, 'DERIVED', true, ax.supportingEvidence)
    }
  }
  return {
    MODEL: slot(ax.stateText, PRODUCER.WORLD_MODEL, 'OBSERVED', true, ax.primaryEvidence),
    SHORT_TERM_REWARD: slot(m.reward, PRODUCER.REALITY, 'DERIVED', true, []),
    APPARENT_CONFIRMATION: slot(m.confirm, PRODUCER.REALITY, 'DERIVED', true, []),
    REINFORCEMENT: slot(m.reuse, PRODUCER.WORLD_MODEL, 'DERIVED', true, ax.supportingEvidence),
    LONG_TERM_COST: slot(m.cost, PRODUCER.WORLD_MODEL, 'DERIVED', true, ax.supportingEvidence)
  }
}

/** §14 — Card04 OLD_MODEL / NEW_MODEL (+ optional REALITY_APPLICATION). */
function card04Slots (wm, mismatch, pricingPower, v) {
  const axis = axisFor(wm)
  if (!axis) return null
  const up = wm.reportableUpgrade
  if (!up) return null
  const app = (pricingPower && pricingPower.switchType && pricingPower.switchType.label) || null
  const appEvidence = (pricingPower && pricingPower.switchType && pricingPower.switchType.sourceEvidence) || []
  const hasApp = !!(v && v.card04 && v.card04.app) || !!app
  return {
    OLD_MODEL: slot((v && v.card04 && v.card04.from) || up.fromText, PRODUCER.WORLD_MODEL, 'OBSERVED', true, wm.axes[axis].primaryEvidence),
    NEW_MODEL: slot((v && v.card04 && v.card04.to) || up.toText, PRODUCER.WORLD_MODEL, 'DERIVED', true, wm.axes[axis].supportingEvidence),
    REALITY_APPLICATION: hasApp
      ? slot((v && v.card04 && v.card04.app) || app, PRODUCER.PRICING_POWER, 'DERIVED', true, appEvidence)
      : slot('', PRODUCER.PRICING_POWER, 'DERIVED', false, [])
  }
}

/** §16/§18 — Card05 HYPOTHESIS / REALITY_TEST / OBSERVE / UPDATE_RULE.
 * State-aware: the hypothesis + update rule reference the PRIMARY axis's own
 * STATE (not just the axis), so the SAME reality with a DIFFERENT model yields a
 * structurally different reality test (§26). */
function card05Slots (wm, v) {
  const axis = axisFor(wm)
  if (!axis) return null
  const t = REALITY_TEST_V2[axis]
  if (!t) return null
  const ax = wm.axes[axis]
  const stateText = ax.stateText
  const rein = (REINFORCEMENT[axis] && REINFORCEMENT[axis][ax.state]) || null
  const up = wm.reportableUpgrade
  const newModel = (up && up.toText) || (WORLD_MODEL_STATE_TEXT[ax.state] || '')
  const cost = (rein && rein.cost) || ''
  // R85-D — when the XSG voice produced the shipped test, the structured slots
  // carry the XSG goal/steps/acceptance (structure unchanged; only TEXT is XSG).
  if (v && v.card05) {
    const acts = Array.isArray(v.card05.actions) ? v.card05.actions : []
    return {
      HYPOTHESIS: slot(v.card05.goal || '', PRODUCER.WORLD_MODEL, 'HYPOTHESIS', true, ax.primaryEvidence),
      REALITY_TEST: slot(acts[0] || t.test, PRODUCER.WORLD_MODEL, 'DERIVED', true, ax.supportingEvidence),
      OBSERVE: slot(v.card05.acceptance || t.observe, PRODUCER.WORLD_MODEL, 'DERIVED', true, []),
      UPDATE_RULE: slot(acts[2] || acts[1] || (cost ? ('如果出现「' + cost + '」，就说明该换成「' + newModel + '」。') : t.update), PRODUCER.WORLD_MODEL, 'DERIVED', true, [])
    }
  }
  return {
    HYPOTHESIS: slot('你是不是一直用「' + stateText + '」这套，它是不是只在你现在这个场景里才成立？', PRODUCER.WORLD_MODEL, 'HYPOTHESIS', true, ax.primaryEvidence),
    REALITY_TEST: slot(t.test, PRODUCER.WORLD_MODEL, 'DERIVED', true, ax.supportingEvidence),
    OBSERVE: slot(t.observe, PRODUCER.WORLD_MODEL, 'DERIVED', true, []),
    UPDATE_RULE: slot(cost ? ('如果出现「' + cost + '」，就说明该换成「' + newModel + '」。') : t.update, PRODUCER.WORLD_MODEL, 'DERIVED', true, [])
  }
}

/** Combine supported slots into ONE visible step string (skips unsupported). */
function renderSteps (slots, keys) {
  const out = []
  for (const k of keys) {
    const s = slots[k]
    if (s && s.supported && String(s.text).trim()) out.push(String(s.text).trim())
  }
  return out
}

/** Collect every structured slot into a flat trace (test-only; never user-visible). */
function buildTrace (cards) {
  const trace = []
  const push = (card, name, s) => { if (s) trace.push({ card: card, slot: name, producer: s.producer, authority: s.authority, evidenceClass: s.evidenceClass, supported: s.supported, text: s.text, sourceEvidence: s.sourceEvidence }) }
  if (cards.card01) { push('card01', 'COLLISION', cards.card01.COLLISION); push('card01', 'REALITY_EVIDENCE', cards.card01.REALITY_EVIDENCE) }
  if (cards.card02) { push('card02', 'DEFAULT_MODEL', cards.card02.DEFAULT_MODEL); push('card02', 'HOW_IT_INTERPRETS', cards.card02.HOW_IT_INTERPRETS) }
  if (cards.card03) for (const k of ['MODEL', 'SHORT_TERM_REWARD', 'APPARENT_CONFIRMATION', 'REINFORCEMENT', 'LONG_TERM_COST']) push('card03', k, cards.card03[k])
  if (cards.card04) for (const k of ['OLD_MODEL', 'NEW_MODEL', 'REALITY_APPLICATION']) push('card04', k, cards.card04[k])
  if (cards.card05) for (const k of ['HYPOTHESIS', 'REALITY_TEST', 'OBSERVE', 'UPDATE_RULE']) push('card05', k, cards.card05[k])
  return trace
}

// ── §22 — final-visible unsupported psychology lexicon ──
const PSYCHOLOGY_LEX = /不敢动|不敢开始|不敢尝试|害怕|怕失败|怕被拒|舍不得|放不下|不愿意|不愿动|不敢面对|逃避|回避/
const PSYCHOLOGY_ALLOWED = { BELIEF_FEAR: /害怕|怕失败|怕被拒|不敢/ }

/** Count unsupported psychology on FINAL visible text (0 required). */
function countVisiblePsychology (texts, ctx) {
  const allowed = PSYCHOLOGY_ALLOWED[(ctx && ctx.selfBelief) || ''] || null
  let n = 0
  for (const t of texts) {
    const s = String(t || '')
    if (!s.trim()) continue
    if (PSYCHOLOGY_LEX.test(s)) {
      if (allowed && allowed.test(s)) continue
      n++
    }
  }
  return n
}

/**
 * R86-E §22 — FINAL-VISIBLE GROUNDING pass. Runs AFTER all R86 overrides and
 * inspects the FINAL visible text. Drops any SENTENCE carrying unsupported
 * psychology (不敢动/不敢开始/害怕/怕失败/舍不得/放不下/不愿意/不敢尝试 …)
 * unless the profile's selfBelief directly supports it. Text-preserving: only
 * removes offending sentences, never invents. Returns counts + repaired flag.
 */
function postGroundingV2 (cards, ctx) {
  const c = Object.assign({}, cards || {})
  const allowed = PSYCHOLOGY_ALLOWED[(ctx && ctx.selfBelief) || ''] || null
  const repaired = { dropped: 0 }
  const clean = (text) => {
    const s = String(text || '')
    if (!s.trim()) return ''
    const parts = s.split(/(?<=[。！？!?])/).map((x) => x.trim()).filter(Boolean)
    if (parts.length <= 1) {
      if (PSYCHOLOGY_LEX.test(s) && !(allowed && allowed.test(s))) { repaired.dropped++; return '' }
      return s
    }
    const kept = parts.filter((p) => {
      if (PSYCHOLOGY_LEX.test(p) && !(allowed && allowed.test(p))) { repaired.dropped++; return false }
      return true
    })
    return kept.join('')
  }
  if (typeof c.card01 === 'string') c.card01 = clean(c.card01)
  if (typeof c.card02 === 'string') c.card02 = clean(c.card02)
  if (c.card03) {
    if (Array.isArray(c.card03.steps)) c.card03.steps = c.card03.steps.map(clean).filter(Boolean)
    if (typeof c.card03.rule === 'string') c.card03.rule = clean(c.card03.rule)
  }
  if (c.card04) {
    for (const k of ['from', 'to', 'rule']) if (typeof c.card04[k] === 'string') c.card04[k] = clean(c.card04[k])
  }
  if (c.card05) {
    if (typeof c.card05.goal === 'string') c.card05.goal = clean(c.card05.goal)
    if (Array.isArray(c.card05.actions)) c.card05.actions = c.card05.actions.map(clean).filter(Boolean)
    if (typeof c.card05.acceptance === 'string') c.card05.acceptance = clean(c.card05.acceptance)
  }
  const finals = [c.card01, c.card02,
    c.card03 ? ((c.card03.steps || []).join('') + (c.card03.rule || '')) : '',
    c.card04 ? [c.card04.from, c.card04.to, c.card04.rule].filter(Boolean).join('') : '',
    c.card05 ? [c.card05.goal, (c.card05.actions || []).join(''), c.card05.acceptance].filter(Boolean).join('') : '']
  return { cards: c, counts: { VISIBLE_UNSUPPORTED_PSYCHOLOGY_COUNT: countVisiblePsychology(finals, ctx) }, repaired: repaired }
}

/** §25 — authority share by SEMANTIC UNIT (structured slots). */
function authorityShare (cards) {
  const trace = buildTrace(cards)
  let worldModel = 0
  let legacyEconomic = 0
  let total = 0
  for (const t of trace) {
    if (!t.supported || !String(t.text).trim()) continue
    total++
    if (t.producer === PRODUCER.WORLD_MODEL || t.producer === PRODUCER.MISMATCH) worldModel++
    else if ([PRODUCER.REALITY, PRODUCER.GAME_MODEL, PRODUCER.PRICING_POWER].indexOf(t.producer) !== -1) legacyEconomic++
  }
  const denom = total || 1
  return {
    totalUnits: total,
    worldModelUnits: worldModel,
    legacyEconomicUnits: legacyEconomic,
    WORLD_MODEL_VISIBLE_SHARE: Math.round((worldModel / denom) * 100) / 100,
    LEGACY_ECONOMIC_VISIBLE_SHARE: Math.round((legacyEconomic / denom) * 100) / 100
  }
}

module.exports = {
  COGNITIVE_SCHEMA_VERSION,
  PRODUCER,
  MODEL_AUTHORITY_PRODUCERS,
  CONTEXT_PRODUCERS,
  PROTECTED_SLOTS,
  slotAuthorized,
  slot,
  REINFORCEMENT,
  REALITY_TEST_V2,
  card01ModelSignalPresent,
  card01EconomicOnly,
  CARD01_MODEL_PAT,
  LEAK_TOKENS,
  card01Slots,
  card02DefaultModel,
  card03Slots,
  card04Slots,
  card05Slots,
  renderSteps,
  buildTrace,
  countVisiblePsychology,
  postGroundingV2,
  PSYCHOLOGY_LEX,
  authorityShare
}
