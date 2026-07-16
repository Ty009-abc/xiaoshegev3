/**
 * data/aiChatSuggestions.js — AI 对话推荐问题池
 * 100 条高质量问题，10 个分类
 * 每次随机抽取 6 条（不同分类），支持换一批
 */

const AI_CHAT_SUGGESTIONS = [
  { icon: '💰', text: '为什么我总是存不下钱？', category: 'wealth' },
  { icon: '💸', text: '为什么越缺钱的人越容易做错误决定？', category: 'wealth' },
  { icon: '📈', text: '普通人应该先提高收入还是先学投资？', category: 'wealth' },
  { icon: '🧠', text: '为什么认知配不上财富，钱最终会离开你？', category: 'wealth' },
  { icon: '⚖️', text: '穷人和富人理解金钱最大的区别是什么？', category: 'wealth' },
  { icon: '🎯', text: '如何判断一个赚钱机会是真的还是陷阱？', category: 'wealth' },
  { icon: '💰', text: '为什么收入增加以后，很多人依然存不下钱？', category: 'wealth' },
  { icon: '🏦', text: '普通人建立第一笔可支配资本，最重要的步骤是什么？', category: 'wealth' },
  { icon: '📉', text: '为什么有些看起来便宜的东西，长期成本反而更高？', category: 'wealth' },
  { icon: '⏳', text: '时间、技能和现金，普通人应该优先积累哪一种资本？', category: 'wealth' },
  { icon: '🧾', text: '如何判断一笔消费是在改善生活，还是在透支未来？', category: 'wealth' },
  { icon: '🪙', text: '为什么真正的财富不是收入，而是选择权？', category: 'wealth' },

  { icon: '🤖', text: '普通人如何通过 AI 赚钱？', category: 'ai' },
  { icon: '🚀', text: '没有技术背景，怎么抓住 AI 机会？', category: 'ai' },
  { icon: '⚙️', text: '哪些工作最容易被 AI 替代？', category: 'ai' },
  { icon: '💡', text: '普通人应该学习哪些 AI 能力？', category: 'ai' },
  { icon: '📱', text: '一个人如何利用 AI 做副业？', category: 'ai' },
  { icon: '🔗', text: '区块链和 Web3 还有普通人参与的机会吗？', category: 'ai' },
  { icon: '🧩', text: 'AI 是工具还是替代者？', category: 'ai' },
  { icon: '🎨', text: 'AI 生成内容的浪潮里，普通人能做什么？', category: 'ai' },
  { icon: '☁️', text: '哪些 AI 工具无需编程就能使用？', category: 'ai' },
  { icon: '🔄', text: '如果 AI 取代了大量职场岗位，我应该如何提前准备？', category: 'ai' },
  { icon: '🛠️', text: '非技术岗位如何结合 AI 提升个人竞争力？', category: 'ai' },
  { icon: '🌐', text: '出海 AI 应用有哪些机会？', category: 'ai' },

  { icon: '🎯', text: '如何判断一个项目是否值得做？', category: 'decision' },
  { icon: '🛑', text: '什么时候应该放弃一个项目？', category: 'decision' },
  { icon: '✅', text: '如何判断一个机会是真实的还是陷阱？', category: 'decision' },
  { icon: '📊', text: '如何判断一个行业是否值得进入？', category: 'decision' },
  { icon: '⚡', text: '什么时候应该果断止损？', category: 'decision' },
  { icon: '🔍', text: '如何识别一个创业想法是否可行？', category: 'decision' },
  { icon: '🧭', text: '如何在信息不足的情况下做出更好的决策？', category: 'decision' },
  { icon: '🔄', text: '如何判断一个趋势是长期机会还是短期热点？', category: 'decision' },
  { icon: '📋', text: '判断一个项目是否有前景，最重要的三个指标是什么？', category: 'decision' },
  { icon: '⏱️', text: '在信息有限的情况下，如何估算一个机会的真实价值？', category: 'decision' },

  { icon: '🧠', text: '如何提升自己的认知层次？', category: 'cognition' },
  { icon: '📚', text: '最好的自我投资方式是什么？', category: 'cognition' },
  { icon: '🗺️', text: '如何建立自己的思维模型？', category: 'cognition' },
  { icon: '🎓', text: '为什么读书和上课并不能真正提升认知？', category: 'cognition' },
  { icon: '🪞', text: '如何发现自己最大的认知盲区？', category: 'cognition' },
  { icon: '🛤️', text: '如何从执行思维提升到系统思维？', category: 'cognition' },
  { icon: '📡', text: '如何提高信息筛选和深度思考的能力？', category: 'cognition' },
  { icon: '🧩', text: '如何判断自己的认知模型是否存在重大缺陷？', category: 'cognition' },
  { icon: '🌱', text: '有哪些低成本路径可以系统性地提升认知质量？', category: 'cognition' },
  { icon: '🔮', text: '如何培养对未来的预判能力？', category: 'cognition' },

  { icon: '💼', text: '35 岁以后，普通人的职业出路在哪里？', category: 'career' },
  { icon: '🪜', text: '如何从打工人思维升级到老板思维？', category: 'career' },
  { icon: '💬', text: '如何向老板要求加薪？', category: 'career' },
  { icon: '🌍', text: '没有背景的普通人，如何通过互联网逆袭？', category: 'career' },
  { icon: '🗂️', text: '为什么提升效率反而让收入上不去？', category: 'career' },
  { icon: '🚪', text: '什么时候应该换工作？', category: 'career' },
  { icon: '📈', text: '如何建立自己的职业护城河？', category: 'career' },
  { icon: '🏗️', text: '如果转型到一个全新的行业，应该如何开始？', category: 'career' },
  { icon: '🎢', text: '如何判断自己的职业天花板是什么？', category: 'career' },
  { icon: '🛡️', text: '在裁员潮中如何提高自己的不可替代性？', category: 'career' },

  { icon: '🔥', text: '如何在社交媒体上从零建立影响力？', category: 'traffic' },
  { icon: '📝', text: '普通人如何通过内容创作赚钱？', category: 'traffic' },
  { icon: '🎬', text: '做短视频，现在还有机会吗？', category: 'traffic' },
  { icon: '🧲', text: '如何设计让人忍不住转发的内容？', category: 'traffic' },
  { icon: '📊', text: '如何在不花钱的情况下获取第一批用户？', category: 'traffic' },
  { icon: '🎙️', text: '播客和音频内容还有增长空间吗？', category: 'traffic' },
  { icon: '✍️', text: '写作能力在短视频时代还有价值吗？', category: 'traffic' },
  { icon: '📈', text: '如何把一个普通账号做到具备商业变现能力？', category: 'traffic' },
  { icon: '🪧', text: '如何判断一个流量渠道是否值得长期投入？', category: 'traffic' },
  { icon: '🛒', text: '直播带货对普通个体来说是不是一个可行选项？', category: 'traffic' },

  { icon: '💀', text: '为什么大多数创业者会失败？', category: 'risk' },
  { icon: '🛡️', text: '普通人最大的三个风险是什么？', category: 'risk' },
  { icon: '🏚️', text: '为什么房子不一定是好的投资？', category: 'risk' },
  { icon: '📉', text: '经济下行周期，普通人应该怎么保护自己？', category: 'risk' },
  { icon: '⚠️', text: '如何避免被割韭菜？', category: 'risk' },
  { icon: '🔐', text: '如何建立家庭的财务安全垫？', category: 'risk' },
  { icon: '🧮', text: '如何计算自己可以承受的最大风险？', category: 'risk' },
  { icon: '🪤', text: '哪些常见的财务陷阱是绝大多数人都会踩的？', category: 'risk' },
  { icon: '📑', text: '合同和保险里有哪些普通人容易忽略的重大风险？', category: 'risk' },
  { icon: '⚰️', text: '如果发生最坏情况，普通人还有哪些兜底方案？', category: 'risk' },

  { icon: '⏳', text: '普通人在 10 年内如何实现财富自由？', category: 'longterm' },
  { icon: '🗓️', text: '为什么长期主义不意味着只坚持不放弃？', category: 'longterm' },
  { icon: '🧱', text: '如何积累自己的复利资产？', category: 'longterm' },
  { icon: '🌳', text: '为什么真正重要的事，十年以后才会看出差别？', category: 'longterm' },
  { icon: '🔭', text: '普通人如何制定一个十年的职业和财富路线图？', category: 'longterm' },
  { icon: '🏛️', text: '有哪些短期看起来没用，但长期极有价值的投资？', category: 'longterm' },
  { icon: '🍃', text: '保持长期专注，普通人可以采取哪些具体方法？', category: 'longterm' },
  { icon: '💎', text: '有哪些普通人无法替代的核心能力，未来 10 年持续增值？', category: 'longterm' },

  { icon: '🌐', text: '如何用概率思维做人生决策？', category: 'probability' },
  { icon: '🎲', text: '为什么中国澳门是理解人生概率的最好课堂？', category: 'probability' },
  { icon: '🃏', text: '赌场为什么永远不会输？这对普通人有什么启发？', category: 'probability' },
  { icon: '📐', text: '什么是贝叶斯思维？普通人怎么用？', category: 'probability' },
  { icon: '🎯', text: '如何在极度不确定的环境中做决定？', category: 'probability' },
  { icon: '🔢', text: '期望值为正的投资机会长什么样？', category: 'probability' },
  { icon: '🧪', text: '如何通过小样本实验降低重大决策的风险？', category: 'probability' },
  { icon: '🗳️', text: '如何在结果不确定的情况下，仍然敢于做出决策？', category: 'probability' },

  { icon: '🏢', text: '如何建立一个不用自己天天盯的生意？', category: 'system' },
  { icon: '🔄', text: '如何用系统化思维替代靠运气的收入？', category: 'system' },
  { icon: '📋', text: '如何把一份工作变成一套可复制的方法论？', category: 'system' },
  { icon: '🔧', text: '如何搭建一个自动运转的赚钱系统？', category: 'system' },
  { icon: '🧬', text: '为什么系统化思维是普通人与高手的核心差距？', category: 'system' },
  { icon: '⚙️', text: '有哪些普通人可以低成本搭建的被动收入系统？', category: 'system' },
  { icon: '🕹️', text: '如何设计一个即使自己不参与也能持续运行的业务？', category: 'system' },
  { icon: '📊', text: '如何衡量一个系统是否真正高效？', category: 'system' },
]

// 类别 emoji 映射
const CATEGORY_EMOJI = {
  wealth: '💰', ai: '🤖', decision: '🎯', cognition: '🧠',
  career: '💼', traffic: '📈', risk: '⚠️', longterm: '⏳',
  probability: '📐', system: '🔧',
}

const CATEGORY_NAMES = {
  wealth: '财富逻辑', ai: 'AI赛道', decision: '项目判断',
  cognition: '认知升级', career: '职场发展', traffic: '流量变现',
  risk: '风险管理', longterm: '长期主义', probability: '概率思维',
  system: '系统构建',
}

/**
 * 随机抽取 N 条，尽量不同分类，避免与上一批重复
 */
function pickQuestions(n, excludeTexts = []) {
  const excludeSet = new Set(excludeTexts)
  const available = AI_CHAT_SUGGESTIONS.filter(q => !excludeSet.has(q.text))
  const byCategory = {}
  for (const q of available) {
    if (!byCategory[q.category]) byCategory[q.category] = []
    byCategory[q.category].push(q)
  }

  const cats = Object.keys(byCategory)
  const picked = []
  const usedCats = new Set()

  // 先每类取一条
  while (picked.length < n && cats.length > 0) {
    const idx = Math.floor(Math.random() * cats.length)
    const cat = cats[idx]
    const pool = byCategory[cat]
    if (pool.length === 0) {
      cats.splice(idx, 1)
      continue
    }
    const qi = Math.floor(Math.random() * pool.length)
    picked.push(pool.splice(qi, 1)[0])
    usedCats.add(cat)
    if (pool.length === 0) cats.splice(idx, 1)
  }

  // 不足则从剩余中补
  if (picked.length < n) {
    const rest = available.filter(q => !picked.includes(q))
    while (picked.length < n && rest.length > 0) {
      const ri = Math.floor(Math.random() * rest.length)
      picked.push(rest.splice(ri, 1)[0])
    }
  }

  return picked
}

module.exports = {
  AI_CHAT_SUGGESTIONS,
  CATEGORY_EMOJI,
  CATEGORY_NAMES,
  pickQuestions,
}
