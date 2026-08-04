# TESTING_GUIDE.md — 测试指南

## 测试套件

```bash
npm run test:contracts    # 6个Contract测试 (29 assertions)
npm run test:fixtures     # Fixture + Regression (13+8+6 tests)
npm run test:impact       # 影响分析
npm run test:smoke        # 快速烟测 (文件存在 + 语法)
npm run test:guardrails   # 全部强制门禁
```

## 测试目录结构

```
tests/
├── contracts/            # Contract Tests (与contracts/一一对应)
│   ├── report-engine-to-contract.test.js
│   ├── report-contract-to-viewmodel.test.js
│   ├── report-viewmodel-to-poster.test.js
│   ├── world-rule-raw-to-normalized.test.js
│   ├── world-rule-normalized-to-poster.test.js
│   └── poster-export-contract.test.js
├── fixtures/             # 真实脱敏Fixtures
│   ├── reports/          # 报告样本 (6个)
│   ├── world-rules/      # 世界规则样本 (5个)
│   └── posters/          # 海报样本 (3个)
└── regression/           # 回归测试
    ├── report-fixtures-regression.test.js
    ├── world-rule-fixtures-regression.test.js
    ├── poster-data-regression.test.js
    └── semantic-quality-regression.test.js
```

## 新增测试规则

1. Contract Tests 先行
2. Fixture 变更 → 更新回归测试
3. 强制门禁失败必须 exit=1
4. 禁止修改测试掩盖失败

---

*最后更新: 2026-08-04 — Engineering Guardrails 3.0*
