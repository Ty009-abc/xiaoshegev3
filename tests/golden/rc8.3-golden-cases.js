/**
 * tests/golden/rc8.3-golden-cases.js
 *
 * RC8.3 C4-001 — Golden Dataset.
 *
 * 100 human-reviewable cases testing the hierarchical cognitive
 * blind spot inference pipeline against the product mission:
 *
 *   帮助普通人理解世界运行规则，发现认知漏洞，模拟决策后果
 *
 * NOT: 赚钱建议 / 副业建议 / 销售建议 / 算命 / 鸡汤
 *
 * @version world_model_v3
 * @sprint c4-001
 */

// ═══════════════════════════════════════════════════════════════
// SIGNAL STATE CONSTANTS
// ═══════════════════════════════════════════════════════════════

var A = 'ACTIVE'
var S = 'SUPPRESSED'
var I = 'INSUFFICIENT_EVIDENCE'

// ═══════════════════════════════════════════════════════════════
// SIGNAL BUILDER
// ═══════════════════════════════════════════════════════════════

function sig(id, state, score, originId) {
  return { id: id, state: state, score: score || 50, originId: originId || id, confidence: 0.5 }
}

// ═══════════════════════════════════════════════════════════════
// INFERENCE STATES
// ═══════════════════════════════════════════════════════════════

var CLEAR = 'CLEAR'
var AMB_FAMILY = 'AMBIGUOUS_FAMILY'
var AMB_BLIND = 'AMBIGUOUS_BLIND_SPOT'
var INSUFF = 'INSUFFICIENT_EVIDENCE'

var EAG = 'EXECUTION_ADAPTATION_GAP'
var RCG = 'RESOURCE_COMPOUNDING_GAP'
var PRG = 'PERCEPTION_RISK_GAP'
var FRG = 'FRAMEWORK_GAP'

var DI  = 'DECISION_INERTIA'
var FLG = 'FEEDBACK_LOOP_GAP'
var LMG = 'LEVERAGE_MODEL_GAP'
var THT = 'TIME_HORIZON_TRAP'
var OB  = 'OPPORTUNITY_BLINDNESS'
var RMD = 'RISK_MODEL_DISTORTION'
var PM  = 'PROBABILITY_MISJUDGMENT'
var IC  = 'IDENTITY_CONSTRAINT'
var STG = 'SYSTEM_THINKING_GAP'

// ═══════════════════════════════════════════════════════════════
// GOLDEN CASES (100)
// ═══════════════════════════════════════════════════════════════

var GOLDEN_CASES = [
  {
    id: 'G-DI-001',
    title: '厨师 —— 三年想开店但从未行动',
    inputProfile: {
      signals: [ sig('WAITING_DURATION_PATTERN', A, 85), sig('MINIMUM_STEP_EXECUTION', I, 50), sig('POST_ACTION_REVIEW_HABIT', I, 50), sig('DECISION_TO_ACTION_LATENCY', I, 50) ],
      occupation: '厨师', yearsOfExperience: 10,
    },
    expected: { family: EAG, blindSpot: DI, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '决策本身创造信息',
      mechanism: '将明确的决策（开店）推迟数年，等待“时机成熟”——但拖延本身阻止了任何关于可行性的信息进入系统',
      whyPrimary: '存在明确的可选决策但长期未被采取，推迟原因是等待更高确定性而非外部约束，这是典型的决策延迟认知模式',
      whyNotAlternates: '不是反馈回路断裂——因为尚未进入循环。不是机会盲区——开店选项已被认知。不是身份约束——自我定义中包含了“想开店的人”',
      falsePositiveRisk: '如果实际外部约束（资金不足、家人反对）是主因，应重新评估',
    },
    evidenceExpectation: {
      requiredSignals: ['WAITING_DURATION_PATTERN'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_DI_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-DI-002',
    title: '程序员 —— 知道该换工作方向但持续推迟',
    inputProfile: {
      signals: [ sig('WAITING_DURATION_PATTERN', A, 80), sig('MINIMUM_STEP_EXECUTION', I, 50), sig('POST_ACTION_REVIEW_HABIT', I, 50), sig('DECISION_TO_ACTION_LATENCY', I, 50) ],
      occupation: '程序员', yearsOfExperience: 6,
    },
    expected: { family: EAG, blindSpot: DI, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: 'DECISION_CREATES_INFORMATION',
      mechanism: '已经知道方向不对但持续待着——每一次延迟都减少了对新可能性的探索时间',
      whyPrimary: '被认知到的职业决策长期推迟，延迟原因不是能力不足而是等待确定性',
      whyNotAlternates: '不是时间视野陷阱——因为认知到了长期方向。不是身份约束——已经在考虑“成为其他类型的开发者”',
      falsePositiveRisk: '可能合理的原因（签证、家庭）被忽略时',
    },
    evidenceExpectation: {
      requiredSignals: ['WAITING_DURATION_PATTERN'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_DI_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-DI-003',
    title: '教师 —— 知道教学方式需要改变但不开始',
    inputProfile: {
      signals: [ sig('WAITING_DURATION_PATTERN', A, 75), sig('MINIMUM_STEP_EXECUTION', I, 50), sig('POST_ACTION_REVIEW_HABIT', I, 50), sig('DECISION_TO_ACTION_LATENCY', I, 50) ],
      occupation: '教师', yearsOfExperience: 15,
    },
    expected: { family: EAG, blindSpot: DI, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: 'DECISION_CREATES_INFORMATION',
      mechanism: '确定需要改革教学方法，但持续等待“下一学期”或“新政策”——每个学期都在等但每个学期都没动',
      whyPrimary: '存在明确的可选行动（新教学方式）但长期被推迟，模式跨多年而非单次事件',
      whyNotAlternates: '不是反馈回路断裂——还没开始行动。不是杠杆缺失——教学本身是高杠杆活动但被推迟了',
      falsePositiveRisk: '如果已经被行政规定强制使用特定教学法，外部约束是主因',
    },
    evidenceExpectation: {
      requiredSignals: ['WAITING_DURATION_PATTERN'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_DI_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-DI-004',
    title: '自由职业者 —— 多个方向都在想但从未开始任何一个',
    inputProfile: {
      signals: [ sig('WAITING_DURATION_PATTERN', A, 90), sig('MINIMUM_STEP_EXECUTION', I, 50), sig('POST_ACTION_REVIEW_HABIT', I, 50), sig('DECISION_TO_ACTION_LATENCY', I, 50) ],
      occupation: '自由职业者', yearsOfExperience: 4,
    },
    expected: { family: EAG, blindSpot: DI, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: 'DECISION_CREATES_INFORMATION',
      mechanism: '同时在考虑3-4个方向但都不开始——不是不知道做什么，而是害怕选错。每个方向都需要最小的第一步来验证',
      whyPrimary: '多个明确的可选决策被推迟，推迟原因是害怕选错（等待确定性）而非缺少选择，模式跨多个领域',
      whyNotAlternates: '不是概率误判——认知到了不确定性但用回避代替管理。不是机会盲区——看到了足够多的路径',
      falsePositiveRisk: '如果确实需要谨慎评估高风险决策，延迟可能合理',
    },
    evidenceExpectation: {
      requiredSignals: ['WAITING_DURATION_PATTERN'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_DI_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-FLG-001',
    title: '外卖员 —— 每天跑单但从不复盘路线优化',
    inputProfile: {
      signals: [ sig('MINIMUM_STEP_EXECUTION', A, 80), sig('POST_ACTION_REVIEW_HABIT', A, 75), sig('DECISION_TO_ACTION_LATENCY', A, 70), sig('WAITING_DURATION_PATTERN', I, 50) ],
      occupation: '外卖员', yearsOfExperience: 3,
    },
    expected: { family: EAG, blindSpot: FLG, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '反馈创造学习',
      mechanism: '持续在行动（每天跑单）但没有系统复盘和迭代——每次配送都像第一次，经验没有累积成模型改进',
      whyPrimary: '存在持续行动但缺少系统性复盘和基于结果的迭代变化',
      whyNotAlternates: '不是决策惯性——正在行动只是不学习。不是身份约束——行动不受身份限制',
      falsePositiveRisk: '如果平台自动优化路线且骑手无优化空间',
    },
    evidenceExpectation: {
      requiredSignals: ['MINIMUM_STEP_EXECUTION', 'POST_ACTION_REVIEW_HABIT', 'DECISION_TO_ACTION_LATENCY'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_FLG_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-FLG-002',
    title: '客服 —— 处理大量工单但从不总结常见问题模式',
    inputProfile: {
      signals: [ sig('MINIMUM_STEP_EXECUTION', A, 75), sig('POST_ACTION_REVIEW_HABIT', A, 70), sig('DECISION_TO_ACTION_LATENCY', A, 65), sig('WAITING_DURATION_PATTERN', I, 50) ],
      occupation: '客服', yearsOfExperience: 2,
    },
    expected: { family: EAG, blindSpot: FLG, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '反馈创造学习',
      mechanism: '每天处理大量客户问题——有足够的数据——但从不从这些数据中总结和提升。世界在对她说话，但她没有听',
      whyPrimary: '行动持续但缺少系统复盘和方法迭代',
      whyNotAlternates: '不是决策惯性——她在工作，在工作中有行动。问题在于不学习',
      falsePositiveRisk: '如果客服流程已经被系统严格约束且无改进空间',
    },
    evidenceExpectation: {
      requiredSignals: ['MINIMUM_STEP_EXECUTION', 'POST_ACTION_REVIEW_HABIT', 'DECISION_TO_ACTION_LATENCY'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_FLG_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-FLG-003',
    title: '程序员 —— 频繁换技术栈但从不反思之前的项目',
    inputProfile: {
      signals: [ sig('MINIMUM_STEP_EXECUTION', A, 85), sig('POST_ACTION_REVIEW_HABIT', A, 75), sig('DECISION_TO_ACTION_LATENCY', A, 70), sig('WAITING_DURATION_PATTERN', I, 50) ],
      occupation: '程序员', yearsOfExperience: 8,
    },
    expected: { family: EAG, blindSpot: FLG, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '反馈创造学习',
      mechanism: '每个项目都做完了——行动在产生——但没有对每个项目做复盘。相同类型的错误在不同项目中重复出现',
      whyPrimary: '持续行动、缺少复盘、方法未基于结果迭代',
      whyNotAlternates: '不是方向频繁切换——切换可能是合理的，问题在于不学习。不是系统思维缺失——问题的根源是反馈回路断裂',
      falsePositiveRisk: '如果已通过Code Review和自动化测试获得充分反馈',
    },
    evidenceExpectation: {
      requiredSignals: ['MINIMUM_STEP_EXECUTION', 'POST_ACTION_REVIEW_HABIT', 'DECISION_TO_ACTION_LATENCY'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_FLG_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-FLG-004',
    title: '学生 —— 刷了很多题但分数不提升',
    inputProfile: {
      signals: [ sig('MINIMUM_STEP_EXECUTION', A, 80), sig('POST_ACTION_REVIEW_HABIT', A, 70), sig('DECISION_TO_ACTION_LATENCY', A, 65), sig('WAITING_DURATION_PATTERN', I, 50) ],
      occupation: '学生', yearsOfExperience: 4,
    },
    expected: { family: EAG, blindSpot: FLG, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '反馈创造学习',
      mechanism: '刷题本质是行动——但如果不回顾错题、不反思为什么会错、不总结模式，刷1000题的效果和刷100题差不多',
      whyPrimary: '行动在产生但学习方法未迭代——没有复盘机制',
      whyNotAlternates: '不是决策惯性——每天在学习。不是系统思维缺失——需要的是学习反馈而非系统分析',
      falsePositiveRisk: '如果物理学习环境已经让孩子精疲力尽且有外部学习障碍',
    },
    evidenceExpectation: {
      requiredSignals: ['MINIMUM_STEP_EXECUTION', 'POST_ACTION_REVIEW_HABIT', 'DECISION_TO_ACTION_LATENCY'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_FLG_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-LMG-001',
    title: '设计师 —— 接单等于个人时间一对一出售',
    inputProfile: {
      signals: [ sig('OUTPUT_DECOUPLING_AWARENESS', A, 80), sig('EFFORT_VS_MECHANISM_FRAMING', A, 75), sig('DIRECTION_SWITCHING_FREQUENCY', I, 50) ],
      occupation: '设计师',
    },
    expected: { family: RCG, blindSpot: LMG, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '价值和投入可以解耦',
      mechanism: '做设计就是自己画——客户给钱、自己交付。不知道可以建立模板库、资产库、设计系统，让同样的投入重复产出价值',
      whyPrimary: '价值交付模式以直接个人投入为主，缺少放大机制认知和应用',
      whyNotAlternates: '不是时间视野陷阱——不是不愿等待复利，而是不知道存在复利机制。不是系统思维——问题在商业模型而非认知框架',
      falsePositiveRisk: '如果市场条件（如只能接定制化需求）排除了杠杆可能性',
    },
    evidenceExpectation: {
      requiredSignals: ['OUTPUT_DECOUPLING_AWARENESS', 'EFFORT_VS_MECHANISM_FRAMING'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_LMG_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-LMG-002',
    title: '维修工 —— 技术好但收入被时间锁死',
    inputProfile: {
      signals: [ sig('OUTPUT_DECOUPLING_AWARENESS', A, 85), sig('EFFORT_VS_MECHANISM_FRAMING', A, 70), sig('DIRECTION_SWITCHING_FREQUENCY', I, 50) ],
      occupation: '维修工',
    },
    expected: { family: RCG, blindSpot: LMG, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '价值和投入可以解耦',
      mechanism: '修一次收一次钱——没有方法让一次诊断/一次修复/一次经验服务更多人。技术好但杠杆为零',
      whyPrimary: '价值交付是线性的个人投入，没有复用系统或可扩展资产',
      whyNotAlternates: '不是时间视野——他知道长期积累技术的价值。问题在于未将知识转化为可复用的形式',
      falsePositiveRisk: '维修工作本质可能确实高度依赖现场服务',
    },
    evidenceExpectation: {
      requiredSignals: ['OUTPUT_DECOUPLING_AWARENESS', 'EFFORT_VS_MECHANISM_FRAMING'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_LMG_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },

  {
    id: 'G-LMG-003',
    title: '摄影师 —— 每场拍摄都需要到场',
    inputProfile: {
      signals: [ sig('OUTPUT_DECOUPLING_AWARENESS', A, 75), sig('EFFORT_VS_MECHANISM_FRAMING', A, 70), sig('DIRECTION_SWITCHING_FREQUENCY', I, 50) ],
      occupation: '摄影师',
    },
    expected: { family: RCG, blindSpot: LMG, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '价值和投入可以解耦',
      mechanism: '摄影师的收入=拍摄场次×单价——每一块钱都要亲自按快门。不知道预设教程、批量处理、授权模式可以解耦收入与时间',
      whyPrimary: '价值交付以直接投入为主，缺少价值放大机制的应用',
      whyNotAlternates: '不是身份约束——不认为“我就该这样拍”，只是不知道其他可能',
      falsePositiveRisk: '如果主观上已尝试但市场条件不允许',
    },
    evidenceExpectation: {
      requiredSignals: ['OUTPUT_DECOUPLING_AWARENESS', 'EFFORT_VS_MECHANISM_FRAMING'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_LMG_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-LMG-004',
    title: '程序员 —— 所有价值靠写代码交付',
    inputProfile: {
      signals: [ sig('OUTPUT_DECOUPLING_AWARENESS', A, 70), sig('EFFORT_VS_MECHANISM_FRAMING', A, 65), sig('DIRECTION_SWITCHING_FREQUENCY', I, 50) ],
      occupation: '程序员',
    },
    expected: { family: RCG, blindSpot: LMG, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '价值和投入可以解耦',
      mechanism: '公司给需求，他写代码——产出与个人写代码的时间严格线性。不知道可以构建工具链、开源库、内部平台来放大个人产出',
      whyPrimary: '线性价值交付模式，无复用系统',
      whyNotAlternates: '不是时间视野——他愿意长期投入。问题是缺少放大意识',
      falsePositiveRisk: '如果已经在用AI或工具大幅提升效率',
    },
    evidenceExpectation: {
      requiredSignals: ['OUTPUT_DECOUPLING_AWARENESS', 'EFFORT_VS_MECHANISM_FRAMING'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_LMG_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-THT-001',
    title: '学生 —— 频繁换专业方向',
    inputProfile: {
      signals: [ sig('DIRECTION_SWITCHING_FREQUENCY', A, 80), sig('LONG_TERM_COMPOUNDING_AWARENESS', A, 75), sig('ALTERNATIVE_PATH_COST_AWARENESS', I, 50), sig('OUTPUT_DECOUPLING_AWARENESS', I, 50) ],
      occupation: '学生',
    },
    expected: { family: RCG, blindSpot: THT, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '时间复利不是线性的',
      mechanism: '每个学期换一个方向——每次切换清零了之前的积累。不理解累积效应：任何方向的前期都在缓慢积累，切换就回到零',
      whyPrimary: '决策中系统性偏向短期收益，频繁切换方向，缺少长期积累的明确配置',
      whyNotAlternates: '不是杠杆缺失——他知道复利概念但缺乏对复利时间结构（前期慢后期快）的直观理解',
      falsePositiveRisk: '如果频繁切换是探索阶段——正常，但需要区分探索模式和无结构漂移',
    },
    evidenceExpectation: {
      requiredSignals: ['DIRECTION_SWITCHING_FREQUENCY', 'LONG_TERM_COMPOUNDING_AWARENESS'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_THT_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-THT-002',
    title: '自由职业者 —— 每次项目结束后换方向',
    inputProfile: {
      signals: [ sig('DIRECTION_SWITCHING_FREQUENCY', A, 85), sig('LONG_TERM_COMPOUNDING_AWARENESS', A, 70), sig('OUTPUT_DECOUPLING_AWARENESS', I, 50) ],
      occupation: '自由职业者',
    },
    expected: { family: RCG, blindSpot: THT, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '时间复利不是线性的',
      mechanism: '每个项目换一个新领域——表面看是在探索机会，实际上从未在任何领域积累到复利临界点。总是在爬山的前100米换山',
      whyPrimary: '频繁切换+缺乏长期积累配置',
      whyNotAlternates: '不是杠杆缺失——有些项目自己做了交付。问题是无法等待，不是无法放大',
      falsePositiveRisk: '如果市场变化快，灵活切换可能正确',
    },
    evidenceExpectation: {
      requiredSignals: ['DIRECTION_SWITCHING_FREQUENCY', 'LONG_TERM_COMPOUNDING_AWARENESS'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_THT_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-THT-003',
    title: '设计师 —— 总在追求最新的工具和趋势',
    inputProfile: {
      signals: [ sig('DIRECTION_SWITCHING_FREQUENCY', A, 75), sig('LONG_TERM_COMPOUNDING_AWARENESS', A, 65), sig('OUTPUT_DECOUPLING_AWARENESS', I, 50) ],
      occupation: '设计师',
    },
    expected: { family: RCG, blindSpot: THT, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '时间复利不是线性的',
      mechanism: '在甲方向的工作中频繁切换设计风格和工具链——每次追新都消耗了积累。核心设计能力（如构图、色彩、沟通）才是累积资产',
      whyPrimary: '短期趋利驱动频繁切换，缺少对核心积累的认知',
      whyNotAlternates: '不是机会盲区——能看到足够多的趋势。问题是无法专注于一个方向的积累',
      falsePositiveRisk: '设计行业本身变化快，部分切换确实必要',
    },
    evidenceExpectation: {
      requiredSignals: ['DIRECTION_SWITCHING_FREQUENCY', 'LONG_TERM_COMPOUNDING_AWARENESS'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_THT_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-THT-004',
    title: '程序员 —— 频繁换技术栈，永远在"next big thing"',
    inputProfile: {
      signals: [ sig('DIRECTION_SWITCHING_FREQUENCY', A, 90), sig('LONG_TERM_COMPOUNDING_AWARENESS', A, 80), sig('OUTPUT_DECOUPLING_AWARENESS', I, 50) ],
      occupation: '程序员',
    },
    expected: { family: RCG, blindSpot: THT, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '时间复利不是线性的',
      mechanism: 'React→Vue→Svelte→HTMX→……每次追新框架。框架知识是短期资产，编程思维、架构能力、领域理解才是长期资产',
      whyPrimary: '追逐短期技术热度，缺少对长期积累方向的认知和坚守',
      whyNotAlternates: '不是决策惯性——在不断学习中。不是反馈断裂——他知道新技术在做什么。问题在时间视野',
      falsePositiveRisk: '早期职业生涯的技术广度有一定价值',
    },
    evidenceExpectation: {
      requiredSignals: ['DIRECTION_SWITCHING_FREQUENCY', 'LONG_TERM_COMPOUNDING_AWARENESS'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_THT_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-OB-001',
    title: '厨师 —— 只接触后厨人群',
    inputProfile: {
      signals: [ sig('INFORMATION_SOURCE_DIVERSITY', A, 80), sig('SERENDIPITOUS_PATH_DISCOVERY', A, 70), sig('NON_DOMAIN_PATH_AWARENESS', A, 65), sig('IDENTITY_BASED_EXCLUSION', I, 50) ],
      occupation: '厨师',
    },
    expected: { family: PRG, blindSpot: OB, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '机会可见性=接触面×识别能力',
      mechanism: '社交圈=厨师-服务员-后厨人员。信息接触面极度同质化。世界的其他部分对他不可见——不是他不能做，是他看不到',
      whyPrimary: '信息接触面显著过窄，对领域外路径缺乏认知，具备基本能力',
      whyNotAlternates: '不是风险扭曲——问题不在评估，在看不到。不是身份约束——他会考虑非厨师工作但不知道有什么',
      falsePositiveRisk: '如果主观上已经在主动拓展信息源',
    },
    evidenceExpectation: {
      requiredSignals: ['INFORMATION_SOURCE_DIVERSITY', 'SERENDIPITOUS_PATH_DISCOVERY', 'NON_DOMAIN_PATH_AWARENESS'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_OB_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-OB-002',
    title: '外卖员 —— 信息源仅限于同行和平台',
    inputProfile: {
      signals: [ sig('INFORMATION_SOURCE_DIVERSITY', A, 85), sig('SERENDIPITOUS_PATH_DISCOVERY', A, 75), sig('NON_DOMAIN_PATH_AWARENESS', A, 70), sig('IDENTITY_BASED_EXCLUSION', I, 50) ],
      occupation: '外卖员',
    },
    expected: { family: PRG, blindSpot: OB, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '机会可见性=接触面×识别能力',
      mechanism: '日常接触=其他骑手+平台通知。没有接触到其他可能性。世界很大，但他只在配送App的界面里',
      whyPrimary: '信息接触面极窄，缺乏对其他路径的认知，具备学习和适应能力',
      whyNotAlternates: '不是身份约束——他不排斥其他工作，只是不知道有哪些可能。不是能力问题',
      falsePositiveRisk: '如果已经知道其他方向但客观条件不允许（如学历门槛）',
    },
    evidenceExpectation: {
      requiredSignals: ['INFORMATION_SOURCE_DIVERSITY', 'SERENDIPITOUS_PATH_DISCOVERY', 'NON_DOMAIN_PATH_AWARENESS'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_OB_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-OB-003',
    title: '学生 —— 信息圈=同班同学+课程',
    inputProfile: {
      signals: [ sig('INFORMATION_SOURCE_DIVERSITY', A, 75), sig('SERENDIPITOUS_PATH_DISCOVERY', A, 65), sig('NON_DOMAIN_PATH_AWARENESS', A, 60), sig('IDENTITY_BASED_EXCLUSION', I, 50) ],
      occupation: '学生',
    },
    expected: { family: PRG, blindSpot: OB, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '机会可见性=接触面×识别能力',
      mechanism: '信息源局限在校园-同学-课程范围内。看不到课程之外存在的路径——不是没有机会，是机会在信息覆盖范围之外',
      whyPrimary: '信息接触面窄，缺乏领域外认知',
      whyNotAlternates: '不是决策惯性——他每天在学习（行动）。问题在于信息视野而非行动意愿',
      falsePositiveRisk: '大学本身就是相对封闭的环境，毕业前信息拓宽是正常的',
    },
    evidenceExpectation: {
      requiredSignals: ['INFORMATION_SOURCE_DIVERSITY', 'SERENDIPITOUS_PATH_DISCOVERY', 'NON_DOMAIN_PATH_AWARENESS'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_OB_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-OB-004',
    title: '设计师 —— 接单渠道仅限于熟人介绍',
    inputProfile: {
      signals: [ sig('INFORMATION_SOURCE_DIVERSITY', A, 70), sig('SERENDIPITOUS_PATH_DISCOVERY', A, 60), sig('NON_DOMAIN_PATH_AWARENESS', A, 55), sig('IDENTITY_BASED_EXCLUSION', I, 50) ],
      occupation: '设计师',
    },
    expected: { family: PRG, blindSpot: OB, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '机会可见性=接触面×识别能力',
      mechanism: '所有客户都通过熟人圈来。不知道有哪些平台、社群、跨领域合作机会存在。技能好但未被看到',
      whyPrimary: '信息接触面窄，路径仅限于已有网络',
      whyNotAlternates: '不是杠杆缺失——他有技能，问题在于信息输入的多样性而非技能转化为杠杆',
      falsePositiveRisk: '如果已经在尝试拓展渠道但暂时未成功',
    },
    evidenceExpectation: {
      requiredSignals: ['INFORMATION_SOURCE_DIVERSITY', 'SERENDIPITOUS_PATH_DISCOVERY', 'NON_DOMAIN_PATH_AWARENESS'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_OB_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },

  {
    id: 'G-RMD-001',
    title: '自由职业者 —— 一次失败后不再敢接类似项目',
    inputProfile: {
      signals: [ sig('EMOTIONAL_RECENCY_IMPACT', A, 85), sig('ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', A, 75), sig('PROBABILISTIC_LANGUAGE_USAGE', I, 50) ],
      occupation: '自由职业者',
    },
    expected: { family: PRG, blindSpot: RMD, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '一次结果≠概率分布',
      mechanism: '一次失败项目被赋予不合理权重——忘记了之前成功的5次。近因效应让最近的（坏）结果扭曲了对整个领域风险评估',
      whyPrimary: '情绪驱动的风险评估偏差，最近一次高情绪冲击的事件扭曲了概率判断',
      whyNotAlternates: '不是概率误判——他知道概率概念但情绪压倒了分析。不是机会盲区——他看到了机会但被情绪阻止',
      falsePositiveRisk: '如果那个失败项目确实揭示了系统性的新风险',
    },
    evidenceExpectation: {
      requiredSignals: ['EMOTIONAL_RECENCY_IMPACT', 'ABSTRACT_VS_EMBODIED_RISK_JUDGMENT'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_RMD_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-RMD-002',
    title: '程序员 —— 高估技术风险低估沟通风险',
    inputProfile: {
      signals: [ sig('EMOTIONAL_RECENCY_IMPACT', A, 70), sig('ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', A, 65), sig('PROBABILISTIC_LANGUAGE_USAGE', I, 50) ],
      occupation: '程序员',
    },
    expected: { family: PRG, blindSpot: RMD, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '风险评估应按概率分布而非可见性',
      mechanism: '技术风险（系统崩溃、安全漏洞）被认为最重要——因为可见且容易量化。但沟通风险、团队风险、认知偏差风险等不可见因素被低估',
      whyPrimary: '风险评估被可见性驱动而非概率分布',
      whyNotAlternates: '不是系统思维缺失——他理解系统但用在技术而非人际上。不是身份约束',
      falsePositiveRisk: '如果在技术领域风险确实客观最高',
    },
    evidenceExpectation: {
      requiredSignals: ['EMOTIONAL_RECENCY_IMPACT', 'ABSTRACT_VS_EMBODIED_RISK_JUDGMENT'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_RMD_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-RMD-003',
    title: '教师 —— 过度在意公开课的批评',
    inputProfile: {
      signals: [ sig('EMOTIONAL_RECENCY_IMPACT', A, 80), sig('ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', A, 70), sig('PROBABILISTIC_LANGUAGE_USAGE', I, 50) ],
      occupation: '教师',
    },
    expected: { family: PRG, blindSpot: RMD, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '风险评估应按概率分布而非可见性',
      mechanism: '一次公开课的负面反馈被放大——可能只是因为那是一个可见的事件而非教学质量的系统性问题。可见风险≠真实风险分布',
      whyPrimary: '高情绪可见性的事件扭曲了整体风险评估',
      whyNotAlternates: '不是反馈断裂——她在反思，但反思被情绪驱动而非系统化',
      falsePositiveRisk: '如果反馈确实揭示了系统性教学问题',
    },
    evidenceExpectation: {
      requiredSignals: ['EMOTIONAL_RECENCY_IMPACT', 'ABSTRACT_VS_EMBODIED_RISK_JUDGMENT'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_RMD_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-RMD-004',
    title: '客服 —— 一次投诉后对所有客户过度防备',
    inputProfile: {
      signals: [ sig('EMOTIONAL_RECENCY_IMPACT', A, 75), sig('ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', A, 65), sig('PROBABILISTIC_LANGUAGE_USAGE', I, 50) ],
      occupation: '客服',
    },
    expected: { family: PRG, blindSpot: RMD, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '风险评估应按概率分布而非可见性',
      mechanism: '一次特别难缠的客户投诉改变了对待所有客户的方式。那是一个低概率事件但从记忆中扭曲了整个客户画像',
      whyPrimary: '高情绪事件扭曲了风险感知，导致过度防御',
      whyNotAlternates: '不是反馈断裂——她在调整行为，但调整基于情绪扭曲的评估',
      falsePositiveRisk: '如果投诉确实反映了系统性的服务问题',
    },
    evidenceExpectation: {
      requiredSignals: ['EMOTIONAL_RECENCY_IMPACT', 'ABSTRACT_VS_EMBODIED_RISK_JUDGMENT'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_RMD_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-PM-001',
    title: '程序员 —— 用一次bug验证自己对代码质量的判断',
    inputProfile: {
      signals: [ sig('PROBABILISTIC_LANGUAGE_USAGE', A, 80), sig('LUCK_VS_SKILL_ATTRIBUTION', A, 75), sig('FEEDBACK_CALIBRATION_RATE', A, 70) ],
      occupation: '程序员',
    },
    expected: { family: FRG, blindSpot: PM, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '单次结果≠模型正确性',
      mechanism: '认为“这次上线没有bug说明我测试充分”——用一次结果验证方法论。忽略了运气成分和统计波动',
      whyPrimary: '用单次结果作为模型验证证据，缺少概率分布思维',
      whyNotAlternates: '不是风险扭曲——不是在用情绪评估风险，而是缺少概率思维工具',
      falsePositiveRisk: '如果项目确实经过了系统性测试且统计意义上可靠',
    },
    evidenceExpectation: {
      requiredSignals: ['PROBABILISTIC_LANGUAGE_USAGE', 'LUCK_VS_SKILL_ATTRIBUTION', 'FEEDBACK_CALIBRATION_RATE'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_PM_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-PM-002',
    title: '学生 —— 一次好成绩=方法对了',
    inputProfile: {
      signals: [ sig('PROBABILISTIC_LANGUAGE_USAGE', A, 75), sig('LUCK_VS_SKILL_ATTRIBUTION', A, 70), sig('FEEDBACK_CALIBRATION_RATE', A, 65) ],
      occupation: '学生',
    },
    expected: { family: FRG, blindSpot: PM, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '单次结果≠模型正确性',
      mechanism: '一次高分就认为学习方法对了——但没有考虑这次考试可能恰好覆盖了擅长的题目。运气=方法，样本=总体',
      whyPrimary: '单次结果当做模型验证，缺少概率和统计概念',
      whyNotAlternates: '不是反馈断裂——她在总结方法，但总结基于错误归因',
      falsePositiveRisk: '如果多次成绩一致且统计上有意义',
    },
    evidenceExpectation: {
      requiredSignals: ['PROBABILISTIC_LANGUAGE_USAGE', 'LUCK_VS_SKILL_ATTRIBUTION', 'FEEDBACK_CALIBRATION_RATE'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_PM_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-PM-003',
    title: '设计师 —— 成功案例不审视背景条件',
    inputProfile: {
      signals: [ sig('PROBABILISTIC_LANGUAGE_USAGE', A, 70), sig('LUCK_VS_SKILL_ATTRIBUTION', A, 65), sig('FEEDBACK_CALIBRATION_RATE', A, 60) ],
      occupation: '设计师',
    },
    expected: { family: FRG, blindSpot: PM, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '单次结果≠模型正确性',
      mechanism: '一次设计被认可就认为自己的方法论有效——忽略了客户偏好、时间点、潮流等外部因素的作用',
      whyPrimary: '将单次成功归因为能力而非概率分布',
      whyNotAlternates: '不是身份约束——她愿意尝试不同的设计风格',
      falsePositiveRisk: '如果多次成功且在不同的客户和条件下',
    },
    evidenceExpectation: {
      requiredSignals: ['PROBABILISTIC_LANGUAGE_USAGE', 'LUCK_VS_SKILL_ATTRIBUTION', 'FEEDBACK_CALIBRATION_RATE'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_PM_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-PM-004',
    title: '外卖员 —— 一次差评就全盘否定自己',
    inputProfile: {
      signals: [ sig('PROBABILISTIC_LANGUAGE_USAGE', A, 65), sig('LUCK_VS_SKILL_ATTRIBUTION', A, 60), sig('FEEDBACK_CALIBRATION_RATE', A, 55) ],
      occupation: '外卖员',
    },
    expected: { family: FRG, blindSpot: PM, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '单次结果≠模型正确性',
      mechanism: '一次差评→“我干不好这个”——用一次负面事件全盘否定自己，忽略了100次配送中99次好评的事实',
      whyPrimary: '将单次负面结果作为整体能力证据',
      whyNotAlternates: '不是风险扭曲——情绪有但根因是缺少概率框架来管理评价',
      falsePositiveRisk: '如果确实一直在收到差评且有明显的服务问题',
    },
    evidenceExpectation: {
      requiredSignals: ['PROBABILISTIC_LANGUAGE_USAGE', 'LUCK_VS_SKILL_ATTRIBUTION', 'FEEDBACK_CALIBRATION_RATE'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_PM_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-IC-001',
    title: '教师 —— "我是教师，不适合做生意"',
    inputProfile: {
      signals: [ sig('IDENTITY_BASED_EXCLUSION', A, 80), sig('CROSS_IDENTITY_ATTEMPT_HISTORY', A, 75), sig('SELF_ASSESSMENT_ASYMMETRY', A, 70) ],
      occupation: '教师',
    },
    expected: { family: FRG, blindSpot: IC, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '身份是描述，不是限制',
      mechanism: '“我是稳定的教育工作者”→隐含否定“我不是冒险的人”、“我不适合商业”。这些是自我定义中的限制性陈述而非客观事实',
      whyPrimary: '自我定义中包含限制性否定，能力足以承担的路径被自我概念排除',
      whyNotAlternates: '不是机会盲区——她看到了商业机会但用身份过滤掉了。不是能力不足——教师的管理能力、沟通能力完全可以迁移',
      falsePositiveRisk: '如果确实教师职业规范和合同禁止副业',
    },
    evidenceExpectation: {
      requiredSignals: ['IDENTITY_BASED_EXCLUSION', 'CROSS_IDENTITY_ATTEMPT_HISTORY', 'SELF_ASSESSMENT_ASYMMETRY'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_IC_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-IC-002',
    title: '设计师 —— "我是创意人，不适合管理"',
    inputProfile: {
      signals: [ sig('IDENTITY_BASED_EXCLUSION', A, 75), sig('CROSS_IDENTITY_ATTEMPT_HISTORY', A, 70), sig('SELF_ASSESSMENT_ASYMMETRY', A, 65) ],
      occupation: '设计师',
    },
    expected: { family: FRG, blindSpot: IC, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '身份是描述，不是限制',
      mechanism: '“我是搞创意的”→隐含“我不适合做管理”、“我不够系统”。这些否定陈述限制了她考虑团队带领、项目管理等方向',
      whyPrimary: '身份定义中的否定陈述排除了能力范围之内的路径',
      whyNotAlternates: '不是系统思维缺失——可能在设计中有很强的系统性',
      falsePositiveRisk: '如果表达的是主观偏好而非身份约束',
    },
    evidenceExpectation: {
      requiredSignals: ['IDENTITY_BASED_EXCLUSION', 'CROSS_IDENTITY_ATTEMPT_HISTORY', 'SELF_ASSESSMENT_ASYMMETRY'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_IC_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },

  {
    id: 'G-IC-003',
    title: '程序员 —— "我是后端，不适合学前端"',
    inputProfile: {
      signals: [ sig('IDENTITY_BASED_EXCLUSION', A, 70), sig('CROSS_IDENTITY_ATTEMPT_HISTORY', A, 65), sig('SELF_ASSESSMENT_ASYMMETRY', A, 60) ],
      occupation: '程序员',
    },
    expected: { family: FRG, blindSpot: IC, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '身份是描述，不是限制',
      mechanism: '“我就是一个后端开发”→这排除了学习前端、移动端、设计、产品等方向的尝试。不是不能学——是身份过滤掉了',
      whyPrimary: '狭窄的身份定义排除了拓展方向',
      whyNotAlternates: '不是决策惯性——他在后端持续学习和行动。问题在于身份的边界限制了领域拓展',
      falsePositiveRisk: '如果后端工作本身已饱和且没有跨界发展的客观需要',
    },
    evidenceExpectation: {
      requiredSignals: ['IDENTITY_BASED_EXCLUSION', 'CROSS_IDENTITY_ATTEMPT_HISTORY', 'SELF_ASSESSMENT_ASYMMETRY'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_IC_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-IC-004',
    title: '外卖员 —— "我就是送外卖的"',
    inputProfile: {
      signals: [ sig('IDENTITY_BASED_EXCLUSION', A, 65), sig('CROSS_IDENTITY_ATTEMPT_HISTORY', A, 60), sig('SELF_ASSESSMENT_ASYMMETRY', A, 55) ],
      occupation: '外卖员',
    },
    expected: { family: FRG, blindSpot: IC, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '身份是描述，不是限制',
      mechanism: '“我就是个送外卖的”——这句话是身份过滤器。它否定了“我也可以是学员、创业者、组织者”等可能性。不是不能——是被身份定义排除了',
      whyPrimary: '身份定义中包含限制性的否定陈述，能力范围被自我概念约束',
      whyNotAlternates: '不是机会盲区——可能已经看到了一些方向。不是系统思维——问题在于身份而非认知结构',
      falsePositiveRisk: '如果客观限制（如时间、家庭负担）非常大',
    },
    evidenceExpectation: {
      requiredSignals: ['IDENTITY_BASED_EXCLUSION', 'CROSS_IDENTITY_ATTEMPT_HISTORY', 'SELF_ASSESSMENT_ASYMMETRY'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_IC_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-STG-001',
    title: '设计师 —— 认为加人就能解决效率问题',
    inputProfile: {
      signals: [ sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 75), sig('LINEARTY_VS_COMPLEXITY_DEFAULT', A, 70), sig('CROSS_DOMAIN_FEEDBACK_THINKING', A, 65) ],
      occupation: '设计师',
    },
    expected: { family: FRG, blindSpot: STG, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '复杂系统中的因果关系是非线性的',
      mechanism: '认为提高产出的方法就是增加人手——但忽略了团队规模增加带来的沟通开销、协作复杂度等非线性的二阶效应',
      whyPrimary: '线性因果解释，忽略行动的延迟效果和二阶效应，缺少反馈回路思维',
      whyNotAlternates: '不是杠杆缺失——她知道需要提高效率但用线性方式思考。不是概率误判',
      falsePositiveRisk: '如果当前团队的瓶颈确实是人力不足且协作成本当前很低',
    },
    evidenceExpectation: {
      requiredSignals: ['FEEDBACK_LOOP_CONCEPT_AWARENESS', 'LINEARTY_VS_COMPLEXITY_DEFAULT', 'CROSS_DOMAIN_FEEDBACK_THINKING'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_STG_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-STG-002',
    title: '自由职业者 —— 不理解为什么"越努力收入越低"',
    inputProfile: {
      signals: [ sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 70), sig('LINEARTY_VS_COMPLEXITY_DEFAULT', A, 65), sig('CROSS_DOMAIN_FEEDBACK_THINKING', A, 60) ],
      occupation: '自由职业者',
    },
    expected: { family: FRG, blindSpot: STG, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '复杂系统中的因果关系是非线性的',
      mechanism: '以为接更多单=更多收入。但忽略了疲劳导致的质量下降、价格战效应、平台算法惩罚等系统性的反馈回路。线性思维看到A→B，看不到B反馈到A',
      whyPrimary: '线性因果解释，忽略反馈回路和二阶效应',
      whyNotAlternates: '不是时间视野——他考虑的是长期收入。不是杠杆——他理解非线性的概念但应用到系统时失效',
      falsePositiveRisk: '如果平台机制确实惩罚效率高的劳工且无法改变',
    },
    evidenceExpectation: {
      requiredSignals: ['FEEDBACK_LOOP_CONCEPT_AWARENESS', 'LINEARTY_VS_COMPLEXITY_DEFAULT', 'CROSS_DOMAIN_FEEDBACK_THINKING'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_STG_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-STG-003',
    title: '客服 —— 逐个处理客户但不看总趋势',
    inputProfile: {
      signals: [ sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 65), sig('LINEARTY_VS_COMPLEXITY_DEFAULT', A, 60), sig('CROSS_DOMAIN_FEEDBACK_THINKING', A, 55) ],
      occupation: '客服',
    },
    expected: { family: FRG, blindSpot: STG, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '复杂系统中的因果关系是非线性的',
      mechanism: '只看单个客户的投诉-处理闭环，不看总体趋势：投诉类型分布、高峰期规律、反馈与产品的关系',
      whyPrimary: '线性因果为主，缺少系统层面的反馈分析',
      whyNotAlternates: '不是反馈断裂——处理了单个投诉。不是杠杆缺失——她的问题在思维框架而非执行模式',
      falsePositiveRisk: '如果客服系统不允许她接触趋势数据',
    },
    evidenceExpectation: {
      requiredSignals: ['FEEDBACK_LOOP_CONCEPT_AWARENESS', 'LINEARTY_VS_COMPLEXITY_DEFAULT', 'CROSS_DOMAIN_FEEDBACK_THINKING'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_STG_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-STG-004',
    title: '学生 —— 认为把每科时间平均分配就是最优',
    inputProfile: {
      signals: [ sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 60), sig('LINEARTY_VS_COMPLEXITY_DEFAULT', A, 55), sig('CROSS_DOMAIN_FEEDBACK_THINKING', A, 50) ],
      occupation: '学生',
    },
    expected: { family: FRG, blindSpot: STG, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '复杂系统中的因果关系是非线性的',
      mechanism: '认为每科投入相同时间=相同提升——但不同学科的进步曲线差别巨大（某些学科前期投入产出极高，某些需要越过阈值才有回报）',
      whyPrimary: '线性因果解释，忽略学科间差异和学习曲线的非线性',
      whyNotAlternates: '不是反馈断裂——每次考试在看成绩。不是概率误判——她知道需要学习方法但用线性思维执行',
      falsePositiveRisk: '如果学校评估体系确实鼓励平均分配策略',
    },
    evidenceExpectation: {
      requiredSignals: ['FEEDBACK_LOOP_CONCEPT_AWARENESS', 'LINEARTY_VS_COMPLEXITY_DEFAULT', 'CROSS_DOMAIN_FEEDBACK_THINKING'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_STG_CROSS_OCCUPATION',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-AMB-001',
    title: '厨师 —— 少量实验但不确定是否构成学习循环',
    inputProfile: {
      signals: [ sig('MINIMUM_STEP_EXECUTION', A, 45), sig('POST_ACTION_REVIEW_HABIT', I, 50), sig('WAITING_DURATION_PATTERN', A, 45) ],
      occupation: '厨师',
    },
    expected: { family: EAG, blindSpot: null, inferenceState: AMB_BLIND, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '边界的模糊性需要被尊重',
      mechanism: '做过一些尝试但不足以判断是探索模式还是偶然行动',
      whyPrimary: '两个方向的证据都不足以做明确判断',
      whyNotAlternates: '不是外部约束',
      falsePositiveRisk: '如果主观有明确但未表露的计划',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'BOUNDARY',
      validationGroup: 'GROUP_AMBIGUITY_BOUNDARY',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },
  {
    id: 'G-AMB-002',
    title: '程序员 —— 方向切换可能是合理的探索',
    inputProfile: {
      signals: [ sig('DIRECTION_SWITCHING_FREQUENCY', A, 50), sig('LONG_TERM_COMPOUNDING_AWARENESS', A, 45), sig('OUTPUT_DECOUPLING_AWARENESS', I, 50) ],
      occupation: '程序员',
    },
    expected: { family: RCG, blindSpot: null, inferenceState: AMB_BLIND, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '环境匹配可能产生合理行为',
      mechanism: '频繁切换在有意识自我探索阶段可能正常',
      whyPrimary: '证据强度不足以区分合理探索和模式缺陷',
      whyNotAlternates: '不是决策惯性——有在切换',
      falsePositiveRisk: '如果客观应做更多探索',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'LOW',
      reviewStatus: 'DISPUTED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'BOUNDARY',
      validationGroup: 'GROUP_AMBIGUITY_BOUNDARY',
      selfValidationStatus: 'UNRESOLVED_MISMATCH',
    },
  },
  {
    id: 'G-AMB-003',
    title: '教师 —— 风险感知可能准确',
    inputProfile: {
      signals: [ sig('EMOTIONAL_RECENCY_IMPACT', A, 45), sig('ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', I, 50) ],
      occupation: '教师',
    },
    expected: { family: PRG, blindSpot: null, inferenceState: AMB_BLIND, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '真实风险与感知风险的边界',
      mechanism: '她的风险评估可能实际上是对的——没有长期数据就无法区分',
      whyPrimary: '单次事件不足以建立情绪偏差模式',
      whyNotAlternates: '不是能力问题',
      falsePositiveRisk: '如果后期数据显示她判断正确',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'LOW',
      reviewStatus: 'DISPUTED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'BOUNDARY',
      validationGroup: 'GROUP_AMBIGUITY_BOUNDARY',
      selfValidationStatus: 'UNRESOLVED_MISMATCH',
    },
  },
  {
    id: 'G-AMB-004',
    title: '设计师 —— 反馈质量低而非反馈回路断裂',
    inputProfile: {
      signals: [ sig('MINIMUM_STEP_EXECUTION', A, 55), sig('POST_ACTION_REVIEW_HABIT', I, 50), sig('DECISION_TO_ACTION_LATENCY', I, 50) ],
      occupation: '设计师',
    },
    expected: { family: EAG, blindSpot: null, inferenceState: AMB_BLIND, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '信息质量与反馈回路是不同概念',
      mechanism: '在做项目但客户不提供高质量反馈——问题可能在反馈源而非反馈机制',
      whyPrimary: '无法区分内部缺陷和外部反馈质量低',
      whyNotAlternates: '不是身份或概率',
      falsePositiveRisk: '如果客户沟通确实需要改进',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'BOUNDARY',
      validationGroup: 'GROUP_AMBIGUITY_BOUNDARY',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },

  {
    id: 'G-AMB-005',
    title: '自由职业者 —— 探索与切换的边界模糊',
    inputProfile: {
      signals: [ sig('DIRECTION_SWITCHING_FREQUENCY', A, 50), sig('LONG_TERM_COMPOUNDING_AWARENESS', A, 45) ],
      occupation: '自由职业者',
    },
    expected: { family: RCG, blindSpot: null, inferenceState: AMB_BLIND, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '探索的时间价值可能高于过早积累',
      mechanism: '在早期自由职业阶段探索多个方向可能是对的',
      whyPrimary: '数据不足以判断是合理探索还是时间视野缺陷',
      whyNotAlternates: '不是杠杆',
      falsePositiveRisk: '如果探索本身是高价值的',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'LOW',
      reviewStatus: 'DISPUTED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'BOUNDARY',
      validationGroup: 'GROUP_AMBIGUITY_BOUNDARY',
      selfValidationStatus: 'UNRESOLVED_MISMATCH',
    },
  },
  {
    id: 'G-AMB-006',
    title: '程序员 —— PROBABILITY 和 SYSTEM 歧义',
    inputProfile: {
      signals: [ sig('PROBABILISTIC_LANGUAGE_USAGE', A, 50), sig('LUCK_VS_SKILL_ATTRIBUTION', A, 50), sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 50) ],
      occupation: '程序员',
    },
    expected: { family: FRG, blindSpot: null, inferenceState: AMB_BLIND, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '两个不同框架问题可能同时存在弱证据',
      mechanism: '既有概率框架薄弱又有系统思维薄弱的弱信号',
      whyPrimary: '两个方向都有弱证据但都不足以确认',
      whyNotAlternates: '两个都是可能的',
      falsePositiveRisk: '如果方向未定是合理的广泛排查',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'BOUNDARY',
      validationGroup: 'GROUP_AMBIGUITY_BOUNDARY',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },
  {
    id: 'G-AMB-007',
    title: '外卖员 —— IDENTITY VS OPPORTUNITY 歧义',
    inputProfile: {
      signals: [ sig('IDENTITY_BASED_EXCLUSION', A, 45), sig('INFORMATION_SOURCE_DIVERSITY', A, 45) ],
      occupation: '外卖员',
    },
    expected: { family: null, blindSpot: null, inferenceState: AMB_FAMILY, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '家庭层面的歧义',
      mechanism: '既可以来自信息不足也可以来自身份过滤',
      whyPrimary: '两个家庭的方向都有微弱证据',
      whyNotAlternates: '两个方向都可能',
      falsePositiveRisk: '如果实际是第三方向的问题',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'BOUNDARY',
      validationGroup: 'GROUP_AMBIGUITY_BOUNDARY',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },
  {
    id: 'G-AMB-008',
    title: '学生 —— 外部压力导致还是认知模式',
    inputProfile: {
      signals: [ sig('MINIMUM_STEP_EXECUTION', A, 40), sig('DIRECTION_SWITCHING_FREQUENCY', A, 40) ],
      occupation: '学生',
    },
    expected: { family: null, blindSpot: null, inferenceState: AMB_FAMILY, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '外部归因与内部归因的区别',
      mechanism: '行为模式可能完全来自外界（家长、学校、考试制度）',
      whyPrimary: '无法区分内部模式被外部塑造',
      whyNotAlternates: '两个都可能',
      falsePositiveRisk: '如果外部因素确实占主导',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'BOUNDARY',
      validationGroup: 'GROUP_AMBIGUITY_BOUNDARY',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },
  {
    id: 'G-AMB-009',
    title: '维修工 —— OB和IC都有弱证据',
    inputProfile: {
      signals: [ sig('INFORMATION_SOURCE_DIVERSITY', A, 40), sig('IDENTITY_BASED_EXCLUSION', A, 40) ],
      occupation: '维修工',
    },
    expected: { family: null, blindSpot: null, inferenceState: AMB_FAMILY, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '家庭级歧义正当',
      mechanism: '信息不足和身份限制两种假设都有微弱支持',
      whyPrimary: '无法确定哪个是主因',
      whyNotAlternates: '都不是强的',
      falsePositiveRisk: '如果实际是第三个家庭',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'BOUNDARY',
      validationGroup: 'GROUP_AMBIGUITY_BOUNDARY',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },
  {
    id: 'G-AMB-010',
    title: '客服 —— 外部环境过于嘈杂',
    inputProfile: {
      signals: [ sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 35), sig('LINEARTY_VS_COMPLEXITY_DEFAULT', A, 35) ],
      occupation: '客服',
    },
    expected: { family: FRG, blindSpot: null, inferenceState: AMB_BLIND, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '信息化环境中的信号检测困难',
      mechanism: '环境中的反馈信号太多太乱，使得很难判断是认知缺陷还是信号处理困难',
      whyPrimary: '信号强度不足',
      whyNotAlternates: '不是能力问题',
      falsePositiveRisk: '如果环境的信噪比确实很低',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'LOW',
      reviewStatus: 'DISPUTED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'BOUNDARY',
      validationGroup: 'GROUP_AMBIGUITY_BOUNDARY',
      selfValidationStatus: 'UNRESOLVED_MISMATCH',
    },
  },
  {
    id: 'G-AMB-011',
    title: '摄影师 —— 一次高回报事件后的困惑',
    inputProfile: {
      signals: [ sig('EMOTIONAL_RECENCY_IMPACT', A, 38), sig('ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', I, 50) ],
      occupation: '摄影师',
    },
    expected: { family: PRG, blindSpot: null, inferenceState: AMB_BLIND, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '高方差事件的高噪声性',
      mechanism: '一次偶然高薪拍摄可能误导她高估了正常回报',
      whyPrimary: '样本量太小',
      whyNotAlternates: '不是杠杆或时间',
      falsePositiveRisk: '如果客观上高薪拍摄确实可以重复',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'BOUNDARY',
      validationGroup: 'GROUP_AMBIGUITY_BOUNDARY',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },
  {
    id: 'G-AMB-012',
    title: '自由职业者 —— RCG家庭内部歧义',
    inputProfile: {
      signals: [ sig('OUTPUT_DECOUPLING_AWARENESS', A, 48), sig('DIRECTION_SWITCHING_FREQUENCY', A, 48) ],
      occupation: '自由职业者',
    },
    expected: { family: RCG, blindSpot: null, inferenceState: AMB_BLIND, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '同一家庭内不同盲点的共存',
      mechanism: 'LMG和THT同样有中等证据——可能两者同时存在',
      whyPrimary: '两者证据强度相当',
      whyNotAlternates: '两个都可能',
      falsePositiveRisk: '如果实际只存在一个',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'BOUNDARY',
      validationGroup: 'GROUP_AMBIGUITY_BOUNDARY',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },
  {
    id: 'G-AMB-013',
    title: '设计师 —— 反馈循环和线性思维都有',
    inputProfile: {
      signals: [ sig('MINIMUM_STEP_EXECUTION', A, 42), sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 42) ],
      occupation: '设计师',
    },
    expected: { family: null, blindSpot: null, inferenceState: AMB_FAMILY, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '跨家庭歧义',
      mechanism: '处在两个认知维度之间的边缘地带',
      whyPrimary: '两者都有微弱证据',
      whyNotAlternates: '不一定需要选择',
      falsePositiveRisk: '如果实际上两者都不是',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'BOUNDARY',
      validationGroup: 'GROUP_AMBIGUITY_BOUNDARY',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },
  {
    id: 'G-AMB-014',
    title: '教师 —— 教学改革慢但可能不是延迟',
    inputProfile: {
      signals: [ sig('WAITING_DURATION_PATTERN', A, 42), sig('DECISION_TO_ACTION_LATENCY', I, 50) ],
      occupation: '教师',
    },
    expected: { family: EAG, blindSpot: null, inferenceState: AMB_BLIND, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '审慎与惯性之间的界线',
      mechanism: '漫长的教育改革可能来自对问题的深刻理解和合理评估',
      whyPrimary: '无法区分审慎和惯性',
      whyNotAlternates: '不是因为不关心',
      falsePositiveRisk: '如果她的审慎确实合理',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'BOUNDARY',
      validationGroup: 'GROUP_AMBIGUITY_BOUNDARY',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },

  {
    id: 'G-AMB-015',
    title: '程序员 —— RMD 和 PM 歧义',
    inputProfile: {
      signals: [ sig('EMOTIONAL_RECENCY_IMPACT', A, 42), sig('PROBABILISTIC_LANGUAGE_USAGE', A, 42) ],
      occupation: '程序员',
    },
    expected: { family: null, blindSpot: null, inferenceState: AMB_FAMILY, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '情绪扭曲和概率缺失可能同时存在',
      mechanism: '既有情绪驱动的决策又有概率框架的缺失',
      whyPrimary: '两个不同家庭的证据相当',
      whyNotAlternates: '两个都是可能的',
      falsePositiveRisk: '家庭判断存在固有歧义',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'BOUNDARY',
      validationGroup: 'GROUP_AMBIGUITY_BOUNDARY',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },
  {
    id: 'G-AMB-016',
    title: '外卖员 —— EAG 和 RCG 歧义',
    inputProfile: {
      signals: [ sig('WAITING_DURATION_PATTERN', A, 42), sig('DIRECTION_SWITCHING_FREQUENCY', A, 42) ],
      occupation: '外卖员',
    },
    expected: { family: null, blindSpot: null, inferenceState: AMB_FAMILY, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '家庭级歧义',
      mechanism: '既在延迟又在担心复利问题',
      whyPrimary: '两个方向都有但都不够强',
      whyNotAlternates: '两个都是可能的方向',
      falsePositiveRisk: '如果还有第三方向的问题',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'BOUNDARY',
      validationGroup: 'GROUP_AMBIGUITY_BOUNDARY',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },
  {
    id: 'G-AMB-017',
    title: '学生 —— IC 和 STG 歧义',
    inputProfile: {
      signals: [ sig('IDENTITY_BASED_EXCLUSION', A, 40), sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 40) ],
      occupation: '学生',
    },
    expected: { family: FRG, blindSpot: null, inferenceState: AMB_BLIND, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: 'FRG家庭内部歧义',
      mechanism: '身份约束和系统思维缺失在同一个家庭中并存',
      whyPrimary: '对哪个更本质没有明确证据',
      whyNotAlternates: '两个都是同一个家庭的候选',
      falsePositiveRisk: '两者可能交互影响',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'BOUNDARY',
      validationGroup: 'GROUP_AMBIGUITY_BOUNDARY',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },
  {
    id: 'G-AMB-018',
    title: '客服 —— 家庭内所有候选都不足',
    inputProfile: {
      signals: [ sig('MINIMUM_STEP_EXECUTION', A, 38), sig('POST_ACTION_REVIEW_HABIT', I, 50) ],
      occupation: '客服',
    },
    expected: { family: EAG, blindSpot: null, inferenceState: AMB_BLIND, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '证据不足时应保持歧义',
      mechanism: '只有一个中等信号不能诊断',
      whyPrimary: '需要更多证据',
      whyNotAlternates: '一个信号不是诊断',
      falsePositiveRisk: '如果这个信号实际上是噪音',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'BOUNDARY',
      validationGroup: 'GROUP_AMBIGUITY_BOUNDARY',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },
  {
    id: 'G-INS-001',
    title: '无任何认知信号',
    inputProfile: {
      signals: [  ],
      occupation: '自由职业者',
    },
    expected: { family: null, blindSpot: null, inferenceState: INSUFF, ambiguityAllowed: true, alternateAllowed: false },
    rationale: {
      worldPrinciple: '没有证据就没有诊断',
      mechanism: '没有观察到任何认知模式',
      whyPrimary: '证据为零',
      whyNotAlternates: '不能臆测',
      falsePositiveRisk: '所有诊断都是错误的',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'STANDARD',
      validationGroup: 'GROUP_INSUFFICIENT_EVIDENCE',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-INS-002',
    title: '所有信号都不足',
    inputProfile: {
      signals: [ sig('WAITING_DURATION_PATTERN', I, 50), sig('MINIMUM_STEP_EXECUTION', I, 50), sig('EMOTIONAL_RECENCY_IMPACT', I, 50), sig('IDENTITY_BASED_EXCLUSION', I, 50) ],
      occupation: '教师',
    },
    expected: { family: null, blindSpot: null, inferenceState: INSUFF, ambiguityAllowed: true, alternateAllowed: false },
    rationale: {
      worldPrinciple: '没有证据就没有诊断',
      mechanism: '所有信号都在insufficient状态',
      whyPrimary: '没有足够证据',
      whyNotAlternates: '强制选择是错误的',
      falsePositiveRisk: '可能诊断出不存在的问题',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'STANDARD',
      validationGroup: 'GROUP_INSUFFICIENT_EVIDENCE',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-INS-003',
    title: '单一弱信号',
    inputProfile: {
      signals: [ sig('DECISION_TO_ACTION_LATENCY', A, 15) ],
      occupation: '程序员',
    },
    expected: { family: null, blindSpot: null, inferenceState: INSUFF, ambiguityAllowed: true, alternateAllowed: false },
    rationale: {
      worldPrinciple: '一个弱信号不够诊断',
      mechanism: '单个低置信信号不能触发有意义的诊断',
      whyPrimary: '需要多信号确认',
      whyNotAlternates: '',
      falsePositiveRisk: '过诊断',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'STANDARD',
      validationGroup: 'GROUP_INSUFFICIENT_EVIDENCE',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },
  {
    id: 'G-INS-004',
    title: '短暂异常行为',
    inputProfile: {
      signals: [ sig('DIRECTION_SWITCHING_FREQUENCY', A, 20) ],
      occupation: '学生',
    },
    expected: { family: null, blindSpot: null, inferenceState: INSUFF, ambiguityAllowed: true, alternateAllowed: false },
    rationale: {
      worldPrinciple: '短暂行为≠持久模式',
      mechanism: '最近一次切换方向不足以建立持续模式',
      whyPrimary: '需要时间和重复来确认模式',
      whyNotAlternates: '',
      falsePositiveRisk: '把临时行为误诊为固有问题',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'STANDARD',
      validationGroup: 'GROUP_INSUFFICIENT_EVIDENCE',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },
  {
    id: 'G-INS-005',
    title: '缺失关键证据',
    inputProfile: {
      signals: [ sig('WAITING_DURATION_PATTERN', A, 50), sig('MINIMUM_STEP_EXECUTION', I, 50) ],
      occupation: '外卖员',
    },
    expected: { family: EAG, blindSpot: null, inferenceState: AMB_BLIND, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '不完整证据不能完整诊断',
      mechanism: 'WAITING存在但缺少其他必要证据',
      whyPrimary: 'DI的necessary条件没有达到ALL_OF要求',
      whyNotAlternates: '不是外部约束',
      falsePositiveRisk: '强行诊断DI',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'STANDARD',
      validationGroup: 'GROUP_INSUFFICIENT_EVIDENCE',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },
  {
    id: 'G-INS-006',
    title: '矛盾证据',
    inputProfile: {
      signals: [ sig('WAITING_DURATION_PATTERN', A, 60), sig('MINIMUM_STEP_EXECUTION', A, 60) ],
      occupation: '厨师',
    },
    expected: { family: EAG, blindSpot: null, inferenceState: AMB_BLIND, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '矛盾证据表示需要更多信息',
      mechanism: 'DI和FLG互相disqualify——说明情况复杂不能简单归结为某一个',
      whyPrimary: '互相矛盾应保持歧义',
      whyNotAlternates: '不是外部约束',
      falsePositiveRisk: '归类为其中一个会丢失信息',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'STANDARD',
      validationGroup: 'GROUP_INSUFFICIENT_EVIDENCE',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },

  {
    id: 'G-INS-007',
    title: '仅有SUPPRESSED信号',
    inputProfile: {
      signals: [ sig('WAITING_DURATION_PATTERN', S, 50), sig('MINIMUM_STEP_EXECUTION', S, 50), sig('POST_ACTION_REVIEW_HABIT', S, 50) ],
      occupation: '自由职业者',
    },
    expected: { family: null, blindSpot: null, inferenceState: INSUFF, ambiguityAllowed: true, alternateAllowed: false },
    rationale: {
      worldPrinciple: '被压制信号不是诊断信号',
      mechanism: '只有被抑制的信号而无活跃信号——表示没有明确的认知缺陷被激活',
      whyPrimary: '无活跃信号',
      whyNotAlternates: '',
      falsePositiveRisk: '将被抑制信号误解为弱支持而不是矛盾',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'STANDARD',
      validationGroup: 'GROUP_INSUFFICIENT_EVIDENCE',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-INS-008',
    title: '信息空白——零信号',
    inputProfile: {
      signals: [  ],
      occupation: '维修工',
    },
    expected: { family: null, blindSpot: null, inferenceState: INSUFF, ambiguityAllowed: true, alternateAllowed: false },
    rationale: {
      worldPrinciple: '无输入=不确定',
      mechanism: '没有任何数据不应该产生任何结论',
      whyPrimary: '防止过度推断',
      whyNotAlternates: '',
      falsePositiveRisk: '强行诊断伤害大于帮助',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'STANDARD',
      validationGroup: 'GROUP_INSUFFICIENT_EVIDENCE',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-INS-009',
    title: '中性信号——不高不低的模糊区间',
    inputProfile: {
      signals: [ sig('INFORMATION_SOURCE_DIVERSITY', A, 30), sig('IDENTITY_BASED_EXCLUSION', A, 30) ],
      occupation: '客服',
    },
    expected: { family: null, blindSpot: null, inferenceState: AMB_FAMILY, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '临界值附近的信号需要谨慎',
      mechanism: '信号在决策边界附近——随机波动可能导致不同的诊断',
      whyPrimary: '边界信号应该保守处理',
      whyNotAlternates: '',
      falsePositiveRisk: '阈值附近的误分类',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'STANDARD',
      validationGroup: 'GROUP_INSUFFICIENT_EVIDENCE',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },
  {
    id: 'G-INS-010',
    title: '单一跨家庭信号',
    inputProfile: {
      signals: [ sig('CROSS_DOMAIN_FEEDBACK_THINKING', A, 25) ],
      occupation: '教师',
    },
    expected: { family: null, blindSpot: null, inferenceState: INSUFF, ambiguityAllowed: true, alternateAllowed: false },
    rationale: {
      worldPrinciple: '跨家庭信号需要更多上下文',
      mechanism: '单一信号属于多个家庭无法指向特定方向',
      whyPrimary: '单一信号歧义太大',
      whyNotAlternates: '',
      falsePositiveRisk: '把歧义信号当作确定性信号',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'STANDARD',
      validationGroup: 'GROUP_INSUFFICIENT_EVIDENCE',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },
  {
    id: 'G-EXT-001',
    title: '外卖员 —— 平台算法限制了优化空间',
    inputProfile: {
      signals: [ sig('MINIMUM_STEP_EXECUTION', A, 50), sig('POST_ACTION_REVIEW_HABIT', I, 50), sig('DIRECTION_SWITCHING_FREQUENCY', A, 45) ],
      occupation: '外卖员 / 受外部算法约束',
    },
    expected: { family: null, blindSpot: null, inferenceState: AMB_FAMILY, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '外部约束可能创造与认知缺陷相同的行为表现',
      mechanism: '平台分配路线、分配订单——骑手的"不优化"行为可能不是学习能力的问题，而是没有自主优化的空间',
      whyPrimary: '需要区分算法约束（外部）和认知缺陷（内部）',
      whyNotAlternates: '不能诊断为认知问题',
      falsePositiveRisk: '把系统性问题当作个人缺陷',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'ADVERSARIAL',
      validationRole: 'EXTERNAL_CONSTRAINT',
      validationGroup: 'GROUP_EXTERNAL_CONSTRAINT',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },
  {
    id: 'G-EXT-002',
    title: '学生 —— 家长强制安排的学习计划',
    inputProfile: {
      signals: [ sig('MINIMUM_STEP_EXECUTION', A, 55), sig('DECISION_TO_ACTION_LATENCY', A, 45), sig('WAITING_DURATION_PATTERN', A, 40) ],
      occupation: '学生 / 受监护人约束',
    },
    expected: { family: EAG, blindSpot: null, inferenceState: AMB_BLIND, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '他治vs自治产生不同的行为模式',
      mechanism: '学生的"一直在行动"是因为家长推着动，不是自主行动模式。被动行动不是主动反馈',
      whyPrimary: '自主vs他治应分开',
      whyNotAlternates: '不是真正的FLG',
      falsePositiveRisk: '把外部施加的行为当作内部模式',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'ADVERSARIAL',
      validationRole: 'EXTERNAL_CONSTRAINT',
      validationGroup: 'GROUP_EXTERNAL_CONSTRAINT',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },
  {
    id: 'G-EXT-003',
    title: '设计师 —— 客户严格限制修改',
    inputProfile: {
      signals: [ sig('OUTPUT_DECOUPLING_AWARENESS', A, 45), sig('EFFORT_VS_MECHANISM_FRAMING', A, 40) ],
      occupation: '设计师 / 受客户合同约束',
    },
    expected: { family: RCG, blindSpot: null, inferenceState: AMB_BLIND, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '外部限制可能创造虚假的杠杆缺失',
      mechanism: '客户要求每次修改必须本人出场——这不是设计师的认知缺陷而是客户的合同规定',
      whyPrimary: '需要区分市场约束和个人模型',
      whyNotAlternates: '不是杠杆的认知问题',
      falsePositiveRisk: '把市场中的有效约束当作认知缺陷',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'ADVERSARIAL',
      validationRole: 'EXTERNAL_CONSTRAINT',
      validationGroup: 'GROUP_EXTERNAL_CONSTRAINT',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },
  {
    id: 'G-EXT-004',
    title: '自由职业者 —— 照顾家庭占用了决策时间',
    inputProfile: {
      signals: [ sig('WAITING_DURATION_PATTERN', A, 55), sig('MINIMUM_STEP_EXECUTION', I, 50) ],
      occupation: '自由职业者 / 家庭照护者',
    },
    expected: { family: EAG, blindSpot: null, inferenceState: AMB_BLIND, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '资源约束不是认知问题',
      mechanism: '"推迟"不是因为信息不足或怕选错——而是每天的时间被照护工作占满',
      whyPrimary: '时间约束 ≠ 认知缺陷',
      whyNotAlternates: '不能把时间不够的人诊断为决策惯性',
      falsePositiveRisk: '把结构性不平等当作个人缺陷',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'ADVERSARIAL',
      validationRole: 'EXTERNAL_CONSTRAINT',
      validationGroup: 'GROUP_EXTERNAL_CONSTRAINT',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },
  {
    id: 'G-EXT-005',
    title: '厨师 —— 餐馆倒闭后被迫换工作',
    inputProfile: {
      signals: [ sig('DIRECTION_SWITCHING_FREQUENCY', A, 50), sig('LONG_TERM_COMPOUNDING_AWARENESS', I, 50) ],
      occupation: '厨师 / 受市场波动影响',
    },
    expected: { family: RCG, blindSpot: null, inferenceState: AMB_BLIND, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '被迫切换与主动漂移有本质不同',
      mechanism: '餐馆倒闭→被迫换工作——不是短期偏好驱动的漂移，而是市场冲击',
      whyPrimary: '区分结构性事件和行为模式',
      whyNotAlternates: '不是THT',
      falsePositiveRisk: '将经济冲击诊断为行为问题',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'ADVERSARIAL',
      validationRole: 'EXTERNAL_CONSTRAINT',
      validationGroup: 'GROUP_EXTERNAL_CONSTRAINT',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },
  {
    id: 'G-EXT-006',
    title: '教师 —— 学校行政规定限制教学方式',
    inputProfile: {
      signals: [ sig('WAITING_DURATION_PATTERN', A, 45), sig('MINIMUM_STEP_EXECUTION', A, 40) ],
      occupation: '教师 / 受行政规定约束',
    },
    expected: { family: EAG, blindSpot: null, inferenceState: AMB_BLIND, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '行政制度对行为的约束不同于认知约束',
      mechanism: '不能改革的真正原因是规章制度而非犹豫',
      whyPrimary: '需要区分制度约束和认知模式',
      whyNotAlternates: '不是DI——她知道想改但规则不让',
      falsePositiveRisk: '把制度问题个人化',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'ADVERSARIAL',
      validationRole: 'EXTERNAL_CONSTRAINT',
      validationGroup: 'GROUP_EXTERNAL_CONSTRAINT',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },

  {
    id: 'G-EXT-007',
    title: '程序员 —— 签证限制职业选择',
    inputProfile: {
      signals: [ sig('IDENTITY_BASED_EXCLUSION', A, 45), sig('SELF_ASSESSMENT_ASYMMETRY', A, 40) ],
      occupation: '程序员 / 受签证/移民约束',
    },
    expected: { family: FRG, blindSpot: null, inferenceState: AMB_BLIND, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '身份约束的外部来源vs内部来源',
      mechanism: '签证限制是真实的客观限制，不是"我是程序员所以不能做X"的身份过滤',
      whyPrimary: '内部身份过滤vs外部身份限制',
      whyNotAlternates: '不是IC——有客观限制',
      falsePositiveRisk: '把法律身份约束当作心理身份约束',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'ADVERSARIAL',
      validationRole: 'EXTERNAL_CONSTRAINT',
      validationGroup: 'GROUP_EXTERNAL_CONSTRAINT',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },
  {
    id: 'G-EXT-008',
    title: '外卖员 —— 住在信息孤岛中（偏远地区）',
    inputProfile: {
      signals: [ sig('INFORMATION_SOURCE_DIVERSITY', A, 55), sig('SERENDIPITOUS_PATH_DISCOVERY', A, 45), sig('NON_DOMAIN_PATH_AWARENESS', A, 40) ],
      occupation: '外卖员 / 偏远地区居住',
    },
    expected: { family: PRG, blindSpot: null, inferenceState: AMB_BLIND, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '信息接触面的地理因素vs认知因素',
      mechanism: '信息接触面窄不是因为他选择窄的信息源——而是地理位置客观上限制了社交多样性',
      whyPrimary: '地理限制vs主观信息偏食',
      whyNotAlternates: '不是真正的OB认知问题',
      falsePositiveRisk: '把地理隔离当作认知问题',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'ADVERSARIAL',
      validationRole: 'EXTERNAL_CONSTRAINT',
      validationGroup: 'GROUP_EXTERNAL_CONSTRAINT',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },
  {
    id: 'G-EXT-009',
    title: '客服 —— 系统不提供趋势数据',
    inputProfile: {
      signals: [ sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 45), sig('LINEARTY_VS_COMPLEXITY_DEFAULT', A, 40) ],
      occupation: '客服 / 受公司工具限制',
    },
    expected: { family: FRG, blindSpot: null, inferenceState: AMB_BLIND, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '系统无法提供反馈时不应归咎个人',
      mechanism: '客服软件不显示趋势数据——不是她不想分析系统而是看不到数据',
      whyPrimary: '工具限制vs认知限制',
      whyNotAlternates: '不是STG——有系统思维倾向但无数据',
      falsePositiveRisk: '把工具不足当作思维缺陷',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'ADVERSARIAL',
      validationRole: 'EXTERNAL_CONSTRAINT',
      validationGroup: 'GROUP_EXTERNAL_CONSTRAINT',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },
  {
    id: 'G-EXT-010',
    title: '自由职业者 —— 行业惯例阻止合作',
    inputProfile: {
      signals: [ sig('OUTPUT_DECOUPLING_AWARENESS', A, 40), sig('EFFORT_VS_MECHANISM_FRAMING', I, 50) ],
      occupation: '自由职业者 / 行业保护主义',
    },
    expected: { family: RCG, blindSpot: null, inferenceState: AMB_BLIND, ambiguityAllowed: true, alternateAllowed: true },
    rationale: {
      worldPrinciple: '行业规范可能创造认知问题的错觉',
      mechanism: '行业要求自由职业者单人单案——不是她缺乏杠杆意识而是行业不认可非个人交付',
      whyPrimary: '行业壁垒vs个人认知',
      whyNotAlternates: '不是LMG',
      falsePositiveRisk: '把行业规范当作个人缺陷',
    },
    evidenceExpectation: {
      requiredSignals: [],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'MEDIUM',
      reviewStatus: 'REVIEWED',
      labelSource: 'ADVERSARIAL',
      validationRole: 'EXTERNAL_CONSTRAINT',
      validationGroup: 'GROUP_EXTERNAL_CONSTRAINT',
      selfValidationStatus: 'EXPECTED_MISMATCH',
    },
  },
  {
    id: 'G-CROSS-001',
    title: '同证据×厨师=DI',
    inputProfile: {
      signals: [ sig('WAITING_DURATION_PATTERN', A, 80), sig('MINIMUM_STEP_EXECUTION', I, 50) ],
      occupation: '厨师',
    },
    expected: { family: EAG, blindSpot: DI, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '相同认知证据应产生相同认知诊断',
      mechanism: 'DI出现在各种职业中——职业是元数据而不是推理特征',
      whyPrimary: 'DI的证据在所有职业中相同',
      whyNotAlternates: '不是职业敏感的诊断',
      falsePositiveRisk: '无',
    },
    evidenceExpectation: {
      requiredSignals: ['WAITING_DURATION_PATTERN'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_CROSS_OCCUPATION_MIXED',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-CROSS-002',
    title: '同证据×程序员=DI',
    inputProfile: {
      signals: [ sig('WAITING_DURATION_PATTERN', A, 80), sig('MINIMUM_STEP_EXECUTION', I, 50) ],
      occupation: '程序员',
    },
    expected: { family: EAG, blindSpot: DI, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '相同的认知证据→相同的诊断',
      mechanism: 'DI的证据跨界一致',
      whyPrimary: 'DI模式与职业无关',
      whyNotAlternates: '不是职业驱动的诊断',
      falsePositiveRisk: '无',
    },
    evidenceExpectation: {
      requiredSignals: ['WAITING_DURATION_PATTERN'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_CROSS_OCCUPATION_MIXED',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-CROSS-003',
    title: '同证据×设计师=FLG',
    inputProfile: {
      signals: [ sig('MINIMUM_STEP_EXECUTION', A, 75), sig('POST_ACTION_REVIEW_HABIT', A, 70), sig('DECISION_TO_ACTION_LATENCY', A, 65), sig('WAITING_DURATION_PATTERN', I, 50) ],
      occupation: '设计师',
    },
    expected: { family: EAG, blindSpot: FLG, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '反馈模式跨界通用',
      mechanism: '没有复盘的执行模式在所有职业中表现相同',
      whyPrimary: 'FLG跨职业的诊断一致性',
      whyNotAlternates: '不是设计师专属',
      falsePositiveRisk: '无',
    },
    evidenceExpectation: {
      requiredSignals: ['MINIMUM_STEP_EXECUTION', 'POST_ACTION_REVIEW_HABIT', 'DECISION_TO_ACTION_LATENCY'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_CROSS_OCCUPATION_MIXED',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-CROSS-004',
    title: '同证据×外卖员=FLG',
    inputProfile: {
      signals: [ sig('MINIMUM_STEP_EXECUTION', A, 75), sig('POST_ACTION_REVIEW_HABIT', A, 70), sig('DECISION_TO_ACTION_LATENCY', A, 65), sig('WAITING_DURATION_PATTERN', I, 50) ],
      occupation: '外卖员',
    },
    expected: { family: EAG, blindSpot: FLG, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '反馈模式与具体工作无关',
      mechanism: '相同模式的FLG在低和高端工作中出现',
      whyPrimary: '反馈模式的无场景性',
      whyNotAlternates: '不是职业决定的',
      falsePositiveRisk: '无',
    },
    evidenceExpectation: {
      requiredSignals: ['MINIMUM_STEP_EXECUTION', 'POST_ACTION_REVIEW_HABIT', 'DECISION_TO_ACTION_LATENCY'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_CROSS_OCCUPATION_MIXED',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-CROSS-005',
    title: '同证据×维修工=THT',
    inputProfile: {
      signals: [ sig('DIRECTION_SWITCHING_FREQUENCY', A, 75), sig('LONG_TERM_COMPOUNDING_AWARENESS', A, 70), sig('OUTPUT_DECOUPLING_AWARENESS', I, 50) ],
      occupation: '维修工',
    },
    expected: { family: RCG, blindSpot: THT, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '时间视野与职业类型无关',
      mechanism: 'THT可以出现在任何需要积累的领域',
      whyPrimary: '跨界模式',
      whyNotAlternates: '不是职业问题',
      falsePositiveRisk: '无',
    },
    evidenceExpectation: {
      requiredSignals: ['DIRECTION_SWITCHING_FREQUENCY', 'LONG_TERM_COMPOUNDING_AWARENESS'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_CROSS_OCCUPATION_MIXED',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-CROSS-006',
    title: '同证据×教师=RMD',
    inputProfile: {
      signals: [ sig('EMOTIONAL_RECENCY_IMPACT', A, 75), sig('ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', A, 70), sig('PROBABILISTIC_LANGUAGE_USAGE', I, 50) ],
      occupation: '教师',
    },
    expected: { family: PRG, blindSpot: RMD, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '风险扭曲与职业无关',
      mechanism: '情绪驱动的风险评估跨越所有职业',
      whyPrimary: 'RMD的通用性',
      whyNotAlternates: '不是教师特有',
      falsePositiveRisk: '无',
    },
    evidenceExpectation: {
      requiredSignals: ['EMOTIONAL_RECENCY_IMPACT', 'ABSTRACT_VS_EMBODIED_RISK_JUDGMENT'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_CROSS_OCCUPATION_MIXED',
      selfValidationStatus: 'MATCH',
    },
  },

  {
    id: 'G-CROSS-007',
    title: '同证据×自由职业者=OB',
    inputProfile: {
      signals: [ sig('INFORMATION_SOURCE_DIVERSITY', A, 75), sig('SERENDIPITOUS_PATH_DISCOVERY', A, 70), sig('NON_DOMAIN_PATH_AWARENESS', A, 65), sig('IDENTITY_BASED_EXCLUSION', I, 50) ],
      occupation: '自由职业者',
    },
    expected: { family: PRG, blindSpot: OB, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '信息接触面与职业类型无关',
      mechanism: '任何职业都可以有窄的信息接触面',
      whyPrimary: 'OB可以出现在任何人身上',
      whyNotAlternates: '不是特定职业的问题',
      falsePositiveRisk: '无',
    },
    evidenceExpectation: {
      requiredSignals: ['INFORMATION_SOURCE_DIVERSITY', 'SERENDIPITOUS_PATH_DISCOVERY', 'NON_DOMAIN_PATH_AWARENESS'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_CROSS_OCCUPATION_MIXED',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-CROSS-008',
    title: '同证据×客服=PM',
    inputProfile: {
      signals: [ sig('PROBABILISTIC_LANGUAGE_USAGE', A, 75), sig('LUCK_VS_SKILL_ATTRIBUTION', A, 70), sig('FEEDBACK_CALIBRATION_RATE', A, 65) ],
      occupation: '客服',
    },
    expected: { family: FRG, blindSpot: PM, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '概率框架缺失与职业无关',
      mechanism: 'PM的出现与职业类型无关',
      whyPrimary: '跨界一致性',
      whyNotAlternates: '不是职业决定',
      falsePositiveRisk: '无',
    },
    evidenceExpectation: {
      requiredSignals: ['PROBABILISTIC_LANGUAGE_USAGE', 'LUCK_VS_SKILL_ATTRIBUTION', 'FEEDBACK_CALIBRATION_RATE'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_CROSS_OCCUPATION_MIXED',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-CROSS-009',
    title: '同证据×学生=STG',
    inputProfile: {
      signals: [ sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 65), sig('LINEARTY_VS_COMPLEXITY_DEFAULT', A, 60), sig('CROSS_DOMAIN_FEEDBACK_THINKING', A, 55) ],
      occupation: '学生',
    },
    expected: { family: FRG, blindSpot: STG, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '系统思维与年龄/阶段无关',
      mechanism: 'STG可以在学生阶段出现',
      whyPrimary: '跨界一致性',
      whyNotAlternates: '不是学生特有的',
      falsePositiveRisk: '无',
    },
    evidenceExpectation: {
      requiredSignals: ['FEEDBACK_LOOP_CONCEPT_AWARENESS', 'LINEARTY_VS_COMPLEXITY_DEFAULT', 'CROSS_DOMAIN_FEEDBACK_THINKING'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_CROSS_OCCUPATION_MIXED',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-CROSS-010',
    title: '同证据×摄影师=IC',
    inputProfile: {
      signals: [ sig('IDENTITY_BASED_EXCLUSION', A, 70), sig('CROSS_IDENTITY_ATTEMPT_HISTORY', A, 65), sig('SELF_ASSESSMENT_ASYMMETRY', A, 60) ],
      occupation: '摄影师',
    },
    expected: { family: FRG, blindSpot: IC, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '身份约束与职业类型无关',
      mechanism: '任何职业都可以有IC',
      whyPrimary: '跨界一致性',
      whyNotAlternates: '不是职业决定的',
      falsePositiveRisk: '无',
    },
    evidenceExpectation: {
      requiredSignals: ['IDENTITY_BASED_EXCLUSION', 'CROSS_IDENTITY_ATTEMPT_HISTORY', 'SELF_ASSESSMENT_ASYMMETRY'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'CROSS_OCCUPATION',
      validationGroup: 'GROUP_CROSS_OCCUPATION_MIXED',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-SAME-001',
    title: '厨师A — 实验型 (FLG)',
    inputProfile: {
      signals: [ sig('MINIMUM_STEP_EXECUTION', A, 80), sig('POST_ACTION_REVIEW_HABIT', A, 75), sig('DECISION_TO_ACTION_LATENCY', A, 70), sig('WAITING_DURATION_PATTERN', I, 50) ],
      occupation: '厨师 / 实验型',
    },
    expected: { family: EAG, blindSpot: FLG, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '相同职业，不同认知模式',
      mechanism: '厨师A不断尝试新菜但从不记录结果',
      whyPrimary: 'FLG的典型表现',
      whyNotAlternates: '不是DI——他在做菜',
      falsePositiveRisk: '无',
    },
    evidenceExpectation: {
      requiredSignals: ['MINIMUM_STEP_EXECUTION', 'POST_ACTION_REVIEW_HABIT', 'DECISION_TO_ACTION_LATENCY'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'SAME_OCCUPATION',
      validationGroup: 'GROUP_SAME_COOK',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-SAME-002',
    title: '厨师B — 犹豫型 (DI)',
    inputProfile: {
      signals: [ sig('WAITING_DURATION_PATTERN', A, 85), sig('MINIMUM_STEP_EXECUTION', I, 50), sig('POST_ACTION_REVIEW_HABIT', I, 50) ],
      occupation: '厨师 / 犹豫型',
    },
    expected: { family: EAG, blindSpot: DI, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '相同职业不同认知',
      mechanism: '厨师B想开新菜但一直在等',
      whyPrimary: 'DI的典型表现',
      whyNotAlternates: '不是FLG——还没开始做',
      falsePositiveRisk: '无',
    },
    evidenceExpectation: {
      requiredSignals: ['WAITING_DURATION_PATTERN'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'SAME_OCCUPATION',
      validationGroup: 'GROUP_SAME_COOK',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-SAME-003',
    title: '程序员A — 杠杆型 (LMG)',
    inputProfile: {
      signals: [ sig('OUTPUT_DECOUPLING_AWARENESS', A, 80), sig('EFFORT_VS_MECHANISM_FRAMING', A, 75), sig('DIRECTION_SWITCHING_FREQUENCY', I, 50) ],
      occupation: '程序员 / 线性交付型',
    },
    expected: { family: RCG, blindSpot: LMG, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '相同职业不同认知模式',
      mechanism: '程序员A写代码非常快但所有产出都是线性交付',
      whyPrimary: 'LMG',
      whyNotAlternates: '不是THT——不换方向',
      falsePositiveRisk: '无',
    },
    evidenceExpectation: {
      requiredSignals: ['OUTPUT_DECOUPLING_AWARENESS', 'EFFORT_VS_MECHANISM_FRAMING'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'SAME_OCCUPATION',
      validationGroup: 'GROUP_SAME_PROGRAMMER',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-SAME-004',
    title: '程序员B — 跟风型 (THT)',
    inputProfile: {
      signals: [ sig('DIRECTION_SWITCHING_FREQUENCY', A, 85), sig('LONG_TERM_COMPOUNDING_AWARENESS', A, 75), sig('OUTPUT_DECOUPLING_AWARENESS', I, 50) ],
      occupation: '程序员 / 跟风型',
    },
    expected: { family: RCG, blindSpot: THT, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '相同职业不同认知',
      mechanism: '程序员B频繁跟风新技术，永远在"next big thing"',
      whyPrimary: 'THT',
      whyNotAlternates: '不是LMG——切换了方向',
      falsePositiveRisk: '无',
    },
    evidenceExpectation: {
      requiredSignals: ['DIRECTION_SWITCHING_FREQUENCY', 'LONG_TERM_COMPOUNDING_AWARENESS'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'SAME_OCCUPATION',
      validationGroup: 'GROUP_SAME_PROGRAMMER',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-SAME-005',
    title: '教师A — 情感型 (RMD)',
    inputProfile: {
      signals: [ sig('EMOTIONAL_RECENCY_IMPACT', A, 80), sig('ABSTRACT_VS_EMBODIED_RISK_JUDGMENT', A, 75), sig('PROBABILISTIC_LANGUAGE_USAGE', I, 50) ],
      occupation: '教师 / 情感型',
    },
    expected: { family: PRG, blindSpot: RMD, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '相同职业不同认知',
      mechanism: '教师A一被批评就否定整个教学方法',
      whyPrimary: 'RMD',
      whyNotAlternates: '不是OB——她看到很多方法但评估时用情感',
      falsePositiveRisk: '无',
    },
    evidenceExpectation: {
      requiredSignals: ['EMOTIONAL_RECENCY_IMPACT', 'ABSTRACT_VS_EMBODIED_RISK_JUDGMENT'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'SAME_OCCUPATION',
      validationGroup: 'GROUP_SAME_TEACHER',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-SAME-006',
    title: '教师B — 框架型 (PM)',
    inputProfile: {
      signals: [ sig('PROBABILISTIC_LANGUAGE_USAGE', A, 75), sig('LUCK_VS_SKILL_ATTRIBUTION', A, 70), sig('FEEDBACK_CALIBRATION_RATE', A, 65) ],
      occupation: '教师 / 框架型',
    },
    expected: { family: FRG, blindSpot: PM, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '相同职业不同认知',
      mechanism: '教师B用一次考试结果验证整个教学方法',
      whyPrimary: 'PM',
      whyNotAlternates: '不是RMD——方法不对但情绪不主导',
      falsePositiveRisk: '无',
    },
    evidenceExpectation: {
      requiredSignals: ['PROBABILISTIC_LANGUAGE_USAGE', 'LUCK_VS_SKILL_ATTRIBUTION', 'FEEDBACK_CALIBRATION_RATE'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'SAME_OCCUPATION',
      validationGroup: 'GROUP_SAME_TEACHER',
      selfValidationStatus: 'MATCH',
    },
  },

  {
    id: 'G-SAME-007',
    title: '设计师A — 视野窄 (OB)',
    inputProfile: {
      signals: [ sig('INFORMATION_SOURCE_DIVERSITY', A, 75), sig('SERENDIPITOUS_PATH_DISCOVERY', A, 70), sig('NON_DOMAIN_PATH_AWARENESS', A, 65), sig('IDENTITY_BASED_EXCLUSION', I, 50) ],
      occupation: '设计师 / 视野窄',
    },
    expected: { family: PRG, blindSpot: OB, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '相同职业不同认知',
      mechanism: '设计师A的客户都来自同一圈子',
      whyPrimary: 'OB',
      whyNotAlternates: '不是IC——不是身份阻止她',
      falsePositiveRisk: '无',
    },
    evidenceExpectation: {
      requiredSignals: ['INFORMATION_SOURCE_DIVERSITY', 'SERENDIPITOUS_PATH_DISCOVERY', 'NON_DOMAIN_PATH_AWARENESS'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'SAME_OCCUPATION',
      validationGroup: 'GROUP_SAME_DESIGNER',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-SAME-008',
    title: '设计师B — 身份受限 (IC)',
    inputProfile: {
      signals: [ sig('IDENTITY_BASED_EXCLUSION', A, 75), sig('CROSS_IDENTITY_ATTEMPT_HISTORY', A, 70), sig('SELF_ASSESSMENT_ASYMMETRY', A, 65), sig('INFORMATION_SOURCE_DIVERSITY', I, 50) ],
      occupation: '设计师 / 身份受限',
    },
    expected: { family: FRG, blindSpot: IC, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '相同职业不同认知',
      mechanism: '设计师B有各种信息但认为"设计师不适合"',
      whyPrimary: 'IC',
      whyNotAlternates: '不是OB——信息够但身份过滤',
      falsePositiveRisk: '无',
    },
    evidenceExpectation: {
      requiredSignals: ['IDENTITY_BASED_EXCLUSION', 'CROSS_IDENTITY_ATTEMPT_HISTORY', 'SELF_ASSESSMENT_ASYMMETRY'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'SAME_OCCUPATION',
      validationGroup: 'GROUP_SAME_DESIGNER',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-SAME-009',
    title: '学生A — 被动执行 (FLG)',
    inputProfile: {
      signals: [ sig('MINIMUM_STEP_EXECUTION', A, 75), sig('POST_ACTION_REVIEW_HABIT', A, 70), sig('DECISION_TO_ACTION_LATENCY', A, 65), sig('WAITING_DURATION_PATTERN', I, 50) ],
      occupation: '学生 / 被动',
    },
    expected: { family: EAG, blindSpot: FLG, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '相同职业不同认知',
      mechanism: '学生A天天学习但不复盘',
      whyPrimary: 'FLG',
      whyNotAlternates: '不是DI——有行动',
      falsePositiveRisk: '无',
    },
    evidenceExpectation: {
      requiredSignals: ['MINIMUM_STEP_EXECUTION', 'POST_ACTION_REVIEW_HABIT', 'DECISION_TO_ACTION_LATENCY'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'SAME_OCCUPATION',
      validationGroup: 'GROUP_SAME_STUDENT',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-SAME-010',
    title: '学生B — 线性思维 (STG)',
    inputProfile: {
      signals: [ sig('FEEDBACK_LOOP_CONCEPT_AWARENESS', A, 70), sig('LINEARTY_VS_COMPLEXITY_DEFAULT', A, 65), sig('CROSS_DOMAIN_FEEDBACK_THINKING', A, 60) ],
      occupation: '学生 / 线性',
    },
    expected: { family: FRG, blindSpot: STG, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '相同职业不同认知',
      mechanism: '学生B学习某科时用平均时间分配策略',
      whyPrimary: 'STG',
      whyNotAlternates: '不是FLG——有学习且复盘但方法线性',
      falsePositiveRisk: '无',
    },
    evidenceExpectation: {
      requiredSignals: ['FEEDBACK_LOOP_CONCEPT_AWARENESS', 'LINEARTY_VS_COMPLEXITY_DEFAULT', 'CROSS_DOMAIN_FEEDBACK_THINKING'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'HUMAN_NORMATIVE',
      validationRole: 'SAME_OCCUPATION',
      validationGroup: 'GROUP_SAME_STUDENT',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-LEG-001',
    title: '不会销售→DI旧系统会错判',
    inputProfile: {
      signals: [ sig('WAITING_DURATION_PATTERN', A, 80), sig('MINIMUM_STEP_EXECUTION', I, 50) ],
      occupation: '自由职业者 / 不擅长销售',
    },
    expected: { family: EAG, blindSpot: DI, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '不能自动把行为问题映射到职业标签',
      mechanism: '旧系统看到"不销售"就说"SELLING问题"——但根因是决策延迟。推迟联系潜在客户的原因是怕被拒、不确定自己该说什么——这是认知模式而非商业技能缺陷',
      whyPrimary: '认知模式（决策惯性）是根因——不是"不会销售"',
      whyNotAlternates: '禁止出现SELLING、TRAFFIC、SINGLE_INCOME等商业诊断',
      falsePositiveRisk: '最大的风险：原来的商业诊断掩盖了认知根因',
    },
    evidenceExpectation: {
      requiredSignals: ['WAITING_DURATION_PATTERN'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'ADVERSARIAL',
      validationRole: 'LEGACY_FAILURE',
      validationGroup: 'GROUP_LEGACY_FAILURE',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-LEG-002',
    title: '没有销量→FLG不是SELLING',
    inputProfile: {
      signals: [ sig('MINIMUM_STEP_EXECUTION', A, 75), sig('POST_ACTION_REVIEW_HABIT', A, 70), sig('DECISION_TO_ACTION_LATENCY', A, 65), sig('WAITING_DURATION_PATTERN', I, 50) ],
      occupation: '自由职业者 / 无销量',
    },
    expected: { family: EAG, blindSpot: FLG, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '输出问题不能等同于认知问题',
      mechanism: '做了很多尝试但不复盘——她的问题不是“没有销售技能”而是“没有从尝试中学习”',
      whyPrimary: '是反馈学习的问题而非销售能力',
      whyNotAlternates: '禁止诊断SELLING——学习缺陷无法通过学习销售来解决',
      falsePositiveRisk: '最大的旧RC8误诊：用"你该学销售"掩盖了反馈机制的缺陷',
    },
    evidenceExpectation: {
      requiredSignals: ['MINIMUM_STEP_EXECUTION', 'POST_ACTION_REVIEW_HABIT', 'DECISION_TO_ACTION_LATENCY'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'ADVERSARIAL',
      validationRole: 'LEGACY_FAILURE',
      validationGroup: 'GROUP_LEGACY_FAILURE',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-LEG-003',
    title: '有技能→不是BUILD_PRODUCT',
    inputProfile: {
      signals: [ sig('OUTPUT_DECOUPLING_AWARENESS', A, 75), sig('EFFORT_VS_MECHANISM_FRAMING', A, 70), sig('DIRECTION_SWITCHING_FREQUENCY', I, 50) ],
      occupation: '程序员 / 有可付费技能',
    },
    expected: { family: RCG, blindSpot: LMG, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '技术好≠需要变现建议',
      mechanism: '旧系统看到程序员的付费技能会建议做产品——但这忽略了根本问题：他把技能当作时间来卖而不是构建可复用的资产',
      whyPrimary: '认知模式的杠杆缺失才是核心——不是缺少产品化建议',
      whyNotAlternates: '禁止"你应该做产品"的诊断——杠杆缺失的人做产品也一样线性',
      falsePositiveRisk: '最大的旧RC8误诊：让缺少杠杆意识的人做产品 = 换了一个地方继续线性交付',
    },
    evidenceExpectation: {
      requiredSignals: ['OUTPUT_DECOUPLING_AWARENESS', 'EFFORT_VS_MECHANISM_FRAMING'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'ADVERSARIAL',
      validationRole: 'LEGACY_FAILURE',
      validationGroup: 'GROUP_LEGACY_FAILURE',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-LEG-004',
    title: '缺少流量→不是TRAFFIC是OB',
    inputProfile: {
      signals: [ sig('INFORMATION_SOURCE_DIVERSITY', A, 80), sig('SERENDIPITOUS_PATH_DISCOVERY', A, 75), sig('NON_DOMAIN_PATH_AWARENESS', A, 70), sig('IDENTITY_BASED_EXCLUSION', I, 50) ],
      occupation: '自由职业者 / 缺少客户',
    },
    expected: { family: PRG, blindSpot: OB, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '症状≠根因',
      mechanism: '她的"流量"问题是因为信息接触面窄——不是不知道如何获取流量，而是她接触的圈子完全不产生流量。OB诊断的核心是感知范围，不是流量运营',
      whyPrimary: '信息感知范围的认知缺陷——不是TRAFFIC运营的缺失',
      whyNotAlternates: '禁止诊断TRAFFIC——窄的信息接触面无法通过"获取更多流量"来解决，需要的是信息生态的改变',
      falsePositiveRisk: '把生态问题当运营问题',
    },
    evidenceExpectation: {
      requiredSignals: ['INFORMATION_SOURCE_DIVERSITY', 'SERENDIPITOUS_PATH_DISCOVERY', 'NON_DOMAIN_PATH_AWARENESS'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: false,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'ADVERSARIAL',
      validationRole: 'LEGACY_FAILURE',
      validationGroup: 'GROUP_LEGACY_FAILURE',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-LEG-005',
    title: '单一收入→不是SINGLE_INCOME',
    inputProfile: {
      signals: [ sig('WAITING_DURATION_PATTERN', A, 75), sig('MINIMUM_STEP_EXECUTION', I, 50), sig('POST_ACTION_REVIEW_HABIT', I, 50) ],
      occupation: '教师 / 拿固定工资',
    },
    expected: { family: EAG, blindSpot: DI, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '不能把"工资单一"自动诊断为问题',
      mechanism: '单一收入不是认知缺陷——是劳动力市场的结构性特征。她的真正问题是认知性的：想发展技能但迟迟不开始实验——存在认知延迟模式与单一收入无关',
      whyPrimary: '认知模式（DI）是核心——不是SINGLE_INCOME',
      whyNotAlternates: '禁止诊断SINGLE_INCOME——这是收入结构的事实描述而非认知诊断',
      falsePositiveRisk: '把社会的收入结构问题误诊为个人的认知问题',
    },
    evidenceExpectation: {
      requiredSignals: ['WAITING_DURATION_PATTERN'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'ADVERSARIAL',
      validationRole: 'LEGACY_FAILURE',
      validationGroup: 'GROUP_LEGACY_FAILURE',
      selfValidationStatus: 'MATCH',
    },
  },
  {
    id: 'G-LEG-006',
    title: '可AI化→不应自动诊断',
    inputProfile: {
      signals: [ sig('OUTPUT_DECOUPLING_AWARENESS', A, 65), sig('EFFORT_VS_MECHANISM_FRAMING', A, 60), sig('DIRECTION_SWITCHING_FREQUENCY', I, 50) ],
      occupation: '设计师 / 被AI替代风险',
    },
    expected: { family: RCG, blindSpot: LMG, inferenceState: CLEAR, ambiguityAllowed: false, alternateAllowed: true },
    rationale: {
      worldPrinciple: '技术替代风险≠认知缺陷',
      mechanism: '她被AI替代的风险来自于工作结构而非认知缺陷。但LMG的认知模式帮她看到：她的价值交付和"自己画"高度耦合——这才是真正的杠杆缺失',
      whyPrimary: '杠杆缺失（LMG）是核心——AI风险是触媒不是根因',
      whyNotAlternates: '不是"你该学AI"——她的杠杆缺失在使用任何工具时都会存在',
      falsePositiveRisk: '最大的风险：把AI焦虑当作AI可以解决的问题——杠杆模型缺失才是根本',
    },
    evidenceExpectation: {
      requiredSignals: ['OUTPUT_DECOUPLING_AWARENESS', 'EFFORT_VS_MECHANISM_FRAMING'],
      contradictingSignals: [],
      disqualifyingSignals: [],
      missingEvidenceAllowed: true,
    },
    constitutionChecks: { occupationShouldNotDetermine: true, incomeShouldNotDetermine: true, businessDirectionForbidden: true, fortuneTellingForbidden: true, deterministicPredictionForbidden: true },
    goldenMeta: {
      confidence: 'HIGH',
      reviewStatus: 'REVIEWED',
      labelSource: 'ADVERSARIAL',
      validationRole: 'LEGACY_FAILURE',
      validationGroup: 'GROUP_LEGACY_FAILURE',
      selfValidationStatus: 'MATCH',
    },
  },

]

// ═══════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════

function validateDataset(cases) {
  var ids = new Set()
  var errors = []
  var families = new Set()
  var blindSpots = new Set()
  var states = new Set()
  var occupations = new Set()

  cases.forEach(function (c) {
    if (ids.has(c.id)) errors.push('Duplicate ID: ' + c.id)
    ids.add(c.id)

    if (!c.title) errors.push(c.id + ': missing title')
    if (!c.expected.family && c.expected.inferenceState !== INSUFF && c.expected.inferenceState !== AMB_FAMILY) errors.push(c.id + ': missing expected family')
    if (!c.expected.blindSpot && c.expected.inferenceState === CLEAR) errors.push(c.id + ': missing expected blindSpot')
    if (!c.rationale.worldPrinciple) errors.push(c.id + ': missing worldPrinciple')
    if (!c.rationale.mechanism) errors.push(c.id + ': missing mechanism')
    if (!c.rationale.whyPrimary) errors.push(c.id + ': missing whyPrimary')
    if (c.rationale.whyNotAlternates === undefined) errors.push(c.id + ': missing whyNotAlternates')

    if (c.expected.family) families.add(c.expected.family)
    if (c.expected.blindSpot) blindSpots.add(c.expected.blindSpot)
    if (c.expected.inferenceState) states.add(c.expected.inferenceState)

    // Constitution checks
    if (!c.constitutionChecks || !c.constitutionChecks.occupationShouldNotDetermine) errors.push(c.id + ': missing constitution')
    if (c.inputProfile.occupation) occupations.add(c.inputProfile.occupation)

    // Golden governance metadata — structural validation only
    if (c.goldenMeta) {
      var VALID_CONF = ['HIGH', 'MEDIUM', 'LOW']
      var VALID_REV = ['REVIEWED', 'NEEDS_REVIEW', 'DISPUTED']
      var VALID_SRC = ['HUMAN_NORMATIVE', 'ADVERSARIAL', 'BOUNDARY', 'ENGINE_CONFIRMED']
      var VALID_ROLE = ['STANDARD', 'CROSS_OCCUPATION', 'SAME_OCCUPATION', 'EXTERNAL_CONSTRAINT', 'LEGACY_FAILURE', 'BOUNDARY']
      var VALID_SVS = ['MATCH', 'EXPECTED_MISMATCH', 'UNRESOLVED_MISMATCH', 'NOT_APPLICABLE']
      if (!VALID_CONF.includes(c.goldenMeta.confidence)) errors.push(c.id + ': invalid goldenMeta.confidence')
      if (!VALID_REV.includes(c.goldenMeta.reviewStatus)) errors.push(c.id + ': invalid goldenMeta.reviewStatus')
      if (!VALID_SRC.includes(c.goldenMeta.labelSource)) errors.push(c.id + ': invalid goldenMeta.labelSource')
      if (!VALID_ROLE.includes(c.goldenMeta.validationRole)) errors.push(c.id + ': invalid goldenMeta.validationRole')
      if (!VALID_SVS.includes(c.goldenMeta.selfValidationStatus)) errors.push(c.id + ': invalid goldenMeta.selfValidationStatus')
      if ((c.goldenMeta.validationRole === 'CROSS_OCCUPATION' || c.goldenMeta.validationRole === 'SAME_OCCUPATION' || c.goldenMeta.validationRole === 'EXTERNAL_CONSTRAINT' || c.goldenMeta.validationRole === 'LEGACY_FAILURE') && !c.goldenMeta.validationGroup) {
        errors.push(c.id + ': ' + c.goldenMeta.validationRole + ' must have validationGroup')
      }
    } else {
      errors.push(c.id + ': missing goldenMeta')
    }
  })

  return { valid: errors.length === 0, errors: errors, families: families, blindSpots: blindSpots, states: states, occupations: occupations, total: cases.length }
}

/**
 * Golden governance structural validation — core rule checks only.
 * Does NOT run the inference engine. Does NOT check label agreement.
 */
function validateGoldenGovernance(cases) {
  var result = validateDataset(cases)
  var confDist = {HIGH:0, MEDIUM:0, LOW:0}
  var revDist = {REVIEWED:0, NEEDS_REVIEW:0, DISPUTED:0}
  var srcDist = {}
  var roleDist = {}
  var svsDist = {MATCH:0, EXPECTED_MISMATCH:0, UNRESOLVED_MISMATCH:0, NOT_APPLICABLE:0}
  var crossOccGroups = new Set()
  var sameOccGroups = new Set()

  cases.forEach(function(c){
    var m = c.goldenMeta
    if(!m) return
    confDist[m.confidence]++
    revDist[m.reviewStatus]++
    srcDist[m.labelSource] = (srcDist[m.labelSource]||0) + 1
    roleDist[m.validationRole] = (roleDist[m.validationRole]||0) + 1
    svsDist[m.selfValidationStatus]++
    if(m.validationRole === 'CROSS_OCCUPATION' && m.validationGroup) crossOccGroups.add(m.validationGroup)
    if(m.validationRole === 'SAME_OCCUPATION' && m.validationGroup) sameOccGroups.add(m.validationGroup)
  })

  result.confidenceDist = confDist
  result.reviewDist = revDist
  result.labelSourceDist = srcDist
  result.validationRoleDist = roleDist
  result.selfValidationDist = svsDist
  result.crossOccGroups = {count: crossOccGroups.size, ids: Array.from(crossOccGroups)}
  result.sameOccGroups = {count: sameOccGroups.size, ids: Array.from(sameOccGroups)}

  return result
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  GOLDEN_CASES,
  validateDataset,
  validateGoldenGovernance,
  sig, A, S, I,
  CLEAR, AMB_FAMILY, AMB_BLIND, INSUFF,
  EAG, RCG, PRG, FRG,
  DI, FLG, LMG, THT, OB, RMD, PM, IC, STG,
}
