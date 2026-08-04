# CONTRACTS.md — 契约体系说明

> 所有 Validator 统一返回结构：`{ ok, errors, warnings, metadata }`。
> 禁止只返回 `true/false`。

## 契约文件

| 契约 | 路径 | 校验对象 |
|------|------|---------|
| Report Contract | `contracts/report/turnaroundReportV4.contract.js` | Engine→Report 完整结构 |
| Poster Contract | `contracts/report/turnaroundPoster.contract.js` | 海报展示数据 |
| World Rule Contract | `contracts/world-rule/normalizedWorldRule.contract.js` | 世界规则规范化 |
| World Rule Poster | `contracts/world-rule/worldRulePoster.contract.js` | 世界规则海报 |
| Poster Export | `contracts/poster/posterExport.contract.js` | 导出尺寸/内容 |

## 契约定义的数据流

```
Engine Result
  → ReportContract.validate()
  → ReportMapper.map()
  → Normalizer.build()
  → PosterContract.validate()
  → Renderer.draw()
```

## 必检项

- verdict 非空（headline 或 mainProblem）
- contradiction.code 非 FALLBACK
- decision.code 非空或 provisional
- potential.score 0-100
- primaryAction.title/checkpoint 非空
- Canvas 尺寸 ≥ 100×100
- worldRule ≠ underlyingLogic
- Raw 对象不传入 Renderer

---

*最后更新: 2026-08-04 — Engineering Guardrails 3.0*
