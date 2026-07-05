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

## Step 7: 编译运行
微信开发者工具 → 编译 → 验证 splash → onboarding → home 链路
