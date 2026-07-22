# CLOUD_FUNCTIONS.md — 云函数部署指南

---

## 总览

本项目包含 **50 个云函数**，全部运行在 Node.js 18.15 环境。

---

## 部署方式

### 方式 A: 微信开发者工具（推荐）

1. 打开项目 → 左侧文件树
2. 找到 `cloudfunctions/` 目录
3. 右键每个函数 → **"上传并部署：云端安装依赖"**

### 方式 B: CloudBase CLI

```bash
# 安装 CLI
npm install -g @cloudbase/cli

# 登录
tcb login

# 部署单个函数
tcb fn deploy <函数名> --envId fanshex-d2g0adgv7dfbc9bdc

# 示例
tcb fn deploy generateAiReport --envId fanshex-d2g0adgv7dfbc9bdc
```

---

## 部署顺序

建议按以下顺序部署，避免依赖问题：

### 第一批：基础服务（无外部依赖）

```
login
getUserProfile
updateUserProfile
getSystemConfig
checkPermission
getMembership
```

### 第二批：数据服务

```
getChallengeEvent
getChallengeRecord
getInsightList
getWorldRules
getWorldRuleDetail
getMemory
updateMemory
clearMemory
toggleMemory
```

### 第三批：AI 服务（需安装依赖）

```
generateAiReport       ← timeout: 60s，主要函数
startChallenge         ← timeout: 15s
submitChallengeChoice  ← timeout: 30s
getDailyInsight        ← timeout: 10s
summarizeConversation  ← timeout: 30s
```

⚠️ 这些函数需要 `node_modules` 中有 AI SDK：

```bash
cd cloudfunctions/generateAiReport
npm init -y
npm install openai
```

### 第四批：支付服务

```
createOrder
payCallback
verifyPayment
getPaymentResult
refundOrder
getProductList
```

⚠️ 这些函数需要 `node_modules`：

```bash
cd cloudfunctions/createOrder
npm init -y
npm install crypto-js
```

### 第五批：辅助服务

```
consumeFreeQuota
expireMemberships
trackFunnelEvent
submitFeedback
recordInvite
getOrderDetail
restoreWorldRules
seedWorldRules
getUnlimitedQR
ensureChallengeCollections
initDatabase
initKnowledgeEmbeddings
runEvolutionCycle
```

### 第六批：管理后台

```
adminCheckAccess
adminGetDashboard
adminGetAnalytics
adminGetUsers
adminGetOrders
adminGetReports
adminGetAiLogs
adminManageContent
adminUpdateSystemConfig
adminUpdateUser
```

---

## 需要安装 npm 依赖的函数

| 函数 | 所需依赖 |
|---|---|
| `generateAiReport` | `openai` |
| `startChallenge` | `openai` |
| `submitChallengeChoice` | `openai` |
| `getDailyInsight` | `openai` |
| `summarizeConversation` | `openai` |
| `runEvolutionCycle` | `openai` |
| `initKnowledgeEmbeddings` | `openai` |
| `createOrder` | `crypto-js` |
| `verifyPayment` | `crypto-js` |
| `refundOrder` | `crypto-js` |
| `getUnlimitedQR` | `axios` |
| `restoreWorldRules` | `openai` |
| `ensureChallengeCollections` | — |

---

## 超时配置

| 函数 | 超时 (秒) | 原因 |
|---|---|---|
| `generateAiReport` | 60 | AI 生成报告耗时较长 |
| `runEvolutionCycle` | 120 | 知识演化分析 |
| `initKnowledgeEmbeddings` | 120 | 首次向量化全部规则 |
| `submitChallengeChoice` | 30 | AI 事件生成 |
| `restoreWorldRules` | 60 | 规则还原 |
| `adminGetAnalytics` | 30 | 数据聚合 |
| `ensureChallengeCollections` | 30 | 集合创建 |
| `seedWorldRules` | 30 | 种子数据写 |
| 其他 | 10–15 | 标准 API |

---

## 验证

部署后用微信开发者工具 → 云开发控制台 → 云函数列表：

1. 确认所有函数状态为 **"正常"**
2. 点击"测试" → 传入空对象 `{}` → 点击"开始测试"
3. 确认返回 `{ code: 0, ... }` 或有意义的错误提示（非 500）

---

## 常见问题

**Q: 云函数调用返回 500？**
A: 检查环境变量是否配置（AI_API_KEY 等）。

**Q: npm install 失败？**
A: 在开发者工具中右键点击云函数 → "在终端中打开" → 手动 `npm install`

**Q: 超时？**
A: 检查 cloudbaserc.json 中的 timeout 值，必要时调大。单个云函数最长 900s。

**Q: 冷启动慢？**
A: 云函数首次调用会有 1-3 秒冷启动。对小程序的 `generateAiReport`，设置最小实例数 1 可缓解。
