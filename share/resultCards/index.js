/**
 * share/resultCards/index.js — 可分享结果卡片（第六册 Part 3）
 *
 * 4 种人格标签 — 裂变核心资产
 *
 * "你测出来是什么？" → 比邀请码强 10 倍
 */
const RESULT_CARDS = {
  // ── 人格标签类型 ──
  labels: {
    high_risk: {
      name: '高风险赌徒型',
      emoji: '🎲',
      color: '#e74c3c',
      description: '你的决策风格偏向高风险高回报',
      shareText: '我测出来是"高风险赌徒型"——你敢测吗？',
    },
    strategic: {
      name: '战略操盘型',
      emoji: '♟️',
      color: '#2ecc71',
      description: '你的决策以理性和长期视角为核心',
      shareText: '我测出来是"战略操盘型"——我们来看看你是什么？',
    },
    awakening: {
      name: '认知觉醒型',
      emoji: '🧠',
      color: '#4a90e2',
      description: '你的认知正在经历结构性升级',
      shareText: '我测出来是"认知觉醒型"——看看你是不是同款？',
    },
    system_player: {
      name: '系统玩家型',
      emoji: '⚙️',
      color: '#a084dc',
      description: '你擅长从系统层面理解和运作规则',
      shareText: '我测出来是"系统玩家型"——你的认知在一个level吗？',
    },
    fortune_hunter: {
      name: '财富猎手型',
      emoji: '🎯',
      color: '#f39c12',
      description: '你对机会的嗅觉非常敏锐',
      shareText: '我测出来是"财富猎手型"——来看看你的？',
    },
    deep_thinker: {
      name: '深度思考型',
      emoji: '💭',
      color: '#3498db',
      description: '你喜欢从底层逻辑理解世界',
      shareText: '我测出来是"深度思考型"——测完说说你的。',
    },
  },

  // ── 结果卡模板 ──
  template: {
    title: '珠澳小事哥 · 认知画像',
    subtitle: '你的认知操作系统画像',
    fields: [
      { key: 'personalityLabel',  label: '人格标签', format: 'badge' },
      { key: 'cognitionScore',    label: '认知指数', format: 'score' },
      { key: 'rankPercent',       label: '超越人群', format: 'percent' },
      { key: 'primaryFlaw',       label: '关键漏洞', format: 'text' },
    ],
    footer: '扫码测测你的认知画像',
  },
}

// ── 生成结果卡数据 ──
function generateResultCard(userData) {
  const {
    personalityType = 'awakening',
    cognitionScore = 0,
    rankPercent = 50,
    primaryFlaw = '未检测',
    inviteCode = 'XXXX',
  } = userData

  const label = RESULT_CARDS.labels[personalityType] || RESULT_CARDS.labels.awakening

  return {
    label,
    scores: {
      人格标签: label.name + ' ' + label.emoji,
      认知指数: `${cognitionScore} 分`,
      超越人群: `Top ${100 - rankPercent}%`,
      关键漏洞: primaryFlaw,
    },
    shareText: label.shareText,
    inviteCode,
    labelColor: label.color,
  }
}

module.exports = { RESULT_CARDS, generateResultCard }
