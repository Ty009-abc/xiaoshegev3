'use strict'
/**
 * turnaroundStrategy/v6/hybrid/proofConsistencyV6.js
 *
 * RC8.4 V6 R46 §6–§11 — MARKET-PROOF FACT CONSISTENCY layer.
 *
 * AUTHORITY ORDER (R46 §6):
 *     USER EVIDENCE / MARKET PROOF  >  USER-VISIBLE STRATEGY COPY
 * A generic B2 phrase may NEVER contradict a known Hybrid market-proof fact.
 *
 * SCOPE OF THIS FILE:
 *   The asset/proof axis has ZERO bottleneck authority, but it DOES have FACTUAL
 *   authority over statements about the user's market position:
 *     has never sold · has sold once · has occasional paid demand · has repeat
 *     customers · has repeatability, etc.
 *   This module produces proof-aware OVERRIDES for those statements so the final
 *   user-visible card is internally coherent (R46 §10: no suffix patching).
 *
 * HARD BOUNDS (R46 §11): proof-aware wording NEVER changes firstActionType,
 *   primaryBottleneck, secondaryConstraint, beliefRealityGap or executionStage.
 *   It only replaces the wording of cards that ASSERT a market fact.
 *
 * States (asset ladder index 0..6):
 *   0 NO_CLEAR_ASSET · 1 SKILL_IDENTIFIED_UNPROVEN · 2 SKILL_USED_FREE
 *   3 PROBLEM_SOLVING_PROOF · 4 PAID_ONCE · 5 OCCASIONAL_PAID · 6 REPEATABLE_PAID
 *
 * CONSUMER LAYER ONLY. Deterministic. No AI. No I/O. No network.
 */

// ── §7 — ALLOWED / FORBIDDEN user-visible claims per state ──────────────
// `forbidden` are substrings/patterns that must NEVER appear in the final
// user-visible report for that state (they assert a contradicting fact).
const CLAIM_CONTRACT = {
  NO_CLEAR_ASSET: {
    allowed: ['还没有明确被市场验证的可售能力', '先让一个真实的人愿意为它付第一笔钱'],
    forbidden: ['已经有人为它付过钱', '已经有稳定客户', '偶尔有付费需求']
  },
  SKILL_IDENTIFIED_UNPROVEN: {
    allowed: ['有一个具体能力', '还没有被市场验证过'],
    forbidden: ['已经有人为它付过钱', '已经有稳定客户', '偶尔有付费需求']
  },
  SKILL_USED_FREE: {
    allowed: ['有人用过、也认可', '一直没有产生收入'],
    forbidden: ['已经有人为它付过钱', '已经有稳定客户', '偶尔有付费需求', '被人付过一次钱']
  },
  PROBLEM_SOLVING_PROOF: {
    allowed: ['解决过别人的问题', '还没人为此付过钱'],
    forbidden: ['已经有人为它付过钱', '已经有稳定客户', '偶尔有付费需求', '被人付过一次钱']
  },
  PAID_ONCE: {
    allowed: ['已经有人为它付过一次钱', '验证这项能力能否被重复购买', '还没证明需求能重复'],
    forbidden: ['却没卖出去', '没卖出去', '为什么没买', '从来没人愿意付', '还没被市场验证', '没有被市场碰过', '没有任何市场验证', '市场并不认', '从未让市场真正回答过', '市场却从来没有真正回答过']
  },
  OCCASIONAL_PAID: {
    allowed: ['已经有断断续续的付费需求', '缺的是稳定', '搞清谁会反复买'],
    forbidden: ['却没卖出去', '没卖出去', '为什么没买', '从来没人愿意付', '还没被市场验证', '没有被市场碰过', '没有任何市场验证', '市场并不认', '从未让市场真正回答过', '只拿到过一次付费']
  },
  REPEATABLE_PAID: {
    allowed: ['已经有了能重复付费的客户', '把这套已经跑通的模式放大'],
    forbidden: ['却没卖出去', '没卖出去', '为什么没买', '从来没人愿意付', '还没被市场验证', '没有被市场碰过', '没有任何市场验证', '市场并不认', '从未让市场真正回答过', '去拿第一笔钱', '第一次真实反馈']
  }
}

// Band per asset state (paid bands get strategy/action overrides).
const PAID_BANDS = { PAID_ONCE: true, OCCASIONAL_PAID: true, REPEATABLE_PAID: true }

// ── §8 — CARD04 "现在" (FROM) is a pure market-position FACT (all states) ──
const CARD04_FROM_FACT = {
  NO_CLEAR_ASSET: '还没有一个被市场验证过的可售能力',
  SKILL_IDENTIFIED_UNPROVEN: '有一个具体能力，但还没有人为它付过钱',
  SKILL_USED_FREE: '能力被人认可过，却一直没有产生收入',
  PROBLEM_SOLVING_PROOF: '能力实实在在解决过问题，但还没有人为此付过钱',
  PAID_ONCE: '已经有人为它付过一次钱，但还没证明需求能重复',
  OCCASIONAL_PAID: '已经有人零星付费，但一直不稳定',
  REPEATABLE_PAID: '已经有了能重复付费的客户，但还没形成体系'
}

// ── §8/§9 — CARD04 "接下来" (TO) proof-refined for paid bands ──
// [assetState][bottleneck] -> new-rule target (stays within bottleneck strategy).
const CARD04_TO = {
  PAID_ONCE: {
    DIRECTION_GAP: '选一个已经被付费验证过的方向，做一次低成本重复验证',
    ACTION_GAP: '对已经买过的人做第二个更小的交付',
    CONSISTENCY_GAP: '把已经成交过的那个动作固定成节奏',
    VALIDATION_GAP: '验证谁会再次购买，以及为什么买',
    REPEATABILITY_GAP: '把这一次成交拆成可以重复的步骤'
  },
  OCCASIONAL_PAID: {
    DIRECTION_GAP: '锁定已经被付费验证的方向，做成固定供给',
    ACTION_GAP: '把偶尔发生的成交固定成一个标准动作',
    CONSISTENCY_GAP: '把零星成交固定成稳定的交付节奏',
    VALIDATION_GAP: '搞清谁会反复买、以及为什么反复买',
    REPEATABILITY_GAP: '把零星的成交沉淀成可重复的路径'
  },
  REPEATABLE_PAID: {
    DIRECTION_GAP: '把已经跑通的方向放大，而不是再换方向',
    ACTION_GAP: '把已经跑通的动作继续放大',
    CONSISTENCY_GAP: '把已经稳定的节奏固化成流程',
    VALIDATION_GAP: '确认新客户也能被同一套方式成交',
    REPEATABILITY_GAP: '把已经跑通的模式放大成规模'
  }
}

// ── §9 — CARD02 leap proof-refined (only where the base copy asserts proof) ──
// [assetState][bottleneck] -> replacement leap sentence.
const CARD02_LEAP = {
  PAID_ONCE: {
    VALIDATION_GAP: '但你只拿到过一次付费回答——要的是它能被重复，而不是再一次自我确认。',
    ACTION_GAP: '但你已经动过一次手了；现在缺的不是开始，而是让这次结果能稳定复现。',
    CONSISTENCY_GAP: '但一次成交还撑不起稳定的积累；要的是把它接成不断档的节奏。'
  },
  OCCASIONAL_PAID: {
    VALIDATION_GAP: '但你已经有人零星付费了——缺的不是“有没有人买”，而是“能不能稳定地反复买”。',
    ACTION_GAP: '但你已经能偶尔成交了；现在缺的是把它变成一个固定、可重复的动作。',
    CONSISTENCY_GAP: '但零星成交还形不成积累；要的是把交付固定成不断档的节奏。'
  },
  REPEATABLE_PAID: {
    VALIDATION_GAP: '但你已经有了能重复付费的客户——现在要验证的是这套方式能不能复制到新客户身上。',
    ACTION_GAP: '但你已经跑通了成交；现在缺的是把这套动作放大，而不是重新开始。',
    CONSISTENCY_GAP: '但你已经能稳定交付；现在缺的是把它固化成流程，而不是靠状态。'
  }
}

// ── §9 — CARD03 loop/contradiction/reframe proof-refined for paid bands ──
// [assetState][bottleneck] -> { steps:[5], insight }.
const CARD03 = {
  PAID_ONCE: {
    DIRECTION_GAP: {
      steps: [
        '你已经有人为你的方向付过钱，说明至少有一个方向是走得通的。',
        '但你把它当成一次偶然，没有继续问：这个方向还能不能被重复验证。',
        '于是你把已经成立的反馈放回一边，又回到“该选哪个方向”的循环里。',
        '可已经拿到的那次付费，恰恰是最值得继续追下去的线索。',
        '转得越久，你越容易把已经跑通的方向也一起换掉。'
      ],
      insight: '你已经让一个方向被现实验证过一次，却还没把它继续追下去。'
    },
    ACTION_GAP: {
      steps: [
        '你已经动过手，也拿到过一次付费结果。',
        '但你把它当成运气，没有把这次做法固定下来。',
        '于是一遇到不确定，你又退回“等准备好再开始”。',
        '可已经拿到的那次结果，说明你其实早就有能力开始。',
        '你越等，越是在把一个已经被验证过的事实丢在一边。'
      ],
      insight: '你已经开始过，也拿到过结果，缺的是把它重复出来。'
    },
    VALIDATION_GAP: {
      steps: [
        '你已经有人愿意付过一次钱，说明这个能力真的能换钱。',
        '但你很快又把注意力放回“再打磨得更好一点”，而不是问下一次谁会买。',
        '于是一次成交只能算一次事件，原因没有被市场再回答一次。',
        '所以你要的不是再优化，而是让市场再告诉你一次：它会不会重复。',
        '真正管用的，是让它被重复购买；在那之前，一次成功还说明不了模式。'
      ],
      insight: '你已经拿到过一次付费回答，但还没证明它能重复。'
    }
  },
  OCCASIONAL_PAID: {
    DIRECTION_GAP: {
      steps: [
        '你已经有人零零星星为你的方向付费，说明这个方向本身是成立的。',
        '但你每次都在重新找方向，而不是把已经有效的那个方向做深。',
        '于是成交时有时无，你也分不清是方向问题还是做法问题。',
        '可你已经拿到的付费，正是这个方向值得继续的证据。',
        '再换方向，等于把已经验证过的线索丢掉重来。'
      ],
      insight: '你的方向已经被现实验证过多次，缺的是把它做深而不是再换。'
    },
    ACTION_GAP: {
      steps: [
        '你已经能偶尔成交，说明你完全做得到。',
        '但你每次都靠临场发挥，没有把“为什么会成”固定成一个动作。',
        '于是一遇到不确定，你还是先停下来等更好的时机。',
        '可结果已经发生过多次，说明问题不在“能不能开始”。',
        '你越等，越是在重复一个已经过期的顾虑。'
      ],
      insight: '你已经能反复开始并成交，缺的是把动作固定下来。'
    },
    VALIDATION_GAP: {
      steps: [
        '你已经有人零星付费了，说明需求是真的。',
        '但你每次都是靠临场发挥成交，没有把“为什么会成”固定下来。',
        '于是收入时有时无，你也不知道下一次能不能再成。',
        '所以你要的不是再多接几单，而是找到那个能反复成交的动作。',
        '真正管用的，是把零星成交变成稳定的供给和交付。'
      ],
      insight: '你有过付费需求，却还没把它变成稳定的成交方式。'
    }
  },
  REPEATABLE_PAID: {
    DIRECTION_GAP: {
      steps: [
        '你已经能反复从同一个方向赚到钱，说明方向本身没问题。',
        '但你还在用“找方向”的方式思考，而不是把它做成一套固定做法。',
        '于是每次都要重新组织一遍，规模始终没起来。',
        '可这个方向已经被验证过很多次了，该做的是放大它。',
        '继续换方向，只会浪费已经跑通的那条路。'
      ],
      insight: '你的方向已经反复被验证，缺的是放大而不是重选。'
    },
    ACTION_GAP: {
      steps: [
        '你已经能稳定地做成这件事，并从中赚到钱。',
        '但你仍然把它当成随时会断的事，靠状态维持。',
        '于是一遇到波动，你还是想回到“再准备一下”。',
        '可你早就证明了自己做得到，该做的是把做法固化。',
        '继续等，只会拖慢一个已经成立的事。'
      ],
      insight: '你已经跑通了这件事，缺的是把它变成稳定的机制。'
    },
    VALIDATION_GAP: {
      steps: [
        '你已经有了能重复付费的客户，说明这套做法是成立的。',
        '但它目前靠的是你个人的手感，还没有变成别人也能照着做的流程。',
        '于是规模被你自己卡住，多一个客户就多一份不确定。',
        '所以你要的不是再亲手做一遍，而是把这套方式固定成可复制的流程。',
        '真正管用的，是让这套模式能被复制、被放大。'
      ],
      insight: '你已经能重复赚到钱，缺的是把它变成可复制的模式。'
    }
  }
}

// ── §9/§11 — CARD05 proof-aware action (paid bands only; action TYPE intact) ──
// [assetState][actionType] -> { action, target, done, decision }.
const CARD05 = {
  PAID_ONCE: {
    DIRECTION_NARROWING: {
      action: '今天把已经付过钱的这个方向写清楚：为谁解决什么问题，再找1个同类的人问一句“你也需要吗？”。',
      target: '已经付过钱的那类人里的3个（先问第1个）',
      done: '至少1个同类的人明确回复“我要”或“我不要”，而不是“还行”。',
      decision: '先看这个方向的反馈是否与已成交的一致；一致就继续做深，不一致再小范围调整。'
    },
    SMALLEST_EXTERNAL_TEST: {
      action: '今天挑一个已经买过的人，做一个更小、更明确的第二次交付，拿到他的反馈。',
      target: '1个已经买过的人',
      done: '他给出至少1条关于这次交付的具体反馈（哪怕是否定）。',
      decision: '这条反馈只用来改下一步——还不足以下“能重复”的结论。'
    },
    CONSISTENCY_PROTECTION: {
      action: '从今天起，把已经成交过的那个动作，每天固定做一遍，连续5天。',
      target: '每天1个新的同类对象',
      done: '每天的成交动作都真的发生，并且至少带来1条外部回应。',
      decision: '看外部回应是否在累积；若只有“做完5天”而没有回应，先换动作而不是加长天数。'
    },
    BUYER_FEEDBACK_COLLECTION: {
      action: '今天找3个已经买过或看过的人，问清楚：什么情况下你会再买一次？',
      target: '3个已经买过或看过的人',
      done: '至少1个人讲清他会不会再买、以及在什么条件下会买（不是“还行”）。',
      decision: '只要有人讲清再买的条件，就按这个条件固定做法，不再自己猜。'
    },
    CASHFLOW_SAFE_EXPERIMENT: {
      action: '今天用不额外花钱的方式，把已经付过钱的那次成交再复现一遍。',
      target: '1个已经买过或同类的新用户',
      done: '再复现1次成交，或拿到1条明确的外部回应。',
      decision: '只要能不额外花钱地再复现一次，就说明这条路可重复；否则先缩小动作。'
    }
  },
  OCCASIONAL_PAID: {
    DIRECTION_NARROWING: {
      action: '今天把已经零星成交的方向写清楚：那几次是怎么成的，再找1个同类的人验证。',
      target: '1个同类的人',
      done: '至少1个人明确回复“我要”或“我不要”。',
      decision: '只要反馈与已有成交方向一致，就把这个方向固定下来，不再另找新方向。'
    },
    SMALLEST_EXTERNAL_TEST: {
      action: '今天把已经有人买过的东西整理成一个能重复交付的最小版本，发给1个新用户。',
      target: '1个新用户',
      done: '新用户给出至少1条具体反馈（哪怕是否定）。',
      decision: '这条反馈只用来改下一步，不足以说明这套交付已经能稳定复制。'
    },
    CONSISTENCY_PROTECTION: {
      action: '从今天起，把成交过的那个动作固定成每天一次的节奏，连续5天。',
      target: '每天1个新的同类对象',
      done: '每天的成交动作都发生，并带来可观察的外部回应。',
      decision: '看外部回应是否在累积；只有“完成次数”而没有回应，就不算跑通。'
    },
    BUYER_FEEDBACK_COLLECTION: {
      action: '今天找3个最近买过的人，问清楚：你为什么会选我，下次还会不会再买？',
      target: '3个最近买过的人',
      done: '至少1个人讲清他反复买的理由（或明确说不会），而不是一句泛泛的好评。',
      decision: '只要有人讲清反复买的理由，就把它固定成默认做法，不再靠临场发挥。'
    },
    CASHFLOW_SAFE_EXPERIMENT: {
      action: '今天用不额外花钱的方式，把最近一次成交的路径再走一遍。',
      target: '1个同类的新用户',
      done: '再成交1次，或拿到1条明确的外部回应。',
      decision: '只要能不额外花钱地再走通一次，就说明这条路可复制；否则先缩小动作。'
    }
  },
  REPEATABLE_PAID: {
    DIRECTION_NARROWING: {
      action: '今天把已经稳定成交的方向写清楚：稳定的客户是怎么来的，再找1个同类的人验证。',
      target: '1个同类的人',
      done: '至少1个人明确回复“我要”或“我不要”。',
      decision: '只要同类人给出一致反馈，就把这个方向确认为主线，转向放大而不是重选。'
    },
    SMALLEST_EXTERNAL_TEST: {
      action: '今天把已经稳定的交付整理成一个标准版本，发给1个新用户看。',
      target: '1个新用户',
      done: '新用户给出至少1条具体反馈，或明确表示要买。',
      decision: '用这条反馈判断这套标准交付能不能直接复制给新客户。'
    },
    CONSISTENCY_PROTECTION: {
      action: '从今天起，把已经稳定的交付动作固定成每天一次的节奏。',
      target: '每天1个新的同类对象',
      done: '每天的交付都按同一套流程完成，并带来可观察的外部回应。',
      decision: '看这套固定流程能不能不依赖状态地持续产生产出；能，就固化成标准。'
    },
    BUYER_FEEDBACK_COLLECTION: {
      action: '今天找3个已经成交的客户，问清楚他们之所以持续买，是因为哪一点。',
      target: '3个已经成交的客户',
      done: '至少1个人讲清持续购买的原因（可复述、可照做）。',
      decision: '只要理由能被复述并照做，就把它写成标准做法，用来复制给新客户。'
    },
    CASHFLOW_SAFE_EXPERIMENT: {
      action: '今天用不额外花钱的方式，把已经稳定的交付流程再跑一遍。',
      target: '1个同类的新用户',
      done: '交付流程按同一套标准完成，并拿到1条外部回应。',
      decision: '只要能不额外花钱地稳定复现，就把这套流程固化成标准。'
    }
  }
}

/**
 * @param {{assetState:string, bottleneck:string, actionType:string}} p
 * @returns {{band:string, isPaidBand:boolean, claim:Object,
 *   card02Leap:string|null, card03:{steps:string[],insight:string}|null,
 *   card04:{from:string, to:string},
 *   card05:{action:string,target:string,done:string,decision:string}|null}}
 */
function buildProofConsistencyV6 (p) {
  const state = (p && p.assetState) || 'NO_CLEAR_ASSET'
  const bottleneck = (p && p.bottleneck) || null
  const actionType = (p && p.actionType) || null

  const from = CARD04_FROM_FACT[state] || CARD04_FROM_FACT.NO_CLEAR_ASSET
  const to = (CARD04_TO[state] && CARD04_TO[state][bottleneck]) || null
  const card02Leap = (CARD02_LEAP[state] && CARD02_LEAP[state][bottleneck]) || null
  const card03 = (CARD03[state] && CARD03[state][bottleneck]) || null
  const card05 = (CARD05[state] && CARD05[state][actionType]) || null

  return {
    band: state,
    isPaidBand: !!PAID_BANDS[state],
    claim: CLAIM_CONTRACT[state] || CLAIM_CONTRACT.NO_CLEAR_ASSET,
    card02Leap,
    card03,
    card04: { from, to },
    card05
  }
}

module.exports = {
  buildProofConsistencyV6,
  CLAIM_CONTRACT,
  CARD04_FROM_FACT,
  CARD04_TO,
  CARD02_LEAP,
  CARD03,
  CARD05
}
