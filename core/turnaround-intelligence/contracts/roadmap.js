/**
 * core/turnaround-intelligence/contracts/roadmap.js
 *
 * CP6-D Roadmap Contract — 固定四阶段（Repair/Build/Expand/Compound）
 *
 * 不生成任务列表——只定义阶段目标 + 退出条件。
 *
 * @version 6.2.0
 * @checkpoint CP6-D
 */

// ═══════════════════════════════════════
// 固定四阶段
// ═══════════════════════════════════════

const PHASES = Object.freeze({
  REPAIR: {
    phase: 1,
    code: 'PHASE_REPAIR',
    label: '修复',
    description: '修复最关键的执行或认知缺陷',
  },
  BUILD: {
    phase: 2,
    code: 'PHASE_BUILD',
    label: '建立',
    description: '建立新的系统、习惯或收入结构',
  },
  EXPAND: {
    phase: 3,
    code: 'PHASE_EXPAND',
    label: '放大',
    description: '在验证可行的基础上扩大规模',
  },
  COMPOUND: {
    phase: 4,
    code: 'PHASE_COMPOUND',
    label: '复利',
    description: '让系统进入自动复利循环',
  },
})

// ═══════════════════════════════════════
// DecisionCode → 阶段参数映射
// 每个 Decision 定义四阶段的 duration + goal + exitCriteria
// ═══════════════════════════════════════

const DECISION_ROADMAP = Object.freeze({

  BUILD_EXECUTION_SYSTEM: {
    phases: {
      REPAIR:    { duration: 30,  goal: '修复执行碎片化，建立每日执行记录',        exitCriteria: ['连续7天每日完成≥1个核心任务', '识别并消除3个主要执行障碍'] },
      BUILD:     { duration: 60,  goal: '建立可复制的每日执行系统',                exitCriteria: ['连续21天每日计划完成率≥80%', '执行记录无需外部提醒'] },
      EXPAND:    { duration: 90,  goal: '将执行系统应用到第二收入线',              exitCriteria: ['至少1个副业项目上线', '每日执行覆盖主副两条线'] },
      COMPOUND:  { duration: 180, goal: '执行系统进入自动驾驶',                    exitCriteria: ['3个月内无需重设系统', '效率比前阶段提升≥30%'] },
    },
  },

  BUILD_SECOND_INCOME: {
    phases: {
      REPAIR:    { duration: 30,  goal: '修复收入结构风险认知，评估可调用资源',     exitCriteria: ['完成收入来源全景评估', '确定≥2个可行副业方向'] },
      BUILD:     { duration: 90,  goal: '启动第一条第二收入线',                     exitCriteria: ['第二收入上线', '月收入≥500元'] },
      EXPAND:    { duration: 180, goal: '扩大第二收入线或新增第三收入线',            exitCriteria: ['第二收入稳定≥3个月', '总收入增长≥20%'] },
      COMPOUND:  { duration: 365, goal: '多条收入线进入自动循环',                    exitCriteria: ['≥2条非工资收入线', '被动收入覆盖基本开支≥20%'] },
    },
  },

  INCREASE_MONETIZATION: {
    phases: {
      REPAIR:    { duration: 30,  goal: '识别可变现能力与市场机会',                 exitCriteria: ['完成能力-市场匹配分析', '确定1个变现切入点'] },
      BUILD:     { duration: 60,  goal: '建立最小变现闭环',                         exitCriteria: ['首个付费产品或服务上线', '实现第一笔收入'] },
      EXPAND:    { duration: 90,  goal: '扩大变现规模',                             exitCriteria: ['月收入≥1000元', '有≥3个稳定客户/用户'] },
      COMPOUND:  { duration: 180, goal: '建立可复制的变现系统',                      exitCriteria: ['收入无需本人24小时参与', '单客户获取成本下降'] },
    },
  },

  DEEPEN_SPECIALIZATION: {
    phases: {
      REPAIR:    { duration: 30,  goal: '停止分散精力，确定唯一专精方向',           exitCriteria: ['确定1个深耕方向', '放弃≥2个分散方向'] },
      BUILD:     { duration: 90,  goal: '深度积累专精方向的知识和实践',              exitCriteria: ['完成≥3个深度项目', '形成个人方法论'] },
      EXPAND:    { duration: 180, goal: '将专精转化为市场价值',                      exitCriteria: ['行业认可度提升', '专精方向收入占比≥50%'] },
      COMPOUND:  { duration: 365, goal: '专精壁垒进入不可替代阶段',                  exitCriteria: ['该领域有个人IP', '被动机会增多'] },
    },
  },

  REDUCE_DECISION_FATIGUE: {
    phases: {
      REPAIR:    { duration: 7,   goal: '识别日常决策耗能点',                       exitCriteria: ['列出≥10个日常决策点', '识别≥3个高效能时刻'] },
      BUILD:     { duration: 23,  goal: '建立3条自动化决策规则',                     exitCriteria: ['≥3个决策规则已生效', '每日决策时间减少≥30%'] },
      EXPAND:    { duration: 60,  goal: '将决策自动化扩展到工作决策',                exitCriteria: ['工作决策效率提升', '认知疲劳感降低'] },
      COMPOUND:  { duration: 90,  goal: '决策系统完全自动化',                        exitCriteria: ['≥80%日常决策无需思考', '精力集中于高价值决策'] },
    },
  },

  BUILD_DISCIPLINE: {
    phases: {
      REPAIR:    { duration: 30,  goal: '建立第一个不可动摇的每日习惯',              exitCriteria: ['连续14天完成固定动作', '无需意志力即可执行'] },
      BUILD:     { duration: 60,  goal: '将1个习惯扩展为习惯链',                     exitCriteria: ['≥3个习惯形成闭环', '习惯链连续21天不断'] },
      EXPAND:    { duration: 90,  goal: '习惯扩展到关键领域',                        exitCriteria: ['工作/学习/健康各有一个固定习惯', '整体效率提升'] },
      COMPOUND:  { duration: 180, goal: '习惯自动运行',                              exitCriteria: ['6个月内无习惯中断', '习惯带来可量化结果'] },
    },
  },

  REBUILD_RISK_FRAMEWORK: {
    phases: {
      REPAIR:    { duration: 30,  goal: '识别当前风险评估中的偏差',                  exitCriteria: ['完成风险偏差分析', '列出≥5个误判案例'] },
      BUILD:     { duration: 60,  goal: '建立基本的风险评估框架',                     exitCriteria: ['框架覆盖≥3个关键领域', '决策依据不再纯靠直觉'] },
      EXPAND:    { duration: 90,  goal: '将风险框架应用到实际决策',                    exitCriteria: ['≥5次关键决策使用了框架', '决策后后悔率下降'] },
      COMPOUND:  { duration: 180, goal: '风险框架内化为直觉',                         exitCriteria: ['重大失误概率降低≥50%', '不再需要刻意使用框架'] },
    },
  },

  CREATE_ASSET_ACCUMULATION: {
    phases: {
      REPAIR:    { duration: 30,  goal: '建立应急资金池',                           exitCriteria: ['紧急备用金≥3个月开支', '无高息负债'] },
      BUILD:     { duration: 90,  goal: '开始定期投资',                             exitCriteria: ['月投资额≥收入的10%', '建立自动定投'] },
      EXPAND:    { duration: 180, goal: '扩大资产配置',                              exitCriteria: ['资产≥2个类别', '被动收入开始产生'] },
      COMPOUND:  { duration: 365, goal: '资产进入复利增长',                           exitCriteria: ['年化增长≥8%', '被动收入覆盖≥3个月开支'] },
    },
  },

  IMPROVE_CONTENT_OUTPUT: {
    phases: {
      REPAIR:    { duration: 14,  goal: '建立每日输出习惯',                          exitCriteria: ['连续7天每日有输出', '确定1个内容方向'] },
      BUILD:     { duration: 46,  goal: '建立稳定的内容生产节奏',                     exitCriteria: ['周更≥2次持续1个月', '有一定受众反馈'] },
      EXPAND:    { duration: 90,  goal: '扩大受众和产出规模',                         exitCriteria: ['月输出量≥10篇', '受众增长≥100%'] },
      COMPOUND:  { duration: 180, goal: '内容成为个人IP资产',                         exitCriteria: ['内容可自动化生产', '有稳定的被动收入'] },
    },
  },

  BUILD_AI_WORKFLOW: {
    phases: {
      REPAIR:    { duration: 14,  goal: '识别当前工作流中的可自动化环节',             exitCriteria: ['列出≥5个可自动化节点', '选择1个优先级最高的'] },
      BUILD:     { duration: 46,  goal: '建立第一个AI自动化工作流',                    exitCriteria: ['首个工作流上线运行', '效率提升≥50%'] },
      EXPAND:    { duration: 90,  goal: '扩展到多个工作流',                           exitCriteria: ['≥3个AI工作流在运行', '每日节省时间≥2小时'] },
      COMPOUND:  { duration: 180, goal: '工作流进入自我迭代',                         exitCriteria: ['工作流自动优化', '时间成本持续下降'] },
    },
  },

  OPTIMIZE_INCOME_STRUCTURE: {
    phases: {
      REPAIR:    { duration: 30,  goal: '完成收入结构全景诊断',                       exitCriteria: ['清晰了解每条收入线的占比和稳定性', '识别最大风险点'] },
      BUILD:     { duration: 90,  goal: '优化最脆弱的那条收入线',                     exitCriteria: ['最脆弱线稳定性提升≥50%', '或新增1条高稳定性线'] },
      EXPAND:    { duration: 120, goal: '调整收入结构到目标比例',                      exitCriteria: ['工资占比≤70%', '≥2条收入线'] },
      COMPOUND:  { duration: 180, goal: '多条收入线自动运行',                          exitCriteria: ['被动收入≥总收入的30%', '抗风险能力大幅提升'] },
    },
  },

  STRENGTHEN_LONG_TERM_HABITS: {
    phases: {
      REPAIR:    { duration: 30,  goal: '识别可利用的现有自律优势',                   exitCriteria: ['列出≥3个已有稳定习惯', '确定1个新习惯切入点'] },
      BUILD:     { duration: 60,  goal: '新增1个可复利的长周期习惯',                   exitCriteria: ['新习惯连续21天不断', '开始产生小结果'] },
      EXPAND:    { duration: 90,  goal: '扩展到≥3个长周期习惯',                        exitCriteria: ['≥3个习惯稳定运行≥30天', '结果开始叠加'] },
      COMPOUND:  { duration: 180, goal: '所有习惯进入自动复利',                         exitCriteria: ['习惯运行≥6个月无中断', '复利结果可量化'] },
    },
  },
})

// ═══════════════════════════════════════
// createRoadmapOutput
// ═══════════════════════════════════════

function createRoadmapOutput({ version, decisionCode, phases }) {
  if (!version) throw new Error('Roadmap: version required')
  if (!decisionCode) throw new Error('Roadmap: decisionCode required')
  if (decisionCode !== 'UNKNOWN' && !DECISION_ROADMAP[decisionCode]) throw new Error(`No roadmap for decision: "${decisionCode}"`)
  if (!Array.isArray(phases)) throw new Error('Roadmap: phases must be an array')

  for (const p of phases) {
    if (!p.phase || !p.code) throw new Error(`Roadmap phase ${p.phase}: code required`)
    if (!p.duration) throw new Error(`Roadmap phase ${p.phase}: duration required`)
    if (!p.goal) throw new Error(`Roadmap phase ${p.phase}: goal required`)
    if (!Array.isArray(p.exitCriteria) || p.exitCriteria.length === 0) {
      throw new Error(`Roadmap phase ${p.phase}: exitCriteria required`)
    }
  }

  return Object.freeze({
    version,
    decisionCode,
    phases: Object.freeze(phases.map(p => Object.freeze({ ...p }))),
  })
}

module.exports = { PHASES, DECISION_ROADMAP, createRoadmapOutput }
