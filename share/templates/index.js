/**
 * share/templates/index.js — 分享素材模板（第六册 Part 3）
 *
 * 5 类分享素材：
 *   1. resultCards   — 测试结果卡（最强）
 *   2. insightPoster — 认知暴击海报
 *   3. growthPoster  — 成长海报
 *   4. invitePoster  — 邀请海报
 *   5. badgeShare    — 成就徽章分享
 */

const SHARE_TEMPLATES = {
  // ═══════════════════════════
  // resultCards — 测试结果卡
  // ═══════════════════════════
  resultCards: {
    title: '珠澳小事哥 · 认知画像',
    subtitle: '来看看你的认知操作系统',
    layout: 'vertical',
    design: {
      background: '#0a0a14',
      cardColor: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
      accentColor: '#4ecdc4',
      fontTitle: 'bold 32rpx',
      fontLabel: 'bold 24rpx',
      fontValue: 'bold 40rpx',
    },
    elements: [
      { type: 'text',     key: 'title',          position: 'top',    style: 'title' },
      { type: 'score',    key: 'cognitionScore', position: 'center', style: 'hero' },
      { type: 'badge',    key: 'personalityLabel',position: 'center',style: 'badge' },
      { type: 'list',     key: 'details',        position: 'bottom', style: 'grid' },
      { type: 'qrcode',   key: 'inviteCode',     position: 'footer', style: 'small' },
    ],
    shareTexts: [
      '测测你的认知操作系统是什么版本？',
      '你的翻身概率是多少？进来测！',
      '我测出是{label}，你敢来看看你的吗？',
    ],
  },

  // ═══════════════════════════
  // insightPoster — 认知暴击海报
  // ═══════════════════════════
  insightPoster: {
    title: '珠澳小事哥 · 今日认知',
    layout: 'horizontal',
    design: {
      background: '#0a0a14',
      textColor: '#ffffff',
      accentColor: '#e74c3c',
      fontQuote: 'italic 36rpx',
    },
    elements: [
      { type: 'quote',    key: 'insight',    position: 'center', style: 'hero' },
      { type: 'source',   key: 'author',     position: 'bottom', style: 'small' },
      { type: 'qrcode',   key: 'inviteCode', position: 'footer', style: 'tiny' },
    ],
    shareTexts: [
      '这条规则值得分享给一个朋友',
      '看完这个观点，我沉默了很久',
      '转发给一个你关心的人',
    ],
  },

  // ═══════════════════════════
  // growthPoster — 成长海报
  // ═══════════════════════════
  growthPoster: {
    title: '珠澳小事哥 · 成长记录',
    layout: 'vertical',
    design: {
      background: 'linear-gradient(135deg, #0f2027, #203a43)',
      accentColor: '#2ecc71',
      fontHero: 'bold 60rpx',
    },
    elements: [
      { type: 'hero',     key: 'streakDays',     position: 'center', style: 'hero' },
      { type: 'text',     key: 'streakLabel',    position: 'center', style: 'subtitle' },
      { type: 'list',     key: 'milestones',     position: 'bottom', style: 'list' },
      { type: 'qrcode',   key: 'inviteCode',     position: 'footer', style: 'small' },
    ],
    shareTexts: [
      '已连续学习{days}天，认知值+{score}',
      '我用小事哥的AI持续成长了{days}天',
      '一起进化的第{days}天',
    ],
  },

  // ═══════════════════════════
  // invitePoster — 邀请海报
  // ═══════════════════════════
  invitePoster: {
    title: '珠澳小事哥 · 认知邀请',
    layout: 'vertical',
    design: {
      background: 'linear-gradient(135deg, #4a90e2, #a084dc)',
      textColor: '#ffffff',
      fontHero: 'bold 50rpx',
    },
    elements: [
      { type: 'text',     key: 'inviteTitle',  position: 'top',    style: 'title' },
      { type: 'hero',     key: 'inviteCode',   position: 'center', style: 'code' },
      { type: 'text',     key: 'cta',           position: 'bottom', style: 'cta' },
    ],
    shareTexts: [
      '测测你朋友的翻身概率',
      '挑战你的朋友',
      '生成我的认知海报',
    ],
  },

  // ═══════════════════════════
  // badgeShare — 成就徽章
  // ═══════════════════════════
  badgeShare: {
    title: '珠澳小事哥 · 认知成就',
    layout: 'vertical',
    design: {
      background: 'linear-gradient(135deg, #f39c12, #e74c3c)',
      accentColor: '#f1c40f',
      fontBadge: 'bold 44rpx',
    },
    elements: [
      { type: 'badgeIcon',key: 'badgeName',    position: 'center', style: 'hero' },
      { type: 'text',     key: 'badgeDesc',    position: 'center', style: 'subtitle' },
      { type: 'text',     key: 'earnedAt',     position: 'bottom', style: 'date' },
    ],
  },
}

// ═══════════════════════════
// 分享按钮文案生成
// ═══════════════════════════

const SHARE_BUTTONS = {
  challenge_complete: ['测测朋友的翻身概率', '挑战你的朋友', '你敢不敢测？'],
  insight_viewed:    ['这条认知值得分享', '发给一个朋友', '转发就是价值'],
  report_unlocked:   ['邀请3位好友解锁深度分析', '分享你的认知升级'],
  milestone_reached: ['生成我的进化海报', '分享我的成长记录'],
  badge_earned:      ['晒出你的成就', '朋友会羡慕你这个徽章'],
}

// ═══════════════════════════
// 辅助函数
// ═══════════════════════════

function getShareButtonText(scene) {
  const texts = SHARE_BUTTONS[scene] || ['分享给朋友', '看看你的认知画像']
  return texts[Math.floor(Math.random() * texts.length)]
}

function getShareTemplate(type) {
  return SHARE_TEMPLATES[type] || SHARE_TEMPLATES.resultCards
}

module.exports = {
  SHARE_TEMPLATES,
  SHARE_BUTTONS,
  getShareButtonText,
  getShareTemplate,
}
