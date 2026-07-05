/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * 云数据库 Collection 名称常量
 * 统一管理，禁止硬编码
 */

const COLLECTIONS = {
  // ── 用户系统 ──
  USERS:             'users',
  USER_PROFILES:     'user_profiles',
  MEMBERSHIPS:       'memberships',

  // ── 商品 & 支付 ──
  PRODUCTS:          'products',
  ORDERS:            'orders',
  PAYMENT_LOGS:      'payment_logs',

  // ── 内容系统 ──
  DAILY_INSIGHTS:    'daily_insights',
  WORLD_RULES:       'world_rules',

  // ── 挑战系统 ──
  CHALLENGE_EVENTS:  'challenge_events',
  CHALLENGE_RECORDS: 'challenge_records',

  // ── 认知标签 ──
  COGNITION_TAGS:    'cognition_tags',

  // ── AI 系统 ──
  AI_REPORTS:        'ai_reports',
  AI_LOGS:           'ai_logs',

  // ── 成长 & 成就 ──
  GROWTH_RECORDS:    'growth_records',
  BADGES:            'badges',
  USER_BADGES:       'user_badges',

  // ── 数据 & 社会化 ──
  ANALYTICS_LOGS:    'analytics_logs',
  SHARE_LOGS:        'share_logs',
  INVITE_RECORDS:    'invite_records',

  // ── 系统配置 ──
  SYSTEM_CONFIGS:    'system_configs',
}

/** 需要初始化的所有 Collection 名称列表 */
const ALL_COLLECTION_NAMES = Object.values(COLLECTIONS)

/**
 * 按业务域分组的 Collection 列表
 * 用于分批初始化
 */
const COLLECTION_GROUPS = {
  user:       [COLLECTIONS.USERS, COLLECTIONS.USER_PROFILES, COLLECTIONS.MEMBERSHIPS],
  commerce:   [COLLECTIONS.PRODUCTS, COLLECTIONS.ORDERS, COLLECTIONS.PAYMENT_LOGS],
  content:    [COLLECTIONS.DAILY_INSIGHTS, COLLECTIONS.WORLD_RULES],
  challenge:  [COLLECTIONS.CHALLENGE_EVENTS, COLLECTIONS.CHALLENGE_RECORDS],
  ai:         [COLLECTIONS.AI_REPORTS, COLLECTIONS.AI_LOGS],
  growth:     [COLLECTIONS.GROWTH_RECORDS, COLLECTIONS.BADGES, COLLECTIONS.USER_BADGES],
  analytics:  [COLLECTIONS.ANALYTICS_LOGS, COLLECTIONS.SHARE_LOGS, COLLECTIONS.INVITE_RECORDS],
  system:     [COLLECTIONS.SYSTEM_CONFIGS],
  cognition:  [COLLECTIONS.COGNITION_TAGS],
}

module.exports = {
  COLLECTIONS,
  ALL_COLLECTION_NAMES,
  COLLECTION_GROUPS,
}
