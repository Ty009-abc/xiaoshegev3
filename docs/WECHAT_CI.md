# WeChat CI/CD 指南

## 概述

珠澳小事哥 v3.0 微信小程序 CI/CD 流程，基于 `miniprogram-ci` 官方工具。

## 前置条件

### 1. 密钥配置（一次性）

```bash
# 复制环境变量模板
cp .env.ci.example .env.ci
chmod 600 .env.ci

# 编辑 .env.ci 填写真实值：
#   WX_APPID=wxd441fbf3b9f10aa3
#   WX_PRIVATE_KEY_PATH=/path/to/private.key
#   WX_VERSION_PREFIX=v6.5    (可选)
#   WX_DEFAULT_DESC=CI 自动上传 (可选)
```

私钥文件获取方式：
1. 登录 [微信小程序后台](https://mp.weixin.qq.com)
2. 「开发管理」→「开发设置」
3. 「小程序代码上传密钥」→ 生成并下载

⚠️ 私钥文件放在项目目录之外（如 `~/.openclaw/media/inbound/`），`.env.ci` 和私钥文件均不回提交 Git。

### 2. IP 白名单

在微信小程序后台「开发设置」→「IP 白名单」中添加服务器公网 IP：

```
124.223.195.68
```

## 命令参考

### Preview（生成预览二维码）

```bash
source .env.ci
bash ci/before-upload.sh --preview
```

生成二维码文件：`preview-<commit>.png`
有效时间：约 25 分钟

### Upload（上传至微信后台）

```bash
source .env.ci
bash ci/before-upload.sh --upload --ver 6.5.1 --desc "fix: world rule footer"
```

⚠️ 限制：
- **Fix 分支不允许 upload**，仅允许 preview
- 只有 `release/*` 分支或合法 release tag 可以 upload
- upload ≠ 提交审核 ≠ 正式发布，需手动前往后台管理

### 开发版（不常用）

```bash
source .env.ci
bash ci/before-upload.sh --dev
```

## Git 门禁规则

上传前自动执行 `ci/gate-check.sh`，以下情况会拦截：

| 检查项 | 要求 |
|---|---|
| 分支命名 | `fix/*` 或 `release/*` |
| 工作区状态 | 干净（无未提交修改） |
| 推送状态 | 已推送且与远程一致 |
| Fix 分支 upload | ❌ 拦截。Fix 仅允许 preview |
| 分支来源 | 基于 `release/v6.5.0` |
| release 一致 | 本地 release 与远程一致 |
| Detached HEAD | 仅允许指向合法 release tag 时 upload |

## 完整工作流程

```
Fix 分支修改代码
  ↓
git commit & push
  ↓
bash ci/before-upload.sh --preview    ← 生成二维码
  ↓
用户真机扫码验收
  ↓
合并到 release/v6.5.0
  ↓
git checkout release/v6.5.0 && git pull
  ↓
bash ci/before-upload.sh --upload --ver 6.5.x --desc "..."
  ↓
微信后台手动设为体验版 / 提交审核
```

## 二维码位置

- 预览二维码：`preview-<commit>.png`（项目根目录，不提交 Git）
- 预览 Manifest：`release/wechat-ci-preview-<commit>.json`
- 上传 Manifest：`release/wechat-ci-upload-<version>.json`

## 失败排查

| 错误 | 原因 | 解决 |
|---|---|---|
| `WX_APPID` 未设置 | 未 source .env.ci | `source .env.ci` |
| 私钥文件不存在 | 路径错误或文件已删除 | 检查 `WX_PRIVATE_KEY_PATH` |
| `UPLOAD BLOCKED` | Fix 分支尝试 upload | 先合并到 release 再 upload |
| `WORKING TREE NOT CLEAN` | 有未提交的修改 | `git stash` 或 `git commit` |
| 远程不一致 | 本地未 push | `git push origin <branch>` |
| 10006 错误 | 私钥无效或过期 | 重新生成密钥 |

## 相关文件

```
.env.ci.example          # 环境变量模板（可提交 Git）
.env.ci                  # 实际配置（不提交 Git，权限 600）
ci/upload.js             # Node.js 上传脚本
ci/gate-check.sh         # Shell 门禁检查
ci/before-upload.sh      # 一键预检+上传
docs/WECHAT_CI.md        # 本文档
release/wechat-ci-*.json # 自动生成的 Manifest（不提交 Git）
```
