/**
 * engine/worldModel/v2/questionnaireV2.js
 *
 * World Model v2 — frozen questionnaire contract (Stage 13-R1).
 *
 * 18 inference questions, 72 answer options.
 * Stable IDs only. Chinese text is DISPLAY-ONLY — never a lookup key.
 * Each option maps to atomic EVIDENCE (never blindSpot / strategy / archetype).
 *
 * @version world_model_v2
 */

// ───────────────────────────────────────────────────────────────
// 18 QUESTIONS (frozen)
// ───────────────────────────────────────────────────────────────

const QUESTIONS_V2 = Object.freeze([
  { id: 'Q_DEC_01', construct: 'DECISION', type: 'single-choice', cardinality: 1, timeReference: '过去最近一次', text: '最近一次你有了一个想做的事，从「想到」到「第一次动手」，隔了多久？' },
  { id: 'Q_DEC_02', construct: 'DECISION', type: 'single-choice', cardinality: 1, timeReference: '一般习惯', text: '一个看起来不错、但结果不确定的机会，你通常怎么处理？' },
  { id: 'Q_FB_01', construct: 'FEEDBACK', type: 'single-choice', cardinality: 1, timeReference: '一般习惯', text: '做完一件重要的事之后，你通常怎么做？' },
  { id: 'Q_FB_02', construct: 'FEEDBACK', type: 'single-choice', cardinality: 1, timeReference: '一般习惯', text: '你会主动让别人（或市场）评价你的成果吗？' },
  { id: 'Q_PROB_01', construct: 'PROBABILITY', type: 'single-choice', cardinality: 1, timeReference: '一般习惯', text: '做重要决定时，你如何估计「成功的可能有多大」？' },
  { id: 'Q_PROB_02', construct: 'PROBABILITY', type: 'single-choice', cardinality: 1, timeReference: '一般习惯', text: '做决定前，你会去查同类事情的成功/失败比例吗？' },
  { id: 'Q_RISK_01', construct: 'RISK', type: 'single-choice', cardinality: 1, timeReference: '一般习惯', text: '一个能承受的、可逆的小风险，你一般怎么处理？' },
  { id: 'Q_RISK_02', construct: 'RISK', type: 'single-choice', cardinality: 1, timeReference: '一般习惯', text: '决定前，你会提前算「最坏会亏多少」吗？' },
  { id: 'Q_LEV_01', construct: 'LEVERAGE', type: 'single-choice', cardinality: 1, timeReference: '当前状态', text: '你的成果是一次性交付，还是能被反复使用/放大？' },
  { id: 'Q_LEV_02', construct: 'LEVERAGE', type: 'single-choice', cardinality: 1, timeReference: '一般习惯', text: '你会用工具、流程、或别人的力量来放大自己的产出吗？' },
  { id: 'Q_TIME_01', construct: 'TIME', type: 'single-choice', cardinality: 1, timeReference: '一般习惯', text: '你会给「几个月后才见效」的事留固定的时间吗？' },
  { id: 'Q_TIME_02', construct: 'TIME', type: 'single-choice', cardinality: 1, timeReference: '过去三个月', text: '过去三个月，你是否持续投入同一个方向？' },
  { id: 'Q_ID_01', construct: 'IDENTITY', type: 'single-choice', cardinality: 1, timeReference: '当前状态', text: '你更常怎么描述自己？' },
  { id: 'Q_ID_02', construct: 'IDENTITY', type: 'single-choice', cardinality: 1, timeReference: '过去', text: '你做过当前身份/职业之外的事吗？' },
  { id: 'Q_OPP_01', construct: 'OPPORTUNITY', type: 'single-choice', cardinality: 1, timeReference: '一般习惯', text: '你的新想法/新机会通常从哪里来？' },
  { id: 'Q_OPP_02', construct: 'OPPORTUNITY', type: 'single-choice', cardinality: 1, timeReference: '当前状态', text: '你常接触的人里，多少和你背景不同？' },
  { id: 'Q_SYS_01', construct: 'SYSTEMS', type: 'single-choice', cardinality: 1, timeReference: '归因方式', text: '反复出现的问题，你倾向认为是单个事件，还是背后某个系统造成的？' },
  { id: 'Q_SYS_02', construct: 'SYSTEMS', type: 'single-choice', cardinality: 1, timeReference: '一般习惯', text: '解决问题时，你倾向先找根本原因，还是先处理表面症状？' },
])

// ───────────────────────────────────────────────────────────────
// 72 ANSWER OPTIONS (frozen)
// evidence = [[evidenceId, strength], ...]  (strength ∈ [0.05, 0.9])
// ───────────────────────────────────────────────────────────────

const OPTIONS_V2 = Object.freeze([

  // Q_DEC_01
  { questionId: 'Q_DEC_01', optionId: 'A', text: '当天就动手', evidence: [['E_DEC_LATENCY', 0.1]] },
  { questionId: 'Q_DEC_01', optionId: 'B', text: '几天到一周', evidence: [['E_DEC_LATENCY', 0.3]] },
  { questionId: 'Q_DEC_01', optionId: 'C', text: '几周到一个月', evidence: [['E_DEC_LATENCY', 0.6]] },
  { questionId: 'Q_DEC_01', optionId: 'D', text: '一个月以上', evidence: [['E_DEC_LATENCY', 0.8]] },
  { questionId: 'Q_DEC_01', optionId: 'E', text: '到现在还没动手', evidence: [['E_DEC_LATENCY', 0.9]] },

  // Q_DEC_02
  { questionId: 'Q_DEC_02', optionId: 'A', text: '先做个小实验试一下', evidence: [['E_DEC_EXPERIMENT', 0.8]] },
  { questionId: 'Q_DEC_02', optionId: 'B', text: '边做边看，随时调整', evidence: [['E_DEC_EXPERIMENT', 0.6]] },
  { questionId: 'Q_DEC_02', optionId: 'C', text: '先想清楚再决定', evidence: [['E_DEC_EXPERIMENT', 0.2]] },
  { questionId: 'Q_DEC_02', optionId: 'D', text: '等别人先做了我再跟', evidence: [['E_DEC_EXPERIMENT', 0.15]] },
  { questionId: 'Q_DEC_02', optionId: 'E', text: '先放着，等更确定', evidence: [['E_DEC_EXPERIMENT', 0.1]] },

  // Q_FB_01
  { questionId: 'Q_FB_01', optionId: 'A', text: '我会复盘，记下什么有效', evidence: [['E_FB_REVIEW', 0.85]] },
  { questionId: 'Q_FB_01', optionId: 'B', text: '简单想想，很少记录', evidence: [['E_FB_REVIEW', 0.4]] },
  { questionId: 'Q_FB_01', optionId: 'C', text: '做完就换下一件', evidence: [['E_FB_REVIEW', 0.1], ['E_FB_UPDATE', 0.1]] },
  { questionId: 'Q_FB_01', optionId: 'D', text: '很少做重要的事', evidence: [['E_DEC_LATENCY', 0.7]] },

  // Q_FB_02
  { questionId: 'Q_FB_02', optionId: 'A', text: '经常主动找人/市场验证', evidence: [['E_FB_SEEK', 0.8]] },
  { questionId: 'Q_FB_02', optionId: 'B', text: '偶尔，被问才说', evidence: [['E_FB_SEEK', 0.4]] },
  { questionId: 'Q_FB_02', optionId: 'C', text: '基本不，自己判断', evidence: [['E_FB_SEEK', 0.1]] },
  { questionId: 'Q_FB_02', optionId: 'D', text: '刻意回避被评价', evidence: [['E_FB_SEEK', 0.05], ['E_FB_UPDATE', 0.05]] },

  // Q_PROB_01
  { questionId: 'Q_PROB_01', optionId: 'A', text: '给个百分比或区间', evidence: [['E_PROB_RANGE', 0.85]] },
  { questionId: 'Q_PROB_01', optionId: 'B', text: '会说大概率/小概率', evidence: [['E_PROB_RANGE', 0.5]] },
  { questionId: 'Q_PROB_01', optionId: 'C', text: '只判断行/不行', evidence: [['E_PROB_RANGE', 0.1]] },
  { questionId: 'Q_PROB_01', optionId: 'D', text: '凭感觉，不估计', evidence: [['E_PROB_RANGE', 0.05]] },

  // Q_PROB_02
  { questionId: 'Q_PROB_02', optionId: 'A', text: '会查数据/案例比例', evidence: [['E_PROB_BASERATE', 0.8]] },
  { questionId: 'Q_PROB_02', optionId: 'B', text: '偶尔想起来会查', evidence: [['E_PROB_BASERATE', 0.4]] },
  { questionId: 'Q_PROB_02', optionId: 'C', text: '不会，凭自己的判断', evidence: [['E_PROB_BASERATE', 0.1]] },
  { questionId: 'Q_PROB_02', optionId: 'D', text: '从没想过要查', evidence: [['E_PROB_BASERATE', 0.05]] },

  // Q_RISK_01
  { questionId: 'Q_RISK_01', optionId: 'A', text: '会去试，可逆就敢做', evidence: [['E_RISK_REVERSIBLE', 0.8]] },
  { questionId: 'Q_RISK_01', optionId: 'B', text: '看情况，损失可控就做', evidence: [['E_RISK_REVERSIBLE', 0.5]] },
  { questionId: 'Q_RISK_01', optionId: 'C', text: '尽量回避所有风险', evidence: [['E_RISK_REVERSIBLE', 0.1]] },
  { questionId: 'Q_RISK_01', optionId: 'D', text: '没想过可逆不可逆', evidence: [['E_RISK_REVERSIBLE', 0.2]] },

  // Q_RISK_02
  { questionId: 'Q_RISK_02', optionId: 'A', text: '会，明确算最坏情况', evidence: [['E_RISK_DOWNSIDE', 0.85]] },
  { questionId: 'Q_RISK_02', optionId: 'B', text: '大概想过，没细算', evidence: [['E_RISK_DOWNSIDE', 0.4]] },
  { questionId: 'Q_RISK_02', optionId: 'C', text: '不会，只想着能赚多少', evidence: [['E_RISK_DOWNSIDE', 0.1], ['E_RISK_ASYMMETRY', 0.1]] },
  { questionId: 'Q_RISK_02', optionId: 'D', text: '从不算，凭感觉', evidence: [['E_RISK_DOWNSIDE', 0.05]] },

  // Q_LEV_01
  { questionId: 'Q_LEV_01', optionId: 'A', text: '一次交付一次回报', evidence: [['E_LEV_REPEAT', 0.1]] },
  { questionId: 'Q_LEV_01', optionId: 'B', text: '部分成果能复用', evidence: [['E_LEV_REPEAT', 0.5]] },
  { questionId: 'Q_LEV_01', optionId: 'C', text: '我做的东西能反复卖/用', evidence: [['E_LEV_REPEAT', 0.8]] },
  { questionId: 'Q_LEV_01', optionId: 'D', text: '没想过复用这回事', evidence: [['E_LEV_REPEAT', 0.05]] },

  // Q_LEV_02
  { questionId: 'Q_LEV_02', optionId: 'A', text: '会，用系统/工具/团队放大', evidence: [['E_LEV_SYSTEM', 0.8]] },
  { questionId: 'Q_LEV_02', optionId: 'B', text: '偶尔用工具提效', evidence: [['E_LEV_SYSTEM', 0.4]] },
  { questionId: 'Q_LEV_02', optionId: 'C', text: '全靠自己一个人做', evidence: [['E_LEV_SYSTEM', 0.1]] },
  { questionId: 'Q_LEV_02', optionId: 'D', text: '没想过放大产出', evidence: [['E_LEV_SYSTEM', 0.05]] },

  // Q_TIME_01
  { questionId: 'Q_TIME_01', optionId: 'A', text: '有固定的时间块', evidence: [['E_TIME_COMPOUND', 0.8]] },
  { questionId: 'Q_TIME_01', optionId: 'B', text: '偶尔，忙起来就挤掉', evidence: [['E_TIME_COMPOUND', 0.4]] },
  { questionId: 'Q_TIME_01', optionId: 'C', text: '基本没有，都忙眼前', evidence: [['E_TIME_COMPOUND', 0.1]] },
  { questionId: 'Q_TIME_01', optionId: 'D', text: '只做马上见效的事', evidence: [['E_TIME_COMPOUND', 0.05]] },

  // Q_TIME_02
  { questionId: 'Q_TIME_02', optionId: 'A', text: '一直在同一个方向', evidence: [['E_TIME_PERSIST', 0.8]] },
  { questionId: 'Q_TIME_02', optionId: 'B', text: '换过一两次', evidence: [['E_TIME_PERSIST', 0.5]] },
  { questionId: 'Q_TIME_02', optionId: 'C', text: '换来换去，没定下来', evidence: [['E_TIME_PERSIST', 0.15]] },
  { questionId: 'Q_TIME_02', optionId: 'D', text: '没投入任何方向', evidence: [['E_TIME_PERSIST', 0.05], ['E_DEC_LATENCY', 0.6]] },

  // Q_ID_01
  { questionId: 'Q_ID_01', optionId: 'A', text: '我是XX职业的人', evidence: [['E_ID_CAPABILITY', 0.1]] },
  { questionId: 'Q_ID_01', optionId: 'B', text: '我能做XX这些事', evidence: [['E_ID_CAPABILITY', 0.8]] },
  { questionId: 'Q_ID_01', optionId: 'C', text: '我拥有这些能力，可以做很多', evidence: [['E_ID_CAPABILITY', 0.85]] },
  { questionId: 'Q_ID_01', optionId: 'D', text: '没想过这个问题', evidence: [['E_ID_CAPABILITY', 0.3]] },

  // Q_ID_02
  { questionId: 'Q_ID_02', optionId: 'A', text: '经常做跨领域的事', evidence: [['E_ID_CROSS', 0.8]] },
  { questionId: 'Q_ID_02', optionId: 'B', text: '做过一两次', evidence: [['E_ID_CROSS', 0.5]] },
  { questionId: 'Q_ID_02', optionId: 'C', text: '从没做过', evidence: [['E_ID_CROSS', 0.1]] },
  { questionId: 'Q_ID_02', optionId: 'D', text: '想做但没敢做', evidence: [['E_ID_CROSS', 0.15]] },

  // Q_OPP_01
  { questionId: 'Q_OPP_01', optionId: 'A', text: '来自不同领域的人/信息', evidence: [['E_OPP_EXPOSURE', 0.8]] },
  { questionId: 'Q_OPP_01', optionId: 'B', text: '来自我熟悉的圈子', evidence: [['E_OPP_EXPOSURE', 0.3]] },
  { questionId: 'Q_OPP_01', optionId: 'C', text: '很少遇到新机会', evidence: [['E_OPP_EXPOSURE', 0.1]] },
  { questionId: 'Q_OPP_01', optionId: 'D', text: '主要靠被动等', evidence: [['E_OPP_EXPOSURE', 0.05]] },

  // Q_OPP_02
  { questionId: 'Q_OPP_02', optionId: 'A', text: '很多不同背景的人', evidence: [['E_OPP_NETWORK', 0.8]] },
  { questionId: 'Q_OPP_02', optionId: 'B', text: '有一些', evidence: [['E_OPP_NETWORK', 0.4]] },
  { questionId: 'Q_OPP_02', optionId: 'C', text: '基本都是同类', evidence: [['E_OPP_NETWORK', 0.1]] },
  { questionId: 'Q_OPP_02', optionId: 'D', text: '几乎不接触外人', evidence: [['E_OPP_NETWORK', 0.05]] },

  // Q_SYS_01
  { questionId: 'Q_SYS_01', optionId: 'A', text: '是背后系统造成的', evidence: [['E_SYS_FRAMING', 0.85]] },
  { questionId: 'Q_SYS_01', optionId: 'B', text: '有时是系统，有时是偶然', evidence: [['E_SYS_FRAMING', 0.5]] },
  { questionId: 'Q_SYS_01', optionId: 'C', text: '就是单个独立事件', evidence: [['E_SYS_FRAMING', 0.1]] },
  { questionId: 'Q_SYS_01', optionId: 'D', text: '没想过这个区别', evidence: [['E_SYS_FRAMING', 0.25]] },

  // Q_SYS_02
  { questionId: 'Q_SYS_02', optionId: 'A', text: '先找根本原因', evidence: [['E_SYS_ROOTCAUSE', 0.8]] },
  { questionId: 'Q_SYS_02', optionId: 'B', text: '看情况，紧急先灭火', evidence: [['E_SYS_ROOTCAUSE', 0.4]] },
  { questionId: 'Q_SYS_02', optionId: 'C', text: '先处理表面症状', evidence: [['E_SYS_ROOTCAUSE', 0.1]] },
  { questionId: 'Q_SYS_02', optionId: 'D', text: '处理完就完了，不深究', evidence: [['E_SYS_ROOTCAUSE', 0.05]] },
])

module.exports = {
  QUESTIONS_V2,
  OPTIONS_V2,
  DIAGNOSTIC_VERSION_V2: 'world_model_v2',
}
