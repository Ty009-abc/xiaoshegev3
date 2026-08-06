# EMERGENCY_BYPASS_APPROVAL.md
- 原因: release/v6.5.0 上 scripts/test-contracts.js 不存在（在 guardrails 分支才存在），pre-push hook 失败
- 批准人: 009 (吕剑方)
- 时间: 2026-08-04 21:55 GMT+8
- 补偿测试: tests/rc6-destiny-engine.test.js — 89/89 PASS
- 补偿集成测试: full mapper→normalizer→poster chain verified
