# KNOWN_ISSUES.md — 已知问题

---

## V6.5.0-rc1

### P1 — 影响功能

| # | 问题 | 影响 | 处理 |
|---|---|---|---|
| KI-01 | V6 7-Card WXML 尚未映射 | 报告详情页仍使用 V4 渲染结构，V6 Hero/Insight/Potential 等卡片 UI 不显示 | 下一迭代进行 WXML wire-up。CP6-F experience contracts 已就位 |
| KI-02 | `pages/challenge/challenge` 为孤儿路由 | app.json 中存在但无有效 UI | 已列入下次清理 |

### P2 — 边角情况

| # | 问题 | 影响 | 处理 |
|---|---|---|---|
| KI-03 | 10 个页面缺 onUnload | splash/onboarding/challenge-start/cognition-daily/insight-list/world-rules/world-rule-detail/payment-result/growth-ranking/challenge-ranking | 非高频页面，异常暴露概率低。延迟修复 |
| KI-04 | membership setTimeout 可能在页面销毁后触发 | 支付成功后快速返回，navigateBack 延迟可能失效 | 已添加 `_navTimer` + onUnload 清理 |
| KI-05 | share-poster setTimeout 未清理 | 海报生成后退出页面 | 延迟影响小（生成在 onLoad 完成） |
| KI-06 | userService.js 顶层 `getApp()` 调用 | Node.js 环境 import 时报错 | 小程序环境正常。发布前无需修复 |

### P3 — 优化建议

| # | 问题 | 建议 |
|---|---|---|
| KI-07 | cloudbaserc.json 包含默认 API Key | 建议初始化脚本替换为占位符，或迁移到云函数环境变量 |
| KI-08 | 部分云函数 `installDependency: false` 但实际需要 npm 包 | 部署时会自动安装，但建议统一配置 |
| KI-09 | 22MB 包体偏大 | 考虑图片压缩 + 按需分包加载 |

---

## 兼容性

| 平台 | 基础库 | 状态 |
|---|---|---|
| iOS 微信 | 8.0.x | ✅ 兼容 |
| Android 微信 | 8.0.x | ✅ 兼容 |
| 微信开发者工具 | 1.06.xx | ✅ 兼容 |
| 真机 iPhone | 待测试 | ⚠️ 开发版未验证 |
| 真机 Android | 待测试 | ⚠️ 开发版未验证 |

---

## 下一版本计划

1. V6 7-Card WXML wire-up（CP6-F UI 接入）
2. 真机多尺寸兼容测试
3. 孤儿路由清理
4. 包体优化（图片压缩 + 分包）
5. Payment 生产环境联调
