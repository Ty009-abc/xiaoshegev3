/**
 * tests/rc8.3-world-model-golden.test.js
 *
 * RC8.3 Golden Dataset — 40+ test cases for World Model Engine.
 *
 * Test dimensions:
 * - Cross-occupation consistency
 * - Same-occupation differentiation
 * - Evidence traceability
 * - Blind spot uniqueness
 * - Determinism
 * - No prohibited expressions
 *
 * @version world_model_v1
 */

var { runWorldModelPipeline } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/worldModelPipeline')
var { scanForProhibitedExpressions } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/validators')
var { adaptWorldModelToLegacyDiagnosis } = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/legacyDiagnosisAdapter')

// ═══════════════════════════════════════════════════════════════
// Golden Cases
// ═══════════════════════════════════════════════════════════════

var GOLDEN_CASES = [

  // ── Cluster 1: Validated skills, experimentation, feedback ──
  {
    id: 'C01_CHEF_VALIDATED',
    answers: {
      lifeStage: '31-40岁', incomeStructure: '技能服务（按次/项目收费）',
      occupationDetail: '厨师', monthlySurplus: '1000-5000元',
      safetyMonths: '3-6个月', debtPressure: '无负债',
      skillValidation: '偶尔有付费需求', monetizableSkill: '技术类（编程/设计/工程）',
      weeklyTime: '5-10小时', executionStability: '比较稳定',
      pastAttemptStage: 'TRIED_MULTIPLE', decisionStyle: 'DATA_DRIVEN',
      primaryGoal: '增加收入', maxTrialCost: '500-1000元',
      failureResponse: 'ANALYZE_RETRY',
    },
  },
  {
    id: 'C02_PROGRAMMER_VALIDATED',
    answers: {
      lifeStage: '25-30岁', incomeStructure: '工资/固定薪资',
      occupationDetail: '程序员', monthlySurplus: '5000-10000元',
      safetyMonths: '6-12个月', debtPressure: '房贷为主（低月供）',
      skillValidation: '偶尔有付费需求', monetizableSkill: '技术类（编程/设计/工程）',
      weeklyTime: '10-20小时', executionStability: '非常稳定/长期坚持',
      pastAttemptStage: 'TRIED_MULTIPLE', decisionStyle: 'DATA_DRIVEN',
      primaryGoal: '增加收入', maxTrialCost: '1000-5000元',
      failureResponse: 'ANALYZE_RETRY',
    },
  },
  {
    id: 'C03_TEACHER_VALIDATED',
    answers: {
      lifeStage: '41-50岁', incomeStructure: '工资/固定薪资',
      occupationDetail: '教师', monthlySurplus: '1000-5000元',
      safetyMonths: '12-24个月', debtPressure: '无负债',
      skillValidation: '偶尔有付费需求', monetizableSkill: '运营/管理/统筹',
      weeklyTime: '5-10小时', executionStability: '比较稳定',
      pastAttemptStage: 'TRIED_MULTIPLE', decisionStyle: 'DATA_DRIVEN',
      primaryGoal: '增加收入', maxTrialCost: '500-1000元',
      failureResponse: 'ANALYZE_RETRY',
    },
  },

  // ── Cluster 2: No validation, planning only ──
  {
    id: 'C04_PROGRAMMER_PLANNING',
    answers: {
      lifeStage: '25-30岁', incomeStructure: '工资/固定薪资',
      occupationDetail: '程序员', monthlySurplus: '5000-10000元',
      safetyMonths: '6-12个月', debtPressure: '无负债',
      skillValidation: '从未变现过', monetizableSkill: '技术类（编程/设计/工程）',
      weeklyTime: '5-10小时', executionStability: '偶尔能坚持',
      pastAttemptStage: 'PLANNING', decisionStyle: 'SAFETY_FIRST',
      primaryGoal: '增加收入', maxTrialCost: '100元以下',
      failureResponse: 'WAIT_BETTER',
    },
  },
  {
    id: 'C05_DESIGNER_PLANNING',
    answers: {
      lifeStage: '25-30岁', incomeStructure: '工资/固定薪资',
      occupationDetail: '设计师', monthlySurplus: '1000-5000元',
      safetyMonths: '3-6个月', debtPressure: '消费贷/信用卡压力较大',
      skillValidation: '免费帮人做过', monetizableSkill: '技术类（编程/设计/工程）',
      weeklyTime: '1-5小时', executionStability: '难以坚持/经常中断',
      pastAttemptStage: 'PLANNING', decisionStyle: 'OPTION_KEEPING',
      primaryGoal: '学习技能', maxTrialCost: '100元以下',
      failureResponse: 'GIVE_UP',
    },
  },

  // ── Cluster 3: Strong income, high security ──
  {
    id: 'C06_ENGINEER_SECURE',
    answers: {
      lifeStage: '31-40岁', incomeStructure: '工资/固定薪资',
      occupationDetail: '工程师', monthlySurplus: '10000元以上',
      safetyMonths: '24个月以上', debtPressure: '房贷为主（低月供）',
      skillValidation: '有稳定客户/收入', monetizableSkill: '技术类（编程/设计/工程）',
      weeklyTime: '5-10小时', executionStability: '非常稳定/长期坚持',
      pastAttemptStage: 'ONGOING', decisionStyle: 'DATA_DRIVEN',
      primaryGoal: '资产增值', maxTrialCost: '10000元以上',
      failureResponse: 'ANALYZE_RETRY',
    },
  },
  {
    id: 'C07_MANAGER_SECURE',
    answers: {
      lifeStage: '41-50岁', incomeStructure: '工资/固定薪资',
      occupationDetail: '管理者', monthlySurplus: '10000元以上',
      safetyMonths: '24个月以上', debtPressure: '房贷为主（低月供）',
      skillValidation: '有稳定客户/收入', monetizableSkill: '运营/管理/统筹',
      weeklyTime: '1-5小时', executionStability: '非常稳定/长期坚持',
      pastAttemptStage: 'TRIED_ONCE', decisionStyle: 'OPTION_KEEPING',
      primaryGoal: '保持现状', maxTrialCost: '1000-5000元',
      failureResponse: 'TRY_OTHER',
    },
  },

  // ── Cluster 4: Unstable income, high risk ──
  {
    id: 'C08_FREELANCER_UNSTABLE',
    answers: {
      lifeStage: '31-40岁', incomeStructure: '收入不稳定',
      occupationDetail: '自由职业', monthlySurplus: '基本为零',
      safetyMonths: '不到1个月', debtPressure: '消费贷/信用卡压力较大',
      skillValidation: '赚到过一次钱', monetizableSkill: '技术类（编程/设计/工程）',
      weeklyTime: '20小时以上', executionStability: '偶尔能坚持',
      pastAttemptStage: 'TRIED_MULTIPLE', decisionStyle: 'QUICK_DECISIVE',
      primaryGoal: '建立稳定收入', maxTrialCost: '500-1000元',
      failureResponse: 'TRY_OTHER',
    },
  },
  {
    id: 'C09_SALES_STABLE',
    answers: {
      lifeStage: '31-40岁', incomeStructure: '销售/佣金/提成',
      occupationDetail: '销售', monthlySurplus: '5000-10000元',
      safetyMonths: '3-6个月', debtPressure: '无负债',
      skillValidation: '偶尔有付费需求', monetizableSkill: '销售/商务谈单',
      weeklyTime: '10-20小时', executionStability: '比较稳定',
      pastAttemptStage: 'ONGOING', decisionStyle: 'QUICK_DECISIVE',
      primaryGoal: '扩展业务', maxTrialCost: '1000-5000元',
      failureResponse: 'ANALYZE_RETRY',
    },
  },

  // ── Cluster 5: Content/online — distribution leverage ──
  {
    id: 'C10_CONTENT_CREATOR',
    answers: {
      lifeStage: '25-30岁', incomeStructure: '线上内容/流量变现',
      occupationDetail: '内容创作者', monthlySurplus: '1000-5000元',
      safetyMonths: '3-6个月', debtPressure: '无负债',
      skillValidation: '偶尔有付费需求', monetizableSkill: '技术类（编程/设计/工程）',
      weeklyTime: '20小时以上', executionStability: '比较稳定',
      pastAttemptStage: 'ONGOING', decisionStyle: 'QUICK_DECISIVE',
      primaryGoal: '扩展影响力', maxTrialCost: '500-1000元',
      failureResponse: 'ANALYZE_RETRY',
    },
  },
  {
    id: 'C11_BLOGGER_EARLY',
    answers: {
      lifeStage: '18-24岁', incomeStructure: '线上内容/流量变现',
      occupationDetail: '博主', monthlySurplus: '基本为零',
      safetyMonths: '1-3个月', debtPressure: '无负债',
      skillValidation: '免费被感谢过', monetizableSkill: '技术类（编程/设计/工程）',
      weeklyTime: '20小时以上', executionStability: '偶尔能坚持',
      pastAttemptStage: 'TRIED_ONCE', decisionStyle: 'GUT_FEEL',
      primaryGoal: '扩大粉丝', maxTrialCost: '100-500元',
      failureResponse: 'TRY_OTHER',
    },
  },

  // ── Cluster 6: Low confidence, missing answers ──
  {
    id: 'C12_LOW_INFORMATION',
    answers: {
      lifeStage: '25-30岁', incomeStructure: '工资/固定薪资',
      occupationDetail: '', monthlySurplus: '',
      safetyMonths: '', debtPressure: '无负债',
      skillValidation: '从未变现过', monetizableSkill: '',
      weeklyTime: '1-5小时', executionStability: '难以坚持/经常中断',
      pastAttemptStage: 'NEVER_TRIED', decisionStyle: 'GUT_FEEL',
      primaryGoal: '', maxTrialCost: '不愿投入',
      failureResponse: 'BLAME_EXTERNAL',
    },
  },
  {
    id: 'C13_MINIMAL_INFO',
    answers: {
      lifeStage: '18-24岁', incomeStructure: '工资/固定薪资',
      occupationDetail: '学生', monthlySurplus: '基本为零',
      safetyMonths: '1-3个月', debtPressure: '无负债',
      skillValidation: '从未变现过', monetizableSkill: '',
      weeklyTime: '5-10小时', executionStability: '偶尔能坚持',
      pastAttemptStage: 'NEVER_TRIED', decisionStyle: 'OPTION_KEEPING',
      primaryGoal: '学习技能', maxTrialCost: '100元以下',
      failureResponse: 'WAIT_BETTER',
    },
  },

  // ── Cluster 7: Extreme risk — high debt ──
  {
    id: 'C14_HIGH_DEBT',
    answers: {
      lifeStage: '31-40岁', incomeStructure: '工资/固定薪资',
      occupationDetail: '工人', monthlySurplus: '负数（入不敷出）',
      safetyMonths: '不到1个月', debtPressure: '债务压力高/以贷养贷',
      skillValidation: '从未变现过', monetizableSkill: '技术类（编程/设计/工程）',
      weeklyTime: '几乎没时间', executionStability: '难以坚持/经常中断',
      pastAttemptStage: 'NEVER_TRIED', decisionStyle: 'SAFETY_FIRST',
      primaryGoal: '还清债务', maxTrialCost: '不愿投入',
      failureResponse: 'BLAME_EXTERNAL',
    },
  },

  // ── Cluster 8: Business owners ──
  {
    id: 'C15_BUSINESS_OWNER',
    answers: {
      lifeStage: '41-50岁', incomeStructure: '实体生意/经营收入',
      occupationDetail: '店主', monthlySurplus: '5000-10000元',
      safetyMonths: '6-12个月', debtPressure: '房贷为主（低月供）',
      skillValidation: '有稳定客户/收入', monetizableSkill: '运营/管理/统筹',
      weeklyTime: '20小时以上', executionStability: '非常稳定/长期坚持',
      pastAttemptStage: 'ONGOING', decisionStyle: 'QUICK_DECISIVE',
      primaryGoal: '扩大生意', maxTrialCost: '10000元以上',
      failureResponse: 'ANALYZE_RETRY',
    },
  },
  {
    id: 'C16_RESTAURANT_OWNER',
    answers: {
      lifeStage: '41-50岁', incomeStructure: '实体生意/经营收入',
      occupationDetail: '餐饮老板', monthlySurplus: '1000-5000元',
      safetyMonths: '1-3个月', debtPressure: '消费贷/信用卡压力较大',
      skillValidation: '偶尔有付费需求', monetizableSkill: '运营/管理/统筹',
      weeklyTime: '20小时以上', executionStability: '比较稳定',
      pastAttemptStage: 'TRIED_MULTIPLE', decisionStyle: 'GUT_FEEL',
      primaryGoal: '扭亏为盈', maxTrialCost: '5000-10000元',
      failureResponse: 'TRY_OTHER',
    },
  },

  // ── Cluster 9: Asset income — capital driven ──
  {
    id: 'C17_INVESTOR',
    answers: {
      lifeStage: '50岁以上', incomeStructure: '资产/投资/租金收入',
      occupationDetail: '投资者', monthlySurplus: '10000元以上',
      safetyMonths: '24个月以上', debtPressure: '无负债',
      skillValidation: '有稳定客户/收入', monetizableSkill: '运营/管理/统筹',
      weeklyTime: '20小时以上', executionStability: '非常稳定/长期坚持',
      pastAttemptStage: 'ONGOING', decisionStyle: 'DATA_DRIVEN',
      primaryGoal: '资产增值', maxTrialCost: '10000元以上',
      failureResponse: 'ANALYZE_RETRY',
    },
  },

  // ── Cluster 10: Conflict evidence cases ──
  {
    id: 'C18_CONFLICT_WILLING_BUT_NO_ACTION',
    answers: {
      lifeStage: '25-30岁', incomeStructure: '工资/固定薪资',
      occupationDetail: '程序员', monthlySurplus: '1000-5000元',
      safetyMonths: '6-12个月', debtPressure: '无负债',
      skillValidation: '从未变现过', monetizableSkill: '技术类（编程/设计/工程）',
      weeklyTime: '5-10小时', executionStability: '难以坚持/经常中断',
      pastAttemptStage: 'NEVER_TRIED', decisionStyle: 'QUICK_DECISIVE',  // Says quick decisive but never tried
      primaryGoal: '增加收入', maxTrialCost: '不愿投入',
      failureResponse: 'WAIT_BETTER',
    },
  },
  {
    id: 'C19_CONFLICT_CAUTIOUS_BUT_UNPROTECTED',
    answers: {
      lifeStage: '31-40岁', incomeStructure: '工资/固定薪资',
      occupationDetail: '会计', monthlySurplus: '1000-5000元',
      safetyMonths: '不到1个月', debtPressure: '消费贷/信用卡压力较大',
      skillValidation: '从未变现过', monetizableSkill: '',
      weeklyTime: '1-5小时', executionStability: '偶尔能坚持',
      pastAttemptStage: 'NEVER_TRIED', decisionStyle: 'SAFETY_FIRST',
      primaryGoal: '还清债务', maxTrialCost: '不愿投入',
      failureResponse: 'BLAME_EXTERNAL',
    },
  },

  // ── Cluster 11-20: Diversity cases ──
  {
    id: 'C20_RETAIL_WORKER',
    answers: {
      lifeStage: '25-30岁', incomeStructure: '工资/固定薪资',
      occupationDetail: '店员', monthlySurplus: '1000元以下',
      safetyMonths: '1-3个月', debtPressure: '消费贷/信用卡压力较大',
      skillValidation: '免费帮人做过', monetizableSkill: '销售/商务谈单',
      weeklyTime: '5-10小时', executionStability: '偶尔能坚持',
      pastAttemptStage: 'NEVER_TRIED', decisionStyle: 'GUT_FEEL',
      primaryGoal: '增加收入', maxTrialCost: '100元以下',
      failureResponse: 'WAIT_BETTER',
    },
  },
  {
    id: 'C21_NURSE_STABLE',
    answers: {
      lifeStage: '31-40岁', incomeStructure: '工资/固定薪资',
      occupationDetail: '护士', monthlySurplus: '1000-5000元',
      safetyMonths: '3-6个月', debtPressure: '无负债',
      skillValidation: '免费帮人做过', monetizableSkill: '技术类（编程/设计/工程）',
      weeklyTime: '1-5小时', executionStability: '比较稳定',
      pastAttemptStage: 'TRIED_ONCE', decisionStyle: 'SAFETY_FIRST',
      primaryGoal: '增加收入', maxTrialCost: '100-500元',
      failureResponse: 'WAIT_BETTER',
    },
  },
  {
    id: 'C22_DRIVER_FULLTIME',
    answers: {
      lifeStage: '41-50岁', incomeStructure: '工资/固定薪资',
      occupationDetail: '司机', monthlySurplus: '1000元以下',
      safetyMonths: '1-3个月', debtPressure: '房贷为主（低月供）',
      skillValidation: '从未变现过', monetizableSkill: '',
      weeklyTime: '几乎没时间', executionStability: '比较稳定',
      pastAttemptStage: 'NEVER_TRIED', decisionStyle: 'GUT_FEEL',
      primaryGoal: '增加收入', maxTrialCost: '100元以下',
      failureResponse: 'WAIT_BETTER',
    },
  },
  {
    id: 'C23_ARTIST_EMERGING',
    answers: {
      lifeStage: '18-24岁', incomeStructure: '收入不稳定',
      occupationDetail: '艺术家', monthlySurplus: '基本为零',
      safetyMonths: '1-3个月', debtPressure: '无负债',
      skillValidation: '赚到过一次钱', monetizableSkill: '技术类（编程/设计/工程）',
      weeklyTime: '20小时以上', executionStability: '偶尔能坚持',
      pastAttemptStage: 'TRIED_MULTIPLE', decisionStyle: 'GUT_FEEL',
      primaryGoal: '建立稳定收入', maxTrialCost: '100-500元',
      failureResponse: 'TRY_OTHER',
    },
  },
  {
    id: 'C24_WRITER_ASPIRING',
    answers: {
      lifeStage: '31-40岁', incomeStructure: '工资/固定薪资',
      occupationDetail: '文员', monthlySurplus: '1000-5000元',
      safetyMonths: '6-12个月', debtPressure: '无负债',
      skillValidation: '免费被感谢过', monetizableSkill: '技术类（编程/设计/工程）',
      weeklyTime: '5-10小时', executionStability: '偶尔能坚持',
      pastAttemptStage: 'PLANNING', decisionStyle: 'OPTION_KEEPING',
      primaryGoal: '创作作品', maxTrialCost: '100-500元',
      failureResponse: 'WAIT_BETTER',
    },
  },
  {
    id: 'C25_MARKETER_MID_CAREER',
    answers: {
      lifeStage: '31-40岁', incomeStructure: '工资/固定薪资',
      occupationDetail: '市场经理', monthlySurplus: '5000-10000元',
      safetyMonths: '12-24个月', debtPressure: '房贷为主（低月供）',
      skillValidation: '偶尔有付费需求', monetizableSkill: '运营/管理/统筹',
      weeklyTime: '5-10小时', executionStability: '比较稳定',
      pastAttemptStage: 'TRIED_MULTIPLE', decisionStyle: 'DATA_DRIVEN',
      primaryGoal: '职业晋升', maxTrialCost: '1000-5000元',
      failureResponse: 'ANALYZE_RETRY',
    },
  },
  {
    id: 'C26_FARMER_TRANSITIONING',
    answers: {
      lifeStage: '50岁以上', incomeStructure: '收入不稳定',
      occupationDetail: '农民', monthlySurplus: '1000元以下',
      safetyMonths: '1-3个月', debtPressure: '无负债',
      skillValidation: '从未变现过', monetizableSkill: '',
      weeklyTime: '20小时以上', executionStability: '比较稳定',
      pastAttemptStage: 'NEVER_TRIED', decisionStyle: 'GUT_FEEL',
      primaryGoal: '增加收入', maxTrialCost: '100元以下',
      failureResponse: 'GIVE_UP',
    },
  },
  {
    id: 'C27_HR_PROFESSIONAL',
    answers: {
      lifeStage: '31-40岁', incomeStructure: '工资/固定薪资',
      occupationDetail: 'HR', monthlySurplus: '1000-5000元',
      safetyMonths: '6-12个月', debtPressure: '无负债',
      skillValidation: '免费帮人做过', monetizableSkill: '运营/管理/统筹',
      weeklyTime: '5-10小时', executionStability: '比较稳定',
      pastAttemptStage: 'TRIED_ONCE', decisionStyle: 'SAFETY_FIRST',
      primaryGoal: '职业晋升', maxTrialCost: '500-1000元',
      failureResponse: 'WAIT_BETTER',
    },
  },
  {
    id: 'C28_CONSULTANT_SOLO',
    answers: {
      lifeStage: '41-50岁', incomeStructure: '技能服务（按次/项目收费）',
      occupationDetail: '顾问', monthlySurplus: '10000元以上',
      safetyMonths: '12-24个月', debtPressure: '无负债',
      skillValidation: '有稳定客户/收入', monetizableSkill: '技术类（编程/设计/工程）',
      weeklyTime: '10-20小时', executionStability: '非常稳定/长期坚持',
      pastAttemptStage: 'ONGOING', decisionStyle: 'DATA_DRIVEN',
      primaryGoal: '扩展业务', maxTrialCost: '1000-5000元',
      failureResponse: 'ANALYZE_RETRY',
    },
  },
  {
    id: 'C29_STUDENT_AMBITIOUS',
    answers: {
      lifeStage: '18-24岁', incomeStructure: '工资/固定薪资',
      occupationDetail: '学生', monthlySurplus: '1000元以下',
      safetyMonths: '1-3个月', debtPressure: '无负债',
      skillValidation: '免费帮人做过', monetizableSkill: '技术类（编程/设计/工程）',
      weeklyTime: '20小时以上', executionStability: '比较稳定',
      pastAttemptStage: 'TRIED_ONCE', decisionStyle: 'QUICK_DECISIVE',
      primaryGoal: '学习技能', maxTrialCost: '100-500元',
      failureResponse: 'TRY_OTHER',
    },
  },
  {
    id: 'C30_RETIRED_ACTIVE',
    answers: {
      lifeStage: '50岁以上', incomeStructure: '资产/投资/租金收入',
      occupationDetail: '退休', monthlySurplus: '5000-10000元',
      safetyMonths: '24个月以上', debtPressure: '无负债',
      skillValidation: '有稳定客户/收入', monetizableSkill: '技术类（编程/设计/工程）',
      weeklyTime: '20小时以上', executionStability: '非常稳定/长期坚持',
      pastAttemptStage: 'ONGOING', decisionStyle: 'OPTION_KEEPING',
      primaryGoal: '学习新技能', maxTrialCost: '1000-5000元',
      failureResponse: 'ANALYZE_RETRY',
    },
  },

  // ══ NEW GOLDEN CASES (10+) — Phase 1B Acceptance Gap Close ══

  // ── Cluster 11: Information scarcity edge cases ──
  {
    id: 'C31_EXTREME_MINIMAL_INFO',
    purpose: '信息不足 (all empty/missing fields, barely enough to pass validation)',
    answers: {
      lifeStage: '', incomeStructure: '',
      occupationDetail: '', monthlySurplus: '',
      safetyMonths: '', debtPressure: '',
      skillValidation: '', monetizableSkill: '',
      weeklyTime: '', executionStability: '',
      pastAttemptStage: 'NEVER_TRIED', decisionStyle: '',
      primaryGoal: '', maxTrialCost: '',
      failureResponse: '',
    },
  },
  {
    id: 'C32_ONLY_GOAL_PROVIDED',
    purpose: '信息不足 (only primaryGoal + lifeStage, rest empty)',
    answers: {
      lifeStage: '41-50岁', incomeStructure: '',
      occupationDetail: '', monthlySurplus: '',
      safetyMonths: '', debtPressure: '无负债',
      skillValidation: '', monetizableSkill: '',
      weeklyTime: '', executionStability: '',
      pastAttemptStage: 'NEVER_TRIED', decisionStyle: 'SAFETY_FIRST',
      primaryGoal: '还清债务', maxTrialCost: '',
      failureResponse: '',
    },
  },

  // ── Cluster 12: Strong conflict evidence ──
  {
    id: 'C33_AGGRESSIVE_GOAL_ZERO_ACTION',
    purpose: '强冲突证据 (goal=增加收入×10万but never tried + no time + no money + wait_better)',
    answers: {
      lifeStage: '25-30岁', incomeStructure: '工资/固定薪资',
      occupationDetail: '文员', monthlySurplus: '1000元以下',
      safetyMonths: '1-3个月', debtPressure: '消费贷/信用卡压力较大',
      skillValidation: '从未变现过', monetizableSkill: '',
      weeklyTime: '几乎没时间', executionStability: '难以坚持/经常中断',
      pastAttemptStage: 'NEVER_TRIED', decisionStyle: 'SAFETY_FIRST',
      primaryGoal: '增加收入', maxTrialCost: '不愿投入',
      failureResponse: 'WAIT_BETTER',
    },
  },
  {
    id: 'C34_STRONG_EXECUTION_WEAK_VALIDATION',
    purpose: '强冲突证据 (strong execution stability + long time but zero market validation)',
    answers: {
      lifeStage: '25-30岁', incomeStructure: '工资/固定薪资',
      occupationDetail: '程序员', monthlySurplus: '1000-5000元',
      safetyMonths: '3-6个月', debtPressure: '无负债',
      skillValidation: '从未变现过', monetizableSkill: '技术类（编程/设计/工程）',
      weeklyTime: '20小时以上', executionStability: '非常稳定/长期坚持',
      pastAttemptStage: 'NEVER_TRIED', decisionStyle: 'OPTION_KEEPING',
      primaryGoal: '学习技能', maxTrialCost: '100-500元',
      failureResponse: 'GIVE_UP',
    },
  },

  // ── Cluster 13: High risk + high feedback ──
  {
    id: 'C35_HIGH_RISK_HIGH_FEEDBACK',
    purpose: '高风险+高反馈 (unstable income, high surplus, multiple attempts, quick decisive, analyze_retry)',
    answers: {
      lifeStage: '31-40岁', incomeStructure: '收入不稳定',
      occupationDetail: '创业者', monthlySurplus: '5000-10000元',
      safetyMonths: '3-6个月', debtPressure: '无负债',
      skillValidation: '偶尔有付费需求', monetizableSkill: '运营/管理/统筹',
      weeklyTime: '20小时以上', executionStability: '比较稳定',
      pastAttemptStage: 'TRIED_MULTIPLE', decisionStyle: 'QUICK_DECISIVE',
      primaryGoal: '增加收入', maxTrialCost: '5000-10000元',
      failureResponse: 'ANALYZE_RETRY',
    },
  },

  // ── Cluster 14: High execution + low probability thinking ──
  {
    id: 'C36_HIGH_EXEC_LOW_PROBABILITY',
    purpose: '高执行+低概率思维 (very stable, time-rich, validated skills but gut_feel + low-cost experiments)',
    answers: {
      lifeStage: '25-30岁', incomeStructure: '工资/固定薪资',
      occupationDetail: '小店老板', monthlySurplus: '1000-5000元',
      safetyMonths: '6-12个月', debtPressure: '无负债',
      skillValidation: '偶尔有付费需求', monetizableSkill: '技术类（编程/设计/工程）',
      weeklyTime: '10-20小时', executionStability: '非常稳定/长期坚持',
      pastAttemptStage: 'TRIED_MULTIPLE', decisionStyle: 'GUT_FEEL',
      primaryGoal: '增加收入', maxTrialCost: '100-500元',
      failureResponse: 'ANALYZE_RETRY',
    },
  },

  // ── Cluster 15: Same occupation, different risk models ──
  {
    id: 'C37A_PROGRAMMER_CAUTIOUS',
    purpose: '同职业不同风险模型-A (programmer with safety_first + low maxTrialCost + never tried)',
    answers: {
      lifeStage: '31-40岁', incomeStructure: '工资/固定薪资',
      occupationDetail: '程序员', monthlySurplus: '5000-10000元',
      safetyMonths: '12-24个月', debtPressure: '无负债',
      skillValidation: '从未变现过', monetizableSkill: '技术类（编程/设计/工程）',
      weeklyTime: '5-10小时', executionStability: '比较稳定',
      pastAttemptStage: 'NEVER_TRIED', decisionStyle: 'SAFETY_FIRST',
      primaryGoal: '增加收入', maxTrialCost: '100元以下',
      failureResponse: 'WAIT_BETTER',
    },
  },
  {
    id: 'C37B_PROGRAMMER_RISK_SEEKING',
    purpose: '同职业不同风险模型-B (programmer with quick_decisive + high maxTrialCost + tried_multiple)',
    answers: {
      lifeStage: '31-40岁', incomeStructure: '工资/固定薪资',
      occupationDetail: '程序员', monthlySurplus: '5000-10000元',
      safetyMonths: '3-6个月', debtPressure: '无负债',
      skillValidation: '偶尔有付费需求', monetizableSkill: '技术类（编程/设计/工程）',
      weeklyTime: '10-20小时', executionStability: '比较稳定',
      pastAttemptStage: 'TRIED_MULTIPLE', decisionStyle: 'QUICK_DECISIVE',
      primaryGoal: '增加收入', maxTrialCost: '5000-10000元',
      failureResponse: 'ANALYZE_RETRY',
    },
  },

  // ── Cluster 16: Cross-occupation same world model ──
  {
    id: 'C38A_CROSS_OCCUPATION_A',
    purpose: '跨职业相同世界模型-A (any occupation with identical cognitive profile)',
    answers: {
      lifeStage: '31-40岁', incomeStructure: '技能服务（按次/项目收费）',
      occupationDetail: '摄影师', monthlySurplus: '1000-5000元',
      safetyMonths: '3-6个月', debtPressure: '无负债',
      skillValidation: '偶尔有付费需求', monetizableSkill: '销售/商务谈单',
      weeklyTime: '10-20小时', executionStability: '比较稳定',
      pastAttemptStage: 'ONGOING', decisionStyle: 'DATA_DRIVEN',
      primaryGoal: '扩展业务', maxTrialCost: '1000-5000元',
      failureResponse: 'ANALYZE_RETRY',
    },
  },
  {
    id: 'C38B_CROSS_OCCUPATION_B',
    purpose: '跨职业相同世界模型-B (different occupation, same cognitive profile as C38A)',
    answers: {
      lifeStage: '31-40岁', incomeStructure: '技能服务（按次/项目收费）',
      occupationDetail: '翻译', monthlySurplus: '1000-5000元',
      safetyMonths: '3-6个月', debtPressure: '无负债',
      skillValidation: '偶尔有付费需求', monetizableSkill: '销售/商务谈单',
      weeklyTime: '10-20小时', executionStability: '比较稳定',
      pastAttemptStage: 'ONGOING', decisionStyle: 'DATA_DRIVEN',
      primaryGoal: '扩展业务', maxTrialCost: '1000-5000元',
      failureResponse: 'ANALYZE_RETRY',
    },
  },

  // ── Cluster 17: primaryGoal conflicts with actual behavior ──
  {
    id: 'C39_GOAL_BEHAVIOR_CONFLICT',
    purpose: 'primaryGoal与真实行为冲突 (goal=增加收入 but never tried + no time + unwilling to invest)',
    answers: {
      lifeStage: '25-30岁', incomeStructure: '工资/固定薪资',
      occupationDetail: '行政', monthlySurplus: '1000元以下',
      safetyMonths: '1-3个月', debtPressure: '消费贷/信用卡压力较大',
      skillValidation: '免费帮人做过', monetizableSkill: '',
      weeklyTime: '几乎没时间', executionStability: '难以坚持/经常中断',
      pastAttemptStage: 'NEVER_TRIED', decisionStyle: 'OPTION_KEEPING',
      primaryGoal: '增加收入', maxTrialCost: '不愿投入',
      failureResponse: 'BLAME_EXTERNAL',
    },
  },

  // ── Cluster 18: Counter-evidence suppresses blind spot ──
  {
    id: 'C40_COUNTER_EVIDENCE_SUPPRESSION',
    purpose: '反证压制Blind Spot (multiple attempts + analyze_retry + total time investment = strong feedback → suppresses FEEDBACK_LOOP_GAP)',
    answers: {
      lifeStage: '25-30岁', incomeStructure: '工资/固定薪资',
      occupationDetail: '产品经理', monthlySurplus: '1000-5000元',
      safetyMonths: '6-12个月', debtPressure: '无负债',
      skillValidation: '偶尔有付费需求', monetizableSkill: '运营/管理/统筹',
      weeklyTime: '10-20小时', executionStability: '比较稳定',
      pastAttemptStage: 'TRIED_MULTIPLE', decisionStyle: 'DATA_DRIVEN',
      primaryGoal: '职业晋升', maxTrialCost: '1000-5000元',
      failureResponse: 'ANALYZE_RETRY',
    },
  },

  // ── Cluster 19: top1/top2 ambiguity trigger ──
  {
    id: 'C41_AMBIGUITY_TOP2_CLOSE',
    purpose: 'top1/top2接近触发ambiguity (balanced profile creating near-equal blind spot candidates)',
    answers: {
      lifeStage: '31-40岁', incomeStructure: '工资/固定薪资',
      occupationDetail: '公务员', monthlySurplus: '1000-5000元',
      safetyMonths: '12-24个月', debtPressure: '房贷为主（低月供）',
      skillValidation: '免费帮人做过', monetizableSkill: '运营/管理/统筹',
      weeklyTime: '5-10小时', executionStability: '偶尔能坚持',
      pastAttemptStage: 'TRIED_ONCE', decisionStyle: 'OPTION_KEEPING',
      primaryGoal: '寻找兴趣', maxTrialCost: '100-500元',
      failureResponse: 'WAIT_BETTER',
    },
  },

  // ── Cluster 20: Legacy Adapter boundaries ──
  {
    id: 'C42_LEGACY_ADAPTER_BOUNDARY_NULL',
    purpose: 'Legacy Adapter边界 (null worldModelDiagnosis input should return adapter error)',
    answers: {
      lifeStage: '', incomeStructure: '',
      occupationDetail: '', monthlySurplus: '',
      safetyMonths: '', debtPressure: '',
      skillValidation: '', monetizableSkill: '',
      weeklyTime: '', executionStability: '',
      pastAttemptStage: '', decisionStyle: '',
      primaryGoal: '', maxTrialCost: '',
      failureResponse: '',
    },
  },
  {
    id: 'C43_LEGACY_ADAPTER_FULL_OUTPUT',
    purpose: 'Legacy Adapter边界 (full rich data → adapter must produce complete legacy diagnosis + report)',
    answers: {
      lifeStage: '41-50岁', incomeStructure: '实体生意/经营收入',
      occupationDetail: '服装店主', monthlySurplus: '5000-10000元',
      safetyMonths: '12-24个月', debtPressure: '房贷为主（低月供）',
      skillValidation: '有稳定客户/收入', monetizableSkill: '运营/管理/统筹',
      weeklyTime: '20小时以上', executionStability: '非常稳定/长期坚持',
      pastAttemptStage: 'ONGOING', decisionStyle: 'DATA_DRIVEN',
      primaryGoal: '扩大生意', maxTrialCost: '10000元以上',
      failureResponse: 'ANALYZE_RETRY',
    },
  },
]

// ═══════════════════════════════════════════════════════════════
// Test Runner
// ═══════════════════════════════════════════════════════════════

function runGoldenTests() {
  var results = []
  var passCount = 0
  var failCount = 0

  GOLDEN_CASES.forEach(function(testCase) {
    var pipelineResult = runWorldModelPipeline(testCase.answers, { version: 'world_model_v1' })
    var d = pipelineResult.diagnosis

    // Test: valid (allow for legacy adapter boundary test — C42 may be boundary failure)
    if (!pipelineResult.valid) {
      if (testCase.id === 'C42_LEGACY_ADAPTER_BOUNDARY_NULL') {
        // Expected: extreme empty input may fail validation — that's the boundary test
        // Still verify adapter handles it
        var adapterResult = adaptWorldModelToLegacyDiagnosis(d)
        if (adapterResult.legacyDiagnosisAdapter === null) {
          // Adapter correctly rejects invalid version — this IS the expected behavior
          passCount++
          return
        }
      }
      results.push({ id: testCase.id, test: 'VALID', status: 'FAIL', detail: (pipelineResult.errors || ['unknown']).join('; ') })
      failCount++
      return
    }

    // Test: blind spot unique (candidateScores must have primary)
    if (!d.cognitiveBlindSpot || !d.cognitiveBlindSpot.id) {
      results.push({ id: testCase.id, test: 'BLIND_SPOT_UNIQUE', status: 'FAIL', detail: 'No blind spot detected' })
      failCount++
      return
    }

    // Test: no employee as archetype
    if (d.cognitiveArchetype.primary === 'EMPLOYEE') {
      results.push({ id: testCase.id, test: 'NO_EMPLOYEE_ARCHETYPE', status: 'FAIL', detail: 'EMPLOYEE detected' })
      failCount++
      return
    }

    // Test: no prohibited blind spots
    var PROHIBITED = ['TRAFFIC', 'SELLING', 'PRODUCT', 'PRICING', 'SINGLE_INCOME', 'BUILD_IP']
    if (PROHIBITED.indexOf(d.cognitiveBlindSpot.id) >= 0) {
      results.push({ id: testCase.id, test: 'NO_PROHIBITED_BLIND_SPOT', status: 'FAIL', detail: d.cognitiveBlindSpot.id })
      failCount++
      return
    }

    // Test: no prohibited strategies
    var PROHIBITED_STRAT = ['BUILD_PRODUCT', 'DO_CONTENT', 'DO_SALES', 'DIRECT_SELL']
    if (PROHIBITED_STRAT.indexOf(d.worldStrategy.id) >= 0) {
      results.push({ id: testCase.id, test: 'NO_PROHIBITED_STRATEGY', status: 'FAIL', detail: d.worldStrategy.id })
      failCount++
      return
    }

    // Test: strategy matches blind spot
    var bsDef = require('../cloudfunctions/generateAiReport/lib/engine/worldModel/blindSpotDefinitions').BLIND_SPOT_DEFINITIONS[d.cognitiveBlindSpot.id]
    if (bsDef) {
      var expectedStrategy = getStrategyForBlindSpot(d.cognitiveBlindSpot.id)
      if (d.worldStrategy.id !== expectedStrategy) {
        results.push({ id: testCase.id, test: 'STRATEGY_MATCH', status: 'FAIL', detail: 'Blind spot=' + d.cognitiveBlindSpot.id + ' but strategy=' + d.worldStrategy.id })
        failCount++
        return
      }
    }

    // Test: determinism (run again)
    var r2 = runWorldModelPipeline(testCase.answers, { version: 'world_model_v1' })
    if (r2.diagnosis.inputHash !== d.inputHash) {
      results.push({ id: testCase.id, test: 'DETERMINISM', status: 'FAIL', detail: 'Hash mismatch' })
      failCount++
      return
    }
    if (r2.diagnosis.cognitiveArchetype.primary !== d.cognitiveArchetype.primary) {
      results.push({ id: testCase.id, test: 'DETERMINISM_ARCHETYPE', status: 'FAIL' })
      failCount++
      return
    }

    // Test: no prohibited expressions in scenario
    var scenarioText = JSON.stringify(d.scenarioSimulation)
    var exprCheck = scanForProhibitedExpressions(scenarioText)
    if (!exprCheck.clean) {
      results.push({ id: testCase.id, test: 'NO_PROHIBITED_EXPRESSIONS', status: 'FAIL', detail: JSON.stringify(exprCheck.violations.slice(0, 3)) })
      failCount++
      return
    }

    // Test: evidence trace (skip for extreme empty input)
    if (testCase.id !== 'C31_EXTREME_MINIMAL_INFO' && testCase.id !== 'C42_LEGACY_ADAPTER_BOUNDARY_NULL') {
      if (!d.trace || !d.trace.evidenceIds || d.trace.evidenceIds.length === 0) {
        results.push({ id: testCase.id, test: 'EVIDENCE_TRACE', status: 'FAIL', detail: 'No evidence IDs in trace' })
        failCount++
        return
      }
    }

    // Test: Legacy Adapter output (for non-boundary cases)
    if (testCase.id !== 'C42_LEGACY_ADAPTER_BOUNDARY_NULL') {
      try {
        var adapted = adaptWorldModelToLegacyDiagnosis(d)
        if (!adapted.legacyDiagnosisAdapter || !adapted.legacyDiagnosisAdapter.diagnosis) {
          results.push({ id: testCase.id, test: 'LEGACY_ADAPTER', status: 'FAIL', detail: 'Adapter failed to produce legacy diagnosis' })
          failCount++
          return
        }
        // Check adapter output has required fields
        var lda = adapted.legacyDiagnosisAdapter
        var ldiag = lda.diagnosis
        if (!ldiag.wealthProfile || !ldiag.bottleneck || !ldiag.strategy) {
          results.push({ id: testCase.id, test: 'LEGACY_ADAPTER_FIELDS', status: 'FAIL', detail: 'Adapter missing required fields' })
          failCount++
          return
        }
        // Check report exists with headline and actionPlan
        if (!lda.report || !lda.report.headline || !lda.report.actionPlan) {
          results.push({ id: testCase.id, test: 'LEGACY_ADAPTER_REPORT', status: 'FAIL', detail: 'Adapter report missing required fields' })
          failCount++
          return
        }
        // Check adapter does NOT contain EMPLOYEE
        var adapterJson = JSON.stringify(adapted)
        if (adapterJson.indexOf('EMPLOYEE') >= 0) {
          results.push({ id: testCase.id, test: 'LEGACY_ADAPTER_NO_EMPLOYEE', status: 'FAIL', detail: 'EMPLOYEE found in adapter output' })
          failCount++
          return
        }
      } catch (e) {
        results.push({ id: testCase.id, test: 'LEGACY_ADAPTER_EXCEPTION', status: 'FAIL', detail: e.message })
        failCount++
        return
      }
    }

    // All tests passed for this case
    passCount++
  })

  return {
    total: GOLDEN_CASES.length,
    pass: passCount,
    fail: failCount,
    failures: results.filter(function(r) { return r.status === 'FAIL' }),
    passRate: Math.round(passCount / GOLDEN_CASES.length * 100) + '%',
  }
}

function getStrategyForBlindSpot(blindSpotId) {
  var map = {
    OPPORTUNITY_BLINDNESS: 'EXPAND_OPTIONALITY',
    FEEDBACK_LOOP_GAP: 'BUILD_FEEDBACK_LOOP',
    DECISION_INERTIA: 'INCREASE_EXPERIMENT_RATE',
    RISK_MODEL_DISTORTION: 'REFRAME_RISK_MODEL',
    PROBABILITY_MISJUDGMENT: 'UPGRADE_PROBABILITY_THINKING',
    IDENTITY_CONSTRAINT: 'EXPAND_IDENTITY_BOUNDARY',
    LEVERAGE_MODEL_GAP: 'BUILD_LEVERAGE_MODEL',
    SYSTEM_THINKING_GAP: 'BUILD_DECISION_SYSTEM',
    TIME_HORIZON_TRAP: 'EXTEND_TIME_HORIZON',
  }
  return map[blindSpotId] || 'BUILD_FEEDBACK_LOOP'
}

// ═══════════════════════════════════════════════════════════════
// Cross-occupation consistency test
// ═══════════════════════════════════════════════════════════════

function testCrossOccupationConsistency() {
  var base = {
    lifeStage: '31-40岁', incomeStructure: '技能服务（按次/项目收费）',
    monthlySurplus: '1000-5000元', safetyMonths: '3-6个月',
    debtPressure: '无负债', skillValidation: '偶尔有付费需求',
    monetizableSkill: '技术类（编程/设计/工程）', weeklyTime: '5-10小时',
    executionStability: '比较稳定', pastAttemptStage: 'TRIED_MULTIPLE',
    decisionStyle: 'DATA_DRIVEN', primaryGoal: '增加收入',
    maxTrialCost: '500-1000元', failureResponse: 'ANALYZE_RETRY',
  }

  var occupations = ['厨师', '程序员', '教师', '快递员', '设计师', '护士']
  var results = occupations.map(function(occ) {
    var ans = Object.assign({}, base, { occupationDetail: occ })
    var r = runWorldModelPipeline(ans)
    return { occupation: occ, archetype: r.diagnosis.cognitiveArchetype.primary, blindSpot: r.diagnosis.cognitiveBlindSpot.id }
  })

  var archetypes = results.map(function(r) { return r.archetype })
  var blindSpots = results.map(function(r) { return r.blindSpot })
  var allSameArchetype = archetypes.every(function(a) { return a === archetypes[0] })
  var allSameBlindSpot = blindSpots.every(function(b) { return b === blindSpots[0] })

  return { consistent: allSameArchetype && allSameBlindSpot, archetype: archetypes[0], blindSpot: blindSpots[0], results: results }
}

// ═══════════════════════════════════════════════════════════════
// Extended cross-occupation consistency (10+ occupations)
// ═══════════════════════════════════════════════════════════════

function testExtendedCrossOccupationConsistency() {
  var base = {
    lifeStage: '31-40岁', incomeStructure: '工资/固定薪资',
    monthlySurplus: '1000-5000元', safetyMonths: '6-12个月',
    debtPressure: '无负债', skillValidation: '偶尔有付费需求',
    monetizableSkill: '技术类（编程/设计/工程）', weeklyTime: '10-20小时',
    executionStability: '比较稳定', pastAttemptStage: 'TRIED_MULTIPLE',
    decisionStyle: 'DATA_DRIVEN', primaryGoal: '增加收入',
    maxTrialCost: '1000-5000元', failureResponse: 'ANALYZE_RETRY',
  }

  var occupations = ['厨师', '程序员', '教师', '快递员', '设计师', '护士', '司机', '会计', 'HR', '文员']
  var results = occupations.map(function(occ) {
    var ans = Object.assign({}, base, { occupationDetail: occ })
    var r = runWorldModelPipeline(ans)
    return { occupation: occ, archetype: r.diagnosis.cognitiveArchetype.primary, blindSpot: r.diagnosis.cognitiveBlindSpot.id }
  })

  var archetypes = results.map(function(r) { return r.archetype })
  var blindSpots = results.map(function(r) { return r.blindSpot })
  var allSameArchetype = archetypes.every(function(a) { return a === archetypes[0] })
  var allSameBlindSpot = blindSpots.every(function(b) { return b === blindSpots[0] })
  var archetypeConsistency = countMostFrequent(archetypes) / archetypes.length
  var blindSpotConsistency = countMostFrequent(blindSpots) / blindSpots.length

  return {
    consistent: allSameArchetype && allSameBlindSpot,
    archetypeConsistency: Math.round(archetypeConsistency * 100) + '%',
    blindSpotConsistency: Math.round(blindSpotConsistency * 100) + '%',
    archetype: archetypes[0],
    blindSpot: blindSpots[0],
    results: results,
  }
}

// ═══════════════════════════════════════════════════════════════
// Same-occupation differentiation (3 profiles per occupation)
// ═══════════════════════════════════════════════════════════════

function testSameOccupationDifferentiation() {
  var occupations = ['程序员', '教师', '设计']
  var profiles = {
    active_validated: {
      skillValidation: '偶尔有付费需求', pastAttemptStage: 'TRIED_MULTIPLE',
      failureResponse: 'ANALYZE_RETRY', decisionStyle: 'DATA_DRIVEN',
      executionStability: '比较稳定', weeklyTime: '10-20小时'
    },
    passive_planning: {
      skillValidation: '从未变现过', pastAttemptStage: 'PLANNING',
      failureResponse: 'WAIT_BETTER', decisionStyle: 'SAFETY_FIRST',
      executionStability: '偶尔能坚持', weeklyTime: '5-10小时'
    },
    cautious_tried_once: {
      skillValidation: '免费帮人做过', pastAttemptStage: 'TRIED_ONCE',
      failureResponse: 'TRY_OTHER', decisionStyle: 'OPTION_KEEPING',
      executionStability: '偶尔能坚持', weeklyTime: '1-5小时'
    },
  }

  var base = {
    lifeStage: '31-40岁', incomeStructure: '工资/固定薪资',
    monthlySurplus: '1000-5000元', safetyMonths: '6-12个月',
    debtPressure: '无负债', monetizableSkill: '技术类（编程/设计/工程）',
    primaryGoal: '增加收入', maxTrialCost: '500-1000元',
  }

  var totalPairs = occupations.length * 3 // 9 profiles
  var differentiatedPairs = 0
  var results = []

  occupations.forEach(function(occ) {
    var profileKeys = Object.keys(profiles)
    var occResults = []
    profileKeys.forEach(function(pk) {
      var ans = Object.assign({}, base, profiles[pk], { occupationDetail: occ })
      var r = runWorldModelPipeline(ans)
      occResults.push({
        occupation: occ, profile: pk,
        archetype: r.diagnosis.cognitiveArchetype.primary,
        blindSpot: r.diagnosis.cognitiveBlindSpot.id,
      })
    })

    // Check that at least 2 out of 3 are different (strong differentiation)
    var archetypes = occResults.map(function(r) { return r.archetype })
    var blindSpots = occResults.map(function(r) { return r.blindSpot })
    var uniqueArchetypes = new Set(archetypes).size
    var uniqueBlindSpots = new Set(blindSpots).size

    if (uniqueArchetypes >= 2) differentiatedPairs++
    if (uniqueBlindSpots >= 2) differentiatedPairs++

    results = results.concat(occResults)
  })

  var totalChecks = occupations.length * 2 // archetype + blindSpot per occupation
  return {
    differentiationRate: Math.round(differentiatedPairs / totalChecks * 100) + '%',
    differentiatedPairs: differentiatedPairs,
    totalChecks: totalChecks,
    results: results,
  }
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function countMostFrequent(arr) {
  var counts = {}
  arr.forEach(function(x) { counts[x] = (counts[x] || 0) + 1 })
  return Math.max.apply(null, Object.values(counts))
}

var EMPTY_ANSWERS_FOR_ADAPTER_NULL = {
  lifeStage: '', incomeStructure: '',
  occupationDetail: '', monthlySurplus: '',
  safetyMonths: '', debtPressure: '',
  skillValidation: '', monetizableSkill: '',
  weeklyTime: '', executionStability: '',
  pastAttemptStage: '', decisionStyle: '',
  primaryGoal: '', maxTrialCost: '',
  failureResponse: '',
}

// ═══════════════════════════════════════════════════════════════
// Export test runners
// ═══════════════════════════════════════════════════════════════

module.exports = {
  GOLDEN_CASES,
  runGoldenTests,
  testCrossOccupationConsistency,
  testExtendedCrossOccupationConsistency,
  testSameOccupationDifferentiation,
  EMPTY_ANSWERS_FOR_ADAPTER_NULL,
}
