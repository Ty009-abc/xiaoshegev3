/**
 * content/cta/index.js — CTA 引擎（第六册 Part 2）
 *
 * 结果驱动 CTA，不硬广
 *
 * 3 种 CTA 类型：
 *   1. test_cta    — 引导测试（"测你的翻身概率"）
 *   2. insight_cta — 引导认知（"看看你的认知漏洞"）
 *   3. emotion_cta — 引导情绪（"很多人测完都破防了"）
 */

const CTAS = {
  // ═══════════════════════════
  // test_cta — 结果驱动测试
  // ═══════════════════════════
  test_cta: [
    {
      id: 'test_01',
      text: '我做了一个AI测试，3分钟测出你的"翻身概率"和"认知漏洞"。去小程序搜"珠澳小事哥"。',
      strength: 9,
      psychology: '结果驱动 + 好奇心',
    },
    {
      id: 'test_02',
      text: '做了一个工具，能测你的认知操作系统版本号。小程序搜"珠澳小事哥"免费测。',
      strength: 8,
      psychology: '版本号隐喻 + 免费',
    },
    {
      id: 'test_03',
      text: '想知道你在别人眼里是什么样的决策者吗？去测一下你的认知类型。',
      strength: 7,
      psychology: '社会比较',
    },
    {
      id: 'test_04',
      text: '你的翻转概率是多少？AI分析你的决策模式，3分钟出结果。',
      strength: 8,
      psychology: '确定性 + 结果导向',
    },
    {
      id: 'test_05',
      text: '我做了一个认知体检工具——不看血常规看你脑回路。测完重新认识自己。搜"珠澳小事哥"。',
      strength: 8,
      psychology: '新颖分类 + 自我认知',
    },
  ],

  // ═══════════════════════════
  // insight_cta — 认知引导
  // ═══════════════════════════
  insight_cta: [
    {
      id: 'insight_01',
      text: '你的认知漏洞在哪里？大部分人的第一大漏点，你中了吗？去小程序自测。',
      strength: 8,
      psychology: '损失厌恶 + 好奇心',
    },
    {
      id: 'insight_02',
      text: '我做的AI系统能找出你的"决策盲区"。来看看你的认知BUG。',
      strength: 7,
      psychology: '缺陷暴露',
    },
    {
      id: 'insight_03',
      text: '大部分人做完第一题就沉默了。去看看你的认知漏洞清单吧。',
      strength: 8,
      psychology: '社会证据 + 好奇心',
    },
    {
      id: 'insight_04',
      text: '不是你以为的自己，是AI看你最真实的样子。测一下你的认知画像。',
      strength: 8,
      psychology: '真实自我 vs 表面自我',
    },
  ],

  // ═══════════════════════════
  // emotion_cta — 情绪共鸣
  // ═══════════════════════════
  emotion_cta: [
    {
      id: 'emotion_01',
      text: '很多人测完都沉默了。去测，我不解释。小程序搜"珠澳小事哥"。',
      strength: 9,
      psychology: '悬念 + 社会证明',
    },
    {
      id: 'emotion_02',
      text: '有个人做完说"我在澳门10年，都没想过这些东西"。你要不要也测一下。',
      strength: 8,
      psychology: '权威背书 + 社会证明',
    },
    {
      id: 'emotion_03',
      text: '测完的人跟我说，这才是他看过自己最真实的样子。你也去看看。',
      strength: 8,
      psychology: '推荐效应',
    },
    {
      id: 'emotion_04',
      text: '看完你的结果，告诉我你破防在哪一题。小程序搜"珠澳小事哥"。',
      strength: 7,
      psychology: '互动承诺',
    },
  ],
}

// ═══════════════════════════
// 矩阵 → CTA 类型映射
// ═══════════════════════════

const MATRIX_CTA_MAP = {
  casino:    ['test_cta', 'emotion_cta'],    // 赌场 → 结果驱动 + 情绪共鸣
  cognition: ['test_cta', 'insight_cta'],    // 认知 → 测试 + 认知引导
  ai:        ['test_cta', 'insight_cta'],    // AI   → 测试 + 认知引导
  trending:  ['emotion_cta', 'insight_cta'], // 热点 → 情绪 + 认知
}

module.exports = {
  CTAS,
  MATRIX_CTA_MAP,
}
