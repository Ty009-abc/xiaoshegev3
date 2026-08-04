# RELEASE_PROCESS.md — 完整发布流程

> 固化 20 步发布流程。不得删减。

## 标准发布流程

### Phase 1: 准备

1. 从 `release/*` 建立 `fix/*` 或 `build/*` 分支
2. 创建 `.changes/current-change.json` 变更清单
3. 诊断根因并记录

### Phase 2: 契约与测试

4. 契约测试先行（`npm run test:contracts`）
5. 增加或更新真实 Fixture
6. 修改代码（仅限 `allowedFiles` 内）

### Phase 3: 验证

7. 自动影响范围分析（`node ci/impact/analyze-impact.js`）
8. 全部强制测试（`npm run test:guardrails`）
9. Git Commit
10. Push GitHub

### Phase 4: 预览与验证

11. CI Preview（`bash ci/before-upload.sh --preview`）
12. 用户扫码真机验证（见 `docs/SMOKE_MATRIX.md`）
13. `git merge release/<version>` — `--no-ff`
14. Release Preview
15. 用户再次快速验证

### Phase 5: 发布

16. Tag: `git tag -a v<version> -m "Release v<version>"`
17. CI Upload
18. 微信后台设体验版
19. 体验版最终验证
20. 提交审核或正式发布

## 门禁矩阵

| 步骤 | 门禁 | 失败后果 |
|------|------|---------|
| 修改 | 不超过 `allowedFiles` | BLOCKED |
| 修改 | 冻结模块需 FRZ_CHG_REQ | BLOCKED |
| 测试 | Contract Tests | exit 1 → BLOCKED |
| 测试 | Fixture Regression | exit 1 → BLOCKED |
| 测试 | Semantic Tests | exit 1 → BLOCKED |
| Preview | 工作区干净 | BLOCKED |
| Preview | 分支非 release | BLOCKED |
| Upload | HEAD=远程 | BLOCKED |
| Upload | Tag指向当前HEAD | BLOCKED |
| Upload | Fix分支禁止 | BLOCKED |

## 禁止事项

- 真实 Upload 前必须真机验证
- 禁止 Merge release 前未通过真机验证
- 禁止 Fix 分支 Upload
- 禁止通过修改测试掩盖失败
- 禁止 Merged without --no-ff

---

*最后更新: 2026-08-04 — Engineering Guardrails 3.0*
