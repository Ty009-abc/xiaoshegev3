/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * 系统配置种子数据
 */

const ts = Date.now()

const DEFAULT_CONFIGS = [
  {
    key: 'admin_users',
    value: {
      openids: [
        // ⚠️ 部署前替换为实际管理员 openid
        // 获取方式：小程序运行后在云开发控制台 → 数据库 → users → 找到自己的 openid
        'REPLACE_WITH_YOUR_OPENID',
      ],
    },
    status: 'active',
    createdAt: ts,
    updatedAt: ts,
  },
  {
    key: 'app_config',
    value: {
      paymentEnabled: true,
      challengeEnabled: true,
      dailyInsightEnabled: true,
      vipEnabled: true,
      freeAiCount: 3,
      trialChallengeCount: 3,
      aiModel: 'v4-flash',
      maintenanceMode: false,
    },
    status: 'active',
    createdAt: ts,
    updatedAt: ts,
  },
  {
    key: 'app_version',
    value: '3.0.0',
    status: 'active',
    createdAt: ts,
    updatedAt: ts,
  },
  {
    key: 'free_ai_count',
    value: 3,
    status: 'active',
    createdAt: ts,
    updatedAt: ts,
  },
  {
    key: 'daily_insight_count',
    value: 1,
    status: 'active',
    createdAt: ts,
    updatedAt: ts,
  },
  {
    key: 'challenge_max_days',
    value: 30,
    status: 'active',
    createdAt: ts,
    updatedAt: ts,
  },
  {
    key: 'ai_model',
    value: 'v4-flash',
    status: 'active',
    createdAt: ts,
    updatedAt: ts,
  },
  {
    key: 'ai_api_endpoint',
    value: 'https://api.deepseek.com/v1/chat/completions',
    status: 'active',
    createdAt: ts,
    updatedAt: ts,
  },
  {
    key: 'share_title',
    value: '珠澳小事哥 · 认知操作系统——你的世界模型诊断器',
    status: 'active',
    createdAt: ts,
    updatedAt: ts,
  },
  {
    key: 'share_image_url',
    value: '',
    status: 'active',
    createdAt: ts,
    updatedAt: ts,
  },
]

module.exports = { DEFAULT_CONFIGS }
