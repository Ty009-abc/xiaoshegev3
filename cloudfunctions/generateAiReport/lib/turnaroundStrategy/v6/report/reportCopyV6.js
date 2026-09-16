'use strict'
/**
 * turnaroundStrategy/v6/report/reportCopyV6.js
 *
 * Consumer-facing Chinese copy tables for the V6 five-card report.
 *
 * CONSUMER LAYER ONLY. Deterministic lookup. No randomness. No time. No AI.
 * The internal diagnosis vocabulary (bottleneck names, belief enums, execution
 * enum, rule ids, world-model terms) must NEVER appear in these strings.
 */

// ── Q5 user belief -> natural phrase for "你以为___" (Card01/02) ──
const BELIEF_SHORT = {
  BELIEF_NO_DIRECTION: '不知道该往哪走',
  BELIEF_KNOW_NO_ACTION: '知道方向却一直没行动',
  BELIEF_TRIED_NO_RESULT: '试过很多但没结果',
  BELIEF_RESOURCE: '缺钱缺资源',
  BELIEF_TIME: '没时间',
  BELIEF_FEAR: '怕失败',
  BELIEF_SWITCHING: '总在换方向',
  BELIEF_ABILITY: '能力还不够',
  BELIEF_FAMILY: '被家庭和环境牵制',
  BELIEF_OTHER: '还没看清真正的原因'
}

// ── Q5 user belief -> clause starting with 自己 (Card02/Card03) ──
const BELIEF_CLAUSE = {
  BELIEF_NO_DIRECTION: '自己缺一个明确的方向',
  BELIEF_KNOW_NO_ACTION: '自己知道该做什么，却一直没真正行动',
  BELIEF_TRIED_NO_RESULT: '自己试过不少，但都没结果',
  BELIEF_RESOURCE: '自己缺钱、缺资源',
  BELIEF_TIME: '自己没时间',
  BELIEF_FEAR: '自己怕失败',
  BELIEF_SWITCHING: '自己总在换方向',
  BELIEF_ABILITY: '自己能力还不够',
  BELIEF_FAMILY: '自己被家庭和环境牵制',
  BELIEF_OTHER: '自己还没找到真正的原因'
}

// ── Q5 user belief -> "你以为缺的是___" noun (Card01 gap form) ──
const BELIEF_LACK = {
  BELIEF_NO_DIRECTION: '方向',
  BELIEF_KNOW_NO_ACTION: '行动',
  BELIEF_TRIED_NO_RESULT: '一次稳定的结果',
  BELIEF_RESOURCE: '资源',
  BELIEF_TIME: '时间',
  BELIEF_FEAR: '勇气',
  BELIEF_SWITCHING: '一个能长期做的方向',
  BELIEF_ABILITY: '能力',
  BELIEF_FAMILY: '条件',
  BELIEF_OTHER: '一个明确的原因'
}

// ── Q2 income mode -> reality anchor phrase (Card03 start) ───────
const INCOME_SHORT = {
  INCOME_SALARY: '拿着固定工资',
  INCOME_BUSINESS: '做着一门小生意',
  INCOME_FREELANCE: '靠接单为生',
  INCOME_ASSET: '靠资产收入',
  INCOME_NONE: '暂时没有稳定收入',
  INCOME_OTHER: '收入来源并不稳定'
}

// ── Q4 primary problem -> consumer phrase ────────────────────────
// R35 §1 — natural Chinese realization. Every phrase must read as human
// Chinese in EVERY role: after 最想解决的是 / 问题是 / 又回到…：. No phrase may
// end in 上 in a way that collides with a …上 wrapper, and none may require a
// 这件事 that turns the clause into a stilted object.
const PROBLEM_PHRASE = {
  PROBLEM_INCOME_STUCK: '收入一直上不去',
  PROBLEM_NO_FUTURE: '看不清往后该往哪走',
  PROBLEM_DEBT: '债务和现金流一直压着你',
  PROBLEM_CAREER_SWITCH: '想转行，却一直找不到方向',
  PROBLEM_SIDE_UNSTARTED: '副业迟迟没有起色',
  PROBLEM_MONETIZE: '有本事，却一直变不成收入',
  PROBLEM_FOCUS: '事情太多，一直没法聚焦',
  PROBLEM_OTHER: '眼下的处境一直没有好转'
}

// ── bottleneck -> strong insight tail (Card01) ───────────────────
const INSIGHT_SHORT = {
  DIRECTION_GAP: '方向一直没被真实试过',
  ACTION_GAP: '你一直没真正开始做',
  CONSISTENCY_GAP: '开始了却没能坚持住',
  VALIDATION_GAP: '一直没拿到真实用户反馈',
  REPEATABILITY_GAP: '没能把成果重复出来'
}

// ── bottleneck -> Card01 tail (GAP form) ────────────────────────
// R31 §3/§10: insight-shaped (worldview layer), not a restatement of answers.
const GAP_TAIL = {
  DIRECTION_GAP: '你还没让任何一个方向活到被真实结果验证',
  ACTION_GAP: '你一直停在准备里，用“想清楚”代替了“做一次”',
  CONSISTENCY_GAP: '你用一次冲动启动，又用一次中断收场',
  VALIDATION_GAP: '你在自己脑子里验证，市场却从没被问过',
  REPEATABILITY_GAP: '你靠一次运气拿到结果，却没把它变成能重复的方法'
}

// ── bottleneck -> Card01 tail (MATCH form) ───────────────────────
const MATCH_TAIL = {
  DIRECTION_GAP: '尽快让一个方向拿到真实反馈',
  ACTION_GAP: '把“准备好”换成“先做一个最小版本”',
  CONSISTENCY_GAP: '把结果绑在一套固定节奏上，而不是靠状态',
  VALIDATION_GAP: '去拿到真实用户愿不愿意买单的答案',
  REPEATABILITY_GAP: '把那次有效成交拆成可以重复的步骤'
}

// ── Q8 time allocation -> clause (Card03) ───────────────────────
const Q8_PHRASE = {
  TIME_SHORT_FIRST: '总是先做马上有结果的',
  TIME_BALANCE: '两边都想安排',
  TIME_PROTECT_LONG: '会固定给长期的事留时间',
  TIME_LONG_DROPS: '一忙起来，长期的事就先停'
}

// ── bottleneck -> closing mechanism line (Card02) ────────────────
const MECHANISM = {
  DIRECTION_GAP: '方向不是想出来的，是试出来的。',
  ACTION_GAP: '不真正开始，就永远拿不到真实反馈。',
  CONSISTENCY_GAP: '做几次就断，换不来任何积累。',
  VALIDATION_GAP: '没人买单，说明需求还没被真实验证。',
  REPEATABILITY_GAP: '有过一次结果，不等于有了可重复的能力。'
}

// ── bottleneck -> stalled result line (Card03 step 4) ────────────
const STALL = {
  DIRECTION_GAP: '方向想了一个又一个，始终没跑出真实结果',
  ACTION_GAP: '一直停在想法和准备里，没有真实结果',
  CONSISTENCY_GAP: '做几次就断掉，始终没有积累',
  VALIDATION_GAP: '东西做出来了，却没人买单',
  REPEATABILITY_GAP: '有过结果，但没法再来一次'
}

// ── execution stage -> plain "what you are doing now" statement ──
const STAGE_NOW = {
  THINKING: '你还在想，没有真的动手',
  RESEARCHING: '你查过很多资料，却还没动手',
  LEARNING: '你学过东西，却还没真正开始',
  STARTED: '你开始过，却没能坚持',
  TESTING: '你做过产品，却还没人买单',
  EARLY_TRACTION: '你已经开始有人付钱，但还不稳定',
  STABLE_TRACTION: '你已经有一点稳定结果'
}

// ── execution stage -> stage lead WITHOUT leading 你 (Card05) ────
const STAGE_LEAD = {
  THINKING: '还停留在想，没有真的动手',
  RESEARCHING: '查过很多资料，却还没动手',
  LEARNING: '学过东西，却还没真正开始',
  STARTED: '开始过，却没能坚持',
  TESTING: '做过产品，却还没人买单',
  EARLY_TRACTION: '已经有人付钱，但还不稳定',
  STABLE_TRACTION: '已经有一点稳定结果'
}

const PATH_FROM = {
  THINKING: '继续想，继续找方向',
  RESEARCHING: '继续查资料、比方案',
  LEARNING: '继续学，但一直没上手',
  STARTED: '做一阵、停一阵',
  TESTING: '做了东西，却没卖出去',
  EARLY_TRACTION: '有人买，但靠的是运气',
  STABLE_TRACTION: '有结果，但没沉淀成方法'
}

// ── bottleneck -> the productive next move (Card04) ──────────────
const PATH_TO = {
  DIRECTION_GAP: '拿一个方向去真实测试',
  ACTION_GAP: '真正做出第一个最小结果',
  CONSISTENCY_GAP: '把一件事稳定做满一段时间',
  VALIDATION_GAP: '先搞清楚真实用户为什么不买',
  REPEATABILITY_GAP: '复制最近一次有效成交的路径'
}

// ── behavior phrases (verb form) ────────────────────────────────
const Q7_PHRASE = {
  UNCERT_SMALL_TEST: '先做个很小的测试',
  UNCERT_WAIT: '先等更多信息',
  UNCERT_ASK_OTHERS: '先问几个做过的人',
  UNCERT_ANALYZE: '先把可能的问题都想清楚'
}

const Q9_PHRASE = {
  NORESULT_SWITCH: '换个方向重新试',
  NORESULT_PERSIST: '再坚持一阵',
  NORESULT_ASK_OTHERS: '找人看看哪里做错了',
  NORESULT_RECHECK: '重新检查方法和步骤',
  NORESULT_STOP: '先停下来，不再继续投入'
}

// ── bottleneck -> Card03 step2 (change intent) ──────────────────
const CHANGE_INTENT = {
  DIRECTION_GAP: '想找一个真正能走通的方向',
  ACTION_GAP: '想真正做成点事',
  CONSISTENCY_GAP: '想坚持把一件事做成',
  VALIDATION_GAP: '想把东西真正卖出去',
  REPEATABILITY_GAP: '想把结果做得更大、更稳'
}

// ── bottleneck -> Card05 supporting checks (deterministic, <=3) ─
const SUPPORT_CHECKS = {
  DIRECTION_GAP: ['把选定的方向用一句话写下来', '约好3个可以问到真实反馈的人'],
  ACTION_GAP: ['把最小动作拆到今天就能做完', '做完后立刻记录真实反馈'],
  CONSISTENCY_GAP: ['先定一个每天固定的时间段', '只盯连续天数，不盯做得多完美'],
  VALIDATION_GAP: ['准备好2–3个不诱导的真实问题', '把每个用户的回答原话记下来'],
  REPEATABILITY_GAP: ['把最近一次成交的每一步写下来', '标出哪几步是可以直接照搬的']
}

// ── belief relation -> one personal bridge sentence (Card04/05) ──
// Keyed on the frozen relation value; consumer-safe wording.
const REL_BRIDGE = {
  BELIEF_MATCH: '你对自己处境的判断基本没错，缺的只是把它真正做出来。',
  BELIEF_PARTIAL: '你的判断只说对了一半，先把这一小步走完再看。',
  BELIEF_REALITY_GAP: '你以为的原因未必是全貌，往前走一步就会看到答案。'
}

// ── first action type -> action sentence (Card05) ───────────────
// R33 §10 — the PRIMARY action must itself create a real-world event
// (publish / ask / send / show / contact / transact), never a bare habit.
// FirstActionType authority is unchanged — only the consumer wording is.
const ACTION_EXPRESSION = {
  DIRECTION_NARROWING: '今天只选一个方向，写清楚你要为谁解决什么问题，然后直接去问1个这样的人：你需要这个吗？',
  SMALLEST_EXTERNAL_TEST: '今天选一个方向，做一个最小版本，把它发给1个真实用户看，拿到一条真实反馈。',
  CONSISTENCY_PROTECTION: '今天定一个每天固定30分钟的时段做这件事，每做一天就把当天的结果发给1个真实用户看，先连续5天。',
  BUYER_FEEDBACK_COLLECTION: '今天找3个真实用户，直接问清楚他们为什么没买。',
  REPEAT_SUCCESS_PATH: '把最近一次成交的步骤拆出来，用同一套做法再去找1个新用户成交一次。',
  CASHFLOW_SAFE_EXPERIMENT: '今天做一个不花钱的最小验证，把它拿给1个真实用户看，拿到一条真实反馈。'
}

// ── reality: monthly surplus -> sizing note ─────────────────────
const SCALE_NOTE = {
  SURPLUS_NONE: '尽量做到零额外投入',
  SURPLUS_UNDER_1K: '尽量做到零额外投入',
  SURPLUS_1K_5K: '控制在小额、可承受的范围',
  SURPLUS_5K_10K: '不用一次投太多',
  SURPLUS_OVER_10K: '仍然按最小成本先验证'
}

// ── R31 §5 Card03: short natural relief line keyed on Q7 default reaction ──
const Q7_RELIEF = {
  UNCERT_SMALL_TEST: '这一步让你暂时跳过了“要不要认真做进去”的决定',
  UNCERT_WAIT: '这一步让你暂时不用做决定',
  UNCERT_ASK_OTHERS: '这一步把判断交回给了别人',
  UNCERT_ANALYZE: '这一步让你暂时不用面对还没想全的部分'
}

// ── R31 §4 Card02: hidden mechanism (distinct from Card01 tail) ──
// Explains WHY the current approach keeps producing the current result.
const HIDDEN_MECHANISM = {
  DIRECTION_GAP: '没有真实反馈，你分不清哪个方向真的走得通——“想清楚”换不来确定性。',
  ACTION_GAP: '只要不动手，你就拿不到能推翻或修正判断的真实信息，准备再久也还停在原地。',
  CONSISTENCY_GAP: '积累只发生在连续里，断断续续等于每次都从零重新开始。',
  VALIDATION_GAP: '你自己认定的价值，只有在别人愿意掏钱时才第一次被证明。',
  REPEATABILITY_GAP: '一次好结果如果说不清它为什么发生，就只能算运气，没办法再来一次。'
}

// ── R31 §6 Card04: old decision rule → new decision rule ────────
const DECISION_FROM = {
  DIRECTION_GAP: '先想清楚，再行动',
  ACTION_GAP: '等准备好，再开始',
  CONSISTENCY_GAP: '靠状态和心情决定做不做',
  VALIDATION_GAP: '先把东西做到完美，再拿出去',
  REPEATABILITY_GAP: '靠这一次的手感，再来一次'
}

const DECISION_TO = {
  DIRECTION_GAP: '先做最小验证，再让反馈决定下一步',
  ACTION_GAP: '先做出一个能被外人看到的最小版本，再边做边改',
  CONSISTENCY_GAP: '把这件事绑进固定时间和固定动作，先跑满一段时间',
  VALIDATION_GAP: '先让真实用户回答“买不买”，再决定要不要继续打磨',
  REPEATABILITY_GAP: '把这次的做法拆成步骤，让结果可以再来一次'
}

// One concrete operating mechanism that makes the new rule executable.
const OPERATING_MECH = {
  DIRECTION_GAP: '每周只推一个方向，用一个一周内能拿到反馈的小动作去验证。',
  ACTION_GAP: '把“要做的事”缩到24小时内能完成的一步，做完立刻去拿外部反馈。',
  CONSISTENCY_GAP: '每天固定30分钟、同一时间、同一动作，先连续做满一周。',
  VALIDATION_GAP: '找3个真实用户，只问一句：你会不会为它掏钱。',
  REPEATABILITY_GAP: '把最近一次成功的每一步写下来，标出哪些可以原样照搬。'
}

// ── R31 §7/§12 Card05: TIME BOX · WHO-VERIFIES · DONE-CRITERION ──
// Keyed on the frozen firstActionType (never replaces it; only specifies it).
const ACTION_SPEC = {
  DIRECTION_NARROWING: {
    timebox: '今天内完成',
    verifyWith: '直接问1个你目标用户里的人',
    done: '对方明确回复“我要/我不要”，而不是“还行”'
  },
  SMALLEST_EXTERNAL_TEST: {
    timebox: '24小时内完成',
    verifyWith: '把最小版本发给1个真实用户看',
    done: '收到至少1条真实反馈，哪怕是否定'
  },
  CONSISTENCY_PROTECTION: {
    timebox: '连续5天、每天固定时段',
    verifyWith: '把每天的成果发给1个真实用户看',
    done: '每天的结果都被1个真实用户看到，并收到一句真实反馈'
  },
  BUYER_FEEDBACK_COLLECTION: {
    timebox: '今天内完成',
    verifyWith: '直接问3个真实用户',
    done: '至少1个真实用户回复“为什么现在不买”'
  },
  REPEAT_SUCCESS_PATH: {
    timebox: '今天内完成',
    verifyWith: '用同一套做法找1个新用户试',
    done: '再成交1次，或拿到1个明确的拒绝'
  },
  CASHFLOW_SAFE_EXPERIMENT: {
    timebox: '24小时内完成',
    verifyWith: '把最小验证拿给1个真实用户看',
    done: '拿到1条来自真实用户的外部反馈'
  }
}

// ════════════════════════════════════════════════════════════════
// R33 §5-§9 — WORLD-MODEL-FIRST copy layer
// ════════════════════════════════════════════════════════════════

// ── R33 §5 Card01: the WRONG RULE, phrased as a decision rule──
const WRONG_RULE = {
  DIRECTION_GAP: '先想清楚方向，再动手',
  ACTION_GAP: '等准备好，再开始',
  CONSISTENCY_GAP: '靠一股劲一次做完',
  VALIDATION_GAP: '把东西做到最好，自然有人买',
  REPEATABILITY_GAP: '做成一次，就算会了'
}

// ── R33 §5/§8 Card01 tail + Card04 new rule: the WORLD RULE ──
const WORLD_RULE_TAIL = {
  DIRECTION_GAP: '得先动手，方向才会慢慢变清楚',
  ACTION_GAP: '开始了，才会一点点准备好',
  CONSISTENCY_GAP: '一断档，就等于从头再来',
  VALIDATION_GAP: '有人愿意买单，才算真的好',
  REPEATABILITY_GAP: '能重复做出来，才算真会'
}

// ── R33.1 §6/§13 Card01 shorten: ≤40-char rule-collision templates ──
// MATCH form is keyed on bottleneck (wrong rule) + primaryProblem (outcome noun)
// so two MATCH reports under the same bottleneck never collide. {w}=wrong rule,
// {n}=outcome noun.
const C01_OUTCOME_NOUN = {
  PROBLEM_INCOME_STUCK: '收入',
  PROBLEM_NO_FUTURE: '未来',
  PROBLEM_DEBT: '现金流',
  PROBLEM_CAREER_SWITCH: '方向',
  PROBLEM_SIDE_UNSTARTED: '副业',
  PROBLEM_MONETIZE: '变现',
  PROBLEM_FOCUS: '专注',
  PROBLEM_OTHER: '改变'
}
const MATCH_C01 = {
  DIRECTION_GAP: '你想{n}，但「{w}」行不通。',
  ACTION_GAP: '你的目标没错，但「{w}」换不来{n}。',
  CONSISTENCY_GAP: '你的目标没错，但「{w}」撑不下去。',
  VALIDATION_GAP: '判断没错，但「{w}」换不来{n}。',
  REPEATABILITY_GAP: '你判断得没错，但「{w}」只灵一次。'
}

// ── R33 §6 Card02: why the old rule conflicts with how the world works ──
const WHY_RULE_FAILS = {
  DIRECTION_GAP: '方向本身是个概率问题，只能靠一次次小试验逼近，想不出一条必然对的路。',
  ACTION_GAP: '动手之前，你手里没有任何真实信息；准备再久，也只是把猜测做得更精致。',
  CONSISTENCY_GAP: '积累只在不断档的重复里发生，每次重启都把之前的投入清零。',
  VALIDATION_GAP: '好坏由掏钱的人说了算，你给自己打的分，市场并不认。',
  REPEATABILITY_GAP: '一次成功说不清原因，就只是运气，换不来下一次。'
}

// ── R33 §7 Card03: structural consequence (one line) ──
const STRUCTURAL_CONSEQUENCE = {
  DIRECTION_GAP: '你一直在挑方向，却始终没让任何一个方向被现实验证过。',
  ACTION_GAP: '你一直在准备，却始终没拿到一条能修正判断的真实信息。',
  CONSISTENCY_GAP: '你每次都在重启，所以从来没有真正积累起来。',
  VALIDATION_GAP: '你一直在自我确认，市场却从来没有真正回答过你。',
  REPEATABILITY_GAP: '你有过结果，却重建不出能再来一次的做法。'
}

// ── R33 §7 Card03: loop nodes (OLD RULE -> decision -> relief -> missing -> returns) ──
// 5 nodes kept (finalValidator requires exactly 5).
const LOOP_NODE1 = {
  DIRECTION_GAP: '旧规则：先想清楚方向，再动手。',
  ACTION_GAP: '旧规则：等准备好，再开始。',
  CONSISTENCY_GAP: '旧规则：靠一股劲一次做完。',
  VALIDATION_GAP: '旧规则：把东西做到最好，自然有人买。',
  REPEATABILITY_GAP: '旧规则：做成一次，就算会了。'
}
const LOOP_NODE3 = {
  DIRECTION_GAP: '这一等，让你暂时不用面对试错的结果。',
  ACTION_GAP: '这一准备，让你暂时不用面对“做了却没做成”。',
  CONSISTENCY_GAP: '这一断，让你暂时逃离了做得不够好的挫败。',
  VALIDATION_GAP: '这一打磨，让你暂时不用面对没人买的答案。',
  REPEATABILITY_GAP: '这一放下，让你暂时不用去想它为什么不稳。'
}
const LOOP_NODE4 = {
  DIRECTION_GAP: '但方向始终没被真实验证，你也因此没得到任何可用信息。',
  ACTION_GAP: '但真实反馈始终没进来，你手里的判断也就没变过。',
  CONSISTENCY_GAP: '但每次重启都清零，你的投入一直没有攒下来。',
  VALIDATION_GAP: '但市场始终没表态，你的“好”始终是你单方面的说法。',
  REPEATABILITY_GAP: '但可重复的路径始终没沉淀，结果也就无法复制。'
}
const LOOP_NODE5 = {
  DIRECTION_GAP: '于是同一个问题又回来：我到底该往哪走。',
  ACTION_GAP: '于是同一个问题又回来：为什么我还是没开始。',
  CONSISTENCY_GAP: '于是同一个问题又回来：为什么我总坚持不下来。',
  VALIDATION_GAP: '于是同一个问题又回来：我做得挺好，为什么没人买。',
  REPEATABILITY_GAP: '于是同一个问题又回来：为什么我做得到一次，却做不成常态。'
}

// ── R33 §8 Card04: OLD rule -> NEW rule (world-model swap) ──
const NEW_RULE = {
  DIRECTION_GAP: '先做一个低成本小试验，再让反馈决定下一个方向',
  ACTION_GAP: '先做出一个能被外人看到的最小版本，再边做边改',
  CONSISTENCY_GAP: '把这件事绑进固定时间和固定动作，先不断档跑一段',
  VALIDATION_GAP: '先让真实用户回答“买不买”，再决定要不要继续打磨',
  REPEATABILITY_GAP: '把那次成功的每一步写下来，让结果可以再来一次'
}

// ── R33 §9 Card05: external signal / decision rule per action type ──
// decision: what the external signal DECIDES once observed.
const REALITY_DECISION = {
  DIRECTION_NARROWING: '只要对方明确说“我要/我不要”，就按这个信号定方向，别再猜。',
  SMALLEST_EXTERNAL_TEST: '只要收到一条真实反馈（哪怕否定），就拿它修正下一步，而不是回头继续想。',
  CONSISTENCY_PROTECTION: '只要连续做到不少于4天，就说明机制立住了；若断档，先缩小单次动作，不减连续性。',
  BUYER_FEEDBACK_COLLECTION: '只要有人讲清“为什么不买”，就按这个原因改，不改自己猜的方向。',
  REPEAT_SUCCESS_PATH: '只要能标出2步可照搬的步骤，就把它们固定成下次的默认动作。',
  CASHFLOW_SAFE_EXPERIMENT: '只要拿到一条不花钱就能得到的外部反馈，就用它决定要不要继续。'
}

// ════════════════════════════════════════════════════════════════
// R34 §1-§10 — HUMAN COPY + REALITY TEST layer
// ════════════════════════════════════════════════════════════════

/**
 * R35 §1 — PROBLEM REALIZATION LAYER (semantic realization, not string concat).
 * A CURRENT_PROBLEM phrase must be realized as a natural Chinese problem clause
 * for the role it plays (after 最想解决的是 / 问题是 / 卡在...). Evidence-gated by
 * the Q4 problem fact. Guards against the old awkward assembly (卡在…上上 /
 * 把…这件事推过去).
 */
const hasOddNP = (np) => /上上|把.*这件事|这件事推/.test(np)
function problemRealization (q4) {
  const np = pick(PROBLEM_PHRASE, q4, '现在的处境')
  return hasOddNP(np) ? '现在的处境' : np
}
function desiredStateLine (income, problem) {
  return `你现在${income}，最想解决的是${problem}。`
}

// R34 §1 — the problem phrase used where a stated desire is required (fallback).
const DESIRED_STATE = {
  PROBLEM_INCOME_STUCK: '让收入真正往上走',
  PROBLEM_NO_FUTURE: '看清楚往后能往哪走',
  PROBLEM_DEBT: '把现金流从债务里松出来',
  PROBLEM_CAREER_SWITCH: '找到一条能换过去的赛道',
  PROBLEM_SIDE_UNSTARTED: '让副业真正跑起来',
  PROBLEM_MONETIZE: '把已有的能力换成钱',
  PROBLEM_FOCUS: '把一件事真正推进下去',
  PROBLEM_OTHER: '把眼下的处境真正改变'
}

// §9 — CARD02 humanized belief lead (natural, not form-field assembly).
const beliefLead = (lack) => `你一直以为，卡住你的是${lack}。`

// §9/R33 §6 — CARD02 diagnostic leap (why the current rule conflicts with the
// world). Each line is BOTH a personal-evidence inference AND a mechanism.
const CARD02_LEAP = {
  DIRECTION_GAP: '但方向从来不是想出来的——在你拿到第一手真实反馈之前，所有的“想清楚”都只是猜测。',
  ACTION_GAP: '但只要没真的动手，你手里的判断就一直是猜的；准备做得再细，也换不来一条真实信息。',
  CONSISTENCY_GAP: '但积累只发生在不断档的重复里；每次都从头再来，等于之前的投入一次都没攒下。',
  VALIDATION_GAP: '但东西好不好，是由愿意掏钱的人说了算的；你自己给自己打的分，市场并不认。',
  REPEATABILITY_GAP: '但一次成功如果说不清它为什么发生，就只是运气——它换不来下一次。'
}

// §3 — CARD01 anti-template. SHORT rule forms keep every variant ≤40 chars;
// the LEADING phrase is the “family” the anti-template metric counts.
const C01_RULE_SHORT = {
  DIRECTION_GAP: '先想清楚再动手',
  ACTION_GAP: '等准备好再开始',
  CONSISTENCY_GAP: '靠一股劲做完',
  VALIDATION_GAP: '做到最好就有人买',
  REPEATABILITY_GAP: '做成一次就算会'
}
const PARTIAL_SHORT = {
  BELIEF_NO_DIRECTION: '没方向',
  BELIEF_KNOW_NO_ACTION: '没行动',
  BELIEF_TRIED_NO_RESULT: '没结果',
  BELIEF_RESOURCE: '缺资源',
  BELIEF_TIME: '没时间',
  BELIEF_FEAR: '怕失败',
  BELIEF_SWITCHING: '总换方向',
  BELIEF_ABILITY: '能力不够',
  BELIEF_FAMILY: '被环境牵制',
  BELIEF_OTHER: '没看清原因'
}
const C01 = {
  gapDir: (lack, r) => `你以为缺的是${lack}，其实卡住你的是“${r}”。`,
  gapAct: (lack, r) => `你一直以为缺的是${lack}，真正卡住你的是“${r}”。`,
  gapCV: (lack, r) => `卡住你的不是缺${lack}，而是“${r}”。`,
  gapRep: (lack, r) => `真正卡住你的是“${r}”，不是缺${lack}。`,
  partial: (bs, r) => `你把“${bs}”当成了全部原因，其实卡住你的是“${r}”。`,
  matchDir: (n, r) => `你想${n}，但「${r}」才是真正卡住你的地方。`,
  matchAct: (n, r) => `你的目标没错，但「${r}」换不来${n}。`,
  matchCons: (n, r) => `你以为「${r}」是在给自己攒底气，其实它撑不下去。`,
  matchVal: (n, r) => `判断没错，但「${r}」换不来${n}。`,
  matchValDebt: (n, r) => `你一直在「${r}」，却换不来${n}。`,
  matchValSide: (n, r) => `你方向没错，但「${r}」换不来${n}。`
}

// §3 MATCH leads — the goal is right, the rule to reach it is wrong. Keyed on
// bottleneck; each bottleneck has several leads so no single surface pattern
// dominates (R34 §3 anti-template). {n}=outcome noun, {r}=rule.
const MATCH_LEADS = {
  DIRECTION_GAP: [
    (n, r) => `你想${n}，但「${r}」才是真正卡住你的地方。`,
    (n, r) => `你要的是${n}，可「${r}」行不通。`
  ],
  ACTION_GAP: [
    (n, r) => `你的目标没错，但「${r}」换不来${n}。`,
    (n, r) => `你想${n}，可「${r}」其实换不来。`,
    (n, r) => `方向没错，但「${r}」换不来${n}。`
  ],
  CONSISTENCY_GAP: [
    (n, r) => `你以为「${r}」是在给自己攒底气，其实它撑不下去。`
  ],
  VALIDATION_GAP: [
    (n, r) => `判断没错，但「${r}」换不来${n}。`,
    (n, r) => `你一直在「${r}」，却换不来${n}。`
  ],
  REPEATABILITY_GAP: [
    (n, r) => `你判断得没错，但「${r}」只灵一次。`
  ]
}

// §4 — CARD03 expression families (>=4 required; ONE per report).
// R35 §3 — genuinely different user-facing structures, not one skeleton
// reworded: LOOP (X→Y→Z→X) · CONTRADICTION (want X / rule rewards Y / get Z) ·
// ACCUMULATION (do A → reset → restart from zero) · REFRAME (mistake A as key,
// actually B) · FALSE_SAFETY (avoid short-term pain → create long-term cost).
const CARD03_FAMILY = {
  DIRECTION_GAP: 'LOOP',
  ACTION_GAP: 'CONTRADICTION',
  CONSISTENCY_GAP: 'ACCUMULATION',
  VALIDATION_GAP: 'REFRAME',
  REPEATABILITY_GAP: 'FALSE_SAFETY'
}

// §4 — CARD03 family-specific node copy (keys = bottleneck).
const C03_CONTRA_DEMAND = {
  ACTION_GAP: '但你的规则一直在要求你：等一切都准备好了，再开始。'
}
const C03_CONTRA_MID = {
  ACTION_GAP: '于是一遇到不确定，你就先停一下；这一停，让你暂时不用面对“做了却没做成”。'
}
const C03_CONTRA_RESULT = {
  ACTION_GAP: '结果就是：越等，你手里越没有能推翻判断的东西。'
}
const C03_ACC_START = {
  CONSISTENCY_GAP: '每次你都靠一股劲开头，一开始就全力往前冲。'
}
const C03_ACC_MID = {
  CONSISTENCY_GAP: '一旦停下来，之前那段的积累就全部作废。'
}
const C03_ACC_COST = {
  CONSISTENCY_GAP: '于是你一遍遍重启，却从来没有真正往前累积。'
}
const C03_REFRAME_BEHAVIOR = {
  VALIDATION_GAP: '你一直把“再打磨得更好一点”当作关键动作。',
  REPEATABILITY_GAP: '你一直把“这次干得不错”当作已经稳了。'
}
const C03_REFRAME_NOT = {
  VALIDATION_GAP: '但它其实换不来一个真实用户的认可。',
  REPEATABILITY_GAP: '但它其实换不来下一次还能成。'
}
const C03_REFRAME_MID = {
  VALIDATION_GAP: '于是一遇到不确定，你就先回头继续打磨，而不是去问一个真实用户。'
}
const C03_REFRAME_TRUTH = {
  VALIDATION_GAP: '真正管用的，是有人愿意为它掏钱；在那之前，一切自我评估都只是猜。',
  REPEATABILITY_GAP: '真正管用的，是把这次的做法拆成能照搬的步骤；在那之前，它只能算运气。'
}
// §4/FALSE_SAFETY — avoid short-term pain → create long-term cost (REPEATABILITY).
const C03_FS_KEEP = {
  REPEATABILITY_GAP: '于是你每次只把上一次的做法原样再试，不敢改，也不去问清它为什么成。'
}
const C03_FS_PAIN = {
  REPEATABILITY_GAP: '这一步确实回避了当面确认失败的不适感。'
}
const C03_FS_COST = {
  REPEATABILITY_GAP: '但它也让原因永远不透明：你永远不知道这一次能不能再来一次。'
}
const C03_FS_EXIT = {
  REPEATABILITY_GAP: '下一次如果换个客户、换个条件，你依然会回到同一个不确定里。'
}
const C03_LOOP_RELIEF = {
  DIRECTION_GAP: '多想想，让你暂时不用面对选错方向的风险。',
  ACTION_GAP: '这一准备，让你暂时不用面对“做了却没做成”。',
  CONSISTENCY_GAP: '停一下，让你暂时逃离做得不够好的挫败。',
  VALIDATION_GAP: '继续打磨，让你暂时不用面对没人买的答案。',
  REPEATABILITY_GAP: '放下不管，让你暂时不用去想它为什么不稳。'
}
const C03_LOOP_COST = {
  DIRECTION_GAP: '但方向始终没被真实验证，你也就一直拿不到能用的信息。',
  ACTION_GAP: '但真实反馈始终没进来，你手里的判断也就没变过。',
  CONSISTENCY_GAP: '但每次重启都清零，你的投入一直没有攒下来。',
  VALIDATION_GAP: '但市场始终没表态，你的“好”始终是你单方面的说法。',
  REPEATABILITY_GAP: '但可重复的路径始终没沉淀，结果也就无法复制。'
}

// §10 — one short human statement per world mechanism (SHAREABLE line).
const WORLD_ONE_LINER = {
  DIRECTION_GAP: '方向不是想出来的，是试出来的。',
  ACTION_GAP: '没有反馈之前，你拥有的不是判断，只是猜测。',
  CONSISTENCY_GAP: '真正昂贵的不是慢，是每次都在重新开始。',
  VALIDATION_GAP: '东西好不好，不是你说好，是有人愿意掏钱。',
  REPEATABILITY_GAP: '一次成功是事件，能重复才是能力。'
}

// §6/§7/§8 — CARD05 REALITY TEST semantic contract per action type.
// HYPOTHESIS / ACTION / TARGET / TIMEBOX / OBSERVABLE_SIGNAL / DECISION, with
// the outcome branches (continue / modify / stop). The signal answers the
// hypothesis; the decision reads the same signal.
const REALITY_TEST = {
  DIRECTION_NARROWING: {
    hypothesis: '有人真的需要你把这件事做出来。',
    action: '今天只选一个方向，写清楚你要替谁解决什么问题，把这件事直接发给1个这样的人，问他一句：你需要这个吗？',
    target: '目标用户里的3个互相独立的人（先发第1个）',
    timebox: '今天发出，3天内问满3个人',
    observableSignal: '前3个人里，至少2个人明确回复“我要”或“我不要”。第1个人的回复只用来改假设，不定方向。',
    decision: '第1个回复只改下一步的问法；等拿到3条独立信号、或1条强经济信号（真金白银的付款/签约）才定方向。',
    ifPositive: '3人里至少2人说要——这个方向先做两周。',
    ifNegative: '3人里多数说不要——换方向，再问3个新人。',
    ifAmbiguous: '有人只说“还行”——把问题改具体，再问一个新人，仍算1条信号。'
  },
  SMALLEST_EXTERNAL_TEST: {
    hypothesis: '有一个最小版本，真实用户愿意看、愿意回应。',
    action: '今天选一个方向，做出一个最小版本，把它发给1个真实用户看，拿到一条真实反馈。',
    target: '1个真实用户',
    timebox: '24小时内',
    observableSignal: '他给你至少1条具体反馈（哪怕是否定），说明他到底看到了什么。',
    decision: '这条反馈只用来改下一步——调整版本或换一类用户，不足以证明整个方向成立。',
    ifPositive: '反馈说“有用”——把这个版本再给第2个人看。',
    ifNegative: '反馈说“没用”——按他说的那一点改一版。',
    ifAmbiguous: '只得到一句“再想想”——把问题问得更具体，再发一次。'
  },
  CONSISTENCY_PROTECTION: {
    hypothesis: '把同一个面向市场的动作重复做，能换来可累积的外部结果。',
    action: '今天起，每天把同一个面向市场的动作重复做一遍（联系1个新用户 / 发布1次 / 报1次价）。5天只是观察窗，不是成功标准。',
    target: '每天1个新对象',
    timebox: '连续5天（这只是观察窗）',
    observableSignal: '外部证据是否开始累积：每天的回应在变多、变明确，或目标人群里开始有人主动问。',
    decision: '看外部证据是否在累积；若只有“做完5天”而没有外部回应，就是没跑通，先换动作而不是加长天数。',
    ifPositive: '回应在累积——把动作固定下来，进入下一周。',
    ifNegative: '5天都没有外部回应——说明动作选错了，换一个再测。',
    ifAmbiguous: '回应时有时无——先把动作缩到最小，保证每天都真的发生。'
  },
  BUYER_FEEDBACK_COLLECTION: {
    hypothesis: '真实用户不买，是因为一个具体原因。',
    action: '今天直接找3个真实用户，问清楚他们为什么没买。',
    target: '3个看过或可能买的真实用户',
    timebox: '今天内',
    observableSignal: '至少1个真实用户讲清他为什么没买（具体反对理由，不是“还行”）。',
    decision: '只要有人讲清原因，就按这个原因改，不再自己猜。',
    ifPositive: '多人说的是同一个原因——就按这个原因改产品。',
    ifNegative: '没人说得清——说明问法太泛，换更具体的问题再问。',
    ifAmbiguous: '说法各不相同——先记下最高频的那一个，先验证它。'
  },
  REPEAT_SUCCESS_PATH: {
    hypothesis: '最近那次成功，是可以被复现的。',
    action: '把最近一次成交的步骤拆出来，用同一套做法再找1个新用户走一遍。',
    target: '1个新用户',
    timebox: '今天内',
    observableSignal: '再成交1次（重复出现的结果），而不是只把步骤说清楚。',
    decision: '只有再成交1次（结果被复现），才能说这套做法可以复制；只把步骤写出来不算。',
    ifPositive: '再次成交——把这套步骤固定成默认做法。',
    ifNegative: '被明确拒绝——找出是哪一步不奏效，只改那一步。',
    ifAmbiguous: '对方没回应——换一个渠道再走一遍同样的步骤。'
  },
  CASHFLOW_SAFE_EXPERIMENT: {
    hypothesis: '不花钱，也能验证这个方向有没有人需要。',
    action: '今天做一个不花钱的最小验证，把它拿给1个真实用户看。',
    target: '1个真实用户',
    timebox: '24小时内',
    observableSignal: '拿到1条来自真实用户的外部反馈。',
    decision: '只要拿到1条外部反馈，就用它决定要不要继续，而不是先投入钱。',
    ifPositive: '反馈说“需要”——先用手工方式再服务1个人。',
    ifNegative: '反馈说“不需要”——换方向，而不是加钱。',
    ifAmbiguous: '反馈很笼统——问一个更具体的问题再验一次。'
  }
}

// R35 §5 — EVIDENCE STRENGTH LEVELS (not all feedback is equal).
// WEAK: opinion / “还行” / generic feedback. MEDIUM: clear yes/no, specific
// objection, click, reply, meeting request. STRONG: payment, deposit, signed
// commitment, repeat purchase, observable repeated behaviour.
const WEAK_SIGNAL_PAT = /(还行|感觉|看法|意见|随便|看看|不太确定|说不清|也许|可能)/
const STRONG_SIGNAL_PAT = /(付款|付费|付钱|掏钱|定金|订金|签约|签合同|下单|成交|买了|购买|复购|续费|预付款|押金|合同|落单)/
const MEDIUM_SIGNAL_PAT = /(回复|回应|拒绝|要|不要|明确|具体|反对|点击|报名|约|见面|面谈|留资|询价)/
const ECONOMIC_SIGNAL_PAT = /(付款|付费|掏钱|定金|签约|签合同|下单|复购|续费|预付款|押金|成交)/

/** §5 — classify the evidence strength named by a signal/decision string. */
function evidenceStrength (s) {
  const t = String(s == null ? '' : s)
  if (ECONOMIC_SIGNAL_PAT.test(t)) return 'STRONG'
  if (MEDIUM_SIGNAL_PAT.test(t) || STRONG_SIGNAL_PAT.test(t)) return 'MEDIUM'
  if (WEAK_SIGNAL_PAT.test(t)) return 'WEAK'
  return 'MEDIUM'
}

// §6 — probability/sample-size rule: this action type must NOT convert a single
// non-economic signal into a final direction decision.
const PROBABILITY_GATED_ACTIONS = ['DIRECTION_NARROWING']
const FINAL_DECISION_PAT = /(定方向|方向定|定为方向|就定了|定下来|可以复制|就是它|确定方向|拍板|固定成默认|固定下来)/
const SINGLE_ONLY_PAT = /(只要他给出|只要对方明确|只要.{0,8}一个人|就按这个答案|1个(?:人|用户|新用户|目标用户)|一个人)/
const AGGREGATED_PAT = /(3个|三个人|3人|三条|多个|几条|互相独立|直到问满|问满|持续|累积|多条|独立信号)/
const STRONG_ECON_PAT = /(真金白银|付款|付费|掏钱|定金|签约|签合同|下单|复购|预付款|押金|经济信号)/

/**
 * §4/§6 SINGLE_WEAK_SIGNAL_OVERCLAIM.
 * TRUE when a probability-gated action's decision turns a single non-economic
 * signal into a FINAL direction/commitment decision: no aggregation across
 * independent signals, no explicit strong-economic exception.
 */
function singleWeakSignalOverclaim (actionType, signal, decision) {
  if (PROBABILITY_GATED_ACTIONS.indexOf(actionType) === -1) return false
  const dec = String(decision == null ? '' : decision)
  const sig = String(signal == null ? '' : signal)
  if (!FINAL_DECISION_PAT.test(dec)) return false
  const aggregated = AGGREGATED_PAT.test(dec) || STRONG_ECON_PAT.test(dec) || STRONG_ECON_PAT.test(sig)
  if (aggregated) return false
  const single = SINGLE_ONLY_PAT.test(dec) || SINGLE_ONLY_PAT.test(sig)
  if (single) return true
  // A gate that mentions neither aggregation nor a single unit is ambiguous; do
  // not flag (fail-open toward the author, fail-closed only on clear overclaims)
  // but require the strong-economic exception to be spelled out.
  return !AGGREGATED_PAT.test(dec)
}

/** §7 CONSISTENCY_TIMEBOX_AS_SUCCESS — the timebox itself is the success metric. */
function consistencyTimeboxAsSuccess (decision, signal) {
  const t = String(decision == null ? '' : decision) + ' ' + String(signal == null ? '' : signal)
  const timeasSuccess = /(连续\s*5\s*天|做满\s*5\s*天|坚持\s*5\s*天|不少于\s*4\s*天|至少\s*4\s*天).{0,12}(就说明|就算|即算|成功|立住|开始累积)/.test(t) ||
    /(就说明机制立住了|就说明这条路在累积)/.test(t)
  const externalAccum = /(外部|回应|反馈|证据|累积|变多|变明确)/.test(t)
  return timeasSuccess && !externalAccum
}

// §5/§7 — habit-only action markers (used to detect bare self-discipline tasks).
const HABIT_ONLY_PAT = /(每天固定\s*\d+\s*分钟|每天\s*\d+\s*分钟|坚持\s*\d+\s*[天周月]|养成习惯|保持自律|自律打卡)/
// §7 — verbs that make an action MARKET-FACING (produces external evidence).
const MARKET_FACING_PAT = /(发布|上传|联系|问|发给|拿给|递|报价|定价|收费|成交|推销|展示|约|寄|投放|招募|邀请|演示|试卖|接单)/

// §13/§6 — observable-signal topic per action type (the signal must answer the
// hypothesis) + the decision topic (decision reads the same signal).
const SIGNAL_TOPIC = {
  DIRECTION_NARROWING: /(要|不要|需要|回复)/,
  SMALLEST_EXTERNAL_TEST: /(反馈|回应|回复)/,
  CONSISTENCY_PROTECTION: /(回应|反馈|要|不要)/,
  BUYER_FEEDBACK_COLLECTION: /(没买|不买|原因|为什么)/,
  REPEAT_SUCCESS_PATH: /(成交|拒绝|复制|再来)/,
  CASHFLOW_SAFE_EXPERIMENT: /(反馈|回应)/
}
const DECISION_TOPIC = {
  DIRECTION_NARROWING: /(要|不要|方向|回复)/,
  SMALLEST_EXTERNAL_TEST: /(反馈|回应)/,
  CONSISTENCY_PROTECTION: /(回应|累积|反馈)/,
  BUYER_FEEDBACK_COLLECTION: /(原因|没买|不买|为什么)/,
  REPEAT_SUCCESS_PATH: /(复制|成交|拒绝|重复)/,
  CASHFLOW_SAFE_EXPERIMENT: /(反馈|回应)/
}

// ── R33 §10 generic-productivity patterns (must be paired with an external signal) ──
// A CARD05 action is flagged GENERIC_PRODUCTIVITY_ACTION when its core action is
// habit-flavoured (每天N分钟/坚持/养成习惯/自律) WITHOUT an explicit external signal.
const GENERIC_PRODUCTIVITY_PAT = /(每天\s*\d+\s*分钟|每天固定\d+|坚持\d*[天周月]|养成习惯|保持自律|持续行动|认真执行|打卡\d*[天周])/
const EXTERNAL_SIGNAL_PAT = /(反馈|回复|拒绝|买单|付费|购买|点击|评论|对话|沟通|发布|上传|真实用户|用户|买家|对方|问\s*\d*\s*个|成交|有人)/

function pick (table, key, fallback) {
  return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : fallback
}

module.exports = {
  BELIEF_SHORT,
  BELIEF_CLAUSE,
  PROBLEM_PHRASE,
  INSIGHT_SHORT,
  MECHANISM,
  STALL,
  STAGE_NOW,
  PATH_FROM,
  PATH_TO,
  Q7_PHRASE,
  Q9_PHRASE,
  ACTION_EXPRESSION,
  SCALE_NOTE,
  getBeliefShort: (q5) => pick(BELIEF_SHORT, q5, '还没想清原因'),
  getBeliefLack: (q5) => pick(BELIEF_LACK, q5, '一个明确的原因'),
  getIncomeShort: (q2) => pick(INCOME_SHORT, q2, '现在的收入状态'),
  getBeliefClause: (q5) => pick(BELIEF_CLAUSE, q5, '自己还没找到真正的原因'),
  getProblemPhrase: (q4) => pick(PROBLEM_PHRASE, q4, '现在的处境'),
  getInsight: (b) => pick(INSIGHT_SHORT, b, '真正的原因还没被看见'),
  getGapTail: (b) => pick(GAP_TAIL, b, '真正的原因还没被看见'),
  getMatchTail: (b) => pick(MATCH_TAIL, b, '先看清真正要解决的问题'),
  getQ8: (v) => pick(Q8_PHRASE, v, '按当下的节奏安排时间'),
  getMechanism: (b) => pick(MECHANISM, b, '先看清问题，再动手。'),
  getStall: (b) => pick(STALL, b, '一直停在原地'),
  getStageNow: (s) => pick(STAGE_NOW, s, '你还在原地'),
  getStageLead: (s) => pick(STAGE_LEAD, s, '还在原地'),
  getPathFrom: (s) => pick(PATH_FROM, s, '继续现在的做法'),
  getPathTo: (b) => pick(PATH_TO, b, '拿一个方向去真实测试'),
  getQ7: (v) => pick(Q7_PHRASE, v, '按自己的习惯反应'),
  getQ9: (v) => pick(Q9_PHRASE, v, '遇到结果不理想就调整'),
  getChangeIntent: (b) => pick(CHANGE_INTENT, b, '想改变现在的状况'),
  getQ7Relief: (v) => pick(Q7_RELIEF, v, '这一步让你暂时不用面对那个没把握的结果'),
  getHiddenMechanism: (b) => pick(HIDDEN_MECHANISM, b, '现在的做法和想要的结果之间，缺了一次真实反馈。'),
  getDecisionFrom: (b) => pick(DECISION_FROM, b, '沿用现在的做法'),
  getDecisionTo: (b) => pick(DECISION_TO, b, '先做一个最小验证，再让反馈决定下一步'),
  getOperatingMech: (b) => pick(OPERATING_MECH, b, '每周只推一个方向，用一个能拿到反馈的小动作去验证。'),
  getActionSpec: (t) => pick(ACTION_SPEC, t, { timebox: '今天内完成', verifyWith: '找一个真实的人', done: '拿到一条真实反馈' }),
  DECISION_FROM,
  DECISION_TO,
  OPERATING_MECH,
  ACTION_SPEC,
  HIDDEN_MECHANISM,
  getSupportChecks: (b) => pick(SUPPORT_CHECKS, b, ['先做一件今天就能完成的小事']),
  getRelBridge: (rel) => pick(REL_BRIDGE, rel, '先把这一小步走完再看。'),
  getActionExpression: (t) => pick(ACTION_EXPRESSION, t, '今天做一个能在一天内完成、能拿到外部反馈的小动作。'),
  getScaleNote: (q3) => pick(SCALE_NOTE, q3, '尽量低成本先试'),
  // R33 world-model layer
  getWrongRule: (b) => pick(WRONG_RULE, b, '沿用现在的做法'),
  getWorldRuleTail: (b) => pick(WORLD_RULE_TAIL, b, '现实会告诉你答案'),
  getOutcomeNoun: (q4) => pick(C01_OUTCOME_NOUN, q4, '改变'),
  getMatchC01: (b, q4) => {
    const tpl = pick(MATCH_C01, b, '你判断得没错，但「{w}」行不通。')
    const w = pick(WRONG_RULE, b, '沿用现在的做法')
    const n = pick(C01_OUTCOME_NOUN, q4, '改变')
    return tpl.split('{w}').join(w).split('{n}').join(n)
  },
  getMatchLead: (b, q4, q5) => {
    const leads = MATCH_LEADS[b]
    if (!leads || !leads.length) return `你判断得没错，但「${pick(C01_RULE_SHORT, b, '沿用现在的做法')}」行不通。`
    let h = 0
    const s = String(b) + '|' + String(q4) + '|' + String(q5)
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
    return leads[h % leads.length](pick(C01_OUTCOME_NOUN, q4, '改变'), pick(C01_RULE_SHORT, b, '沿用现在的做法'))
  },
  MATCH_LEADS,
  getWhyRuleFails: (b) => pick(WHY_RULE_FAILS, b, '现在的做法和想要的结果之间，缺了一次真实反馈。'),
  getStructuralConsequence: (b) => pick(STRUCTURAL_CONSEQUENCE, b, '你一直在原地打转。'),
  getLoopNode1: (b) => pick(LOOP_NODE1, b, '旧规则：沿用现在的做法。'),
  getLoopNode3: (b) => pick(LOOP_NODE3, b, '这一步让你暂时不用面对那个没把握的结果。'),
  getLoopNode4: (b) => pick(LOOP_NODE4, b, '但真实反馈始终没进来。'),
  getLoopNode5: (b) => pick(LOOP_NODE5, b, '于是同一个问题又回来了。'),
  getNewRule: (b) => pick(NEW_RULE, b, '先做一个最小验证，再让反馈决定下一步'),
  getRealityDecision: (t) => pick(REALITY_DECISION, t, '只要拿到一条真实反馈，就用它修正下一步。'),
  GENERIC_PRODUCTIVITY_PAT,
  EXTERNAL_SIGNAL_PAT,
  // R34 human-copy + reality-test layer
  desiredStateLine,
  DESIRED_STATE,
  getDesiredState: (q4) => pick(DESIRED_STATE, q4, '把眼下的处境真正改变'),
  beliefLead,
  CARD02_LEAP,
  getCard02Leap: (b) => pick(CARD02_LEAP, b, '但没拿到真实反馈之前，你手里的判断都还只是猜测。'),
  C01_RULE_SHORT,
  C01,
  getC01RuleShort: (b) => pick(C01_RULE_SHORT, b, '沿用现在的做法'),
  getPartialShort: (q5) => pick(PARTIAL_SHORT, q5, '没看清原因'),
  CARD03_FAMILY,
  getCard03Family: (b) => pick(CARD03_FAMILY, b, 'LOOP'),
  getC03ContraDemand: (b) => pick(C03_CONTRA_DEMAND, b, '但你的规则一直在要求你：等准备好了再开始。'),
  getC03ContraMid: (b) => pick(C03_CONTRA_MID, b, '于是一遇到不确定，你就先停一下。'),
  getC03ContraResult: (b) => pick(C03_CONTRA_RESULT, b, '结果就是：越等，你越没有能推翻判断的东西。'),
  getC03AccStart: (b) => pick(C03_ACC_START, b, '每次你都靠一股劲开头。'),
  getC03AccMid: (b) => pick(C03_ACC_MID, b, '一旦停下来，之前那段的积累就全部作废。'),
  getC03AccCost: (b) => pick(C03_ACC_COST, b, '于是你一遍遍重启，却从来没有真正往前累积。'),
  getC03ReframeBehavior: (b) => pick(C03_REFRAME_BEHAVIOR, b, '你一直把“再打磨得更好一点”当作关键动作。'),
  getC03ReframeNot: (b) => pick(C03_REFRAME_NOT, b, '但它其实换不来一个真实用户的认可。'),
  getC03ReframeMid: (b) => pick(C03_REFRAME_MID, b, '于是一遇到不确定，你就先停下来反复琢磨。'),
  getC03ReframeTruth: (b) => pick(C03_REFRAME_TRUTH, b, '真正管用的，是有人真的为它买单。'),
  getC03LoopRelief: (b) => pick(C03_LOOP_RELIEF, b, '这一步让你暂时不用面对那个没把握的结果。'),
  getC03LoopCost: (b) => pick(C03_LOOP_COST, b, '但真实反馈始终没进来。'),
  C03_CONTRA_DEMAND,
  C03_CONTRA_MID,
  C03_CONTRA_RESULT,
  C03_ACC_START,
  C03_ACC_MID,
  C03_ACC_COST,
  C03_REFRAME_BEHAVIOR,
  C03_REFRAME_NOT,
  C03_REFRAME_MID,
  C03_REFRAME_TRUTH,
  C03_FS_KEEP,
  C03_FS_PAIN,
  C03_FS_COST,
  C03_FS_EXIT,
  getC03FsKeep: (b) => pick(C03_FS_KEEP, b, '于是你每次都只把上一次的做法原样再试。'),
  getC03FsPain: (b) => pick(C03_FS_PAIN, b, '这一步回避了当面确认失败的不适感。'),
  getC03FsCost: (b) => pick(C03_FS_COST, b, '但它也让原因一直不透明：你始终不知道它能不能再来一次。'),
  getC03FsExit: (b) => pick(C03_FS_EXIT, b, '下一次换个条件，你依然会回到同一个不确定里。'),
  getProblemRealization: (q4) => problemRealization(q4),
  C03_LOOP_RELIEF,
  C03_LOOP_COST,
  WORLD_ONE_LINER,
  getWorldOneLiner: (b) => pick(WORLD_ONE_LINER, b, '现实会给出答案。'),
  REALITY_TEST,
  getRealityTest: (t) => pick(REALITY_TEST, t, null),
  WEAK_SIGNAL_PAT,
  STRONG_SIGNAL_PAT,
  MEDIUM_SIGNAL_PAT,
  ECONOMIC_SIGNAL_PAT,
  evidenceStrength,
  singleWeakSignalOverclaim,
  consistencyTimeboxAsSuccess,
  HABIT_ONLY_PAT,
  MARKET_FACING_PAT,
  SIGNAL_TOPIC,
  DECISION_TOPIC,
  WRONG_RULE,
  WORLD_RULE_TAIL,
  MATCH_C01,
  C01_OUTCOME_NOUN,
  WHY_RULE_FAILS,
  STRUCTURAL_CONSEQUENCE,
  LOOP_NODE1,
  LOOP_NODE3,
  LOOP_NODE4,
  LOOP_NODE5,
  NEW_RULE,
  REALITY_DECISION
}
