'use strict'
/**
 * cloudfunctions/common/challengeEventCatalog.js
 *
 * RC8_10B — CHALLENGE EVENT METADATA CATALOG (KEEP_EXISTING_EVENT_BANK: true).
 *
 * The 30-day challenge bank (challenge_events CE001–CE030) is NOT rewritten here.
 * This module only ADDS metadata so the personalization selector can decide
 * which events fit a given user's real situation (occupation / capital /
 * cognition), and which are contraindicated.
 *
 * Metadata per event:
 *   domains              one of DOMAINS (universal | career | business | sales |
 *                        content | service | technical | management |
 *                        investment | ai)
 *   occupationAffinity   occupation tokens this event is naturally about
 *                        ('universal' = any occupation)
 *   skillRequirement     none | low | domain | technical
 *   capitalRequirement   none | low | medium | high
 *   experienceLevel      any | beginner | intermediate | advanced
 *   cognitiveDimension   the PRIMARY nine-dimension this event probes
 *   scenarioTags         short thematic tags
 *   contraindications    occupation tokens for which this event MUST NOT show
 *
 * @version rc8_10b_v1
 */

const DOMAINS = [
  'universal', 'career', 'business', 'sales', 'content',
  'service', 'technical', 'management', 'money', 'ai',
]

const DIMENSIONS = [
  'laborMindset', 'probabilityMindset', 'systemThinking',
  'leverageThinking', 'capitalThinking', 'riskAwareness',
  'informationSensitivity', 'longTermism', 'decisionStability',
]

// Non-digital / non-technical occupations — the "learn IT, switch career"
// trap (CE004) must NOT be shown to them by default.
const NON_TECH_OCCUPATIONS = [
  '厨师', '外卖员', '快递员', '宝妈', '美容', '理发', '服务员', '导购',
  '保安', '农户', '农民', '工人', '司机', '售货员', '保洁',
]

const EVENT_META = {
  CE001: { domains: ['ai', 'business'], occupationAffinity: ['universal'], skillRequirement: 'low', capitalRequirement: 'low', experienceLevel: 'any', cognitiveDimension: 'probabilityMindset', scenarioTags: ['机会识别', 'AI副业'], contraindications: [] },
  CE002: { domains: ['career'], occupationAffinity: ['白领', '销售', '技术人员'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'leverageThinking', scenarioTags: ['股权', '加班'], contraindications: [] },
  CE003: { domains: ['money'], occupationAffinity: ['个体老板', '白领'], skillRequirement: 'none', capitalRequirement: 'medium', experienceLevel: 'any', cognitiveDimension: 'riskAwareness', scenarioTags: ['投资', '高收益陷阱'], contraindications: [] },
  CE004: { domains: ['technical', 'career'], occupationAffinity: ['学生', '白领', '技术人员'], skillRequirement: 'technical', capitalRequirement: 'low', experienceLevel: 'beginner', cognitiveDimension: 'informationSensitivity', scenarioTags: ['培训陷阱', '转行'], contraindications: NON_TECH_OCCUPATIONS },
  CE005: { domains: ['career'], occupationAffinity: ['白领', '销售', '技术人员', '厨师'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'leverageThinking', scenarioTags: ['跳槽', '职业选择'], contraindications: [] },
  CE006: { domains: ['universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'medium', experienceLevel: 'any', cognitiveDimension: 'longTermism', scenarioTags: ['家庭', '财务'], contraindications: [] },
  CE007: { domains: ['money'], occupationAffinity: ['个体老板'], skillRequirement: 'none', capitalRequirement: 'high', experienceLevel: 'intermediate', cognitiveDimension: 'riskAwareness', scenarioTags: ['内幕消息', '股市'], contraindications: ['外卖员', '快递员', '宝妈', '学生', '厨师'] },
  CE008: { domains: ['money'], occupationAffinity: ['个体老板', '白领'], skillRequirement: 'low', capitalRequirement: 'high', experienceLevel: 'any', cognitiveDimension: 'capitalThinking', scenarioTags: ['理财', '第一笔'], contraindications: ['外卖员', '快递员', '宝妈', '学生'] },
  CE009: { domains: ['content'], occupationAffinity: ['内容创作者', '宝妈', '学生'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'longTermism', scenarioTags: ['短视频', '注意力'], contraindications: [] },
  CE010: { domains: ['ai', 'career'], occupationAffinity: ['universal'], skillRequirement: 'low', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'systemThinking', scenarioTags: ['AI', '岗位升级'], contraindications: [] },
  CE011: { domains: ['universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'low', experienceLevel: 'any', cognitiveDimension: 'longTermism', scenarioTags: ['复利', '死工资'], contraindications: [] },
  CE012: { domains: ['universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'decisionStability', scenarioTags: ['沉没成本'], contraindications: [] },
  CE013: { domains: ['content', 'business'], occupationAffinity: ['内容创作者', '厨师', '宝妈', '销售'], skillRequirement: 'low', capitalRequirement: 'low', experienceLevel: 'any', cognitiveDimension: 'capitalThinking', scenarioTags: ['免费陷阱', '内容资产'], contraindications: [] },
  CE014: { domains: ['universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'decisionStability', scenarioTags: ['连续失败', '再次下注'], contraindications: [] },
  CE015: { domains: ['business', 'content'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'probabilityMindset', scenarioTags: ['幸存者偏差'], contraindications: [] },
  CE016: { domains: ['universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'riskAwareness', scenarioTags: ['胜率', '清零风险'], contraindications: [] },
  CE017: { domains: ['universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'decisionStability', scenarioTags: ['紧急决策'], contraindications: [] },
  CE018: { domains: ['universal'], occupationAffinity: ['universal'], skillRequirement: 'low', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'systemThinking', scenarioTags: ['系统化', '重复'], contraindications: [] },
  CE019: { domains: ['business', 'content'], occupationAffinity: ['内容创作者', '厨师', '个体老板', '宝妈'], skillRequirement: 'low', capitalRequirement: 'low', experienceLevel: 'any', cognitiveDimension: 'leverageThinking', scenarioTags: ['可复制产品'], contraindications: [] },
  CE020: { domains: ['universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'leverageThinking', scenarioTags: ['离开系统'], contraindications: [] },
  CE021: { domains: ['business', 'management'], occupationAffinity: ['个体老板', '技术人员', '白领'], skillRequirement: 'low', capitalRequirement: 'high', experienceLevel: 'intermediate', cognitiveDimension: 'systemThinking', scenarioTags: ['增长混乱', '系统崩塌'], contraindications: [] },
  CE022: { domains: ['universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'high', experienceLevel: 'any', cognitiveDimension: 'capitalThinking', scenarioTags: ['10万块', '配置'], contraindications: [] },
  CE023: { domains: ['universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'informationSensitivity', scenarioTags: ['信息优势'], contraindications: [] },
  CE024: { domains: ['business', 'career'], occupationAffinity: ['个体老板', '销售', '白领'], skillRequirement: 'low', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'longTermism', scenarioTags: ['合作', '长期'], contraindications: [] },
  CE025: { domains: ['business', 'content'], occupationAffinity: ['内容创作者', '个体老板', '销售'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'longTermism', scenarioTags: ['快钱', '信誉'], contraindications: [] },
  CE026: { domains: ['business', 'career'], occupationAffinity: ['个体老板', '内容创作者', '技术人员'], skillRequirement: 'low', capitalRequirement: 'low', experienceLevel: 'any', cognitiveDimension: 'longTermism', scenarioTags: ['长期项目', '坚持'], contraindications: [] },
  CE027: { domains: ['universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'decisionStability', scenarioTags: ['证伪', '承认错误'], contraindications: [] },
  CE028: { domains: ['universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'decisionStability', scenarioTags: ['成功模式失效'], contraindications: [] },
  CE029: { domains: ['universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'riskAwareness', scenarioTags: ['不可逆风险'], contraindications: [] },
  CE030: { domains: ['universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'systemThinking', scenarioTags: ['人生系统', '三年'], contraindications: [] },
  CE031: { domains: ['universal', 'career'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'leverageThinking', scenarioTags: ['时间定价', '时薪思维'], contraindications: [] },
  CE032: { domains: ['universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'decisionStability', scenarioTags: ['面子成本', '身份焦虑'], contraindications: [] },
  CE033: { domains: ['money', 'universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'low', experienceLevel: 'any', cognitiveDimension: 'informationSensitivity', scenarioTags: ['锚定效应', '比价'], contraindications: [] },
  CE034: { domains: ['money', 'universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'low', experienceLevel: 'any', cognitiveDimension: 'riskAwareness', scenarioTags: ['从众压力', '晒单'], contraindications: [] },
  CE035: { domains: ['career', 'universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'probabilityMindset', scenarioTags: ['过度自信', '回本周期'], contraindications: [] },
  CE036: { domains: ['money', 'universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'low', experienceLevel: 'any', cognitiveDimension: 'riskAwareness', scenarioTags: ['损失厌恶', '止损'], contraindications: [] },
  CE037: { domains: ['money', 'universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'low', experienceLevel: 'any', cognitiveDimension: 'capitalThinking', scenarioTags: ['延迟满足', '闲钱'], contraindications: [] },
  CE038: { domains: ['career', 'technical'], occupationAffinity: ['universal'], skillRequirement: 'low', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'leverageThinking', scenarioTags: ['技能折旧', '工具升级'], contraindications: [] },
  CE039: { domains: ['money', 'career'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'longTermism', scenarioTags: ['单一收入', '第二收入'], contraindications: [] },
  CE040: { domains: ['universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'decisionStability', scenarioTags: ['情绪决策', '冷静期'], contraindications: [] },
  CE041: { domains: ['career', 'service'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'decisionStability', scenarioTags: ['边界感', '拒绝'], contraindications: [] },
  CE042: { domains: ['universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'longTermism', scenarioTags: ['复利中断', '可持续'], contraindications: [] },
  CE043: { domains: ['business', 'universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'capitalThinking', scenarioTags: ['机会成本', '算账'], contraindications: [] },
  CE044: { domains: ['money', 'universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'low', experienceLevel: 'any', cognitiveDimension: 'riskAwareness', scenarioTags: ['借钱', '应急金'], contraindications: [] },
  CE045: { domains: ['money', 'universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'low', experienceLevel: 'any', cognitiveDimension: 'riskAwareness', scenarioTags: ['担保', '连带责任'], contraindications: [] },
  CE046: { domains: ['money', 'universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'low', experienceLevel: 'any', cognitiveDimension: 'riskAwareness', scenarioTags: ['保险', '风险转移'], contraindications: [] },
  CE047: { domains: ['universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'longTermism', scenarioTags: ['健康透支', '节奏'], contraindications: [] },
  CE048: { domains: ['career', 'universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'systemThinking', scenarioTags: ['学习迁移', '用得上'], contraindications: [] },
  CE049: { domains: ['business', 'sales'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'leverageThinking', scenarioTags: ['谈判', '报价'], contraindications: [] },
  CE050: { domains: ['universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'decisionStability', scenarioTags: ['身份认同', '自我设限'], contraindications: [] },
  CE031: { domains: ['universal', 'career'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'leverageThinking', scenarioTags: ['时间定价', '时薪思维'], contraindications: [] },
  CE032: { domains: ['universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'decisionStability', scenarioTags: ['面子成本', '身份焦虑'], contraindications: [] },
  CE033: { domains: ['money', 'universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'low', experienceLevel: 'any', cognitiveDimension: 'informationSensitivity', scenarioTags: ['锚定效应', '比价'], contraindications: [] },
  CE034: { domains: ['money', 'universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'low', experienceLevel: 'any', cognitiveDimension: 'riskAwareness', scenarioTags: ['从众压力', '晒单'], contraindications: [] },
  CE035: { domains: ['career', 'universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'probabilityMindset', scenarioTags: ['过度自信', '回本周期'], contraindications: [] },
  CE036: { domains: ['money', 'universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'low', experienceLevel: 'any', cognitiveDimension: 'riskAwareness', scenarioTags: ['损失厌恶', '止损'], contraindications: [] },
  CE037: { domains: ['money', 'universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'low', experienceLevel: 'any', cognitiveDimension: 'capitalThinking', scenarioTags: ['延迟满足', '闲钱'], contraindications: [] },
  CE038: { domains: ['career', 'technical'], occupationAffinity: ['universal'], skillRequirement: 'low', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'leverageThinking', scenarioTags: ['技能折旧', '工具升级'], contraindications: [] },
  CE039: { domains: ['money', 'career'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'longTermism', scenarioTags: ['单一收入', '第二收入'], contraindications: [] },
  CE040: { domains: ['universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'decisionStability', scenarioTags: ['情绪决策', '冷静期'], contraindications: [] },
  CE041: { domains: ['career', 'service'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'decisionStability', scenarioTags: ['边界感', '拒绝'], contraindications: [] },
  CE042: { domains: ['universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'longTermism', scenarioTags: ['复利中断', '可持续'], contraindications: [] },
  CE043: { domains: ['business', 'universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'capitalThinking', scenarioTags: ['机会成本', '算账'], contraindications: [] },
  CE044: { domains: ['money', 'universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'low', experienceLevel: 'any', cognitiveDimension: 'riskAwareness', scenarioTags: ['借钱', '应急金'], contraindications: [] },
  CE045: { domains: ['money', 'universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'low', experienceLevel: 'any', cognitiveDimension: 'riskAwareness', scenarioTags: ['担保', '连带责任'], contraindications: [] },
  CE046: { domains: ['money', 'universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'low', experienceLevel: 'any', cognitiveDimension: 'riskAwareness', scenarioTags: ['保险', '风险转移'], contraindications: [] },
  CE047: { domains: ['universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'longTermism', scenarioTags: ['健康透支', '节奏'], contraindications: [] },
  CE048: { domains: ['career', 'universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'systemThinking', scenarioTags: ['学习迁移', '用得上'], contraindications: [] },
  CE049: { domains: ['business', 'sales'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'leverageThinking', scenarioTags: ['谈判', '报价'], contraindications: [] },
  CE050: { domains: ['universal'], occupationAffinity: ['universal'], skillRequirement: 'none', capitalRequirement: 'none', experienceLevel: 'any', cognitiveDimension: 'decisionStability', scenarioTags: ['身份认同', '自我设限'], contraindications: [] },
}

/** Merge catalog metadata onto a raw event doc (pure; never mutates). */
function decorateEvent (ev) {
  const meta = EVENT_META[ev.eventId] || {}
  return Object.assign({}, ev, {
    domains: meta.domains || ['universal'],
    occupationAffinity: meta.occupationAffinity || ['universal'],
    skillRequirement: meta.skillRequirement || 'none',
    capitalRequirement: meta.capitalRequirement || 'none',
    experienceLevel: meta.experienceLevel || 'any',
    cognitiveDimension: meta.cognitiveDimension || 'decisionStability',
    scenarioTags: meta.scenarioTags || [],
    contraindications: meta.contraindications || [],
  })
}

module.exports = { DOMAINS, DIMENSIONS, EVENT_META, NON_TECH_OCCUPATIONS, decorateEvent }
