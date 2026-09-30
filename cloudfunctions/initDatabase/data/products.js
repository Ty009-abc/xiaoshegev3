/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * 默认商品数据
 * 价格单位：分
 *
 * RC8_11_STAGE1 — 会员化商品目录迁移
 *   - 新增 vip_month_39_9（认知会员月卡 ¥39.9）
 *   - 保留 vip_year_299（认知会员年卡 ¥299）
 *   - report_9_9 / challenge_39_9 / vip_month_99 标记 notNewSale:true
 *     （退休销售 ≠ 删除：历史订单/权益/回调仍完整识别并保留）
 */

const now = () => Date.now()

const DEFAULT_PRODUCTS = [
  {
    productId: 'report_9_9',
    name: 'AI深度翻身报告',
    description: '解锁完整认知诊断和翻身路线图，AI判官给你一场灵魂解剖',
    price: 990,
    originalPrice: 1990,
    currency: 'CNY',
    type: 'single',
    permission: 'report_unlock',
    durationDays: 0,
    coverUrl: '',
    sort: 1,
    status: 'active',
    notNewSale: true, // RC8_11: 退休新售（历史权益永久保留）
    createdAt: now(),
    updatedAt: now(),
  },
  {
    productId: 'challenge_39_9',
    name: '30天认知翻身挑战',
    description: '30天人生模拟器·从底层打工到财富自由·每道题都在诊断你的认知层级',
    price: 3990,
    originalPrice: 5990,
    currency: 'CNY',
    type: 'single',
    permission: 'challenge_unlock',
    durationDays: 0,
    coverUrl: '',
    sort: 2,
    status: 'active',
    notNewSale: true, // RC8_11: 退休新售（历史权益永久保留）
    createdAt: now(),
    updatedAt: now(),
  },
  {
    productId: 'vip_month_39_9',
    name: '认知会员月卡',
    description: 'AI问小事哥·6个个性化场景·长期记忆·30天认知挑战·完整世界模型报告·历史报告与复盘',
    price: 3990,
    originalPrice: 5990,
    currency: 'CNY',
    type: 'membership',
    permission: 'vip',
    durationDays: 30,
    coverUrl: '',
    sort: 3,
    status: 'active',
    notNewSale: false, // RC8_11: 新会员主商品
    createdAt: now(),
    updatedAt: now(),
  },
  {
    productId: 'vip_month_99',
    name: '认知操作系统月卡',
    description: '30天无限AI分析·解锁全部世界规则·生成分享海报',
    price: 9900,
    originalPrice: 12900,
    currency: 'CNY',
    type: 'membership',
    permission: 'vip',
    durationDays: 30,
    coverUrl: '',
    sort: 4,
    status: 'active',
    notNewSale: true, // RC8_11: 退休新售（被 vip_month_39_9 取代）
    createdAt: now(),
    updatedAt: now(),
  },
  {
    productId: 'vip_year_299',
    name: '认知会员年卡',
    description: '365天会员·无限AI分析·深度认知画像·年度翻身报告',
    price: 29900,
    originalPrice: 49900,
    currency: 'CNY',
    type: 'membership',
    permission: 'vip',
    durationDays: 365,
    coverUrl: '',
    sort: 5,
    status: 'active',
    notNewSale: false, // RC8_11: 新会员主商品（保留年卡独占权益）
    createdAt: now(),
    updatedAt: now(),
  },
]

module.exports = { DEFAULT_PRODUCTS }
