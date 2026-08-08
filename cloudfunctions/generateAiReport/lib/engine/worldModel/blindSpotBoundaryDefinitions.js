/**
 * engine/worldModel/blindSpotBoundaryDefinitions.js
 *
 * RC8.3 Phase 1C Sprint 1 — Blind Spot Boundary Architecture.
 *
 * DESIGN CONSTRAINT:
 * These boundaries describe COGNITIVE MODEL DEFECTS.
 * They must hold true even if all occupation, income, business,
 * and commercial contexts are removed.
 *
 * No signal IDs. No scoring weights. No inference rules.
 * Pure boundary architecture.
 *
 * @version world_model_v1
 * @sprint c1-adr-002, c1-adr-003a, c1-adr-003b, c1-adr-002r
 */

const BLIND_SPOT_BOUNDARIES = Object.freeze({

  // ==========================================================
  // BOUNDARY 1: DECISION_INERTIA
  // ==========================================================

  DECISION_INERTIA: {
    id: 'DECISION_INERTIA',
    title: '决策惯性',
    supportedWorldPrinciples: ['DECISION_CREATES_INFORMATION'],
    coreQuestion: '这个人是否“知道存在选择，但关键决策长期没有进入真实行动或实验”？',
    definition: '决策惯性是一种认知模式缺陷：当一个人面临需要决策的情境时，系统性地将决策推迟，等待更多确定性或更优条件。这种延迟不仅推迟了行动，更根本地阻止了信息进入系统——因为未做出的决策产生零新信息。内部模型因此停滞更新。',
    mechanism: '当一个人持续等待“足够的信息”或“更好的时机”再做决策时，他们忽略了决策本身是信息的首要来源。每一个决策与世界的交互都会产生决策前无法获得的新数据。延迟决策 = 延迟信息获取 = 模型越来越不准确。这是一个自我强化的循环：模型越不准确，越不敢决策；越不敢决策，模型越不准确。',
    necessaryConditions: [
      {
        condition: '存在明确的可选决策但长期未被采取',
        description: '不是“不知道有什么选择”，而是知道选择但持续推迟。必须有至少一个被认知到但未执行的选项，且推迟时间显著超过正常决策周期。'
      },
      {
        condition: '推迟的核心原因是等待更高确定性',
        description: '不是因为缺少资源、能力或外部约束，而是因为内部认为“还不够确定”、“还没准备好”、“需要更多信息”。追求确定性本身成为行为的主要模式。'
      },
      {
        condition: '推迟行为是模式而非单次事件',
        description: '不是一次性的审慎考虑。而是反复出现的模式：在不同领域、不同时间点都表现出类似的决策延迟。'
      }
    ],
    necessaryConditionPolicy: Object.freeze({ operator: 'ALL_OF' }),
    differentiatingEvidence: [
      {
        evidence: '决策推迟的时长显著超过信息收集的边际价值',
        distinguishes: '区分于“合理的信息收集”：当额外等待几乎不会带来更多有用信息时仍在等待，属于惯性而非审慎。'
      },
      {
        evidence: '已获取的信息足够做出有意义的下一步，但决策仍未发生',
        distinguishes: '区分于“信息不足”：信息已经足够做出下一步的最小实验，但仍在等待。'
      },
      {
        evidence: '推迟的决策不止一个领域，而是跨领域的模式',
        distinguishes: '区分于“特定领域的合理谨慎”：如果推迟模式出现在多个不相关领域，说明这是认知模式而非情境选择。'
      }
    ],
    contradictingEvidence: [
      {
        evidence: '已经在多个方向进行小规模测试或实验',
        explanation: '如果已经进入行动-反馈循环，则决策惯性已经被打破。'
      },
      {
        evidence: '近期确实做出了不可逆的关键决策',
        explanation: '做出不可逆决策是决策惯性的反面——决策惯性恰恰是回避不可逆决策。'
      },
      {
        evidence: '基于反馈主动调整了后续决策',
        explanation: '如果已经在用反馈更新决策，则问题不是决策缺失，而是反馈质量——属于 Feedback Loop Gap 而非 Decision Inertia。'
      }
    ],
    disqualifyingEvidence: [
      {
        evidence: '持续进行多方向的小规模实验',
        effect: '如果一个人在持续做实验，他们就在产生信息、更新模型——无论实验大小。直接排除 Decision Inertia。'
      },
      {
        evidence: '有明确的不可逆决策已完成并进入执行阶段',
        effect: '已经做出并执行了不可逆决策，说明决策本身没有被惯性阻止。'
      }
    ],
    ambiguityConditions: [
      {
        condition: '存在少量行动但无法判断是否构成“实验循环”',
        description: '用户可能做过一两次尝试，但不足以确定是“正在行动”还是“还没真正开始”。这种情况下 DECISION_INERTIA 和 FEEDBACK_LOOP_GAP 之间的边界模糊。'
      },
      {
        condition: '有决策意图但被外部约束阻止',
        description: '不是内部惯性而是外部条件不允许——需要区分内部模式缺陷和外部约束。'
      }
    ],
    missingEvidenceHints: ['需要知道：推迟决策的时间跨度（周？月？年？）', '需要知道：在推迟期间是否进行了任何形式的测试、尝试或信息收集', '需要知道：是否存在一个具体可执行的最小步骤被考虑过但未执行'],
    commonMisclassification: [
      {
        confusedWith: 'FEEDBACK_LOOP_GAP',
        whyConfused: '两者都涉及“没有进展”的观察。但原因完全不同：INERTIA 是没有决策→没有信息→没有进展；FEEDBACK_GAP 是有决策有行动但没有反馈→没有学习→没有进展。外观相似（进展停滞），机制不同（决策缺失 vs 学习缺失）。',
        boundaryResolution: '关键区分变量：是否存在持续行动的证据。如果有持续行动，优先考虑 FEEDBACK_LOOP_GAP。如果主要是等待、犹豫、计划但未执行，优先考虑 DECISION_INERTIA。'
      },
      {
        confusedWith: 'TIME_HORIZON_TRAP',
        whyConfused: '推迟长期决策看起来像“短期偏好”，但决策惯性的人可能也想做长期决策——只是等。TIME_HORIZON_TRAP 是选择了短期，DECISION_INERTIA 是什么都没选。',
        boundaryResolution: '如果有短期决策被做出和执行的证据 → TIME_HORIZON_TRAP。如果连短期决策也推迟 → DECISION_INERTIA。'
      }
    ],
    reasoningTemplate: {
      observation: '观察到的模式：在多个需要决策的领域，用户系统性地推迟做出关键选择。推迟不是因为缺少信息（已有足够信息做出最小实验），而是因为等待更高确定性。',
      explanation: '这个模式说明用户的内部模型正在阻止新信息的流入。每一个未做出的决策都是一个被关闭的信息通道。系统处于信息产生停滞状态——不是因为世界不提供信息，而是因为用户不与世界交互。',
      whyNotFeedbackLoopGap: '不是 Feedback Loop Gap，因为这里的问题不是“行动了但没有复盘”——而是根本没有进入行动-反馈循环。决策尚未发生。',
      whyNotTimeHorizonTrap: '不是 Time Horizon Trap，因为推迟的不仅是长期决策——短期决策也同样被推迟。这不是时间偏好问题，而是决策启动问题。',
      whyNotRiskModelDistortion: '不是 Risk Model Distortion，因为等待的原因不是“害怕风险会带来损失”——而是“不确定结果会是什么”。这是信息需求问题，不是风险感受问题。',
      conclusion: '决策惯性是一个信息产生缺陷：用户的世界模型因为缺乏新数据输入而停滞更新。首要改善方向不是“更勇敢”或“接受风险”，而是“让决策产生信息”——通过最小可逆实验打破信息停滞。'
    },
    falsePositivePatterns: [
      {
        pattern: '外部条件暂时性地阻止了可观察的行动（如市场冻结、审批流程、不可抗力），而非内部决策推迟模式',
        whyNotBlindSpot: '外部条件解除后该人会积极行动，说明这不是内部认知缺陷，而是对外部约束的合理响应。决策惯性要求推迟是内部的、模式化的。'
      },
      {
        pattern: '处于合理的信息收集阶段，正在等一个确定的关键证据到达后再决策',
        whyNotBlindSpot: '如果有明确的证据门槛——且该门槛是事先设定的、合理的——等待不是惯性，而是审慎的决策流程。区分标准：等待是否有预定义的结束条件，还是一直在等到足够确定。'
      }
    ],
    externalConstraints: [
      {
        constraint: '外部强制等待期（如监管审批、第三方依赖、合同排他期）',
        type: 'EXTERNAL'
      },
      {
        constraint: '当前不可逆的高风险环境使谨慎策略成为最理性选择',
        type: 'EXTERNAL'
      }
    ],
    recoveryPrinciple: '决策惯性修复后，关键选择进入行动测试——每一个被执行的决策都在产生此前无法获得的新信息。内部模型从静止转为持续更新。不是变得勇敢，而是变得有信息。',
    primaryViolatedWorldPrinciple: 'DECISION_CREATES_INFORMATION',
    secondaryViolatedWorldPrinciples: []
  },

  // ==========================================================
  // BOUNDARY 2: FEEDBACK_LOOP_GAP
  // ==========================================================

  FEEDBACK_LOOP_GAP: {
    id: 'FEEDBACK_LOOP_GAP',
    title: '反馈回路断裂',
    supportedWorldPrinciples: ['FEEDBACK_UPDATES_MODELS'],
    coreQuestion: '这个人是否“在行动，但行动的结果没有稳定进入下一轮模型更新”？',
    definition: '反馈回路断裂是一种认知模式缺陷：一个人确实在做出决策和采取行动，但这些行动产生的结果信号没有被系统性地采集、分析、并整合到后续决策中。行动在发生，信息在产生，但信息没有被转化为模型更新。世界在向这个人说话，但没有人听。',
    mechanism: '行动产生信号。但信号只有被观察、记录和处理后才成为信息。如果一个人行动后不做复盘、不记录结果、不根据结果调整方法，那么每一次行动都相当于“第一次”——因为过去的经验没有被编码到模型中。这导致重复相同的错误、无法识别成功的模式、行动效率不随时间提升。与 Decision Inertia 不同：Feedback Loop Gap 的人行动了，只是没有学习。',
    necessaryConditions: [
      {
        condition: '存在持续的行动证据',
        description: '必须有证据表明这个人确实在采取行动、做出尝试——而不是仅仅在思考或计划。没有持续行动，无法诊断 Feedback Loop Gap。'
      },
      {
        condition: '缺少系统性的行动后复盘',
        description: '行动后的复盘（记录结果、分析原因、提取规律）不存在或极为薄弱。行动的结果不会被系统地用于指导下一次行动。'
      },
      {
        condition: '行动方法缺乏基于结果的迭代变化',
        description: '即使重复行动，方法、策略、路径缺乏基于过去结果的有意义调整。第二次行动的方式与第一次几乎一样，无论第一次的结果如何。'
      }
    ],
    necessaryConditionPolicy: Object.freeze({ operator: 'ALL_OF' }),
    differentiatingEvidence: [
      {
        evidence: '有多次行动但行动方式高度重复，缺少基于结果的调整',
        distinguishes: '区分于“正在学习”：如果行动方式在根据结果变化，说明反馈回路是完整的。如果方式不变，说明结果没有进入决策系统。'
      },
      {
        evidence: '面对失败或不满意的结果，反应是“再试一次”而非“分析为什么”',
        distinguishes: '区分于 Decision Inertia：这里的人在行动（不是在等），但没有在行动后思考。'
      },
      {
        evidence: '无法说出上一次行动的具体收获或教训',
        distinguishes: '区分于“隐性学习”：如果一个人能够清晰描述从过去经验中学到的东西，反馈回路是工作的。'
      }
    ],
    contradictingEvidence: [
      {
        evidence: '有清晰的复盘习惯，能描述从行动中学到的具体教训',
        explanation: '复盘习惯说明反馈回路是完整的——结果被接收和处理了。'
      },
      {
        evidence: '行动策略在不同尝试之间有可观察的变化和改进',
        explanation: '策略变化说明反馈正在驱动决策更新。'
      },
      {
        evidence: '会主动寻求外部反馈并根据反馈调整',
        explanation: '主动寻求反馈说明存在反馈需求，这是反馈回路正在运行的强信号。'
      }
    ],
    disqualifyingEvidence: [
      {
        evidence: '存在系统性的行动后复盘并形成了可记录的教训',
        effect: '系统复盘直接说明反馈回路完整。排除 Feedback Loop Gap。'
      },
      {
        evidence: '策略调整频率和质量与行动次数匹配',
        effect: '每次行动都有对应的策略更新，说明反馈回路正常工作。'
      }
    ],
    ambiguityConditions: [
      {
        condition: '有行动和部分调整，但无法确定调整是基于反馈还是随机变化',
        description: '策略确实在变，但不确定变化的原因——是因为从反馈中学到了，还是因为不耐烦或随机尝试。'
      },
      {
        condition: '行动次数不足，无法判断是否存在反馈模式',
        description: '只有一两次行动，不足以确定是否存在“反馈断裂”的模式。可能只是还没行动够。'
      }
    ],
    missingEvidenceHints: ['需要知道：行动后的复盘频率和深度', '需要知道：是否能够描述上一次行动的具体收获', '需要知道：第二次行动相对于第一次行动有什么基于反馈的调整'],
    commonMisclassification: [
      {
        confusedWith: 'DECISION_INERTIA',
        whyConfused: '两者都表现为“进展缓慢”。但机制不同：INERTIA 是决策缺失，FEEDBACK_GAP 是学习缺失。决策惯性的人没开始，反馈断裂的人开始了但没在学。',
        boundaryResolution: '关键区分变量：是否存在持续行动。有行动 → FEEDBACK_LOOP_GAP。主要是等待/犹豫/计划 → DECISION_INERTIA。'
      },
      {
        confusedWith: 'SYSTEM_THINKING_GAP',
        whyConfused: '两者都涉及“缺少反馈”。但 SYSTEM_THINKING_GAP 是缺少系统思维工具（不理解和利用反馈回路的概念），FEEDBACK_LOOP_GAP 是行为层面的缺失（有需求但缺少执行）。前者是认知工具缺失，后者是行为习惯缺失。',
        boundaryResolution: '如果这个人在其他领域（如工作、学习）有良好的复盘习惯 → 不是系统思维缺失。如果在所有领域都没有复盘 → 可能是系统思维缺失。'
      }
    ],
    reasoningTemplate: {
      observation: '观察到的模式：这个人在多个领域采取行动，但行动后的复盘和学习环节缺失或极为薄弱。行动在产生数据，但这些数据没有被用来改进下一次行动。',
      explanation: '这是一个反馈断裂的模式。世界正在提供信号，但这些信号没有被转化为模型更新。这个人实际上在用“再试一次”代替“分析一次”。每次行动的结果没有留下痕迹。',
      whyNotDecisionInertia: '不是 Decision Inertia，因为这个人确实在行动——不是等待、犹豫、或停留在计划阶段。问题不在于“不开始”，而在于“开始以后不学习”。',
      whyNotSystemThinkingGap: '不是 System Thinking Gap，因为这个问题可能仅限于特定领域（非工作领域），且这个人在其他领域可能有完整的反馈习惯。如果所有领域都缺复盘，才考虑系统思维缺失。',
      whyNotLeverageModelGap: '不是 Leverage Model Gap，因为核心缺陷在于“不学习”而非“不会放大”。即使这个人学会了杠杆思维，如果反馈回路断裂，杠杆也无法有效运作——因为没有反馈就无法知道杠杆是否在起作用。',
      conclusion: '反馈回路断裂是一个学习缺陷：信息在产生但没有被捕获。首要改善方向不是“行动更多”或“更聪明地行动”，而是“建立反馈仪式”——让每一次行动都强制产生至少一条明确的学习记录。'
    },
    falsePositivePatterns: [
      {
        pattern: '该人已有系统性的复盘习惯并依据复盘结果调整了后续行动',
        whyNotBlindSpot: '如果有证据表明该人在持续地收集、分析和应用反馈来调整策略，这直接排除反馈回路断裂。学习循环不需要完美，只需要存在且运行。'
      },
      {
        pattern: '行动次数还不足以形成稳定的反馈模式——处于探索初期',
        whyNotBlindSpot: '两三行动不足以区分是反馈断裂（不学习）还是样本不足（在学习但不稳定）。区分需要更多行动数据。在早期阶段的样本不足不是认知缺陷。'
      }
    ],
    externalConstraints: [
      {
        constraint: '行动的环境不提供可观测的结果信号（如某些创造性工作的市场反馈延迟数月到数年）',
        type: 'EXTERNAL'
      },
      {
        constraint: '反馈来源本身具有系统性偏差，使得即使收集了也难以准确学习',
        type: 'EXTERNAL'
      }
    ],
    recoveryPrinciple: '反馈回路修复后，每一次行动产生的结果信号都被系统性地采集、分析和整合到下一轮决策中。模型不再从零开始——每一次循环都站在前一次的肩膀上。',
    primaryViolatedWorldPrinciple: 'FEEDBACK_UPDATES_MODELS',
    secondaryViolatedWorldPrinciples: []
  },

  // ==========================================================
  // BOUNDARY 3: LEVERAGE_MODEL_GAP
  // ==========================================================

  LEVERAGE_MODEL_GAP: {
    id: 'LEVERAGE_MODEL_GAP',
    title: '杠杆模型缺失',
    supportedWorldPrinciples: ['LEVERAGE_MULTIPLIES_VALUE'],
    coreQuestion: '这个人的价值交付结构是否"高度依赖重复的个人投入，缺少可复制、可复用、可扩展的机制"？',
    definition: '杠杆模型缺失是一种认知模式缺陷：一个人的价值交付结构是线性的——每一单位产出需要大致相等的一单位个人投入。他们不理解或未曾应用将产出与个人投入解耦的机制。结果是被个人时间和精力的上限严格限制。',
    mechanism: '杠杆的本质是让一次投入能够跨时间、跨规模、跨网络重复产生价值。没有杠杆，一个人的产出严格受限于他能投入的时间。有杠杆，相同的投入可以服务更多的人、产生更多的价值、在不增加个人投入的情况下增长。杠杆模型缺失的人可能非常勤奋，但他们的勤奋是线性的——没有放大机制。',
    necessaryConditions: [
      {
        condition: '价值交付模式以直接个人投入为主',
        description: '产生的价值（无论是知识、劳动、服务还是创作）主要依赖个人直接投入。没有中间层、没有系统、没有可复用的资产来放大个人努力。'
      },
      {
        condition: '缺少对价值放大机制的认知或应用',
        description: '要么不理解“产出可以不随投入线性增长”的概念，要么理解但没有应用。核心是：放大机制不在其世界观中。'
      },
      {
        condition: '没有正在建设的可复用资产',
        description: '没有正在构建的工具、流程、内容、系统、网络或其他可以在不增加个人投入的情况下持续产生价值的资产。'
      }
    ],
    necessaryConditionPolicy: Object.freeze({ operator: 'ALL_OF' }),
    differentiatingEvidence: [
      {
        evidence: '投入与产出高度线性相关——更多产出只能来自更多个人时间',
        distinguishes: '区分于“正在建设杠杆”：如果已经存在非线性的产出增长，杠杆模型就是存在的。'
      },
      {
        evidence: '对“如何让同一份努力服务更多人”没有明确的思路或尝试',
        distinguishes: '区分于 TIME_HORIZON_TRAP：有时间缺陷的人可能知道杠杆但追求短期，有杠杆缺陷的人不知道或不追求杠杆。'
      },
      {
        evidence: '解决问题的方式始终是“自己多做”而非“让别人/系统/工具来做”',
        distinguishes: '区分于“个人偏好独立工作”：不是更喜欢自己做，而是不知道怎么做才能不依赖自己。'
      }
    ],
    contradictingEvidence: [
      {
        evidence: '已经在使用能够脱离个人时间产生价值的工具或系统',
        explanation: '存在可复用资产说明杠杆模型已经在运作。'
      },
      {
        evidence: '能够描述如何让价值产出不依赖个人直接投入',
        explanation: '有杠杆认知说明思维模型中没有缺失。'
      },
      {
        evidence: '正在建设可复用的资产（工具、流程、内容、网络）',
        explanation: '主动建设杠杆说明理解并追求放大机制。'
      }
    ],
    disqualifyingEvidence: [
      {
        evidence: '已有可复用的系统或资产正在脱离个人投入产生价值',
        effect: '可复用资产的存在直接排除杠杆缺失。可能还有其他缺陷，但不是这个。'
      },
      {
        evidence: '明确在追求价值放大而非价值直接交换',
        effect: '有放大意图说明杠杆认知存在。'
      }
    ],
    ambiguityConditions: [
      {
        condition: '有放大潜力但尚未验证——介于认知和应用之间',
        description: '理解了杠杆的概念也有想法，但尚未实践。在这种情况下，很难区分“理解了但没机会”和“没理解所以没行动”。'
      },
      {
        condition: '与 TIME_HORIZON_TRAP 共存',
        description: '一个人可能既缺少杠杆认知，也偏向短期决策。两者不是互斥的，但需要区分主因——是“不知道放大”还是“不愿意等待放大”。'
      }
    ],
    missingEvidenceHints: ['需要知道：是否存在任何“做一次、用多次”的产出', '需要知道：是否有过“投入减少但产出增加”的具体案例', '需要知道：面对增长瓶颈，优先考虑的是“更努力”还是“找放大机制”'],
    commonMisclassification: [
      {
        confusedWith: 'TIME_HORIZON_TRAP',
        whyConfused: '两者都可以表现为“线性增长”或“没有指数增长”。但原因不同：LEVERAGE_GAP 是价值结构本身无法放大——即使等很久也不会放大。TIME_TRAP 是价值结构可能可以放大，但因为追求短期收益而不愿意等待。',
        boundaryResolution: '关键区分：如果这个人长期专注于一件事但产出线性 → LEVERAGE_GAP。如果这个人频繁换方向、无法在任何方向上积累足够时间 → TIME_HORIZON_TRAP。长期主义 + 线性交付 = LEVERAGE_GAP。短期主义 + 不积累 = TIME_TRAP。'
      },
      {
        confusedWith: 'OPPORTUNITY_BLINDNESS',
        whyConfused: '缺少杠杆可能看起来像“看不到杠杆机会”。但 OPPORTUNITY_BLINDNESS 是看不到任何外部路径，LEVERAGE_GAP 是看不到（或不信任）放大机制本身。',
        boundaryResolution: '如果这个人能看到其他方向但不知道如何放大 → LEVERAGE_GAP。如果这个人根本看不到其他方向 → OPPORTUNITY_BLINDNESS。'
      }
    ],
    reasoningTemplate: {
      observation: '观察到的模式：这个人的价值交付完全依赖个人直接投入。产出 = 投入。他们没有正在建设的可复用资产，也没有探索让产出脱离个人时间的机制。',
      explanation: '这是一个价值结构缺陷。这个人被困在一对一交付模型中——每一个单位的价值都需要一个单位的个人投入。这不是时间不够的问题——即使有无限时间，这个结构也不会自然产生放大。',
      whyNotTimeHorizonTrap: '不是 Time Horizon Trap，因为这个人可能非常有耐心、长期专注一件事。但专注的内容是线性的——等再久也不会从线性变成非线性。时间偏好正常但价值结构线性 → LEVERAGE_GAP。',
      whyNotOpportunityBlindness: '不是 Opportunity Blindness，因为这个人可能看到很多外部机会，只是在每一个机会中都以一对一的方式交付价值。视野没问题，放大机制缺失。',
      whyNotFeedbackLoopGap: '不是 Feedback Loop Gap，因为这个人可能复盘很好——从行动中学到了东西。但学到的是“如何更好地做线性交付”，而不是“如何放大”。',
      conclusion: '杠杆模型缺失是一个价值结构缺陷：产出与投入强绑定。首要改善方向不是“更努力”或“更多时间”，而是“让一次投入重复产生价值”——将个人产出转化为可复用的资产。'
    },
    falsePositivePatterns: [
      {
        pattern: '该人已有可复用的系统或资产在脱离个人时间产生价值——只是尚未达到期望的规模',
        whyNotBlindSpot: '如果存在正在运行的可复用机制（即使规模不大），杠杆认知已经存在并在运作——不是缺失。规模问题是成长问题，不是认知缺陷。'
      },
      {
        pattern: '外部资源约束（缺少启动资金、工具或基础设施）暂时限制了杠杆建设',
        whyNotBlindSpot: '如果该人理解和追求杠杆但受外部资源限制，这是环境约束而非认知缺陷。他们缺少的不是杠杆思维，而是实现杠杆的资源。'
      }
    ],
    externalConstraints: [
      {
        constraint: '生存压力迫使个人将全部时间用于直接换取基本收入',
        type: 'EXTERNAL'
      },
      {
        constraint: '当前环境缺乏支持杠杆建设的基础设施或平台',
        type: 'EXTERNAL'
      }
    ],
    recoveryPrinciple: '杠杆模型建立后，价值产出不再是个人投入的线性函数。一次投入可以在多个维度、多个时间点同时产生价值。个人时间不再是产出的硬上限——系统作为乘数开始运作。',
    primaryViolatedWorldPrinciple: 'LEVERAGE_MULTIPLIES_VALUE',
    secondaryViolatedWorldPrinciples: []
  },

  // ==========================================================
  // BOUNDARY 4: TIME_HORIZON_TRAP
  // ==========================================================

  TIME_HORIZON_TRAP: {
    id: 'TIME_HORIZON_TRAP',
    title: '时间视野陷阱',
    supportedWorldPrinciples: ['TIME_COMPOUNDS_ADVANTAGE'],
    coreQuestion: '这个人的决策窗口是否“系统性过短，短期收益持续压过长期复利和选择空间”？',
    definition: '时间视野陷阱是一种认知模式缺陷：一个人的决策优化窗口过短，系统性地偏爱立即可见的小收益，而放弃需要时间积累才能显现的大收益。这不是“不喜欢长期规划”——而是对时间复利的运作方式缺乏直观理解，导致在比较短期和长期选项时，系统性地低估长期选项的价值。',
    mechanism: '时间复利不是线性增长——它是一个加速函数。在前期看起来缓慢的积累，在越过临界点后会产生爆发性增长。时间视野短的人只看到前期的平坦部分，因此切换方向、追求即时的正反馈、放弃需要等待的累积。结果是永远停留在复利曲线的平坦段，从未到达加速段。',
    necessaryConditions: [
      {
        condition: '决策中系统性偏向短期收益',
        description: '在选择中反复出现“选快的而非大的”的模式。不是一次性的应急决策，而是跨领域的模式。'
      },
      {
        condition: '频繁切换方向，很少在任何方向上积累足够长的时间',
        description: '在同一个方向上的持续投入时间不足（远低于该方向产生显著复利所需的时间），经常在复利开始显现之前就转向新方向。'
      },
      {
        condition: '缺少对长期积累价值的明确配置',
        description: '没有在时间、精力或资源上为需要长期积累才能显现的东西做明确配置。所有的投入都指向短期可见的回报。'
      }
    ],
    necessaryConditionPolicy: Object.freeze({ operator: 'AT_LEAST_N', minimum: 2 }),
    differentiatingEvidence: [
      {
        evidence: '方向切换频率显著高于该方向产生复利所需的时间',
        distinguishes: '区分于“在多个方向同时积累”：如果每个方向都有持续投入，这不是陷阱。陷阱的特征是放弃旧的、开始新的，而非叠加。'
      },
      {
        evidence: '放弃的方向中，有一些在放弃时已经接近或达到复利临界点',
        distinguishes: '区分于“合理的策略调整”：如果在积累已经开始产生加速度时放弃，说明不是策略判断而是时间偏好缺陷。'
      },
      {
        evidence: '无法说出任何一个已经持续投入超过一年的积累方向',
        distinguishes: '区分于“多才多艺”：如果没有任何方向有超过一年的持续积累，说明时间视野不足以支撑任何复利过程。'
      }
    ],
    contradictingEvidence: [
      {
        evidence: '有明确方向持续投入了显著时间（超过该领域的复利临界点）',
        explanation: '长期持续投入说明时间视野足够支撑复利。'
      },
      {
        evidence: '能够为了长期收益忍受短期的低回报',
        explanation: '存在延迟满足的能力，说明时间偏好正常。'
      },
      {
        evidence: '决策时明确考虑长期复利效应',
        explanation: '复利思维说明时间视野不是缺陷。'
      }
    ],
    disqualifyingEvidence: [
      {
        evidence: '在至少一个方向上有跨年度的持续积累且产出正在加速',
        effect: '跨年度的复利积累直接说明时间视野足够。排除 Time Horizon Trap。'
      },
      {
        evidence: '当前的主要投入方向明确指向长期价值——短期回报是次要考虑',
        effect: '长期优先的资源配置模式与 Time Horizon Trap 矛盾。'
      }
    ],
    ambiguityConditions: [
      {
        condition: '方向切换有合理原因（环境变化、信息更新）而非单纯不耐烦',
        description: '需要区分“合理的策略调整”和“时间偏好缺陷驱动的频繁切换”。环境变化导致的切换可能是理性的，但难以从外部判断。'
      },
      {
        condition: '与 LEVERAGE_MODEL_GAP 共存',
        description: '一个人可能既偏向短期决策，也缺少杠杆认知。两个缺陷可以共存且互相强化：短期偏好让人更不愿意建设需要时间的杠杆，杠杆缺失让长期积累的回报更低。'
      }
    ],
    missingEvidenceHints: ['需要知道：在一个方向上的持续投入时间最长有多久', '需要知道：最近三次方向切换的原因是什么（是结果不满意？还是看到更好的机会？还是不耐烦？）', '需要知道：是否有任何持续投入超过一年且产出开始加速的经历'],
    commonMisclassification: [
      {
        confusedWith: 'LEVERAGE_MODEL_GAP',
        whyConfused: '两者都可以表现为“没有指数增长”。但原因不同：TIME_HORIZON_TRAP 的人可能拥有杠杆认知和杠杆能力，但不愿意等。LEVERAGE_MODEL_GAP 的人可能愿意等，但等的东西本身不是可复利的。',
        boundaryResolution: '关键区分：如果一个人的资源配置模式是长期 + 线性 → LEVERAGE_GAP。如果一个人的资源配置模式是短期 + 频繁切换 → TIME_HORIZON_TRAP。长期专注但专注在无法放大的东西 vs 不愿意在任何东西上等待足够长的时间。'
      },
      {
        confusedWith: 'DECISION_INERTIA',
        whyConfused: '频繁切换方向看上去像“一直在犹豫”。但 DECISION_INERTIA 是什么都不选，TIME_HORIZON_TRAP 是选了但待不住。',
        boundaryResolution: '如果这个人快速做出决策并开始执行（只是很快又换方向）→ TIME_HORIZON_TRAP。如果这个人在做出决策这一步就卡住 → DECISION_INERTIA。'
      }
    ],
    reasoningTemplate: {
      observation: '观察到的模式：这个人的决策窗口很短。在可以选择“快的小的”和“慢的大大的”时，系统性地选择前者。任何方向的投入都在复利开始显现之前就中断了。',
      explanation: '这是一个时间偏好缺陷。这个人可能非常活跃、执行力很强——但所有的执行力都投向了短期窗口。他们从未体验过复利曲线的加速段，因此对“坚持下去会怎样”缺乏直观理解。每一次切换都让他们从复利曲线的起点重新开始。',
      whyNotLeverageModelGap: '不是 Leverage Model Gap，因为这个人可能非常擅长杠杆——每个短期项目中都有效率放大的机制。问题是这些项目都没有积累——复利需要时间，而这个人给每个项目的时间都不够。杠杆已存在但不够等待 → TIME_HORIZON_TRAP。',
      whyNotDecisionInertia: '不是 Decision Inertia，因为这个人确实在不断地做出决策和执行——速度还很快。问题不是“不动”，而是“动得太频繁，以至于任何方向都来不及积累”。',
      whyNotFeedbackLoopGap: '不是 Feedback Loop Gap，因为这个人可能复盘很好——从每次短期项目中都学到了东西。学到的东西被用来指导下一次选择。反馈回路是完整的，时间视野是短的。',
      conclusion: '时间视野陷阱是一个复利缺陷：方向切换太快，以至于从不经历复利。首要改善方向不是“更努力”或“更聪明”，而是“给一个方向足够长的时间”——选定一个方向，承诺一个非平凡的最低持有期，在持有期内不做方向切换。'
    },
    falsePositivePatterns: [
      {
        pattern: '在探索阶段有意识地尝试多个方向以收集信息——每个方向的停留时间预先设为与信息收集需求匹配',
        whyNotBlindSpot: '如果有明确的探索计划且每个方向的停留时间与学习目标匹配，这是策略性探索，不是时间视野缺陷。区分标准：是否有预先设定的评估点和切换标准。'
      },
      {
        pattern: '外部时限或环境紧急情况迫使短期内做出快速调整',
        whyNotBlindSpot: '在外部危机（如紧急财务义务、健康突发事件）中优先短期决策是适应性行为。当外部压力解除后自然恢复，说明这不是时间偏好缺陷。'
      }
    ],
    externalConstraints: [
      {
        constraint: '外部环境高度不稳定，使得长期规划的信息基础不可靠',
        type: 'EXTERNAL'
      },
      {
        constraint: '紧迫的短期义务暂时压缩了长期规划的空间',
        type: 'EXTERNAL'
      }
    ],
    recoveryPrinciple: '时间视野扩展后，决策窗口从短期扩展到了长期。每一个选择不仅评估当前的收益，还评估其在一年、三年、五年后的累积效应。复利不再是一个概念——而是一个被纳入每个决策的维度。',
    primaryViolatedWorldPrinciple: 'TIME_COMPOUNDS_ADVANTAGE',
    secondaryViolatedWorldPrinciples: []
  },

  // ==========================================================
  // BOUNDARY 5: OPPORTUNITY_BLINDNESS
  // ==========================================================

  OPPORTUNITY_BLINDNESS: {
    id: 'OPPORTUNITY_BLINDNESS',
    title: '机会盲区',
    supportedWorldPrinciples: ['OPPORTUNITY_EMERGES_THROUGH_EXPOSURE'],
    coreQuestion: '这个人的信息接触面和模式识别能力的交集是否过窄，导致客观上存在的可选路径在其感知范围内不可见？',
    definition: '机会盲区是一种认知暴露缺陷：一个人的信息获取渠道过窄，接触的人群、领域、问题类型高度同质化，导致客观上遍布世界的机会在其主观感知范围内不存在。这不是能力问题——这是感知范围问题。',
    mechanism: '机会的可见性取决于两个变量的乘积：信息接触面和模式识别能力。两者中任意一个过小，乘积就过小，能感知到的机会就很少。机会盲区的人问题在于接触面——他们只看得到自己已经熟悉的领域中的路径。世界很大，但他们只从一个小窗口向外看。',
    necessaryConditions: [
      {
        condition: '信息接触面显著过窄',
        description: '日常接触的人、信息源、领域高度同质化。大多数时间都在与相同类型的人交流、消费相同类型的信息、处理相同类型的问题。跨领域的输入很少或为零。'
      },
      {
        condition: '对自身领域之外的路径缺乏认知',
        description: '无法描述或想象自身当前领域之外的可选方向。当被问及还有哪些可能时，答案局限在已有的认知范围内——不是拒绝其他选项，而是看不到。'
      },
      {
        condition: '具备识别和利用机会的基本能力',
        description: '如果此人碰巧接触到机会，他们是能够识别和利用的。问题不在于能力缺陷，而在于接触面缺陷。'
      }
    ],
    necessaryConditionPolicy: Object.freeze({ operator: 'ALL_OF' }),
    differentiatingEvidence: [
      {
        evidence: '能看到自己领域内部的变化和路径，但对领域外几乎一无所知',
        distinguishes: '区分于IDENTITY_CONSTRAINT：身份约束的人拒绝外面看到的路径。机会盲区的人是看不到外面有路径——不是拒绝，是无知。'
      },
      {
        evidence: '社交和信息圈高度同质化，缺乏跨领域接触',
        distinguishes: '区分于DECISION_INERTIA：有机会盲区的人可能在已知领域内决策很快——只是决策范围被限制在很小的可见范围内。'
      },
      {
        evidence: '对别人是怎么发现那种方向的缺乏直观理解',
        distinguishes: '区分于LEVERAGE_MODEL_GAP：后者知道方向但不知道怎么放大。前者连方向本身都看不见。'
      }
    ],
    contradictingEvidence: [
      {
        evidence: '信息接触面广泛多元，能够描述多个不相关领域的路径',
        explanation: '广泛的跨域接触说明信息接触面足够大。排除机会盲区。'
      },
      {
        evidence: '正在主动探索自身领域之外的路径并收集信息',
        explanation: '主动跨域探索说明已经在扩大接触面。'
      },
      {
        evidence: '能够识别和描述不在当前领域内的具体外部机会',
        explanation: '有能力看到外部路径说明机会感知系统在运行。'
      }
    ],
    disqualifyingEvidence: [
      {
        evidence: '有持续且多样的跨领域信息摄入',
        effect: '跨领域的信息摄入直接排除信息接触面过窄。'
      },
      {
        evidence: '在过去一年内通过外部接触发现了新的方向并开始探索',
        effect: '通过外部接触发现了新方向说明机会感知系统完整运作。'
      }
    ],
    ambiguityConditions: [
      {
        condition: '信息接触面不窄但不能识别机会——可能是模式识别问题',
        description: '接触面大但看不到机会，不是接触面问题，可能是模式识别或其他问题。需要区分看到了但不认为是自己的（IDENTITY）和就是没看到（OPPORTUNITY）。'
      },
      {
        condition: '有外部约束限制了接触面的扩大',
        description: '如果是因为环境约束（地理位置、语言、经济条件等）导致接触面窄，这属于External Constraint而非Cognitive Blind Spot。'
      }
    ],
    missingEvidenceHints: ['需要知道：日常信息摄入的来源数量和多样性', '需要知道：是否曾经通过偶然的外部接触发现了重要路径', '需要知道：对自身领域之外的路径了解程度'],
    commonMisclassification: [
      {
        confusedWith: 'IDENTITY_CONSTRAINT',
        whyConfused: '两者都可以表现为不考虑某些路径。但机制完全不同：OPPORTUNITY是看不到——路径不在感知范围内。IDENTITY是看到了但排除——路径被身份模型过滤掉。前者是信息问题，后者是身份问题。',
        boundaryResolution: '关键区分：如果这个人能描述但不考虑→IDENTITY。如果这个人无法描述（因为确实不知道）→OPPORTUNITY。'
      },
      {
        confusedWith: 'DECISION_INERTIA',
        whyConfused: '两者都可以表现为没有新行动。但机会盲区的人是在可见范围内积极行动，只是可见范围太小。决策惯性的人是在可见范围内也不行动。',
        boundaryResolution: '如果这个人在自己领域内主动做决策和行动→OPPORTUNITY（接触面问题）。如果在自己领域内也系统性地推迟决策→DECISION_INERTIA。'
      }
    ],
    falsePositivePatterns: [
      {
        pattern: '正在深度专注一个方向，暂时减少跨域探索',
        whyNotBlindSpot: '深度专注期暂时缩小信息接触面是策略性选择，而非结构性缺陷。这属于合理的时间配置，不是认知盲区。'
      },
      {
        pattern: '位于信息隔离的环境中（外部约束）',
        whyNotBlindSpot: '环境约束导致的接触面狭窄是External Constraint，不是Cognitive Blind Spot。区分标准：如果换到开放环境后接触面显著扩大，则不是认知缺陷。'
      }
    ],
    externalConstraints: [
      {
        constraint: '地理位置导致无法扩展接触面',
        type: 'EXTERNAL'
      },
      {
        constraint: '经济条件限制无法覆盖信息获取成本',
        type: 'EXTERNAL'
      },
      {
        constraint: '当前责任限制了自由探索时间',
        type: 'EXTERNAL'
      }
    ],
    recoveryPrinciple: '机会盲区修复后，世界模型的变化是：信息接触面显著扩大，跨领域的信息开始流入内部模型，可选路径的感知数量倍增。这个人开始看到之前看不到的路径——不是因为世界变了，而是因为观察世界的窗口变大了。',
    reasoningTemplate: {
      observation: '观察到的模式：这个人在自己的熟悉领域内运作得很好，但似乎不知道领域之外有哪些可行的方向。不是拒绝外部——而是感知不到。信息摄入高度同质化。',
      explanation: '这是一个信息接触面缺陷。机会分布在世界的各个角落，但如果一个人的信息摄入渠道始终不变，能感知到的机会范围就不会扩大。这个人的问题不是如何选择——而是只有少数选项可见。',
      whyNotIdentityConstraint: '不是Identity Constraint，因为当这个人碰巧接触到外部机会时，他们表现出的是好奇和兴趣，而非防御和排除。问题在于接触少，不在于拒绝。',
      whyNotDecisionInertia: '不是Decision Inertia，因为这个人在可见范围内的决策和行动是积极的。他们不是在等——他们是在一个很小的已知范围内积极行动。可见范围内没有问题，可见范围本身太小。',
      conclusion: '机会盲区是一个信息暴露缺陷：不是能力不够，而是接触面太窄。首要改善方向是扩大信息接触面——增加跨领域的信息源、接触不同类型的人、进入不熟悉的场景。'
    },
    primaryViolatedWorldPrinciple: 'OPPORTUNITY_EMERGES_THROUGH_EXPOSURE',
    secondaryViolatedWorldPrinciples: []
  },

  // ==========================================================
  // BOUNDARY 6: RISK_MODEL_DISTORTION
  // ==========================================================

  RISK_MODEL_DISTORTION: {
    id: 'RISK_MODEL_DISTORTION',
    title: '风险建模失真',
    supportedWorldPrinciples: ['RISK_IS_ASYMMETRICAL'],
    coreQuestion: '这个人的风险感知是否被非概率因素系统性扭曲，导致对下行和上行的判断偏离实际分布？',
    definition: '风险建模失真是一种认知评估缺陷：一个人对风险的判断不是基于实际概率和后果的分布，而是被情绪、近因效应、社会影响等因素扭曲。结果是系统性地高估某些风险（通常是可见的、情绪化的风险）而低估另一些风险（通常是不可见的、缓慢积累的或属于遗漏错误的风险）。',
    mechanism: '人类的风险感知系统有两个通道：快速的情感通道（对生动、近期的危险产生强烈反应）和缓慢的分析通道（计算概率、后果、不对称性）。风险建模失真的人情感通道过度活跃，分析通道未被充分使用。结果是对可能的损失的反应强度主要取决于损失的可见性和情绪冲击，而非实际概率或数量级。这导致对低概率但高可见性的风险过度反应，同时对高概率但低可见性的风险几乎无视。',
    necessaryConditions: [
      {
        condition: '对风险的判断与客观概率分布存在系统性偏差',
        description: '不是一次性的判断失误，而是反复出现的模式——某些类型的风险被系统性地高估，另一些被系统性地低估。'
      },
      {
        condition: '风险判断主要受非概率因素驱动',
        description: '对风险的感受更多来自它是否吓人而非它有多可能。近期经历的突出事件（近因效应）显著影响风险判断。'
      },
      {
        condition: '对风险不对称性的识别困难',
        description: '要么将所有风险视为对称危险（不区分散度），要么只看到风险的一面（只看到下行而忽略上行，或只看上行而忽略下行）。'
      }
    ],
    necessaryConditionPolicy: Object.freeze({ operator: 'AT_LEAST_N', minimum: 2 }),
    differentiatingEvidence: [
      {
        evidence: '对高概率但渐进的风险（如长期暴露的累积风险）反应不足',
        distinguishes: '区分于PROBABILITY_MISJUDGMENT：后者是整体认知框架不支持概率思维，前者是情感扭曲了本该准确的概率判断。'
      },
      {
        evidence: '对低概率但高情绪冲击的事件（如罕见但吓人的损失）过度反应',
        distinguishes: '区分于健康的谨慎：过度反应的程度与客观威胁不匹配，且该模式跨领域复现。'
      },
      {
        evidence: '能够理解概率概念，但在面对具象化风险场景时判断偏移',
        distinguishes: '区分于PROBABILITY_MISJUDGMENT：这个人的抽象概率推理可能是正常的，但在具象情境中被情绪压倒。'
      }
    ],
    contradictingEvidence: [
      {
        evidence: '能够冷静评估风险的概率和后果分布并据此行动',
        explanation: '系统的风险分析能力说明分析通道在运行。'
      },
      {
        evidence: '对近期发生的不利事件能够保持概率视角',
        explanation: '能够抵抗近因效应——未被高情绪冲击事件扭曲近期判断。'
      },
      {
        evidence: '明确使用最坏情况、最可能情况、最好情况等多场景分析',
        explanation: '多场景分析说明在思考分布而非点估计。'
      }
    ],
    disqualifyingEvidence: [
      {
        evidence: '有系统的风险评估框架并以分析推理为主导',
        effect: '分析推理为主导说明风险模型基本校准良好。排除严重失真。'
      },
      {
        evidence: '能够在高情绪情境中维持分析性风险判断',
        effect: '情绪不影响理性分析→风险建模未失真。'
      }
    ],
    ambiguityConditions: [
      {
        condition: '对特定领域的风险判断明显不准，但其他领域正常',
        description: '可能是领域经验不足导致的特定领域不准确，而非全局风险建模缺陷。需要区分全局认知缺陷和特定领域知识不足。'
      },
      {
        condition: '风险判断偏差与环境压力高度相关',
        description: '如果在低压力环境下风险判断准确，这更像情绪调节问题而非认知模型结构缺陷。'
      }
    ],
    missingEvidenceHints: ['需要知道：在抽象的（非情绪性的）风险判断任务上的表现', '需要知道：最近是否经历了高情绪冲击的负面事件（近因效应检验）', '需要知道：在不同类型风险（社会风险、物质风险、机会风险）上的判断一致性'],
    commonMisclassification: [
      {
        confusedWith: 'PROBABILITY_MISJUDGMENT',
        whyConfused: '两者都导致对风险的判断不准。但机制不同：RISK_MODEL_DISTORTION是情感扭曲了分析——认知工具存在但被情绪压制。PROBABILITY_MISJUDGMENT是认知工具不存在——根本不会概率思维。前者是算得准但不用，后者是不会算。',
        boundaryResolution: '关键区分：如果这个人的抽象概率推理正常但具象场景偏离→RISK。如果抽象概率推理也明显有问题→PROBABILITY。'
      },
      {
        confusedWith: 'DECISION_INERTIA',
        whyConfused: '被恐惧主导的不作为看起来像决策惯性。但机制不同：RISK是不动因为判断风险太高（虽然实际不高）。DECISION_INERTIA是不动因为觉得信息不够——不是因为怕。',
        boundaryResolution: '如果不作为的原因是万一失败了怎么办→RISK。如果不作为的原因是还不够确定→INERTIA。'
      }
    ],
    falsePositivePatterns: [
      {
        pattern: '在真实高风险环境中的谨慎',
        whyNotBlindSpot: '如果当前环境客观上确实高风险，谨慎是适应性的，不是认知失真。失真只存在于判断与实际概率分布偏离的情况。'
      },
      {
        pattern: '对特定罕见事件的关注是因为有专业知识',
        whyNotBlindSpot: '如果在某个领域有专业知识，对特定罕见风险有更强的感知是合理的——因为知道外行人不知道的危险。这不属于失真。'
      }
    ],
    externalConstraints: [
      {
        constraint: '真实的高风险环境（战争、经济崩溃、法律风险等）',
        type: 'EXTERNAL'
      },
      {
        constraint: '缺乏可靠的风险信息来源',
        type: 'EXTERNAL'
      },
      {
        constraint: '过去发生过的严重创伤事件影响了风险感知基线',
        type: 'EXTERNAL_PSYCHOLOGICAL'
      }
    ],
    recoveryPrinciple: '风险建模失真修复后，世界模型的变化是：这个人对风险的判断开始基于概率分布和不对称性分析，而非情绪强度和可见性。他们能够区分吓人的风险和真实危险的风险，能够看到上行机会中的不对称性，不因可见的损失可能性而放弃概率上有利的选择。',
    reasoningTemplate: {
      observation: '观察到的模式：这个人对风险的反应强度与客观威胁水平不匹配。某些低概率但高情绪冲击的风险被放得很大，某些高概率但低可见性的风险几乎不被察觉。情绪似乎在引导——甚至取代——分析判断。',
      explanation: '这是一个风险情感失真问题。人脑有两个风险通道——快速情感通道和缓慢分析通道。当前情感通道占据了通路，分析通道被绕过。结果不是不会分析风险——可能是分析在纸上，决策不用分析。',
      whyNotProbabilityMisjudgment: '不是Probability Misjudgment，因为如果给这个人一个抽象的概率题，他们可能算得对。问题在于面对具象情境时，概率知识被情绪淹没。会算但不用不等于不会算。',
      whyNotDecisionInertia: '不是Decision Inertia，因为这个人的不行动可能是有选择的——在低风险领域他们行动很快。只有在风险感知被扭曲的领域才犹豫。全局决策惯性不会区分领域。',
      conclusion: '风险建模失真是一个情感-分析平衡缺陷：分析通道存在但没有在关键时刻启用。首要改善方向是建立风险分析仪式——在做涉及风险的决策前，强制自己写下最坏情况、最可能情况、最好情况以及各自的概率估计，用书面分析顶替情感直觉。'
    },
    primaryViolatedWorldPrinciple: 'RISK_IS_ASYMMETRICAL',
    secondaryViolatedWorldPrinciples: ['PROBABILITY_GOVERNS_OUTCOMES']
  },

  // ==========================================================
  // BOUNDARY 7: PROBABILITY_MISJUDGMENT
  // ==========================================================

  PROBABILITY_MISJUDGMENT: {
    id: 'PROBABILITY_MISJUDGMENT',
    title: '概率误判',
    supportedWorldPrinciples: ['PROBABILITY_GOVERNS_OUTCOMES'],
    coreQuestion: '这个人的认知框架是否不支持概率思维——将复杂结果以分布而非确定性方式理解？',
    definition: '概率误判是一种认知框架缺陷：一个人的思维模型主要以二元确定性方式运作（对/错、成功/失败、安全/危险），缺乏将结果理解为概率分布的能力。这导致他们将单次结果视为模型正确性的证据，将随机波动视为模式，将低概率但易想象的事件高估。',
    mechanism: '人类的默认思维模式是确定性的——寻找明确的因果链和确定的结论。概率思维需要额外的认知努力：思考多种可能的结果、评估每种结果的可能性、接受不确定性的存在。概率误判的人缺少这一认知层次——他们的世界模型中没有概率分布的概念。结果是：用单一样本做结论、混淆运气和技能、被近期的突出事件过度影响。',
    necessaryConditions: [
      {
        condition: '思考结果时缺乏概率框架',
        description: '不使用例如有百分之X的可能、可能是A/B/C几种结果的思维。默认使用会成功/会失败、好/坏的二元框架。'
      },
      {
        condition: '将单次结果视为模型验证证据',
        description: '一次成功等于方法正确，一次失败等于方法错误。没有意识到单次结果可能是随机波动。'
      },
      {
        condition: '对概率和统计概念缺乏基本理解',
        description: '缺乏基础的贝叶斯思维——先有先验，再根据新证据更新。没有大数定律、回归均值的直觉。'
      }
    ],
    necessaryConditionPolicy: Object.freeze({ operator: 'ALL_OF' }),
    differentiatingEvidence: [
      {
        evidence: '用单次成功或失败来评价整个策略或路径',
        distinguishes: '区分于RISK_MODEL_DISTORTION：后者可能理解概率但被情绪扭曲。这里是根本不理解概率——用了错误的分析框架。'
      },
      {
        evidence: '对随机性和运气缺乏直觉理解',
        distinguishes: '区分于信息不足：即使给了充分数据，仍然以二元方式解读。'
      },
      {
        evidence: '在需要评估比例、频率、趋势的问题上反复给出点估计',
        distinguishes: '区分于特定领域知识不足：不仅在一个领域而是在所有涉及不确定性的问题上都使用确定性框架。'
      }
    ],
    contradictingEvidence: [
      {
        evidence: '使用例如有七成把握、大概率会这样的表达方式',
        explanation: '概率性表达说明思维框架中有概率维度。'
      },
      {
        evidence: '能够区分运气和技能在结果中的贡献',
        explanation: '区分运气和技能是概率思维的核心能力。'
      },
      {
        evidence: '做决策时考虑多种可能的结果并分配置信度',
        explanation: '多场景思维说明概率框架存在。'
      }
    ],
    disqualifyingEvidence: [
      {
        evidence: '清晰地使用概率语言描述不确定性并据此做决策',
        effect: '概率语言的使用直接说明概率思维框架存在。'
      },
      {
        evidence: '在给定新证据后能够合理地更新之前的判断',
        explanation: '贝叶斯更新是概率思维的核心标志。做到这一点说明概率框架完整。'
      }
    ],
    ambiguityConditions: [
      {
        condition: '对特定领域（如金融、医学）缺乏概率知识，但其他领域正常',
        description: '可能是领域知识不足而非全局概率认知缺陷。'
      },
      {
        condition: '概率判断偏差与风险情绪高度重合',
        description: '当情感的近因效应和概率判断同时影响，难以区分是概率框架缺陷还是情感扭曲。'
      }
    ],
    missingEvidenceHints: ['需要知道：在涉及不确定性的问题时，是否使用概率性语言而非确定性语言', '需要知道：能否区分运气和技能在具体结果中的贡献', '需要知道：在收到关于自己判断的反馈后，修正幅度是否对应新证据的强度'],
    commonMisclassification: [
      {
        confusedWith: 'RISK_MODEL_DISTORTION',
        whyConfused: '两者都导致对不确定性情境的判断不准。但机制不同：PROBABILITY是认知工具不存在——根本不会概率思维。RISK是认知工具存在但被情绪压制——会算但不用。前者是能力缺陷，后者是执行缺陷。',
        boundaryResolution: '关键区分：抽象概率推理是否正常。如果给一个不涉及情感的风险题也会算错→PROBABILITY。如果抽象没问题但面对吓人场景时出错→RISK。'
      },
      {
        confusedWith: 'FEEDBACK_LOOP_GAP',
        whyConfused: '将单次结果当作全部证据看起来像缺乏反馈循环。但概率误判的人可能有反馈，只是解读反馈的方式是错误的——用二元框架解读概率信号。',
        boundaryResolution: '如果有复盘习惯但仍以二元方式理解结果→PROBABILITY。如果完全没有复盘习惯→FEEDBACK_LOOP_GAP。'
      }
    ],
    falsePositivePatterns: [
      {
        pattern: '在情绪激动时暂时使用极端语言',
        whyNotBlindSpot: '在强烈的情绪状态下使用绝对化表达是暂时的，不代表整体的概率思维缺失。'
      },
      {
        pattern: '在确定性很高的领域使用确定性语言',
        whyNotBlindSpot: '有些问题客观上确实很确定。在真高确定性的问题上不用概率语言是合理的。'
      }
    ],
    externalConstraints: [
      {
        constraint: '缺乏统计和概率教育背景',
        type: 'EXTERNAL_EDUCATIONAL'
      },
      {
        constraint: '所处文化环境不鼓励概率性思维',
        type: 'EXTERNAL_CULTURAL'
      }
    ],
    recoveryPrinciple: '概率思维建立后，世界模型的变化是：这个人开始将每一个结果视为一个样本点而非最终结论。他们能区分信号和噪声，接受不确定性的存在而不因此瘫痪。决策质量不再依赖单次结果——而是基于长期的期望值。',
    reasoningTemplate: {
      observation: '观察到的模式：这个人在讨论选择、结果和未来时，几乎全部使用二元确定性语言。成功/失败、对/错、安全/危险。没有中间地带，没有概率梯度。',
      explanation: '这是一个概率框架缺失问题。人的默认认知模式是确定性的——寻找明确的因果链。概率思维需要额外的认知层次：思考多种可能的结果、评估每种结果的可能性。这个人缺少这一层次。',
      whyNotRiskModelDistortion: '不是Risk Model Distortion，因为如果给这个人一个不涉及情感的概率问题，他们也可能算错。问题不是情感干扰了分析，而是分析工具本身不存在——不会概率思维。',
      whyNotFeedbackLoopGap: '不是Feedback Loop Gap，因为这个人可能复盘很好——但复盘的方式是二元评价（成功/失败），而非概率分析（这次的结果在哪个分位数）。反馈存在但被错误框架解读。',
      conclusion: '概率误判是一个认知框架缺陷：世界在提供概率信号，但接收器只能解读二元信号。首要改善方向不是更冷静或更勇敢，而是建立概率思维基础——学习理解分布、样本、方差，将不确定性纳入世界模型。'
    },
    primaryViolatedWorldPrinciple: 'PROBABILITY_GOVERNS_OUTCOMES',
    secondaryViolatedWorldPrinciples: []
  },

  // ==========================================================
  // BOUNDARY 8: IDENTITY_CONSTRAINT
  // ==========================================================

  IDENTITY_CONSTRAINT: {
    id: 'IDENTITY_CONSTRAINT',
    title: '身份约束',
    supportedWorldPrinciples: ['IDENTITY_CONSTRAINS_CHOICES'],
    coreQuestion: '这个人的自我身份模型是否在发挥排他性过滤作用——将客观上可用的选择排除在感知到的可选范围之外？',
    definition: '身份约束是一种认知过滤缺陷：一个人的自我认知（我是谁）形成了一个隐性的选择过滤器。每个我是X的身份陈述同时也否定了大量我是Y的可能性。当身份定义过于狭窄或刚化时，大量客观上可行的路径被身份模型自动排除——不是因为能力不足，不是因为没有资源，而是因为这些路径与自我概念不兼容。',
    mechanism: '身份不只是描述——它是一个约束系统。我是稳定的人意味着我不冒险。我是负责的人意味着我不能失败。这些隐含的排除是自动的、无意识的。当事人不是看到了路径然后拒绝——他们根本没有看到这些路径，因为身份过滤器在路径进入意识之前就完成了筛选。',
    necessaryConditions: [
      {
        condition: '自我定义中包含限制性的否定陈述',
        description: '我是X暗含我不是Y，且这些Y被系统性排除。不是偶然没做某件事，而是这些可能性根本不在考虑范围内。'
      },
      {
        condition: '能力足以承担的路径被自我概念排除',
        description: '客观上具备尝试某些方向的基本条件（时间、基本能力、基本资源），但主观上认为这不是我会做的事情。'
      },
      {
        condition: '身份定义的排他性限制了选择空间',
        description: '不是谨慎选择，而是身份本身在说你没有这个选项。这是自动认知过滤，不是有意识的决策。'
      }
    ],
    necessaryConditionPolicy: Object.freeze({ operator: 'ALL_OF' }),
    differentiatingEvidence: [
      {
        evidence: '排除某个方向的核心理由是我不是那种人',
        distinguishes: '区分于能力不足：不是因为不具备能力，而是因为这与自我概念冲突。'
      },
      {
        evidence: '当看到与自己相似的人走了不同路径时表现出认知冲突',
        distinguishes: '区分于OPPORTUNITY_BLINDNESS：机会盲区的人不知道路径存在。身份约束的人看到别人走了那条路，但认为那不是我能走的路。'
      },
      {
        evidence: '对自身能力评估偏低，且低估的领域恰好与身份排除的方向重合',
        distinguishes: '区分于真实能力不足：能力评估偏差与身份排除方向高度一致，而其他方向评估正常。'
      }
    ],
    contradictingEvidence: [
      {
        evidence: '身份定义宽广灵活，能够描述多元的自我可能',
        explanation: '灵活的自我概念说明身份过滤器宽松。'
      },
      {
        evidence: '曾经做出过与原有身份定位不一致但成功的选择',
        explanation: '有过跨越身份边界的成功经验说明身份不是刚性约束。'
      },
      {
        evidence: '对不同可能性的考虑范围与社会同类人群相比是偏宽的',
        explanation: '偏宽的选择范围说明身份过滤器不严格。'
      }
    ],
    disqualifyingEvidence: [
      {
        evidence: '能够列举出多个我是XX但我也可以做YY的具体实例',
        explanation: '有身份跨越的实际经验说明身份不是刚性约束。'
      },
      {
        evidence: '自我描述中使用可以成为、可能也是等扩展性语言',
        explanation: '扩展性自我语言说明身份是发展的而非固定的。'
      }
    ],
    ambiguityConditions: [
      {
        condition: '能力确实不足以承担某些方向——与身份约束的边界模糊',
        description: '需要区分真的是能力不足还是身份在说能力不足。自我认知偏差可能导致显著的能力低估。'
      },
      {
        condition: '外部环境确实限制了某些选择——与身份约束的边界模糊',
        description: '需要区分真实的环境约束和身份内化的约束。内化的外部约束属于身份约束，真实的外部约束不是。'
      }
    ],
    missingEvidenceHints: ['需要知道：当被问及为什么不能做某件事时，回答中出现了多少次我是XX类型的人', '需要知道：过去是否有过跨身份边界的尝试及其结果', '需要知道：对自身能力的评估在身份排除方向和身份确认方向之间是否存在不对称'],
    commonMisclassification: [
      {
        confusedWith: 'OPPORTUNITY_BLINDNESS',
        whyConfused: '两者都表现为不考虑某些路径。但机制完全不同：IDENTITY是看到了但排除——路径进入感知但被身份模型过滤。OPPORTUNITY是看不到——路径根本不在感知范围内。前者是过滤问题，后者是接触面问题。',
        boundaryResolution: '关键区分：如果这个人能够描述和理解某个路径但不考虑→IDENTITY。如果这个人根本无法描述（因为确实不知道）→OPPORTUNITY。'
      },
      {
        confusedWith: 'DECISION_INERTIA',
        whyConfused: '身份约束可能导致在某些方向上的不作为，看起来像决策惯性。但惯性是不决策本身——身份约束是不考虑。',
        boundaryResolution: '如果考虑了但迟迟不行动→DECISION_INERTIA。如果根本没有进入考虑范围→IDENTITY_CONSTRAINT。'
      }
    ],
    falsePositivePatterns: [
      {
        pattern: '基于真实能力边界的合理自我约束',
        whyNotBlindSpot: '如果客观上确实不具备条件，这不是身份约束——这是现实评估。区分标准：如果条件充足但仍然排除，才属于身份约束。'
      },
      {
        pattern: '基于个人价值观的有意识选择',
        whyNotBlindSpot: '明确的价值观选择（如我不做那个因为违反我的原则）不是身份约束——身份约束是无意识的自动排除。'
      }
    ],
    externalConstraints: [
      {
        constraint: '真实的能力不足限制了某些选择',
        type: 'EXTERNAL'
      },
      {
        constraint: '环境和社会规范对某些行为的实际限制',
        type: 'EXTERNAL_SOCIAL'
      },
      {
        constraint: '家庭责任或其他承诺限制了可选范围',
        type: 'EXTERNAL'
      }
    ],
    recoveryPrinciple: '身份约束松动后，世界模型的变化是：我是谁从固定的标签变为可探索的空间。自我定义从排除性的（不是Y）变为包括性的（可以是X也可以是Z）。可选路径的感知范围扩大——不是因为世界提供了更多路径，而是因为身份过滤器放宽了准入标准。',
    reasoningTemplate: {
      observation: '观察到的模式：这个人在考虑可选择的方向时，反复出现我不是那种人的表述。某些路径被自动排除——不是因为没有看见，不是因为没有考虑——而是因为它们与自我概念不兼容。',
      explanation: '这是一个身份过滤问题。我是谁的认知不仅是描述，更是一个排除系统。每个身份陈述都在暗中否定一整套可能性。当事人拥有能力、资源和信息——唯独缺少让这些路径进入考虑范围的身份许可。',
      whyNotOpportunityBlindness: '不是Opportunity Blindness，因为这个人能够描述和认知到那些被排除的路径——他们只是自动判断那不是我的路。信息接触面没问题，信息过滤有问题。',
      whyNotDecisionInertia: '不是Decision Inertia，因为在自己身份认可的方向上，这个人可能决策和行动非常积极。惯性只出现在被身份排除的方向上。这不是全局决策模式问题，是特定域的选择感知问题。',
      conclusion: '身份约束是一个自我模型过滤缺陷：不是世界太小，而是我对自己的定义太窄。首要改善方向不是寻找更多信息或做出更多决策，而是松动自我定义的刚性——将我是谁从标签变为探索。'
    },
    primaryViolatedWorldPrinciple: 'IDENTITY_CONSTRAINS_CHOICES',
    secondaryViolatedWorldPrinciples: []
  },

  // ==========================================================
  // BOUNDARY 9: SYSTEM_THINKING_GAP
  // ==========================================================

  SYSTEM_THINKING_GAP: {
    id: 'SYSTEM_THINKING_GAP',
    title: '系统思维缺失',
    supportedWorldPrinciples: ['SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR'],
    coreQuestion: '这个人的思维模型是否以线性因果链条为主，缺乏理解反馈回路、二阶效应、延迟和非线性关系的认知框架？',
    definition: '系统思维缺失是一种认知框架缺陷：一个人的解释模型主要以简单的线性因果（A导致B）运作，缺乏理解和分析复杂系统中相互作用、反馈延迟、涌现行为的能力。结果是系统性地忽略二阶效应，看不到反馈回路，低估延迟的影响。',
    mechanism: '复杂系统——经济、组织、社交网络——的行为不是各部分的简单叠加。相互作用产生涌现行为：小输入可能产生大输出（杠杆点），大输入可能被系统吸收而无效果（系统的自平衡性）。系统思维缺失的人不理解这些特性。他们以为增加投入就会线性增加产出，以为解决症状就是解决病因，以为没有立即可见的效应就是没有效应。这不是知道更多变量——而是缺乏理解变量之间相互作用的认知框架。',
    necessaryConditions: [
      {
        condition: '解释因果关系时以线性单链条为主',
        description: '结果总是被归因到一个直接原因。缺少从系统的相互作用出发的多因素分析。'
      },
      {
        condition: '忽略行动的延迟效果和二阶效应',
        description: '评价行动只依据立即可见的结果。不考虑行动可能产生的延迟影响、反弹效应、补偿效应。'
      },
      {
        condition: '缺少反馈回路思维',
        description: '不能自然地识别和描述自强化循环（正反馈）和自平衡循环（负反馈）。在解决问题时不考虑系统对干预的响应。'
      }
    ],
    necessaryConditionPolicy: Object.freeze({ operator: 'AT_LEAST_N', minimum: 2 }),
    differentiatingEvidence: [
      {
        evidence: '将问题归因到单一原因而不考虑系统相互作用',
        distinguishes: '区分于信息不足：即使有多个信息源，仍然只提炼出单一原因。区分于FEEDBACK_LOOP_GAP：反馈断裂是不收集反馈，系统思维缺失是收集了但不会系统性解读。'
      },
      {
        evidence: '对虽然这件事当时没效果但长期肯定有用的说法缺乏直觉理解',
        distinguishes: '区分于TIME_HORIZON_TRAP：时间陷阱是能看到长期但不选择长期。系统思维缺失是不理解为什么长期会有效——缺少延迟效应的直觉。'
      },
      {
        evidence: '面对复杂问题总是寻找一个决定性方案',
        distinguishes: '区分于LEVERAGE_MODEL_GAP：杠杆缺失是不理解放大机制。系统思维缺失是以为所有问题都应该有直接的线性解决方案。'
      }
    ],
    contradictingEvidence: [
      {
        evidence: '能够识别和描述一个系统中的关键反馈回路',
        explanation: '反馈回路识别说明系统思维框架存在。'
      },
      {
        evidence: '在分析问题时自然地考虑相互作用和多因素',
        explanation: '多因素分析说明理解系统复杂性。'
      },
      {
        evidence: '能够预测行动的二阶效应和延迟影响',
        explanation: '二阶思维是系统思维的核心表现。'
      }
    ],
    disqualifyingEvidence: [
      {
        evidence: '在多个领域展示了反馈回路分析和二阶效应预测能力',
        effect: '系统思维在多个领域的应用说明该认知框架完整。'
      },
      {
        evidence: '能够解释为什么简单线性方案在复杂系统中常常失败',
        explanation: '理解线性的局限说明对系统特性有深刻理解。'
      }
    ],
    ambiguityConditions: [
      {
        condition: '在某些领域的系统思维正常但特定领域缺失',
        description: '可能是特定领域知识不足（不了解该领域的系统结构），而非全局系统思维缺陷。'
      },
      {
        condition: '系统思维缺失与FEEDBACK_LOOP_GAP共存且难以区分主因',
        description: '不收集反馈和不系统性地分析反馈可能同时存在且互相强化。'
      }
    ],
    missingEvidenceHints: ['需要知道：在解释复杂现象时，论据中是否包含反馈回路或相互作用', '需要知道：是否能够描述延迟效应和二阶效应的具体案例', '需要知道：面对失败时，归因是否总是落在单一直接原因上'],
    commonMisclassification: [
      {
        confusedWith: 'FEEDBACK_LOOP_GAP',
        whyConfused: '两者都涉及缺少反馈。但SYSTEM是缺少系统思维工具（不理解反馈回路概念），FEEDBACK是行为层面缺失（有需求但缺少执行）。前者是认知工具缺失——不会用反馈回路来思考。后者是行为习惯缺失——有思维工具但没有使用习惯。',
        boundaryResolution: '关键区分：如果这个人在其他领域（如工作）有良好的反馈思维→不是SYSTEM。如果在所有领域都不会用反馈思维→SYSTEM。更根本的区分：SYSTEM的人即使看到数据也不会系统性地解读，FEEDBACK的人是没有数据可看。'
      },
      {
        confusedWith: 'TIME_HORIZON_TRAP',
        whyConfused: '系统思维缺失可能导致看不懂长期复利的逻辑——以为线性增长就是常态。时间陷阱是看懂了但不愿等。前者是不理解为什么等有用，后者是不愿意等。',
        boundaryResolution: '如果理解了但选择短期→TIME_HORIZON_TRAP。如果不理解长期为什么会有累积效应→SYSTEM_THINKING_GAP。'
      },
      {
        confusedWith: 'LEVERAGE_MODEL_GAP',
        whyConfused: '两者都可能导致看不到非线性增长路径。杠杆缺失是看不到放大机制，系统思维缺失是看不到相互作用如何产生放大。',
        boundaryResolution: '如果有杠杆认知但不会系统性地寻找杠杆点→LEVERAGE。如果连相互作用和反馈回路都不理解→SYSTEM。'
      }
    ],
    falsePositivePatterns: [
      {
        pattern: '在面对全新陌生领域时暂时以简单模型开始',
        whyNotBlindSpot: '面对完全不熟悉的系统，从简单模型开始是合理的认知策略——先理解基础再添加复杂性。'
      },
      {
        pattern: '在有时间压力的即时决策中简化思维',
        whyNotBlindSpot: '在时间紧迫时简化决策是适应性的，不代表全局缺乏系统思维。'
      }
    ],
    externalConstraints: [
      {
        constraint: '缺乏系统思维的教育背景',
        type: 'EXTERNAL_EDUCATIONAL'
      },
      {
        constraint: '所处环境鼓励线性简化的思维方式',
        type: 'EXTERNAL_CULTURAL'
      },
      {
        constraint: '面对的系统过于复杂，超出了任何个人的理解范围',
        type: 'EXTERNAL'
      }
    ],
    recoveryPrinciple: '系统思维建立后，世界模型的变化是：这个人开始看到世界的相互作用层。因果关系不再是直线——而是网络、回路、延迟、非线性。他们在决策前不仅考虑一阶效果，还考虑二阶后果和系统可能会如何响应。对复杂问题不再寻找一个原因或一个方案——而是寻找杠杆点和干预序列。',
    reasoningTemplate: {
      observation: '观察到的模式：这个人在分析任何问题时都以线性因果链条为主——A导致B，B导致C。对反馈回路（结果反过来影响原因）、延迟效应（效果在时间上滞后）、和非线性关系（小输入大输出或反过来）缺乏直觉。',
      explanation: '这是一个系统认知框架缺失问题。不是不知道更多变量或更详细的数据——而是缺乏理解变量间相互作用的基本认知框架。复杂系统的行为取决于相互作用而非独立变量，线性思维的预测在复杂系统中系统性失效。',
      whyNotFeedbackLoopGap: '不是Feedback Loop Gap，因为这个人可能有复盘习惯——但复盘时不会用反馈回路的框架来分析。他们会看这一次做得好不好但不会追溯结果如何影响下一次的初始条件。有数据但不做系统性分析。',
      whyNotTimeHorizonTrap: '不是Time Horizon Trap，因为这个人可能愿意长期投入——但他们期待的是线性积累而非复利增长。不是不愿意等，而是不理解为什么等会产生非线性回报。',
      whyNotLeverageModelGap: '不是Leverage Model Gap，因为杠杆思维要求理解系统放大机制，而系统思维缺失的人连相互作用都不理解——更谈不上杠杆。杠杆缺失是系统思维缺失的上层问题。',
      conclusion: '系统思维缺失是一个认知框架缺陷：世界是相互连接的系统，但思维模型是线性的。首要改善方向不是学习更多事实或数据，而是建立系统思维的基础框架——学习识别反馈回路、区分一阶和二阶效应、理解延迟和非线性——将线性思维升级为系统思维。'
    },
    primaryViolatedWorldPrinciple: 'SYSTEMS_PRODUCE_EMERGENT_BEHAVIOR',
    secondaryViolatedWorldPrinciples: []
  },
})

const BLIND_SPOT_FAMILIES = Object.freeze({
  EXECUTION_ADAPTATION_GAP: {
    id: 'EXECUTION_ADAPTATION_GAP',
    label: '执行/适应缺口',
    description: '在行动与学习之间的落差：要么不行动，要么行动了但无法从结果中学习调整。',
    members: ['DECISION_INERTIA', 'FEEDBACK_LOOP_GAP'],
    distinguishingQuestion: '是“不行动所以没有信息”还是“行动了但没有学习”？'
  },
  RESOURCE_COMPOUNDING_GAP: {
    id: 'RESOURCE_COMPOUNDING_GAP',
    label: '资源/复利缺口',
    description: '在价值放大与时间尺度之间的失衡：要么不会放大价值，要么不愿等待复利。',
    members: ['LEVERAGE_MODEL_GAP', 'TIME_HORIZON_TRAP'],
    distinguishingQuestion: '是“不会放大”还是“不愿等待”？'
  },
  PERCEPTION_RISK_GAP: {
    id: 'PERCEPTION_RISK_GAP',
    label: '感知/风险缺口',
    description: '在“看到什么”和“如何评估”上的缺陷：要么看不到足够多的可选路径，要么看到的路径被扭曲的风险评估过滤掉。',
    members: ['OPPORTUNITY_BLINDNESS', 'RISK_MODEL_DISTORTION'],
    distinguishingQuestion: '是“看不到路径”还是“看到了但被风险恐惧过滤”？'
  },
  FRAMEWORK_GAP: {
    id: 'FRAMEWORK_GAP',
    label: '认知框架缺口',
    description: '在思维工具层面的缺陷：要么缺少概率思维框架，要么身份模型过窄限制选择空间，要么只能用线性因果理解复杂系统。',
    members: ['PROBABILITY_MISJUDGMENT', 'IDENTITY_CONSTRAINT', 'SYSTEM_THINKING_GAP'],
    distinguishingQuestion: '是缺少思维工具，还是工具存在但被情绪或习惯抑制？'
  }
})

module.exports = {
  BLIND_SPOT_BOUNDARIES,
  BLIND_SPOT_FAMILIES,
}
