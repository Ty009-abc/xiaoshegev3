# ENVIRONMENT.md — 环境变量配置

---

## CloudBase 环境信息

| 配置项 | 值 |
|---|---|
| 环境 ID | `fanshex-d2g0adgv7dfbc9bdc` |
| 运行时 | Node.js 18.15 |
| 区域 | 上海 (ap-shanghai) |

---

## 云函数环境变量

### 🤖 AI 服务（DeepSeek / OpenAI 兼容）

以下云函数需要 AI API 配置：

`generateAiReport` `startChallenge` `submitChallengeChoice` `getDailyInsight` `summarizeConversation` `runEvolutionCycle`

| 变量 | 说明 | 当前值 |
|---|---|---|
| `AI_API_KEY` | API 密钥 | `sk-1e22630f6ba74bc58b27232da7ea05d4` |
| `AI_API_BASE_URL` | API 地址 | `https://api.deepseek.com/v1` |
| `AI_MODEL_FLASH` | 快速模型 | `deepseek-chat` |
| `AI_MODEL_PRO` | 精准模型 | `deepseek-chat` |

**注意:** API Key 已在生成环境中配置。

---

### 💰 微信支付

以下云函数需要支付配置：

`createOrder` `payCallback` `verifyPayment` `refundOrder`

| 变量 | 说明 | 状态 |
|---|---|---|
| `WXPAY_MCHID` | 商户号 | `1747400090` ✅ |
| `WXPAY_APPID` | 小程序 AppID | `wxd441fbf3b9f10aa3` ✅ |
| `WXPAY_API_V3_KEY` | API V3 密钥 | 已配置 ✅ |
| `WXPAY_SERIAL_NO` | 证书序列号 | `PUB_KEY_ID_0117474000902026062900381622000800` ✅ |
| `WXPAY_PRIVATE_KEY` | 商户私钥 (PEM) | ⚠️ 需生产环境填入 |
| `WXPAY_NOTIFY_URL` | 支付回调 URL | ⚠️ 需生产环境填入 |

**支付私钥格式:**
```
-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQ...
-----END PRIVATE KEY-----
```

---

### 🧠 知识嵌入

`initKnowledgeEmbeddings`

| 变量 | 说明 | 当前值 |
|---|---|---|
| `EMBEDDING_API_KEY` | Embedding API Key | `sk-1e22630f6ba74bc58b27232da7ea05d4` |
| `EMBEDDING_MODEL` | 模型 | `deepseek-embedding` |
| `EMBEDDING_API_BASE` | API 地址 | `https://api.deepseek.com/v1` |

---

### 👑 管理后台

`checkPermission` `adminCheckAccess`

| 变量 | 说明 | 示例 |
|---|---|---|
| `ADMIN_OPENIDS` | 管理员 OpenID 列表 | `oXXXXX1,oXXXXX2` |

**获取方式:** 登录后通过 `cloud.getWXContext().OPENID` 在云函数中打印。

---

## 小程序运行环境

| 配置项 | 值 |
|---|---|
| AppID | `wxd441fbf3b9f10aa3` |
| 基础库版本 | `2.32.3` |
| ES6→ES5 | ✅ 开启 |
| 代码压缩 | ✅ 开启 |
| 上传时编译 | ✅ 开启 |
| WXML 压缩 | ✅ 开启 |
| WXSS 压缩 | ✅ 开启 |

---

## 云函数列表 (50 个)

### 用户相关
`login` `getUserProfile` `updateUserProfile` `getMembership` `getOrderDetail`

### 挑战相关
`startChallenge` `submitChallengeChoice` `getChallengeEvent` `getChallengeRecord` `ensureChallengeCollections`

### AI 相关
`generateAiReport` `getAiReport` `getDailyInsight` `summarizeConversation`

### 认知相关
`getInsightList` `getWorldRules` `getWorldRuleDetail` `restoreWorldRules` `initKnowledgeEmbeddings`

### 支付相关
`createOrder` `payCallback` `verifyPayment` `getPaymentResult` `refundOrder` `getProductList`

### 会员相关
`consumeFreeQuota` `expireMemberships` `checkPermission`

### 记忆相关
`getMemory` `updateMemory` `clearMemory` `toggleMemory`

### 分析相关
`trackFunnelEvent` `submitFeedback`

### 增长相关
`recordInvite` `runEvolutionCycle` `getUnlimitedQR`

### 管理后台
`adminCheckAccess` `adminGetDashboard` `adminGetAnalytics` `adminGetUsers` `adminGetOrders` `adminGetReports` `adminGetAiLogs` `adminManageContent` `adminUpdateSystemConfig` `adminUpdateUser`

### 系统
`seedWorldRules` `initDatabase` `getSystemConfig`
