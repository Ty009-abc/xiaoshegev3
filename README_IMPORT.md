# README_IMPORT.md — 珠澳小事哥 导入指南

---

## ⚡ 快速开始

```
1. 微信开发者工具 → 导入项目
2. 填入 AppID: wxd441fbf3b9f10aa3
3. 填入 CloudBase 环境 ID: fanshex-d2g0adgv7dfbc9bdc
4. 点击"确定"
5. 上传云函数 → 部署
```

---

## 📦 项目信息

| 键 | 值 |
|---|---|
| AppID | `wxd441fbf3b9f10aa3` |
| 项目名称 | `xiaoshige-v3` |
| CloudBase 环境 | `fanshex-d2g0adgv7dfbc9bdc` |
| 基础库 | `2.32.3` |
| 云函数运行时 | `Nodejs18.15` |
| 包体大小 | ~21MB（不含 node_modules） |
| 仓库 | `github.com:Ty009-abc/xiaoshegev3.git` |
| 分支 | `agent/openclaw-checkpoint6-turnaround-intelligence` |
| RC Commit | `35cd369` |

---

## 📂 目录结构

```
├── app.js / app.json / app.wxss    # 小程序入口
├── pages/                          # 32 个页面
│   ├── splash/                     # 启动页
│   ├── home/                       # 首页 (tabBar)
│   ├── challenge-start/            # 挑战入口 (tabBar)
│   ├── challenge-play/             # 挑战答题
│   ├── ai-chat/                    # AI 对话 (tabBar)
│   ├── ai-analysis/                # AI 分析
│   ├── report-preview/             # 报告预览
│   ├── report-detail/              # 报告详情
│   ├── membership/                 # 支付解锁
│   ├── share-poster/               # 分享海报
│   ├── profile/                    # 我的 (tabBar)
│   └── admin/                      # 管理后台
├── components/                     # 22 个组件
├── services/                       # 10 个服务
├── utils/                          # 8 个工具
├── core/                           # 核心引擎 (116 个文件)
│   ├── turnaround-intelligence/    # V6 翻身策略引擎
│   └── turnaround-analytics/       # V6.5 数据分析
├── cloudfunctions/                 # 50 个云函数
├── static/                         # 静态资源
├── images/                         # 图片
├── tests/                          # 20 个测试套件
└── docs/                           # 文档
```

---

## 🔧 开发环境要求

- **微信开发者工具** ≥ 1.06.xx（稳定版）
- **Node.js** ≥ 18.15（云函数运行时）
- **CloudBase CLI**（可选，用于命令行部署云函数）
- **Git**（版本管理）

---

## 🚀 导入步骤

### Step 1: 克隆仓库

```bash
git clone git@github.com:Ty009-abc/xiaoshegev3.git
cd xiaoshige-v3
git checkout agent/openclaw-checkpoint6-turnaround-intelligence
```

### Step 2: 打开微信开发者工具

1. 打开微信开发者工具
2. 选择"导入项目"
3. 目录：选择 `xiaoshige-v3` 根目录
4. AppID：填入 `wxd441fbf3b9f10aa3`
5. 点击"导入"

### Step 3: 配置云开发

1. 点击工具栏"云开发"图标
2. 确认环境 ID 为 `fanshex-d2g0adgv7dfbc9bdc`
3. 如未开通，先开通云开发

### Step 4: 部署云函数

**方式 A：通过开发者工具（推荐）**

在左侧文件树中找到 `cloudfunctions/`：
- 右键每个云函数 → "上传并部署：云端安装依赖"
- 需要安装依赖的函数（共 6 个）：`startChallenge`, `submitChallengeChoice`, `getChallengeEvent`, `getChallengeRecord`, `generateAiReport`, `restoreWorldRules`, `getUnlimitedQR`, `ensureChallengeCollections`, `initKnowledgeEmbeddings`

**方式 B：通过 CloudBase CLI**

```bash
npm install -g @cloudbase/cli
tcb login
tcb fn deploy startChallenge --envId fanshex-d2g0adgv7dfbc9bdc
# ... repeat for each function
```

### Step 5: 配置环境变量

在云开发控制台 → 云函数 → 对应函数 → "编辑" → "环境变量"：

**AI 相关：**
- `AI_API_KEY`: DeepSeek API Key（或其他兼容 API）
- `AI_API_BASE_URL`: `https://api.deepseek.com/v1`
- `AI_MODEL_FLASH`: `deepseek-chat`
- `AI_MODEL_PRO`: `deepseek-chat`

**支付相关：**
- `WXPAY_MCHID`: 商户号
- `WXPAY_APPID`: 小程序 AppID
- `WXPAY_API_V3_KEY`: API V3 密钥
- `WXPAY_SERIAL_NO`: 证书序列号
- `WXPAY_PRIVATE_KEY`: 商户私钥（PEM 格式）
- `WXPAY_NOTIFY_URL`: 支付回调 URL

**管理后台：**
- `ADMIN_OPENIDS`: 管理员 OpenID 列表（逗号分隔）

### Step 6: 初始化数据库

在开发者工具中：
1. 云开发控制台 → 数据库
2. 创建以下集合：
   - `users` — 用户信息
   - `challenge_records` — 挑战记录
   - `challenge_events` — 挑战事件
   - `reports` — 生成报告
   - `orders` — 支付订单
   - `memberships` — 会员信息
   - `analytics_logs` — 分析日志
   - `funnel_events` — 漏斗事件
   - `feedback` — 用户反馈
   - `world_rules` — 世界规则
   - `insights` — 认知暴击
   - `daily_insights` — 每日暴击

### Step 7: 编译运行

1. 点击工具栏"编译"
2. 确认无红色错误
3. 在模拟器中测试基本流程

---

## ✅ 验证清单

- [ ] 首页正常渲染
- [ ] TabBar 四个 tab 可切换
- [ ] 挑战答题正常开始/提交
- [ ] AI 分析正常生成
- [ ] 报告预览正常展示
- [ ] 分享海报正常生成
- [ ] 支付流程可用
- [ ] 云函数全部部署成功
- [ ] 数据库集合全部创建

---

## 🔗 相关文档

- [RELEASE_NOTE.md](./RELEASE_NOTE.md) — 版本发布说明
- [CHANGELOG.md](./CHANGELOG.md) — 完整更新日志
- [ENVIRONMENT.md](./ENVIRONMENT.md) — 环境变量说明
- [Known Issues](./KNOWN_ISSUES.md) — 已知问题
- [Cloud Functions Guide](./CLOUD_FUNCTIONS.md) — 云函数部署指南
- [PPV Report](./.audit-reports/PPV_20260722.md) — 封装前验证报告
