/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * 默认商品数据
 * 价格单位：分
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
    sort: 3,
    status: 'active',
    createdAt: now(),
    updatedAt: now(),
  },
  {
    productId: 'vip_year_299',
    name: '认知操作系统年卡',
    description: '365天VIP·无限AI分析·深度认知画像·年度翻身报告',
    price: 29900,
    originalPrice: 49900,
    currency: 'CNY',
    type: 'membership',
    permission: 'vip',
    durationDays: 365,
    coverUrl: '',
    sort: 4,
    status: 'active',
    createdAt: now(),
    updatedAt: now(),
  },
]

module.exports = { DEFAULT_PRODUCTS }
