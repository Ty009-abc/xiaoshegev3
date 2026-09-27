# ═══════════════════════════════════════════════════════════════
# 珠澳小事哥 · 认知操作系统 v3.0
# 手动部署步骤
# ═══════════════════════════════════════════════════════════════

## Step 1: 导入项目
解压 xiaoshige-v3-deploy.tar.gz
微信开发者工具 → 导入项目 → 选择 xiaoshige-v3/ 目录
AppID: wxd441fbf3b9f10aa3

## Step 2: 创建 47 个 Collection
打开 CLOUDBASE_COLLECTIONS.txt
云开发控制台 → 数据库 → 逐个创建

## Step 3: 配置环境变量
参考 .env.example 填入真实值
微信云开发控制台 → 云函数 → 逐个配置环境变量
或通过 cloudbaserc.json 的 envVariables 字段批量部署

## Step 4: 执行 initDatabase
微信开发者工具 → cloudfunctions/initDatabase → 右键 → 上传并部署
云开发控制台 → 云函数 → initDatabase → 测试 → {}

## Step 5: 配置管理员
db.collection('system_configs').add({
  data: {
    key: 'admin_users',
    value: ['你的openid'],
    status: 'active',
    createdAt: Date.now()
  }
})

## Step 6: 部署全部云函数
微信开发者工具 → cloudfunctions/ → 全选 → 右键 → 上传并部署：所有文件

### ⚠️ 依赖型云函数（含 package.json dependencies）
必须连同 node_modules 一起部署，否则运行时 `require('wx-server-sdk')` 会在
InitFunction 阶段直接崩溃（历史事故 RC8.8：adminGetDashboard 曾以纯源码部署导致 443）。

- 开发者工具：右键该函数 → **上传并部署：云端安装依赖**
- 或使用可复现部署脚本（推荐）：

```bash
bash scripts/deploy-admin-dashboard.sh
```

该脚本先 `npm ci --omit=dev`，再校验 `require.resolve('wx-server-sdk')`
与 `node_modules/wx-server-sdk` 存在，全部通过后才部署。
依赖版本由 `cloudfunctions/<fn>/package-lock.json` 锁定（需提交到 git）。

## Step 7: 编译运行
微信开发者工具 → 编译 → 验证 splash → onboarding → home 链路
