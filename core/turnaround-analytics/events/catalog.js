/**
 * core/turnaround-analytics/events/catalog.js
 *
 * V6.5 Gate A — 完整事件目录
 *
 * 所有用户交互在此定义。
 *
 * @version 6.5.0
 */

const { EVENT_CATEGORIES } = require('./schema')

const EVENT_CATALOG = Object.freeze({

  // ═══════════════════════════════════════
  // SESSION
  // ═══════════════════════════════════════
  SESSION_START: {
    eventId: 'session_start',
    category: 'SESSION',
    action: 'start',
    description: '用户进入小程序',
  },
  SESSION_END: {
    eventId: 'session_end',
    category: 'SESSION',
    action: 'end',
    description: '用户离开/超时',
  },

  // ═══════════════════════════════════════
  // NAVIGATION
  // ═══════════════════════════════════════
  PAGE_VIEW_HOME: {
    eventId: 'page_view_home',
    category: 'NAVIGATION',
    action: 'view_home',
    description: '首页浏览',
  },
  PAGE_VIEW_HISTORY: {
    eventId: 'page_view_history',
    category: 'NAVIGATION',
    action: 'view_history',
    description: '历史报告页',
  },
  PAGE_VIEW_COLLECTION: {
    eventId: 'page_view_collection',
    category: 'NAVIGATION',
    action: 'view_collection',
    description: '收藏页',
  },

  // ═══════════════════════════════════════
  // QUESTIONNAIRE
  // ═══════════════════════════════════════
  QUESTIONNAIRE_START: {
    eventId: 'questionnaire_start',
    category: 'QUESTIONNAIRE',
    action: 'start',
    description: '开始答题',
  },
  QUESTION_ANSWER: {
    eventId: 'question_answer',
    category: 'QUESTIONNAIRE',
    action: 'answer',
    description: '回答单题',
    metadataSchema: { questionIndex: 'number', answerLength: 'number' },
  },
  QUESTIONNAIRE_COMPLETE: {
    eventId: 'questionnaire_complete',
    category: 'QUESTIONNAIRE',
    action: 'complete',
    description: '全部题目回答完成',
  },
  QUESTIONNAIRE_ABANDON: {
    eventId: 'questionnaire_abandon',
    category: 'QUESTIONNAIRE',
    action: 'abandon',
    description: '答题中途退出',
    metadataSchema: { lastQuestionIndex: 'number' },
  },

  // ═══════════════════════════════════════
  // AI GENERATION
  // ═══════════════════════════════════════
  AI_GENERATION_START: {
    eventId: 'ai_generation_start',
    category: 'AI_GENERATION',
    action: 'start',
    description: '开始生成报告',
  },
  AI_GENERATION_COMPLETE: {
    eventId: 'ai_generation_complete',
    category: 'AI_GENERATION',
    action: 'complete',
    description: '报告生成完成',
    metadataSchema: { durationMs: 'number', engineVersion: 'string' },
  },
  AI_GENERATION_ERROR: {
    eventId: 'ai_generation_error',
    category: 'AI_GENERATION',
    action: 'error',
    description: '生成失败',
    metadataSchema: { errorCode: 'string', retryCount: 'number' },
  },
  AI_GENERATION_FALLBACK: {
    eventId: 'ai_generation_fallback',
    category: 'AI_GENERATION',
    action: 'fallback',
    description: '使用回退策略',
    metadataSchema: { reason: 'string' },
  },

  // ═══════════════════════════════════════
  // CARD VIEW (7 cards)
  // ═══════════════════════════════════════
  CARD_VIEW_HERO: {
    eventId: 'card_view_hero',
    category: 'CARD_VIEW',
    action: 'view',
    description: 'Hero 卡片展示',
    metadataSchema: { cardIndex: 0 },
  },
  CARD_VIEW_INSIGHT: {
    eventId: 'card_view_insight',
    category: 'CARD_VIEW',
    action: 'view',
    description: 'Insight 卡片展示',
    metadataSchema: { cardIndex: 1 },
  },
  CARD_VIEW_POTENTIAL: {
    eventId: 'card_view_potential',
    category: 'CARD_VIEW',
    action: 'view',
    description: 'Potential 卡片展示',
    metadataSchema: { cardIndex: 2 },
  },
  CARD_VIEW_STRATEGY: {
    eventId: 'card_view_strategy',
    category: 'CARD_VIEW',
    action: 'view',
    description: 'Strategy 卡片展示',
    metadataSchema: { cardIndex: 3 },
  },
  CARD_VIEW_TIMELINE: {
    eventId: 'card_view_timeline',
    category: 'CARD_VIEW',
    action: 'view',
    description: 'Timeline 卡片展示',
    metadataSchema: { cardIndex: 5 },
  },
  CARD_VIEW_ACTION: {
    eventId: 'card_view_action',
    category: 'CARD_VIEW',
    action: 'view',
    description: 'Action 卡片展示',
    metadataSchema: { cardIndex: 6 },
  },
  CARD_VIEW_EVIDENCE: {
    eventId: 'card_view_evidence',
    category: 'CARD_VIEW',
    action: 'view',
    description: 'Evidence Drawer 展示',
    metadataSchema: { cardIndex: 7 },
  },

  // ═══════════════════════════════════════
  // CARD INTERACTION
  // ═══════════════════════════════════════
  CARD_EXPAND_EVIDENCE: {
    eventId: 'card_expand_evidence',
    category: 'CARD_INTERACTION',
    action: 'expand',
    description: 'Evidence Drawer 展开',
  },
  CARD_TAP_HERO: {
    eventId: 'card_tap_hero',
    category: 'CARD_INTERACTION',
    action: 'tap',
    description: 'Hero 卡片点击（渐进披露）',
  },
  CARD_TAP_INSIGHT: {
    eventId: 'card_tap_insight',
    category: 'CARD_INTERACTION',
    action: 'tap',
    description: 'Insight 卡片点击',
  },
  CARD_SWIPE: {
    eventId: 'card_swipe',
    category: 'CARD_INTERACTION',
    action: 'swipe',
    description: '卡片滑动',
    metadataSchema: { fromCard: 'string', toCard: 'string' },
  },

  // ═══════════════════════════════════════
  // SHARING
  // ═══════════════════════════════════════
  SHARE_CLICK: {
    eventId: 'share_click',
    category: 'SHARING',
    action: 'click',
    description: '点击分享按钮',
  },
  SHARE_GENERATE: {
    eventId: 'share_generate',
    category: 'SHARING',
    action: 'generate',
    description: '生成分享海报',
    metadataSchema: { posterType: 'string' },
  },
  SHARE_COMPLETE: {
    eventId: 'share_complete',
    category: 'SHARING',
    action: 'complete',
    description: '分享完成',
    metadataSchema: { channel: 'string' },
  },

  // ═══════════════════════════════════════
  // PAYMENT
  // ═══════════════════════════════════════
  PAYMENT_START: {
    eventId: 'payment_start',
    category: 'PAYMENT',
    action: 'start',
    description: '开始支付',
  },
  PAYMENT_SUCCESS: {
    eventId: 'payment_success',
    category: 'PAYMENT',
    action: 'success',
    description: '支付成功',
  },
  PAYMENT_FAIL: {
    eventId: 'payment_fail',
    category: 'PAYMENT',
    action: 'fail',
    description: '支付失败',
  },
  PAYMENT_RESTORE: {
    eventId: 'payment_restore',
    category: 'PAYMENT',
    action: 'restore',
    description: '恢复购买',
  },
  PAYMENT_EXPIRE: {
    eventId: 'payment_expire',
    category: 'PAYMENT',
    action: 'expire',
    description: '会员过期',
  },

  // ═══════════════════════════════════════
  // FEEDBACK
  // ═══════════════════════════════════════
  FEEDBACK_THUMBS_UP: {
    eventId: 'feedback_thumbs_up',
    category: 'FEEDBACK',
    action: 'thumbs_up',
    description: '点赞',
  },
  FEEDBACK_THUMBS_DOWN: {
    eventId: 'feedback_thumbs_down',
    category: 'FEEDBACK',
    action: 'thumbs_down',
    description: '点踩',
  },
  FEEDBACK_FREE_TEXT: {
    eventId: 'feedback_free_text',
    category: 'FEEDBACK',
    action: 'free_text',
    description: '文字反馈',
    metadataSchema: { textLength: 'number' },
  },

  // ═══════════════════════════════════════
  // SYSTEM
  // ═══════════════════════════════════════
  SYSTEM_ERROR: {
    eventId: 'system_error',
    category: 'SYSTEM',
    action: 'error',
    description: '系统异常',
  },
  SYSTEM_CRASH: {
    eventId: 'system_crash',
    category: 'SYSTEM',
    action: 'crash',
    description: '崩溃',
    metadataSchema: { stack: 'string' },
  },
  SYSTEM_PERFORMANCE: {
    eventId: 'system_performance',
    category: 'SYSTEM',
    action: 'performance',
    description: '性能指标',
    metadataSchema: { route: 'string', loadTimeMs: 'number' },
  },
})

// ═══════════════════════════════════════
// Event Count
// ═══════════════════════════════════════

const EVENT_COUNT = Object.keys(EVENT_CATALOG).length
const EVENT_BY_CATEGORY = {}
for (const [key, evt] of Object.entries(EVENT_CATALOG)) {
  if (!EVENT_BY_CATEGORY[evt.category]) EVENT_BY_CATEGORY[evt.category] = []
  EVENT_BY_CATEGORY[evt.category].push(evt.eventId)
}

module.exports = { EVENT_CATALOG, EVENT_COUNT, EVENT_BY_CATEGORY }
