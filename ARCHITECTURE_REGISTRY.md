# ARCHITECTURE_REGISTRY.md
<!-- V3 功能所有权清单 — 每个功能只有一条生产链路 -->

## FEATURE: 30_DAY_CHALLENGE（30天认知挑战）

```
ENTRY:           pages/challenge-start
RUNTIME_PAGE:    pages/challenge-play
CLOUD_START:     cloudfunctions/startChallenge
CLOUD_EVENT:     cloudfunctions/getChallengeEvent
CLOUD_CHOICE:    cloudfunctions/submitChallengeChoice
CLOUD_REPORT:    cloudfunctions/generateAiReport
DATA_SOURCE:     challenge_events (30 events)
STATE_SOURCE:    challenge_records
SCORING:         cloudfunctions/submitChallengeChoice/lib/scoring.js
RESULT:          pages/challenge-result
REPORT:          pages/report-preview
LEGACY:          pages/challenge/challenge → RETIRED (ffcd392)
LEGACY:          pages/ai-analysis (challenge_final) → REDIRECTED (ffcd392)
```

## FEATURE: DIAGNOSTIC_10Q（翻身策略诊断）

```
ENTRY:           pages/home → challenge-play?mode=diagnostic
RUNTIME_PAGE:    pages/challenge-play
CLOUD_START:     cloudfunctions/startChallenge
CLOUD_REPORT:    cloudfunctions/generateAiReport
DATA_SOURCE:     DIAGNOSTIC_QUESTIONS (local, 10 questions)
STATE_SOURCE:    challenge_records
ENGINE:          cloudfunctions/generateAiReport/lib/turnaroundEngine.js
SCORING:         turnaroundEngine (not challenge scoring)
RESULT:          pages/report-detail
REPORT:          pages/report-preview
```

## FEATURE: WORLD_RULES（世界规则）

```
ENTRY:           pages/home → pages/world-rules
LIST_PAGE:       pages/world-rules
DETAIL_PAGE:     pages/world-rule-detail
CLOUD_LIST:      cloudfunctions/getWorldRules
CLOUD_DETAIL:    cloudfunctions/getWorldRuleDetail
DATA_SOURCE:     world_rules (280 rules)
THEME:           LIGHT (#F5F7FB) — fa0229c
RESTORE:         cloudfunctions/restoreWorldRules
SEED_SOURCE:     backup/authoritative_world_rules_280.js
```

## FEATURE: COGNITIVE_SHOCK（认知暴击）

```
ENTRY:           pages/home → cognitive-shock-detail
DETAIL_PAGE:     subpkg-ai/cognitive-shock-detail
CLOUD_QR:        cloudfunctions/getUnlimitedQR
QR_HANDLER:      cognitive-shock-detail.js → _ensureQrCode()
POSTER:          share/posters/index.js
```

## FEATURE: PAYMENT（支付/会员）

```
ENTRY:           pages/membership
CLOUD:           cloudfunctions/paymentCheck
DATA:            memberships / users
PERMISSION:      cloudfunctions/checkPermission
```

## CLOUD FUNCTION BASELINE (2026-07-16)

| Function | Deploy Status | installDependency | package.json |
|---|---|---|---|
| startChallenge | ✅ deployed | true | wx-server-sdk: latest |
| getChallengeEvent | ✅ deployed | true | wx-server-sdk: latest |
| submitChallengeChoice | ✅ deployed | true | wx-server-sdk: latest |
| getChallengeRecord | ✅ deployed | true | wx-server-sdk: latest |
| generateAiReport | ✅ deployed | true | wx-server-sdk: ~2.6.3 |
| ensureChallengeCollections | ✅ deployed | true | wx-server-sdk: latest |

## CLOUD FUNCTIONS REGISTRY

| Function | Status | Depends On |
|---|---|---|
| startChallenge | ACTIVE | challenge_records, users, memberships |
| getChallengeEvent | ACTIVE | challenge_records, challenge_events |
| submitChallengeChoice | ACTIVE | challenge_records, challenge_events, lib/scoring.js |
| generateAiReport | ACTIVE | challenge_records, ai_reports, lib/ai.js, lib/turnaroundEngine.js, lib/scoring.js |
| ensureChallengeCollections | ACTIVE | (collection admin) |
| getWorldRules | ACTIVE | world_rules |
| getWorldRuleDetail | ACTIVE | world_rules |
| getUnlimitedQR | ACTIVE | wxacode.getUnlimited, cloud.uploadFile |
| restoreWorldRules | STANDBY | world_rules (upsert) |
| initDatabase | PROTECTED | world_rules, challenge_events (PROTECTED_COLLECTIONS guard) |
| seedWorldRulesV2 | STANDBY | world_rules |
| checkPermission | ACTIVE | users, memberships |
| adminGetUsers | ACTIVE | users |
| adminUpdateUser | ACTIVE | users |
| adminGetAnalytics | ACTIVE | analytics data |

## SHARED MODULES

| Module | Consumers |
|---|---|
| services/challengeService.js | challenge-start, challenge-play, challenge-result |
| services/aiReportService.js | report-preview |
| services/worldRuleService.js | world-rules, world-rule-detail |
| services/permissionService.js | multiple |
| cloudfunctions/*/lib/scoring.js | submitChallengeChoice, generateAiReport, startChallenge |
| cloudfunctions/*/lib/response.js | generateAiReport |
| utils/personalityModes.js | home, challenge-play, ai-analysis |
