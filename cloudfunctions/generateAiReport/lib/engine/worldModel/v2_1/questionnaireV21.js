/**
 * engine/worldModel/v2_1/questionnaireV21.js
 *
 * World Model v2.1 — Frozen Static Questionnaire Contract (Stage19A1).
 *
 * SHADOW ONLY. Static data tables; NO inference, NO signal extraction,
 * NO dimension scoring, NO response-validity, NO displayPosition.
 *
 * Authority (priority R3C > R3B > R3A > R3 > R2 > R1):
 *   - R1 §C/D: 18 frozen scenario questions + option semantics
 *     (docs/RC8.3_STAGE18_R1_WORLD_OS_QUESTIONNAIRE_CONTRACT.md)
 *   - R3 §D: 48 normalized atomic evidence (docs/RC8.3_STAGE18_R3_WORLD_OS_CONTRACT_REPAIR.md)
 *
 * Frozen constants:
 *   QUESTIONNAIRE_VERSION = world_model_v2_1
 *   QUESTION_COUNT        = 18
 *   CONSTRUCT_COUNT       = 9
 *   OPTION_PROPOSITION_COUNT = 65
 *
 * Each option carries `semanticPropositionRefs` = atomic evidenceId(s) the
 * option maps to, derived strictly from R1 §C/D (option → proposition → evidence).
 * `optionId` is the STABLE SEMANTIC option identity (letter A/B/C/D).
 * displayPosition is FORBIDDEN in this layer (R3C: semanticOptionId → cognition ONLY).
 *
 * @version world_model_v2_1
 */

const QUESTIONNAIRE_VERSION_V21 = 'world_model_v2_1'
const QUESTION_COUNT_V21 = 18
const CONSTRUCT_COUNT_V21 = 9
const OPTION_PROPOSITION_COUNT_V21 = 65

const CONSTRUCTS_V21 = [
  'DECISION',
  'FEEDBACK',
  'PROBABILITY',
  'RISK',
  'LEVERAGE',
  'TIME',
  'IDENTITY',
  'OPPORTUNITY',
  'SYSTEMS',
]

const QUESTIONS_V21 = [
  // ── DECISION ────────────────────────────────────────────────────────────
  {
    questionId: 'SC_DEC_01',
    construct: 'DECISION',
    prompt: "你有个想了一阵子的机会，条件七成成熟但没完全确定。你更可能？",
    options: [
      { optionId: 'A', text: '先投一点，试出结果再说', semanticPropositionRefs: ['DEC_ACTION_LEARNS'] },
      { optionId: 'B', text: '等更确定再动', semanticPropositionRefs: ['DEC_CERTAINTY_GATE'] },
      { optionId: 'C', text: '问几个做过的人，他们说行我才敢', semanticPropositionRefs: ['DEC_SOCIAL_PROOF'] },
      { optionId: 'D', text: '把能想到的风险都列清楚再决定', semanticPropositionRefs: ['DEC_ANALYSIS_PARALYSIS'] },
    ],
  },
  {
    questionId: 'SC_DEC_02',
    construct: 'DECISION',
    prompt: "有一条可能改变你判断的新信息，但要再多等一天。你更可能？",
    options: [
      { optionId: 'A', text: '等，信息值这一天', semanticPropositionRefs: ['DEC_INFO_VALUED'] },
      { optionId: 'B', text: '不等，先做，边做边看', semanticPropositionRefs: ['DEC_ACTION_LEARNS'] },
      { optionId: 'C', text: '没想过信息能改变判断', semanticPropositionRefs: ['DEC_INFO_BLIND'] },
    ],
  },

  // ── FEEDBACK ────────────────────────────────────────────────────────────
  {
    questionId: 'SC_FB_01',
    construct: 'FEEDBACK',
    prompt: "你做的东西被一个你尊重的人否定了，但他的理由你不同意。你更可能？",
    options: [
      { optionId: 'A', text: '找他当面问清楚分歧在哪', semanticPropositionRefs: ['FB_PROCESSING'] },
      { optionId: 'B', text: '先放着，按自己判断继续', semanticPropositionRefs: ['FB_AS_NOISE'] },
      { optionId: 'C', text: '换个更懂行的人再问问', semanticPropositionRefs: ['FB_SYMPATHY'] },
      { optionId: 'D', text: '记下分歧，但继续不改', semanticPropositionRefs: ['FB_INERT'] },
    ],
  },
  {
    questionId: 'SC_FB_02',
    construct: 'FEEDBACK',
    prompt: "你的方案被否了两次，理由各不相同。你更可能认为？",
    options: [
      { optionId: 'A', text: '我的方案有问题，该改', semanticPropositionRefs: ['FB_PROCESSING'] },
      { optionId: 'B', text: '他们没看懂，我再解释清楚', semanticPropositionRefs: ['FB_AS_THREAT'] },
      { optionId: 'C', text: '意见不统一，听谁的都一样', semanticPropositionRefs: ['FB_AS_NOISE'] },
      { optionId: 'D', text: '各记一条，下次都验证', semanticPropositionRefs: ['FB_PROCESSING'] },
    ],
  },

  // ── PROBABILITY ─────────────────────────────────────────────────────────
  {
    questionId: 'SC_PROB_01',
    construct: 'PROBABILITY',
    prompt: "一个朋友创业成功了，劝你也做。你更可能先想？",
    options: [
      { optionId: 'A', text: '像他这样成功的人里，失败的有多少', semanticPropositionRefs: ['PROB_BASE_RATE'] },
      { optionId: 'B', text: '他挺靠谱，值得信', semanticPropositionRefs: ['PROB_SURVIVOR_BIAS'] },
      { optionId: 'C', text: '别人能成我也能', semanticPropositionRefs: ['PROB_SURVIVOR_BIAS'] },
      { optionId: 'D', text: '没想过概率这回事', semanticPropositionRefs: ['PROB_NO_AWARENESS'] },
    ],
  },
  {
    questionId: 'SC_PROB_02',
    construct: 'PROBABILITY',
    prompt: "你说一件事'八成把握'，如果有人能给你一条可能推翻或增强它的信息，但要花点时间。你更可能？",
    options: [
      { optionId: 'A', text: '值得看，我的八成可能会变', semanticPropositionRefs: ['PROB_UPDATABLE'] },
      { optionId: 'B', text: '都八成了，不用再看', semanticPropositionRefs: ['PROB_BINARY_FIXED'] },
      { optionId: 'C', text: "我一般不说'几成'，凭感觉", semanticPropositionRefs: ['PROB_NO_RANGE'] },
    ],
  },

  // ── RISK ────────────────────────────────────────────────────────────────
  {
    questionId: 'SC_RISK_01',
    construct: 'RISK',
    prompt: "一个机会，最坏亏 1000（你能承受），最好赚 1 万。你更可能？",
    options: [
      { optionId: 'A', text: '看赔率和最坏情况再定', semanticPropositionRefs: ['RISK_ASYMMETRY_AWARE'] },
      { optionId: 'B', text: "只看到'会亏'，不想碰", semanticPropositionRefs: ['RISK_LOSS_AVERSION'] },
      { optionId: 'C', text: "只看到'能赚'，就上了", semanticPropositionRefs: ['RISK_UPSIDE_BLIND'] },
      { optionId: 'D', text: '没想过最坏和最好', semanticPropositionRefs: ['RISK_BLIND'] },
    ],
  },
  {
    questionId: 'SC_RISK_02',
    construct: 'RISK',
    prompt: "一个失败后可退回的决定。'可退回'这一点会不会影响你的选择？",
    options: [
      { optionId: 'A', text: '会，可逆就敢试', semanticPropositionRefs: ['RISK_REVERSIBILITY_AWARE'] },
      { optionId: 'B', text: '不会，失败就是失败', semanticPropositionRefs: ['RISK_REVERSIBILITY_BLIND'] },
      { optionId: 'C', text: '从没区分过可逆不可逆', semanticPropositionRefs: ['RISK_REVERSIBILITY_BLIND'] },
    ],
  },

  // ── LEVERAGE ────────────────────────────────────────────────────────────
  {
    questionId: 'SC_LEV_01',
    construct: 'LEVERAGE',
    prompt: "你要花一周解决一个会反复出现的问题。你更倾向？",
    options: [
      { optionId: 'A', text: '直接解决这一次', semanticPropositionRefs: ['LEV_LINEAR_EFFORT'] },
      { optionId: 'B', text: '先做个以后能反复用的方法/工具，哪怕这次慢', semanticPropositionRefs: ['LEV_DECOUPLED'] },
      { optionId: 'C', text: '拉几个人分工一起弄', semanticPropositionRefs: ['LEV_DECOUPLED'] },
      { optionId: 'D', text: '没想过这区别', semanticPropositionRefs: ['LEV_BLIND'] },
    ],
  },
  {
    questionId: 'SC_LEV_02',
    construct: 'LEVERAGE',
    prompt: "你的产出，通常更接近？",
    options: [
      { optionId: 'A', text: '我停手它就停', semanticPropositionRefs: ['LEV_TIME_COUPLED'] },
      { optionId: 'B', text: '一部分能被别人/流程接着用', semanticPropositionRefs: ['LEV_DECOUPLED'] },
      { optionId: 'C', text: '从没想过放大', semanticPropositionRefs: ['LEV_BLIND'] },
    ],
  },

  // ── TIME ────────────────────────────────────────────────────────────────
  {
    questionId: 'SC_TIME_01',
    construct: 'TIME',
    prompt: "今天有件事能立刻出结果，还有件事三个月后才见效但能持续。你的时间更倾向？",
    options: [
      { optionId: 'A', text: '先做立刻见效的', semanticPropositionRefs: ['TIME_COMPOUNDING_UNPROTECTED'] },
      { optionId: 'B', text: '给长期的事留固定时间', semanticPropositionRefs: ['TIME_COMPOUNDING_PROTECTED'] },
      { optionId: 'C', text: '忙起来长期的就先搁置', semanticPropositionRefs: ['TIME_COMPOUNDING_UNPROTECTED'] },
    ],
  },
  {
    questionId: 'SC_TIME_02',
    construct: 'TIME',
    prompt: "过去三个月，你在同一件事上持续投入了吗？",
    options: [
      { optionId: 'A', text: '一直在同一方向', semanticPropositionRefs: ['TIME_DIRECTION_PERSISTENT'] },
      { optionId: 'B', text: '换过一两次', semanticPropositionRefs: ['TIME_DIRECTION_UNSTABLE'] },
      { optionId: 'C', text: '换来换去', semanticPropositionRefs: ['TIME_DIRECTION_UNSTABLE'] },
    ],
  },

  // ── IDENTITY ────────────────────────────────────────────────────────────
  {
    questionId: 'SC_ID_01',
    construct: 'IDENTITY',
    prompt: "有个机会需要你做一个从没做过、和现在工作无关的事。你第一反应更接近？",
    options: [
      { optionId: 'A', text: '我可以学', semanticPropositionRefs: ['ID_UPDATEABLE'] },
      { optionId: 'B', text: '这不是我的领域', semanticPropositionRefs: ['ID_BOUNDARY_FIXED'] },
      { optionId: 'C', text: '我可以找会的人一起', semanticPropositionRefs: ['ID_UPDATEABLE'] },
      { optionId: 'D', text: '我可能做不好', semanticPropositionRefs: ['ID_ABILITY_FIXED'] },
    ],
  },
  {
    questionId: 'SC_ID_02',
    construct: 'IDENTITY',
    prompt: "描述你现在能做什么时，你更常从哪个角度说？",
    options: [
      { optionId: 'A', text: '我的职业/岗位', semanticPropositionRefs: ['ID_ROLE_FIXED'] },
      { optionId: 'B', text: '我具体做过的事', semanticPropositionRefs: ['ID_UPDATEABLE'] },
      { optionId: 'C', text: '我学起来挺快', semanticPropositionRefs: ['ID_UPDATEABLE'] },
      { optionId: 'D', text: '看对方是谁', semanticPropositionRefs: ['ID_CONTEXTUAL'] },
    ],
  },

  // ── OPPORTUNITY ─────────────────────────────────────────────────────────
  {
    questionId: 'SC_OPP_01',
    construct: 'OPPORTUNITY',
    prompt: "你最近一个新想法，最初是从哪冒出来的？",
    options: [
      { optionId: 'A', text: '接触了不同背景的人/信息', semanticPropositionRefs: ['OPP_DIVERSE'] },
      { optionId: 'B', text: '熟悉圈子里', semanticPropositionRefs: ['OPP_NARROW'] },
      { optionId: 'C', text: '很久没新想法了', semanticPropositionRefs: ['OPP_NARROW'] },
      { optionId: 'D', text: '主要靠等，碰上了才想', semanticPropositionRefs: ['OPP_PASSIVE'] },
    ],
  },
  {
    questionId: 'SC_OPP_02',
    construct: 'OPPORTUNITY',
    prompt: "你平时接触的人，多大比例和你背景/行业不同？",
    options: [
      { optionId: 'A', text: '不少', semanticPropositionRefs: ['OPP_DIVERSE'] },
      { optionId: 'B', text: '有一些', semanticPropositionRefs: ['OPP_SOME'] },
      { optionId: 'C', text: '基本同类', semanticPropositionRefs: ['OPP_HOMOGENEOUS'] },
    ],
  },

  // ── SYSTEMS ─────────────────────────────────────────────────────────────
  {
    questionId: 'SC_SYS_01',
    construct: 'SYSTEMS',
    prompt: "一个团队里老出同样的问题，换了几个人还是老样子。你怎么看？",
    options: [
      { optionId: 'A', text: '问题在流程/环境，换人也一样', semanticPropositionRefs: ['SYS_SYSTEM_CAUSALITY'] },
      { optionId: 'B', text: '是人不行，得找对人', semanticPropositionRefs: ['SYS_PERSON'] },
      { optionId: 'C', text: '每次原因都不一样', semanticPropositionRefs: ['SYS_EVENT'] },
      { optionId: 'D', text: '没想过', semanticPropositionRefs: ['SYS_BLIND'] },
    ],
  },
  {
    questionId: 'SC_SYS_02',
    construct: 'SYSTEMS',
    prompt: "你的方法在一个场合有效，换到另一个场合失效了。你更可能？",
    options: [
      { optionId: 'A', text: '场合变了，条件不同', semanticPropositionRefs: ['SYS_SYSTEM_CAUSALITY'] },
      { optionId: 'B', text: '方法本身有漏洞', semanticPropositionRefs: ['SYS_METHOD'] },
      { optionId: 'C', text: '运气成分大', semanticPropositionRefs: ['SYS_LUCK'] },
      { optionId: 'D', text: '继续用，多试几次', semanticPropositionRefs: ['SYS_BRUTE_RETRY'] },
    ],
  },
]

module.exports = {
  QUESTIONNAIRE_VERSION_V21,
  QUESTION_COUNT_V21,
  CONSTRUCT_COUNT_V21,
  OPTION_PROPOSITION_COUNT_V21,
  CONSTRUCTS_V21,
  QUESTIONS_V21,
}
