/**
 * core/turnaround-os/fixtures/checkpoint4Fixtures.js
 *
 * CHECKPOINT_4 测试五人格 fixture
 * 复用 checkpoint2的人格定义但做浅封装
 *
 * @version 6.0.0
 */

function makeWorkerInput() {
  return {
    identity: { occupationType: 'employee', occupationLabel: '仓库管理', ageStage: '30-35', cityTier: '三线', familyStage: '已婚有子女' },
    reality: { monthlyIncome: 5000, monthlyExpense: 4800, savings: 3000, debt: 20000, availableHoursPerWeek: 5, incomeStability: 55, safetyMonths: 0.6 },
    capabilities: { execution: 40, learning: 35, communication: 30, sales: 10, content: 10, aiAdaptability: 10, systemThinking: 15, discipline: 50 },
    psychology: { riskTolerance: 10, anxiety: 80, desire: 60, patience: 30, selfAwareness: 40, externalAttribution: 60 },
    assets: { skills: ['warehouse_logistics'], experiences: ['8years_labor'], resources: [], audience: [], credentials: [], reusableAssets: [] },
    constraints: { familyPressure: ['support_parents', 'child_education'], cashflowPressure: ['debt_repay', 'living_expenses'], timePressure: ['long_work_hours'], healthPressure: [], geographicPressure: ['small_city'], psychologicalPressure: ['fear_of_change'] },
  }
}

function makeFreelancerInput() {
  return {
    identity: { occupationType: 'freelancer', occupationLabel: '平面设计师', ageStage: '28-35', cityTier: '一线', familyStage: '单身' },
    reality: { monthlyIncome: 12000, monthlyExpense: 8000, savings: 50000, debt: 0, availableHoursPerWeek: 15, incomeStability: 35, safetyMonths: 6 },
    capabilities: { execution: 65, learning: 60, communication: 55, sales: 20, content: 40, aiAdaptability: 30, systemThinking: 25, discipline: 45 },
    psychology: { riskTolerance: 40, anxiety: 50, desire: 70, patience: 40, selfAwareness: 55, externalAttribution: 30 },
    assets: { skills: ['design', 'branding', 'photoshop'], experiences: ['5years_freelance'], resources: [], audience: ['wechat_contacts'], credentials: [], reusableAssets: [] },
    constraints: { familyPressure: [], cashflowPressure: ['irregular_income'], timePressure: ['client_deadlines'], healthPressure: [], geographicPressure: [], psychologicalPressure: ['income_anxiety'] },
  }
}

function makeCreatorInput() {
  return {
    identity: { occupationType: 'creator', occupationLabel: '自媒体创作者', ageStage: '25-30', cityTier: '一线', familyStage: '单身' },
    reality: { monthlyIncome: 3000, monthlyExpense: 5000, savings: 10000, debt: 0, availableHoursPerWeek: 40, incomeStability: 15, safetyMonths: 2 },
    capabilities: { execution: 50, learning: 70, communication: 65, sales: 15, content: 75, aiAdaptability: 40, systemThinking: 30, discipline: 35 },
    psychology: { riskTolerance: 60, anxiety: 55, desire: 80, patience: 35, selfAwareness: 45, externalAttribution: 40 },
    assets: { skills: ['video_editing', 'writing', 'social_media'], experiences: ['2years_content'], resources: [], audience: ['10k_followers', 'email_list'], credentials: [], reusableAssets: [] },
    constraints: { familyPressure: [], cashflowPressure: ['low_income'], timePressure: [], healthPressure: [], geographicPressure: [], psychologicalPressure: ['monetization_pressure'] },
  }
}

function makeBusinessOwnerInput() {
  return {
    identity: { occupationType: 'business_owner', occupationLabel: '餐饮店老板', ageStage: '35-45', cityTier: '二线', familyStage: '已婚有子女' },
    reality: { monthlyIncome: 25000, monthlyExpense: 15000, savings: 80000, debt: 50000, availableHoursPerWeek: 8, incomeStability: 60, safetyMonths: 5 },
    capabilities: { execution: 70, learning: 40, communication: 50, sales: 55, content: 20, aiAdaptability: 15, systemThinking: 25, discipline: 60 },
    psychology: { riskTolerance: 35, anxiety: 45, desire: 55, patience: 50, selfAwareness: 45, externalAttribution: 35 },
    assets: { skills: ['management', 'food_industry'], experiences: ['8years_business'], resources: ['supplier_network', 'customer_base'], audience: ['regular_customers'], credentials: [], reusableAssets: [] },
    constraints: { familyPressure: ['children_expenses'], cashflowPressure: ['business_reinvestment'], timePressure: ['business_daily_ops'], healthPressure: [], geographicPressure: [], psychologicalPressure: [] },
  }
}

function makeHighIncomeProInput() {
  return {
    identity: { occupationType: 'professional', occupationLabel: '软件工程师', ageStage: '30-38', cityTier: '一线', familyStage: '已婚有子女' },
    reality: { monthlyIncome: 45000, monthlyExpense: 25000, savings: 300000, debt: 500000, availableHoursPerWeek: 10, incomeStability: 90, safetyMonths: 12 },
    capabilities: { execution: 75, learning: 85, communication: 60, sales: 10, content: 20, aiAdaptability: 70, systemThinking: 65, discipline: 70 },
    psychology: { riskTolerance: 30, anxiety: 40, desire: 65, patience: 55, selfAwareness: 60, externalAttribution: 25 },
    assets: { skills: ['programming', 'system_architecture', 'ai_tools'], experiences: ['10years_tech'], resources: ['professional_network'], audience: [], credentials: ['top_school'], reusableAssets: [] },
    constraints: { familyPressure: ['mortgage', 'child_future'], cashflowPressure: ['high_mortgage'], timePressure: ['corporate_demands'], healthPressure: [], geographicPressure: [], psychologicalPressure: ['golden_handcuffs'] },
  }
}

const FIXTURE_MAKERS = {
  worker: makeWorkerInput,
  freelancer: makeFreelancerInput,
  creator: makeCreatorInput,
  businessOwner: makeBusinessOwnerInput,
  highIncomePro: makeHighIncomeProInput,
}

const FIXTURE_LABELS = {
  worker: '低收入打工者',
  freelancer: '自由职业者',
  creator: '内容创作者',
  businessOwner: '小生意经营者',
  highIncomePro: '高收入职业用户',
}

module.exports = {
  makeWorkerInput,
  makeFreelancerInput,
  makeCreatorInput,
  makeBusinessOwnerInput,
  makeHighIncomeProInput,
  FIXTURE_MAKERS,
  FIXTURE_LABELS,
}
