# LEGACY_REGISTRY.md
<!-- 旧实现下线追踪 — 任何新系统上线后，旧系统必须进入此表 -->

| LEGACY_ID | OLD_PATH | REPLACED_BY | STATUS | REDIRECT | DELETE_COMMIT | DATE |
|---|---|---|---|---|---|---|
| LEGACY_CHALLENGE_V1 | `pages/challenge/challenge.js` | `pages/challenge-play` | RETIRED | `redirectTo challenge-start` | `ffcd392` | 2026-07-15 |
| LEGACY_CHALLENGE_WXML | `pages/challenge/challenge.wxml` | — | RETAINED (empty template) | — | — | 2026-07-15 |
| LEGACY_CHALLENGE_WXSS | `pages/challenge/challenge.wxss` | — | RETAINED (empty) | — | — | 2026-07-15 |
| LEGACY_CHALLENGE_JSON | `pages/challenge/challenge.json` | — | RETAINED (config only) | — | — | 2026-07-15 |
| LEGACY_APP_JSON_ROUTE | `app.json "pages/challenge/challenge"` | — | DELETED | — | `ffcd392` | 2026-07-15 |
| LEGACY_LOCAL_EVENTS_POOL | `challenge.js eventsPool` | `challenge_events` DB | RETIRED | — | `ffcd392` | 2026-07-15 |
| LEGACY_LOCAL_CLAMP_SCORE | `challenge.js local clampScore` | `scoring.js normalizeScores` | RETIRED | — | `ffcd392` | 2026-07-15 |
| LEGACY_GLOBALDATA_SCORES | `app.globalData._challengeScores` | `challenge_records` DB | DELETED | — | `ffcd392` | 2026-07-15 |
| LEGACY_AI_ANALYSIS_CHALLENGE | `pages/ai-analysis/ai-analysis.js` (challenge_final) | `pages/report-preview` | REDIRECTED | `redirectTo report-preview` | `ffcd392` | 2026-07-15 |
| LEGACY_DARK_THEME_RULE_DETAIL | `world-rule-detail` dark theme | Light theme `#F5F7FB` | RETIRED | — | `fa0229c` | 2026-07-15 |

## STATUS VALUES

- `RETIRED` — 旧代码已移除或重写为最小重定向桩
- `REDIRECTED` — onLoad 自动跳转到 canonical 入口
- `RETAINED` — 保留但仅作为骨架（空模板）
- `DELETED` — 已物理删除
- `PENDING` — 已识别但尚未处理

## RESIDUE SCAN LOG

| Date | Scanned | Results |
|---|---|---|
| 2026-07-15 | `_challengeScores` | 0 hits ✅ |
| 2026-07-15 | `eventsPool` | 0 hits ✅ |
| 2026-07-15 | `clampScore` | 0 hits ✅ |
| 2026-07-15 | `goToReport` | 0 hits ✅ |
