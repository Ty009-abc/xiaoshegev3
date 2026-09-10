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
    prompt: "有个机会你琢磨挺久了，大概七成把握。你会怎么做？",
    options: [
      { optionId: 'A', text: '先小做一点，边做边看', semanticPropositionRefs: ['DEC_ACTION_LEARNS'] },
      { optionId: 'B', text: '再等等，稳一点再上', semanticPropositionRefs: ['DEC_CERTAINTY_GATE'] },
      { optionId: 'C', text: '问问做过的人，有底了再动', semanticPropositionRefs: ['DEC_SOCIAL_PROOF'] },
      { optionId: 'D', text: '先把问题都想全，再拍板', semanticPropositionRefs: ['DEC_ANALYSIS_PARALYSIS'] },
    ],
  },
  {
    questionId: 'SC_DEC_02',
    construct: 'DECISION',
    prompt: "一条新消息可能让你改主意，但要多等一天才拿到。你会怎么做？",
    options: [
      { optionId: 'A', text: '等等看，这消息可能有用', semanticPropositionRefs: ['DEC_INFO_VALUED'] },
      { optionId: 'B', text: '不等，先干起来再说', semanticPropositionRefs: ['DEC_ACTION_LEARNS'] },
      { optionId: 'C', text: '定了就不太回头，消息再说', semanticPropositionRefs: ['DEC_INFO_BLIND'] },
    ],
  },

  // ── FEEDBACK ────────────────────────────────────────────────────────────
  {
    questionId: 'SC_FB_01',
    construct: 'FEEDBACK',
    prompt: "你敬重的人否定了你做的东西，但他给的理由你不太认同。你会怎么做？",
    options: [
      { optionId: 'A', text: '当面问他，分歧到底在哪', semanticPropositionRefs: ['FB_PROCESSING'] },
      { optionId: 'B', text: '先放放，按自己的想法来', semanticPropositionRefs: ['FB_AS_NOISE'] },
      { optionId: 'C', text: '再找个信得过的人问问', semanticPropositionRefs: ['FB_SYMPATHY'] },
      { optionId: 'D', text: '记下来，但先照原计划来', semanticPropositionRefs: ['FB_INERT'] },
    ],
  },
  {
    questionId: 'SC_FB_02',
    construct: 'FEEDBACK',
    prompt: "你的方案连着被否了两次，两次说的原因还不一样。你怎么想？",
    options: [
      { optionId: 'A', text: '可能真有问题，改改看', semanticPropositionRefs: ['FB_PROCESSING'] },
      { optionId: 'B', text: '他们没看明白，我再说一遍', semanticPropositionRefs: ['FB_AS_THREAT'] },
      { optionId: 'C', text: '说法对不上，先放一放', semanticPropositionRefs: ['FB_AS_NOISE'] },
      { optionId: 'D', text: '先都记下，回头一条条试', semanticPropositionRefs: ['FB_PROCESSING'] },
    ],
  },

  // ── PROBABILITY ─────────────────────────────────────────────────────────
  {
    questionId: 'SC_PROB_01',
    construct: 'PROBABILITY',
    prompt: "一个朋友创业成了，劝你也一起干。你脑子里先冒出来的是什么？",
    options: [
      { optionId: 'A', text: '干这行的，成的到底有多少', semanticPropositionRefs: ['PROB_BASE_RATE'] },
      { optionId: 'B', text: '他趟过路了，跟着干心里有底', semanticPropositionRefs: ['PROB_SURVIVOR_BIAS'] },
      { optionId: 'C', text: '他都能成，我试一把也行', semanticPropositionRefs: ['PROB_SURVIVOR_BIAS'] },
      { optionId: 'D', text: '先不想这些，机会来了先上', semanticPropositionRefs: ['PROB_NO_AWARENESS'] },
    ],
  },
  {
    questionId: 'SC_PROB_02',
    construct: 'PROBABILITY',
    prompt: "你觉得一件事八成能成。再花点时间，可能查到一条推翻它的消息。你会？",
    options: [
      { optionId: 'A', text: '查查，说不定我得改主意', semanticPropositionRefs: ['PROB_UPDATABLE'] },
      { optionId: 'B', text: '都八成了，不用再折腾', semanticPropositionRefs: ['PROB_BINARY_FIXED'] },
      { optionId: 'C', text: '我不太估几成，差不多就做', semanticPropositionRefs: ['PROB_NO_RANGE'] },
    ],
  },

  // ── RISK ────────────────────────────────────────────────────────────────
  {
    questionId: 'SC_RISK_01',
    construct: 'RISK',
    prompt: "眼下有个事，最多亏一千（你亏得起），成了能赚一万。你会怎么做？",
    options: [
      { optionId: 'A', text: '先看看最坏能亏多少，再定', semanticPropositionRefs: ['RISK_ASYMMETRY_AWARE'] },
      { optionId: 'B', text: '想想那一千块，有点不想动', semanticPropositionRefs: ['RISK_LOSS_AVERSION'] },
      { optionId: 'C', text: '能赚一万，值得搏一把', semanticPropositionRefs: ['RISK_UPSIDE_BLIND'] },
      { optionId: 'D', text: '没细看，感觉靠谱就上', semanticPropositionRefs: ['RISK_BLIND'] },
    ],
  },
  {
    questionId: 'SC_RISK_02',
    construct: 'RISK',
    prompt: "有件事，就算做砸了也能收回来。你会怎么决定？",
    options: [
      { optionId: 'A', text: '能收回来，那就先试试', semanticPropositionRefs: ['RISK_REVERSIBILITY_AWARE'] },
      { optionId: 'B', text: '做砸了就是砸了，得慎重', semanticPropositionRefs: ['RISK_REVERSIBILITY_BLIND'] },
      { optionId: 'C', text: '能不能收回，平时没太留意', semanticPropositionRefs: ['RISK_REVERSIBILITY_BLIND'] },
    ],
  },

  // ── LEVERAGE ────────────────────────────────────────────────────────────
  {
    questionId: 'SC_LEV_01',
    construct: 'LEVERAGE',
    prompt: "有个问题老反复出现，你得花一周处理。你会怎么弄？",
    options: [
      { optionId: 'A', text: '先把这次弄利索', semanticPropositionRefs: ['LEV_LINEAR_EFFORT'] },
      { optionId: 'B', text: '顺手做个以后能用的', semanticPropositionRefs: ['LEV_DECOUPLED'] },
      { optionId: 'C', text: '喊人搭把手一起弄', semanticPropositionRefs: ['LEV_DECOUPLED'] },
      { optionId: 'D', text: '还是照老办法来', semanticPropositionRefs: ['LEV_BLIND'] },
    ],
  },
  {
    questionId: 'SC_LEV_02',
    construct: 'LEVERAGE',
    prompt: "你不盯着的时候，你做的那些事还会往前走吗？",
    options: [
      { optionId: 'A', text: '我一停手，它就停了', semanticPropositionRefs: ['LEV_TIME_COUPLED'] },
      { optionId: 'B', text: '有的做完，别人接着还能用', semanticPropositionRefs: ['LEV_DECOUPLED'] },
      { optionId: 'C', text: '做完就交差，没再往下接', semanticPropositionRefs: ['LEV_BLIND'] },
    ],
  },

  // ── TIME ────────────────────────────────────────────────────────────────
  {
    questionId: 'SC_TIME_01',
    construct: 'TIME',
    prompt: "有件事很快出结果；另一件得三个月才见效、好处能一直攒着。你先顾哪件？",
    options: [
      { optionId: 'A', text: '先顾马上能出结果的那件', semanticPropositionRefs: ['TIME_COMPOUNDING_UNPROTECTED'] },
      { optionId: 'B', text: '宁可慢点，也给慢的那件留出时间', semanticPropositionRefs: ['TIME_COMPOUNDING_PROTECTED'] },
      { optionId: 'C', text: '平时一忙，慢的那件就排后面了', semanticPropositionRefs: ['TIME_COMPOUNDING_UNPROTECTED'] },
    ],
  },
  {
    questionId: 'SC_TIME_02',
    construct: 'TIME',
    prompt: "过去三个月，你有没有一直往同一件事上使劲？",
    options: [
      { optionId: 'A', text: '就那一件，一直在弄', semanticPropositionRefs: ['TIME_DIRECTION_PERSISTENT'] },
      { optionId: 'B', text: '中间换过一两回', semanticPropositionRefs: ['TIME_DIRECTION_UNSTABLE'] },
      { optionId: 'C', text: '来来回回换了好几次', semanticPropositionRefs: ['TIME_DIRECTION_UNSTABLE'] },
    ],
  },

  // ── IDENTITY ────────────────────────────────────────────────────────────
  {
    questionId: 'SC_ID_01',
    construct: 'IDENTITY',
    prompt: "一个机会，要你做件从没干过、跟现在工作也不沾边的事。你第一反应？",
    options: [
      { optionId: 'A', text: '没干过，但可以学', semanticPropositionRefs: ['ID_UPDATEABLE'] },
      { optionId: 'B', text: '这活不是我这块的', semanticPropositionRefs: ['ID_BOUNDARY_FIXED'] },
      { optionId: 'C', text: '找懂行的人一起弄', semanticPropositionRefs: ['ID_UPDATEABLE'] },
      { optionId: 'D', text: '心里没底，怕做不好', semanticPropositionRefs: ['ID_ABILITY_FIXED'] },
    ],
  },
  {
    questionId: 'SC_ID_02',
    construct: 'IDENTITY',
    prompt: "刚认识的人问你「你擅长什么」，你一般先怎么答？",
    options: [
      { optionId: 'A', text: '先报一下自己做什么的', semanticPropositionRefs: ['ID_ROLE_FIXED'] },
      { optionId: 'B', text: '讲一件自己做出过的事', semanticPropositionRefs: ['ID_UPDATEABLE'] },
      { optionId: 'C', text: '说自己上手快、能学', semanticPropositionRefs: ['ID_UPDATEABLE'] },
      { optionId: 'D', text: '看对面是谁，挑着说', semanticPropositionRefs: ['ID_CONTEXTUAL'] },
    ],
  },

  // ── OPPORTUNITY ─────────────────────────────────────────────────────────
  {
    questionId: 'SC_OPP_01',
    construct: 'OPPORTUNITY',
    prompt: "你最近冒出的一个新想法，最早是怎么来的？",
    options: [
      { optionId: 'A', text: '跟圈外的人聊着聊出来的', semanticPropositionRefs: ['OPP_DIVERSE'] },
      { optionId: 'B', text: '熟人圈子里聊出来的', semanticPropositionRefs: ['OPP_NARROW'] },
      { optionId: 'C', text: '想不起来最近有啥新想法', semanticPropositionRefs: ['OPP_NARROW'] },
      { optionId: 'D', text: '没特意想，碰上了才有', semanticPropositionRefs: ['OPP_PASSIVE'] },
    ],
  },
  {
    questionId: 'SC_OPP_02',
    construct: 'OPPORTUNITY',
    prompt: "你平时来往的人里，跟你背景、行业不一样的，多吗？",
    options: [
      { optionId: 'A', text: '挺多的', semanticPropositionRefs: ['OPP_DIVERSE'] },
      { optionId: 'B', text: '有几个', semanticPropositionRefs: ['OPP_SOME'] },
      { optionId: 'C', text: '基本一个圈子', semanticPropositionRefs: ['OPP_HOMOGENEOUS'] },
    ],
  },

  // ── SYSTEMS ─────────────────────────────────────────────────────────────
  {
    questionId: 'SC_SYS_01',
    construct: 'SYSTEMS',
    prompt: "团队里总出同样的岔子，人换了好几拨还是老样子。你觉得是咋回事？",
    options: [
      { optionId: 'A', text: '可能是安排的问题，换谁都差不多', semanticPropositionRefs: ['SYS_SYSTEM_CAUSALITY'] },
      { optionId: 'B', text: '可能是人不行，换个人看看', semanticPropositionRefs: ['SYS_PERSON'] },
      { optionId: 'C', text: '每次情况都不太一样，说不好', semanticPropositionRefs: ['SYS_EVENT'] },
      { optionId: 'D', text: '没怎么细想，出了先处理', semanticPropositionRefs: ['SYS_BLIND'] },
    ],
  },
  {
    questionId: 'SC_SYS_02',
    construct: 'SYSTEMS',
    prompt: "你有个方法，在这儿好使，换个地方就不灵了。你会怎么想？",
    options: [
      { optionId: 'A', text: '水土不服，也正常', semanticPropositionRefs: ['SYS_SYSTEM_CAUSALITY'] },
      { optionId: 'B', text: '这方法本身有短板', semanticPropositionRefs: ['SYS_METHOD'] },
      { optionId: 'C', text: '这次运气差了点', semanticPropositionRefs: ['SYS_LUCK'] },
      { optionId: 'D', text: '再多试几次看看', semanticPropositionRefs: ['SYS_BRUTE_RETRY'] },
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
