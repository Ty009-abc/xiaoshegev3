/**
 * 珠澳小事哥 · 认知操作系统 v3.0 — 第五册 Part 2
 * 商品数据（方案 A — 老板决策版）
 *
 * 核心策略：
 *   - 主推季卡 ¥199（不是年卡）
 *   - 月卡隐藏（不展示）
 *   - 年卡 ¥299 超值锚定
 *   - 咨询 ¥899 限名额
 *   - 价格单位：分
 */

const now = () => Date.now()

const DEFAULT_PRODUCTS = [
  // ═══════════ L1: Entry — 打开付费习惯 ═══════════
  {
    productId: 'REPORT_001',
    name: 'AI深度翻身报告',
    description: '你的完整世界模型已生成\n立即解锁深度报告 — 限时 ¥9.9\n\n包含：完整AI报告 · 翻身概率 · 认知漏洞 · 30天行动建议',
    price: 990,                    // ¥9.90
    originalPrice: 9900,           // ¥99.00（原价锚定）
    currency: 'CNY',
    type: 'one_time',
    permission: 'report_unlock',
    durationDays: 0,
    permissions: ['report_unlock'],
    recommended: false,
    active: true,
    status: 'active',
    visibleTo: ['free', 'report_buyer'],   // 免费用户 & 已购报告用户可见
    sort: 1,
    createdAt: now(),
    updatedAt: now(),
  },

  // ═══════════ 月卡 — 隐藏（不展示）═══════════
  // 原因：月卡会破坏价格锚 → 降低 ARPU
  {
    productId: 'VIP_MONTHLY',
    name: '认知操作系统月卡',
    description: '30天 · 无限AI分析 · 全部世界规则',
    price: 9900,                   // ¥99.00
    originalPrice: 0,
    currency: 'CNY',
    type: 'subscription',
    permission: 'vip',
    durationDays: 30,
    permissions: ['vip', 'ai_unlimited', 'report_unlock', 'challenge_unlock', 'world_rules_unlock'],
    recommended: false,
    active: true,
    status: 'hidden',              // 不展示
    visibleTo: [],                 // 不对任何用户展示
    sort: 10,
    createdAt: now(),
    updatedAt: now(),
  },

  // ═══════════ L2: 季卡 — 主推 ⭐ ═══════════
  {
    productId: 'VIP_QUARTERLY',
    name: '认知操作系统季卡',
    description: '最受欢迎 · 90天认知升级计划\n\n无限AI分析 · 全部世界规则 · 挑战模式 · 成长复盘 · 分享海报',
    price: 19900,                  // ¥199.00
    originalPrice: 29700,          // ¥297.00（= 99×3 锚定）
    currency: 'CNY',
    type: 'subscription',
    permission: 'vip',
    durationDays: 90,
    permissions: [
      'vip', 'ai_unlimited', 'report_unlock', 'challenge_unlock',
      'world_rules_unlock', 'history_insights_unlock',
      'poster_generate', 'advanced_profile',
    ],
    recommended: true,             // ⭐ 主推
    active: true,
    status: 'active',
    visibleTo: ['free', 'report_buyer'],
    sort: 2,
    badge: '最受欢迎',
    createdAt: now(),
    updatedAt: now(),
  },

  // ═══════════ L2: 年卡 — 超值锚定 ═══════════
  {
    productId: 'VIP_YEARLY',
    name: '认知操作系统年卡',
    description: '一年，彻底升级你的世界模型\n\n无限AI分析 · 专属深度Prompt · 更强人格强度 · 高价值知识库 · 优先AI模型',
    price: 29900,                  // ¥299.00
    originalPrice: 118800,         // ¥1,188.00（= 99×12 锚定）
    currency: 'CNY',
    type: 'subscription',
    permission: 'vip',
    durationDays: 365,
    permissions: [
      'vip', 'ai_unlimited', 'report_unlock', 'challenge_unlock',
      'world_rules_unlock', 'history_insights_unlock',
      'poster_generate', 'advanced_profile',
      'premium_prompt', 'stronger_persona', 'vip_knowledge', 'priority_ai_model',
    ],
    recommended: false,
    active: true,
    status: 'active',
    visibleTo: ['free', 'report_buyer', 'vip'],
    sort: 3,
    badge: '超值 · 省 ¥889',
    createdAt: now(),
    updatedAt: now(),
  },

  // ═══════════ L3: Premium — 高利润 ═══════════
  {
    productId: 'CONSULT_001',
    name: '1对1认知咨询',
    description: '60分钟深度诊断 · 个人路径分析 · AI+人工联合诊断 · 定制行动路线\n\n每月仅开放10个名额',
    price: 89900,                  // ¥899.00
    originalPrice: 129900,         // ¥1,299.00
    currency: 'CNY',
    type: 'consulting',
    permission: 'consult_unlock',
    durationDays: 0,
    permissions: ['consult_unlock', 'personal_report', 'follow_up_30d'],
    recommended: false,
    active: true,
    status: 'active',
    visibleTo: ['vip', 'heavy_user'],   // 仅VIP & 重度用户可见
    sort: 20,
    maxPerMonth: 10,              // 每月限10个
    badge: '每月限10名',
    createdAt: now(),
    updatedAt: now(),
  },
]

module.exports = { DEFAULT_PRODUCTS }
