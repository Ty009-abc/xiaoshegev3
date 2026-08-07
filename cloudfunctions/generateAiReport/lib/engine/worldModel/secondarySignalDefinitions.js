/**
 * engine/worldModel/secondarySignalDefinitions.js
 *
 * RC8.3 C2 — Secondary Signal Vocabulary.
 *
 * Secondary Signals are DIFFERENTIATORS, not primary detectors.
 * They help distinguish between confusable blind spots when
 * primary evidence is ambiguous.
 *
 * DESIGN CONSTRAINTS (HARD):
 * - Each signal MUST reference at least one C1 Boundary
 * - Each signal MUST have contradiction patterns
 * - Each signal MUST NOT directly determine Archetype, Blind Spot, or Strategy
 * - Each signal requires ≥ 2 evidence items OR 1 strong + 1 contextual
 * - Each signal MUST have minimumEvidence and ambiguityNotes
 * - NO occupation, income, or business semantics
 * - NO Golden Case special-casing
 *
 * SIGNAL vs PRIMARY SIGNAL:
 * Primary signals (signalDefinitions.js) detect behavioral patterns.
 * Secondary signals (this file) distinguish between confusable blind spots.
 * A secondary signal's value alone does NOT trigger a diagnosis;
 * it only shifts confidence between competing hypotheses.
 *
 * @version world_model_v2
 * @sprint c2-001
 */

const SECONDARY_SIGNALS = Object.freeze({

  // ═══════════════════════════════════════════════════════════════
  // PAIR 1: DECISION_INERTIA vs FEEDBACK_LOOP_GAP
  // ═══════════════════════════════════════════════════════════════

  // --- Decision-side differentiators ---

  WAITING_DURATION_PATTERN: {
    id: 'WAITING_DURATION_PATTERN',
    dimension: 'EXECUTION_ADAPTATION_GAP',
    description: '对决策推迟的时间跨度进行量化——区分"还在想"和"想了也忘了"',
    evidencePattern: '被推迟的关键决策可被识别，且有明确的时间边界（按周/月/年计量）',
    contradictionPattern: '所有决策都在主动推进中，不存在被长期搁置的选择',
    differentiates: {
      supports: 'DECISION_INERTIA',
      weakens: 'FEEDBACK_LOOP_GAP',
      rationale: '有明确推迟时间线的等待是惯性（INERTIA），没有等待期的低效是反馈缺口（FEEDBACK）'
    },
    doesNotDirectlyDetermine: ['blindSpot', 'archetype', 'strategy'],
    minimumEvidence: 2,
    ambiguityNotes: '短推迟（几天）是不确定性，长推迟（数月/年）是惯性。需要结合排除性信息（推迟期间做了什么）才能判断。'
  },

  MINIMUM_STEP_EXECUTION: {
    id: 'MINIMUM_STEP_EXECUTION',
    dimension: 'EXECUTION_ADAPTATION_GAP',
    description: '判断最小可行步骤是否被执行过——区分"不敢动"和"动了但没学到"',
    evidencePattern: '曾经执行过某个最小步骤（即使整体方向仍不确定），并从中获得了新信息',
    contradictionPattern: '所有已知选项均停留在心理推演层面，没有任何最小步骤进入真实测试',
    differentiates: {
      supports: 'FEEDBACK_LOOP_GAP',
      weakens: 'DECISION_INERTIA',
      rationale: '执行了最小步骤说明有决策能力（排除INERTIA），但没学到就是FEEDBACK'
    },
    doesNotDirectlyDetermine: ['blindSpot', 'archetype', 'strategy'],
    minimumEvidence: 2,
    ambiguityNotes: '单次最小步骤可能是被迫的。需要确认是否有过"主动、有意图"的最小步骤。'
  },

  // --- Feedback-side differentiators ---

  POST_ACTION_REVIEW_HABIT: {
    id: 'POST_ACTION_REVIEW_HABIT',
    dimension: 'EXECUTION_ADAPTATION_GAP',
    description: '判断行动后是否有系统性的复盘习惯——区分"行动了没复盘"和"根本没行动"',
    evidencePattern: '行动后有明确的复盘、记录、分析环节，且能说出至少2个具体收获',
    contradictionPattern: '行动后没有复盘习惯，无法说出从行动中学到的东西',
    differentiates: {
      supports: 'FEEDBACK_LOOP_GAP',
      weakens: 'DECISION_INERTIA',
      rationale: '有行动但无复盘→FEEDBACK。根本没有行动→INERTIA。'
    },
    doesNotDirectlyDetermine: ['blindSpot', 'archetype', 'strategy'],
    minimumEvidence: 2,
    ambiguityNotes: '有复盘但复盘内容空泛（"这次做得还行"）不算证据。需要具体的、可操作的学习内容。'
  },

  DECISION_TO_ACTION_LATENCY: {
    id: 'DECISION_TO_ACTION_LATENCY',
    dimension: 'EXECUTION_ADAPTATION_GAP',
    description: '判断"决定去做"和"实际开始做"之间的时间差',
    evidencePattern: '做出决定后立即或很快进入执行（几天内），有多个这样的案例',
    contradictionPattern: '即使做出了决定，执行也被显著推迟',
    differentiates: {
      supports: 'FEEDBACK_LOOP_GAP',
      weakens: 'DECISION_INERTIA',
      rationale: '决定后立即执行说明决策本身没问题→问题在反馈学习。决定后又拖延→INERTIA'
    },
    doesNotDirectlyDetermine: ['blindSpot', 'archetype', 'strategy'],
    minimumEvidence: 1,
    ambiguityNotes: '需要强证据（具体时间案例）+ 确认不是外部约束导致的延迟。单看信号不足以区分。'
  },

  // ═══════════════════════════════════════════════════════════════
  // PAIR 2: LEVERAGE_MODEL_GAP vs TIME_HORIZON_TRAP
  // ═══════════════════════════════════════════════════════════════

  // --- Leverage-side differentiators ---

  OUTPUT_DECOUPLING_AWARENESS: {
    id: 'OUTPUT_DECOUPLING_AWARENESS',
    dimension: 'RESOURCE_COMPOUNDING_GAP',
    description: '判断是否理解"做一次、用多次"的概念——区分"不会放大"和"不愿等待"',
    evidencePattern: '产出中存在可复用的元素（模板、系统、工具、内容资产），或曾经尝试创建',
    contradictionPattern: '所有产出的价值都与投入时间严格成比例，不存在复用模式',
    differentiates: {
      supports: 'LEVERAGE_MODEL_GAP',
      weakens: 'TIME_HORIZON_TRAP',
      rationale: '有复用意识说明杠杆模型存在（排除LEVERAGE），问题短视（可能是TIME）'
    },
    doesNotDirectlyDetermine: ['blindSpot', 'archetype', 'strategy'],
    minimumEvidence: 2,
    ambiguityNotes: '偶然的复用（如转发同一内容）不算。需要有意识地创建可独立于自己运行的价值产出。'
  },

  EFFORT_VS_MECHANISM_FRAMING: {
    id: 'EFFORT_VS_MECHANISM_FRAMING',
    dimension: 'RESOURCE_COMPOUNDING_GAP',
    description: '判断面对增长瓶颈时的思考方向——"更努力"还是"找放大机制"',
    evidencePattern: '在描述如何提升产出时，提到机制性的放大方法（而非增加个人努力）',
    contradictionPattern: '所有提升描述都集中在"多花时间"、"更努力"、"更专注"上',
    differentiates: {
      supports: 'LEVERAGE_MODEL_GAP',
      weakens: 'TIME_HORIZON_TRAP',
      rationale: '找放大机制→有杠杆思维，瓶颈在时间偏好。只会更努力→杠杆模型缺失'
    },
    doesNotDirectlyDetermine: ['blindSpot', 'archetype', 'strategy'],
    minimumEvidence: 2,
    ambiguityNotes: '在资源充足的背景下"更努力"有合理性。需要确认这是系统性思维模式而非特定情境。'
  },

  // --- Time-side differentiators ---

  DIRECTION_SWITCHING_FREQUENCY: {
    id: 'DIRECTION_SWITCHING_FREQUENCY',
    dimension: 'RESOURCE_COMPOUNDING_GAP',
    description: '判断方向切换的频率和原因——区分"不会放大"和"不愿等"',
    evidencePattern: '在一个方向上持续投入超过一年，且产出有加速趋势',
    contradictionPattern: '方向频繁切换（一年内 ≥ 3 次），每次切换的动机是"等不及看到结果"',
    differentiates: {
      supports: 'TIME_HORIZON_TRAP',
      weakens: 'LEVERAGE_MODEL_GAP',
      rationale: '频繁切换→时间偏好短，不是能力问题。持续但有瓶颈→可能是杠杆缺失'
    },
    doesNotDirectlyDetermine: ['blindSpot', 'archetype', 'strategy'],
    minimumEvidence: 2,
    ambiguityNotes: '方向切换可能是合理的（识别到更好的机会）。需要区分"理性转向"和"因不耐烦而转向"。'
  },

  LONG_TERM_COMPOUNDING_AWARENESS: {
    id: 'LONG_TERM_COMPOUNDING_AWARENESS',
    dimension: 'RESOURCE_COMPOUNDING_GAP',
    description: '判断是否理解长期投入的累积效应——区分"知道但不愿做"和"根本不知道"',
    evidencePattern: '在决策中参考了长期累积效应（如"三年后这个能力会到什么水平"），并有相关体验',
    contradictionPattern: '决策只评估短期收益，对持续投入的累积效果没有直觉',
    differentiates: {
      supports: 'TIME_HORIZON_TRAP',
      weakens: 'LEVERAGE_MODEL_GAP',
      rationale: '有复利意识但不执行→TIME（知道但不愿等）。没有复利意识→可能是杠杆模型缺失'
    },
    doesNotDirectlyDetermine: ['blindSpot', 'archetype', 'strategy'],
    minimumEvidence: 2,
    ambiguityNotes: '理论知识（读过书、听过概念）不等于有真实的复利体验。需要具体的个人体验案例。'
  },

  ALTERNATIVE_PATH_COST_AWARENESS: {
    id: 'ALTERNATIVE_PATH_COST_AWARENESS',
    dimension: 'RESOURCE_COMPOUNDING_GAP',
    description: '判断是否理解"切换成本"——区分"看不到杠杆"和"看到了但换了方向"',
    evidencePattern: '在面对新的方向诱惑时，能清楚地表达留在当前方向的价值损失',
    contradictionPattern: '方向切换行为频繁且每次切换时都认为"这次不一样"',
    differentiates: {
      supports: 'TIME_HORIZON_TRAP',
      weakens: 'LEVERAGE_MODEL_GAP',
      rationale: '低估切换成本→时间视野窄。看到了但不知道如何利用→可能是杠杆缺失'
    },
    doesNotDirectlyDetermine: ['blindSpot', 'archetype', 'strategy'],
    minimumEvidence: 2,
    ambiguityNotes: '有时切换确实是正确选择。关键看切换时是否系统性地低估了累积收益的损失。'
  },

  // ═══════════════════════════════════════════════════════════════
  // PAIR 3: RISK_MODEL_DISTORTION vs PROBABILITY_MISJUDGMENT
  // ═══════════════════════════════════════════════════════════════

  // --- Risk-side differentiators ---

  EMOTIONAL_RECENCY_IMPACT: {
    id: 'EMOTIONAL_RECENCY_IMPACT',
    dimension: 'PERCEPTION_RISK_GAP',
    description: '判断近期的情绪事件是否扭曲了风险感知——区分"判断被情绪扭曲"和"缺少判断工具"',
    evidencePattern: '最近经历了高情绪冲击的事件（重大失败/损失），且此后风险态度显著变化（过度谨慎或过度冒进）',
    contradictionPattern: '风险态度稳定，不受近期事件的明显影响',
    differentiates: {
      supports: 'RISK_MODEL_DISTORTION',
      weakens: 'PROBABILITY_MISJUDGMENT',
      rationale: '有扭曲工具→RISK。有概率框架但被情绪覆盖→也是RISK。完全没有概率框架→PROB'
    },
    doesNotDirectlyDetermine: ['blindSpot', 'archetype', 'strategy'],
    minimumEvidence: 2,
    ambiguityNotes: '重大事件后改变风险态度是正常的。关键看改变方向是否系统性地偏离了概率期望——例如避开了正不对称的路径。'
  },

  ABSTRACT_VS_EMBODIED_RISK_JUDGMENT: {
    id: 'ABSTRACT_VS_EMBODIED_RISK_JUDGMENT',
    dimension: 'PERCEPTION_RISK_GAP',
    description: '判断在抽象风险判断和切身风险判断上的表现差异——区分"分析能力存在但被压抑"和"根本没有分析能力"',
    evidencePattern: '在抽象场景（非个人相关）中能做出合理的风险判断，但涉及自身时判断显著不同',
    contradictionPattern: '无论在抽象场景还是个人场景中都缺乏风险分析能力',
    differentiates: {
      supports: 'RISK_MODEL_DISTORTION',
      weakens: 'PROBABILITY_MISJUDGMENT',
      rationale: '抽象准自身不准→分析工具存在但被情绪扭曲（RISK）。都不准→没有分析工具（PROB）'
    },
    doesNotDirectlyDetermine: ['blindSpot', 'archetype', 'strategy'],
    minimumEvidence: 2,
    ambiguityNotes: '需要确认"抽象风险判断准确"是真实的概率推理还是运气。一次准确判断是不够的。'
  },

  // --- Probability-side differentiators ---

  PROBABILISTIC_LANGUAGE_USAGE: {
    id: 'PROBABILISTIC_LANGUAGE_USAGE',
    dimension: 'FRAMEWORK_GAP',
    description: '判断是否使用概率框架而非确定性框架来表达不确定性',
    evidencePattern: '在讨论不确定结果时使用概率性语言（可能性、大概、八成、有几个可能），且能区分"有可能"和"高概率"',
    contradictionPattern: '所有不确定讨论都使用确定性框架（能/不能、成功/失败、做/不做）',
    differentiates: {
      supports: 'PROBABILITY_MISJUDGMENT',
      weakens: 'RISK_MODEL_DISTORTION',
      rationale: '用确定性语言→缺少概率框架（PROB）。用概率语言但不会评估→可能是RISK'
    },
    doesNotDirectlyDetermine: ['blindSpot', 'archetype', 'strategy'],
    minimumEvidence: 2,
    ambiguityNotes: '会说"可能"不等于有概率思维。需要看到概率分布思维（多个可能性的权重评估）。'
  },

  LUCK_VS_SKILL_ATTRIBUTION: {
    id: 'LUCK_VS_SKILL_ATTRIBUTION',
    dimension: 'FRAMEWORK_GAP',
    description: '判断能否区分运气和技能在结果中的贡献——区分"不会概率归因"和"情绪扭曲归因"',
    evidencePattern: '在回顾成功和失败时能够区分运气成分和技能成分，且分配合理',
    contradictionPattern: '成功全归因于能力，失败全归因于运气（或反过来）',
    differentiates: {
      supports: 'PROBABILITY_MISJUDGMENT',
      weakens: 'RISK_MODEL_DISTORTION',
      rationale: '不能区分运气/技能→概率框架缺失（PROB）。能区分但归因被扭曲→可能是RISK'
    },
    doesNotDirectlyDetermine: ['blindSpot', 'archetype', 'strategy'],
    minimumEvidence: 2,
    ambiguityNotes: '自利归因（成功归自己失败归外界）是普遍人类倾向，不一定是概率缺陷。需要系统性而非偶发的归因偏差。'
  },

  FEEDBACK_CALIBRATION_RATE: {
    id: 'FEEDBACK_CALIBRATION_RATE',
    dimension: 'FRAMEWORK_GAP',
    description: '判断在收到新证据后判断修正的幅度是否合理——区分"不会修正"和"修正被扭曲"',
    evidencePattern: '在收到关于自己判断的反馈后，修正幅度与新证据的信息量大致匹配',
    contradictionPattern: '收到新证据后要么完全不修正（固执），要么修正幅度与新证据信息量不匹配',
    differentiates: {
      supports: 'PROBABILITY_MISJUDGMENT',
      weakens: 'RISK_MODEL_DISTORTION',
      rationale: '不修正→概率框架缺失。修正方向被情绪扭曲→RISK'
    },
    doesNotDirectlyDetermine: ['blindSpot', 'archetype', 'strategy'],
    minimumEvidence: 1,
    ambiguityNotes: '需要强证据（具体的修正案例）。修正太快和太慢都可能指向概率框架缺失。'
  },

  // ═══════════════════════════════════════════════════════════════
  // PAIR 4: SYSTEM_THINKING_GAP vs FEEDBACK_LOOP_GAP
  // ═══════════════════════════════════════════════════════════════

  // --- System-thinking differentiators ---

  FEEDBACK_LOOP_CONCEPT_AWARENESS: {
    id: 'FEEDBACK_LOOP_CONCEPT_AWARENESS',
    dimension: 'FRAMEWORK_GAP',
    description: '判断是否理解反馈回路的概念——区分"有工具但不用"和"没有这个工具"',
    evidencePattern: '在解释现象时自发提到反馈回路、相互作用、二阶效应等概念，并给出具体案例',
    contradictionPattern: '所有解释都是线性因果（A→B→C），从不涉及相互作用和回路',
    differentiates: {
      supports: 'SYSTEM_THINKING_GAP',
      weakens: 'FEEDBACK_LOOP_GAP',
      rationale: '完全不用反馈概念→缺少框架（SYSTEM）。有框架但不用→行为问题（FEEDBACK）'
    },
    doesNotDirectlyDetermine: ['blindSpot', 'archetype', 'strategy'],
    minimumEvidence: 2,
    ambiguityNotes: '需要在不同领域都看到线性因果。单一领域的线性解释可能是该领域真的不复杂。'
  },

  CROSS_DOMAIN_FEEDBACK_THINKING: {
    id: 'CROSS_DOMAIN_FEEDBACK_THINKING',
    dimension: 'FRAMEWORK_GAP',
    description: '判断跨领域是否都能用反馈思维——区分"某领域没有反馈习惯"和"整个脑子都不会"',
    evidencePattern: '在某个领域（如工作）展现出反馈回路思维，但在另一个领域（如个人决策）没有',
    contradictionPattern: '无论在哪个领域，思维模式都是线性的',
    differentiates: {
      supports: 'FEEDBACK_LOOP_GAP',
      weakens: 'SYSTEM_THINKING_GAP',
      rationale: '某领域有反馈思维→框架存在（不是SYSTEM），另一领域没有→行为缺失（FEEDBACK）'
    },
    doesNotDirectlyDetermine: ['blindSpot', 'archetype', 'strategy'],
    minimumEvidence: 2,
    ambiguityNotes: '在某些领域简化思维是适应性的。需要在多个不相关领域都不使用反馈思维才能支持SYSTEM。'
  },

  LINEARTY_VS_COMPLEXITY_DEFAULT: {
    id: 'LINEARTY_VS_COMPLEXITY_DEFAULT',
    dimension: 'FRAMEWORK_GAP',
    description: '判断面对复杂现象时默认的归因方式——区分"默认线性归因"和"有复杂思维但没数据"',
    evidencePattern: '面对失败/意外结果时，归因多样且涉及多个相互作用因素',
    contradictionPattern: '面对失败时，归因总是落在单一、直接的最近一步原因上',
    differentiates: {
      supports: 'SYSTEM_THINKING_GAP',
      weakens: 'FEEDBACK_LOOP_GAP',
      rationale: '单一归因是线性思维特征（SYSTEM）。多因素归因说明有系统思维→问题在数据收集（FEEDBACK）'
    },
    doesNotDirectlyDetermine: ['blindSpot', 'archetype', 'strategy'],
    minimumEvidence: 2,
    ambiguityNotes: '有时单一根因确实存在。需要看这是系统性的归因模式还是特定情况的合理简化。'
  },

  // ═══════════════════════════════════════════════════════════════
  // PAIR 5: OPPORTUNITY_BLINDNESS vs IDENTITY_CONSTRAINT
  // ═══════════════════════════════════════════════════════════════

  // --- Opportunity-side differentiators ---

  INFORMATION_SOURCE_DIVERSITY: {
    id: 'INFORMATION_SOURCE_DIVERSITY',
    dimension: 'PERCEPTION_RISK_GAP',
    description: '判断信息摄入的广度和多样性——区分"看不到路径"和"看到了但被身份过滤"',
    evidencePattern: '日常信息来自多个领域和多种来源（≥ 3 个不同领域），接触不同类型的人和想法',
    contradictionPattern: '信息摄入来源单一（基本上只有一个领域或类型），很少接触领域外的内容',
    differentiates: {
      supports: 'OPPORTUNITY_BLINDNESS',
      weakens: 'IDENTITY_CONSTRAINT',
      rationale: '来源单一→信息接触面小→看不到路径（OPPORTUNITY）。来源多样→信息充足→看不到→可能是IDENTITY'
    },
    doesNotDirectlyDetermine: ['blindSpot', 'archetype', 'strategy'],
    minimumEvidence: 2,
    ambiguityNotes: '来源数量多但内容同质化不等于多样性。需要确认信息来源在领域和类型上有真正的差异。'
  },

  SERENDIPITOUS_PATH_DISCOVERY: {
    id: 'SERENDIPITOUS_PATH_DISCOVERY',
    dimension: 'PERCEPTION_RISK_GAP',
    description: '判断是否有过"偶然通过外部接触发现重要路径"的经历——区分"信息面窄"和"信息充足但身份过滤"',
    evidencePattern: '曾通过偶然的外部接触（非计划内的）发现了重要的新方向或路径',
    contradictionPattern: '从未有过偶然发现，所有已知路径都来自固有圈子',
    differentiates: {
      supports: 'OPPORTUNITY_BLINDNESS',
      weakens: 'IDENTITY_CONSTRAINT',
      rationale: '没有偶然发现→信息面窄→OPPORTUNITY。有偶然发现但没利用→可能是IDENTITY过滤了'
    },
    doesNotDirectlyDetermine: ['blindSpot', 'archetype', 'strategy'],
    minimumEvidence: 2,
    ambiguityNotes: '有些人有偶然发现但未能利用，可能指向IDENTITY而非OPPORTUNITY。需要看发现后的行为。'
  },

  NON_DOMAIN_PATH_AWARENESS: {
    id: 'NON_DOMAIN_PATH_AWARENESS',
    dimension: 'PERCEPTION_RISK_GAP',
    description: '判断对自身领域之外路径的认知程度——区分"没听说过"和"听说过但觉得不是我"',
    evidencePattern: '能描述至少 2-3 个不同领域的人如何实现目标的具体路径（即使与自己不同）',
    contradictionPattern: '对自身领域之外的实现路径基本没有了解',
    differentiates: {
      supports: 'OPPORTUNITY_BLINDNESS',
      weakens: 'IDENTITY_CONSTRAINT',
      rationale: '不了解其他路径→信息面窄→OPPORTUNITY。了解但不考虑→IDENTITY在过滤'
    },
    doesNotDirectlyDetermine: ['blindSpot', 'archetype', 'strategy'],
    minimumEvidence: 2,
    ambiguityNotes: '需要确认"不了解"是因为信息面窄还是因为身份过滤导致不主动了解。'
  },

  // --- Identity-side differentiators ---

  IDENTITY_BASED_EXCLUSION: {
    id: 'IDENTITY_BASED_EXCLUSION',
    dimension: 'FRAMEWORK_GAP',
    description: '判断选择排除是否基于身份标签——区分"被身份过滤"和"被信息面限制"',
    evidencePattern: '在解释为什么不走某条路时，使用身份类表述（"我是XX类型的人"、"这不适合我这种人"、"我干不了那种事"）',
    contradictionPattern: '排除路径的理由都基于外部信息或实际评估，而非身份标签',
    differentiates: {
      supports: 'IDENTITY_CONSTRAINT',
      weakens: 'OPPORTUNITY_BLINDNESS',
      rationale: '用身份标签排除→IDENTITY。基于实际信息排除→可能是OPPORTUNITY（只了解有限信息）'
    },
    doesNotDirectlyDetermine: ['blindSpot', 'archetype', 'strategy'],
    minimumEvidence: 2,
    ambiguityNotes: '合理的自我认知和身份约束是不同的。需要区分"我是XX所以我会XX"和"我是XX所以我不做XX"。前者是认知，后者是约束。'
  },

  CROSS_IDENTITY_ATTEMPT_HISTORY: {
    id: 'CROSS_IDENTITY_ATTEMPT_HISTORY',
    dimension: 'FRAMEWORK_GAP',
    description: '判断是否有过跨身份边界的尝试——区分"身份被锁定"和"信息面窄"',
    evidencePattern: '曾经尝试过与当前自我定义不一致的方向，且从中获得了信息（即使尝试后放弃）',
    contradictionPattern: '从未尝试过任何与自我定义不符的事情',
    differentiates: {
      supports: 'IDENTITY_CONSTRAINT',
      weakens: 'OPPORTUNITY_BLINDNESS',
      rationale: '有跨身份尝试→身份不是绝对锁定的（可能不是IDENTITY）。从未尝试→可能双重问题'
    },
    doesNotDirectlyDetermine: ['blindSpot', 'archetype', 'strategy'],
    minimumEvidence: 2,
    ambiguityNotes: '有尝试但失败了就退回→可能是IDENTITY（身份被"验证"加固）而非自由的探索。'
  },

  SELF_ASSESSMENT_ASYMMETRY: {
    id: 'SELF_ASSESSMENT_ASYMMETRY',
    dimension: 'FRAMEWORK_GAP',
    description: '判断自我能力评估是否存在排除vs确认方向的不对称——区分"身份过滤器"和"无信息"',
    evidencePattern: '在排除不适合的路径时非常自信，但在确认适合的路径时证据要求很低——或反之',
    contradictionPattern: '排除和确认两个方向的评估标准一致',
    differentiates: {
      supports: 'IDENTITY_CONSTRAINT',
      weakens: 'OPPORTUNITY_BLINDNESS',
      rationale: '排除方向不严格、确认方向严格→身份过滤器在运行（IDENTITY）。两边一致→可能是OPPORTUNITY'
    },
    doesNotDirectlyDetermine: ['blindSpot', 'archetype', 'strategy'],
    minimumEvidence: 2,
    ambiguityNotes: '需要在多个决策案例中看到不对称模式。单个案例的不对称可能是合理的背景知识差异。'
  }
})

// ═══════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════

/**
 * Returns all secondary signals relevant to a specific blind spot.
 */
function getSignalsForBlindSpot(blindSpotId) {
  const results = []
  Object.keys(SECONDARY_SIGNALS).forEach(function(key) {
    const s = SECONDARY_SIGNALS[key]
    if (s.differentiates.supports === blindSpotId || s.differentiates.weakens === blindSpotId) {
      results.push(s)
    }
  })
  return results
}

/**
 * Returns all secondary signals relevant to a blind spot pair.
 */
function getSignalsForPair(idA, idB) {
  const results = []
  Object.keys(SECONDARY_SIGNALS).forEach(function(key) {
    const s = SECONDARY_SIGNALS[key]
    const diff = s.differentiates
    if ((diff.supports === idA && diff.weakens === idB) ||
        (diff.supports === idB && diff.weakens === idA)) {
      results.push(s)
    }
  })
  return results
}

/**
 * Returns the dimension label for a secondary signal.
 */
function getSignalDimension(signalKey) {
  const s = SECONDARY_SIGNALS[signalKey]
  return s ? s.dimension : null
}

/**
 * Validates a secondary signal definition has all required fields.
 */
function validateSignal(signalKey) {
  const s = SECONDARY_SIGNALS[signalKey]
  if (!s) return { valid: false, error: 'NOT_FOUND', signal: signalKey }

  const required = ['id', 'dimension', 'description', 'evidencePattern',
    'contradictionPattern', 'differentiates', 'doesNotDirectlyDetermine',
    'minimumEvidence', 'ambiguityNotes']
  const missing = required.filter(f => !s[f])

  if (missing.length > 0) return { valid: false, error: 'MISSING_FIELDS', signal: signalKey, missing }

  if (s.minimumEvidence < 1) return { valid: false, error: 'MIN_EVIDENCE_TOO_LOW', signal: signalKey }

  return { valid: true, signal: signalKey }
}

/**
 * Lists all secondary signal IDs.
 */
function getAllSignalIds() {
  return Object.keys(SECONDARY_SIGNALS)
}

module.exports = {
  SECONDARY_SIGNALS,
  getSignalsForBlindSpot,
  getSignalsForPair,
  getSignalDimension,
  validateSignal,
  getAllSignalIds
}
