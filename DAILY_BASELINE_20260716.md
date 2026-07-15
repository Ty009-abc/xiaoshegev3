# DAILY BASELINE — 2026-07-16

> V3 20260716 Daily Baseline Freeze
> Tag: v3-20260716-daily-baseline
> HEAD: 14b8a32

---

## A. 30天认知挑战 — 唯一合法链路 (CANONICAL)

```
challenge-start
  → challengeService.startChallenge()
  → startChallenge 云函数
  → challenge_records (写入)
  → challenge-play?mode=challenge&recordId=xxx
  → getChallengeEvent 云函数
  → challenge_events (30题, 只读)
  → submitChallengeChoice 云函数
  → rawScores 递增
  → normalized_v2 九维归一化
  → challenge-result (聚合)
  → report-preview (展示)
  → generateAiReport(recordId) 云函数
  → challenge_final 报告
  → normalizeChallengeFinalReport
  → AI 分析报告

STATUS: CANONICAL
```

## B. 永久退役链路 (RETIRED, DO NOT RESTORE)

| 条目 | 状态 | 说明 |
|---|---|---|
| `pages/challenge/challenge.js` | RETIRED | 旧本地挑战链，onLoad→redirectTo challenge-start |
| `eventsPool` 硬编码30题 | RETIRED | 改用云端 challenge_events |
| 客户端 `clampScore` 计分 | RETIRED | 改用云端 normalized_v2 |
| `app.globalData._challengeScores` | RETIRED | 已移除 |
| `ai-analysis` 作为 challenge_final 报告入口 | RETIRED | 重定向到 report-preview |
| `challenge-start` → `pages/challenge/challenge` | RETIRED | 现走 challenge-play?mode=challenge |

DO_NOT_RESTORE: true

---

## C. 今日关键 Commits

| Commit | 描述 |
|---|---|
| `27faa51` | challenge_final 报告字段契约修复 |
| `546545e` | rawScores + normalized_v2 九维计分 |
| `ffcd392` | 旧30天挑战链路正式退役，新云端链路接管 |
| `373a786` | V3 Canonical Development Governance V1 (20 rules) |
| `969cf30` | 小程序构建隔离 cloudfunctions/**/*.js |
| `236ab11` | startChallenge ts 作用域修复 |
| `3c8195d` | 挑战云函数 installDependency=true |
| `14b8a32` | ensureChallengeCollections 安全集合初始化器 |

---

## D. 已确认成功的模块

| # | 模块 | 状态 |
|---|---|---|
| 1 | 认知暴击独立详情页 | WORKING |
| 2 | 认知暴击二维码 | WORKING (真机已验证) |
| 3 | 世界规则首页 (280条) | WORKING |
| 4 | 世界规则详情页 (浅色主题) | WORKING |
| 5 | world_rules (COUNT=280) | PROTECTED |
| 6 | challenge_events (COUNT=30) | PROTECTED |
| 7 | 30题题库 Day 1-30 | READY |
| 8 | normalized_v2 评分代码 | CODE_READY |
| 9 | challenge_final 字段适配 | CODE_READY |

---

## E. 当前阻断点

```
CURRENT_BLOCKER: challenge_records 集合不存在
错误: -502005 DATABASE_COLLECTION_NOT_EXIST
定位: startChallenge 云函数 → db.collection('challenge_records').add({...})
```

已确认以下模块 **DO NOT REOPEN**:
- 旧挑战入口问题
- wx-server-sdk 依赖
- ts 作用域
- 30题题库存在性
- report-preview 字段契约
- normalized_v2 设计

**NEXT_ACTION_ONLY**: 创建空 challenge_records 集合

---

## F. 数据库保护基线

```
PROTECTED_COLLECTIONS:
- world_rules      COUNT = 280  PROTECTED = true
- challenge_events COUNT = 30   PROTECTED = true

challenge_records:
  CURRENT_STATUS = MISSING
  NEXT_ACTION     = CREATE_EMPTY_COLLECTION

禁止: clear / remove / deleteMany / drop / reseed / initDatabase (涉及以上集合)
```

---

## G. 云函数部署基线

| 函数 | package.json | SDK in deps | installDependency | 本地commit | 部署状态 |
|---|---|---|---|---|---|
| startChallenge | ✅ | ✅ latest | ✅ true | 236ab11 | deployed |
| getChallengeEvent | ✅ | ✅ latest | ✅ true | 部署中 | deployed |
| submitChallengeChoice | ✅ | ✅ latest | ✅ true | 部署中 | deployed |
| getChallengeRecord | ✅ | ✅ latest | ✅ true | 部署中 | deployed |
| generateAiReport | ✅ | ✅ ~2.6.3 | ✅ true | 已部署 | deployed |

---

## TOMORROW_START_HERE

### Step 1 — 确认 HEAD 和 tag
```bash
cd /home/ubuntu/xiaoshige-v3/xiaoshige-v3
git checkout master
git log --oneline -3
# HEAD should be 14b8a32 or later
```

### Step 2 — 确认 world_rules = 280
```bash
tcb fn invoke getWorldRules --env-id fanshex-d2g0adgv7dfbc9bdc
```

### Step 3 — 确认 challenge_events = 30
```bash
tcb fn invoke ensureChallengeCollections --env-id fanshex-d2g0adgv7dfbc9bdc
```

### Step 4 — 创建 challenge_records 集合
集合已在云端通过 ensureChallengeCollections 创建。验证：
```bash
tcb fn invoke ensureChallengeCollections --env-id fanshex-d2g0adgv7dfbc9bdc
```
应返回 challenge_records: existedAlready=true, count=0

### Step 5 — 真机点击 30 天挑战

**成功标准**：
```
[ChallengeV2Start] {
  recordId: "CR...",          // 非空
  scoringVersion: "normalized_v2",
  hasRawScores: true,
  choicesLength: 0
}
```

### Step 6 — 只测试 3 题

日志应显示：
```
[ChallengeV2Choice] rawScores changes correctly per question
```

### Step 7 — 确认 rawScores 变化

### Step 8 — 再决定是否进行 30 题完整 E2E

**禁止明天重新审计或重新修改**: 旧入口退役 / ts作用域 / SDK依赖 / 计分架构

---

## PACKAGE INFO

```
PACKAGE: xiaoshige-v3-baseline-20260716.tar.gz
HEAD:    14b8a32
TAG:     v3-20260716-daily-baseline
STATUS:  CLEAN
```
