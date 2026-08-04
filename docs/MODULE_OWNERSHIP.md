# MODULE_OWNERSHIP.md — 模块职责与冻结区

> 每个模块有明确的允许职责和禁止职责。
> 修改冻结模块前必须先提交 `FROZEN_MODULE_CHANGE_REQUEST`。

## 模块职责

### Report Engine
| 允许职责 | 禁止职责 |
|---------|---------|
| 基于规则生成结构化结论 | 生成 Canvas / UI |
| 返回 fatalRule / advantageRule | 输出文字文案 |
| 计算 score / overall | 操作 DOM / Page |

**路径**: `cloudfunctions/generateAiReport/lib/engine/`

### Report Contract
| 允许职责 | 禁止职责 |
|---------|---------|
| 定义输出数据结构 | 包含业务逻辑 |
| 提供 skeleton 工厂 | 自行填充数据 |
| 作为 Validator 的 schema 来源 | 修改后不更新 tests/contracts |

**路径**: `cloudfunctions/generateAiReport/lib/report/reportContractV4.js`

### Report Mapper
| 允许职责 | 禁止职责 |
|---------|---------|
| Engine Result → Contract 的字段转换 | 创造新事实 / 新结论 |
| 确定性映射（同一输入 → 同一输出） | 生成 AI 文案 |
| 类型安全守卫 | 自行修改原始数据 |

**路径**: `cloudfunctions/generateAiReport/lib/report/reportMapperV4.js`

### Renderer
| 允许职责 | 禁止职责 |
|---------|---------|
| 基于 Contract 数据绘图 | 推理、判断、改写内容 |
| Canvas 2D 渲染 | 补充 Contract 中没有的字段 |
| 响应 Canvas 尺寸 | 1×1 Canvas 导出 |

**路径**: `share/posters/`

### PosterService
| 允许职责 | 禁止职责 |
|---------|---------|
| 海报导出、保存、权限 | 生成内容 |
| 文件格式转换 | 修改 Contract 数据 |
| 临时文件管理 | 调用引擎 |

**路径**: `share/PosterService.js`（冻结区）

### Normalizer
| 允许职责 | 禁止职责 |
|---------|---------|
| 字段重命名、类型转换 | 重算结论 |
| 提供兼容层 | UI 绘制 |
| 字段退化处理 | 创造新字段 |

**路径**: `utils/reportNormalizerV4.js`

### Page
| 允许职责 | 禁止职责 |
|---------|---------|
| 展示 Contract / ViewModel | 重算 Decision / Verdict |
| 响应用户交互 | 修改引擎输出 |
| 调用 Normalizer | 直接访问 Raw 对象 |

**路径**: `pages/`

### CI
| 允许职责 | 禁止职责 |
|---------|---------|
| 检查、预览、上传 | 修改业务逻辑 |
| 运行测试门禁 | 跳过失败测试 |
| 环境配置 | 变更代码 |

**路径**: `ci/`（冻结区）

## 冻结模块

以下路径为冻结区，修改前必须提交 `FROZEN_MODULE_CHANGE_REQUEST`：

```
share/PosterPrimitives.js
share/PosterService.js
core/turnaround-intelligence/**
core/turnaround-os/**
ci/**
```

### 冻结模块变更请求格式

```
FROZEN_MODULE_CHANGE_REQUEST
- 修改路径: <path>
- 修改原因: <why>
- 调用方影响: <affected callers>
- 替代方案: <alternatives>
- 测试计划: <test plan>
- 回滚方案: <rollback>
```

未经批准不得修改。

## 跨层数据流

```
Engine Result
  ↓
Report Contract (reportContractV4.js)
  ↓
Report Mapper (reportMapperV4.js)
  ↓
Normalizer (reportNormalizerV4.js)
  ↓
ViewModel
  ↓
Page / Renderer
```

禁止跨层访问：Page 不能直接读 Engine Result，Renderer 不能直接读 Raw 对象。

---

*最后更新: 2026-08-04 — Engineering Guardrails 3.0*
