# P0 修复架构图 — Circuit Breaker + Retry + Dynamic Token Budget + Timeout

```
                    ┌─────────────────────────────────────────────┐
                    │            runAI (总入口)                      │
                    │   aiEngine.js v3.1                          │
                    └──────────────┬──────────────────────────────┘
                                   │
    ┌──────────────────────────────┼──────────────────────────────┐
    │                                                                 │
    ▼                                                                 │
┌───────────────┐                                                      │
│ 1. Intent     │  routeIntent(input)                                  │
│    Router     │  → ai_chat / coaching / report / challenge           │
└───────┬───────┘                                                      │
        ▼                                                              │
┌───────────────┐                                                      │
│ 2. Cost       │  checkCostGuard(db,openid)                           │
│    Guard      │  ¥500/日 → free用户降级 Lite                         │
└───────┬───────┘                                                      │
        ▼                                                              │
┌───────────────┐                                                      │
│ 3. Model      │  selectModel(scene, user)                            │
│    Selector   │  Pro / Standard / Lite                               │
└───────┬───────┘                                                      │
        ▼                                                              │
┌───────────────┐     ┌─────────────────────────────────┐             │
│ 4. Cache      │────▶│ HIT? → 直接返回 ✅               │             │
│    Check      │     │ MISS? → 继续 ⬇                   │             │
└───────┬───────┘     └─────────────────────────────────┘             │
        ▼                                                              │
┌───────────────────────────────────────────────────────┐             │
│ 5. Dynamic Token Budget (MAX 3000)                     │             │
│                                                        │             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │             │
│  │ SYSTEM   │  │ RAG      │  │ MEMORY   │  │ USER   │ │             │
│  │ 500 tok  │  │ 900 tok  │  │ 700 tok  │  │ 900 tok│ │             │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘ │             │
│                                                        │             │
│  超预算 → 按 relevance/importance 裁剪 chunk           │             │
│  未用满 → 转给 USER_CONTEXT (redistribution)           │             │
│  裁剪优先级: RAG(0) < MEMORY(1) < SYSTEM(2) < USER(3)  │             │
└───────────────────────┬───────────────────────────────┘             │
                        ▼                                              │
┌───────────────────────────────────────────────────────┐             │
│ 6. System Prompt Builder                               │             │
│    systemPrompt + [Memory] + [RAG] + userMessage       │             │
└───────────────────────┬───────────────────────────────┘             │
                        ▼                                              │
         ┌──────────────────────────────┐                             │
         │     ⚡ CIRCUIT BREAKER        │  ◀── NEW                    │
         │                              │                             │
         │  ┌─────┐  5 fail  ┌─────┐   │                             │
         │  │CLOSED│────────▶│OPEN  │   │  30s recovery               │
         │  └─────┘          └──┬──┘   │                             │
         │       ▲              │      │                             │
         │       │    success   │      │                             │
         │       │    ┌─────────┘      │                             │
         │       │    ▼               │                             │
         │       │  ┌────────┐        │  3 requests probe            │
         │       └──│HALF_OPEN│◀──────┘                             │
         │          └────────┘                                       │
         │          fail → re-OPEN                                   │
         │                                                           │
         │  OPEN时: fallback → "AI 引擎暂时过载 🔧"                   │
         └──────────────┬───────────────┘                             │
                        ▼                                              │
         ┌──────────────────────────────┐                             │
         │  7. LLM Call with Retry       │  ◀── NEW                    │
         │                              │                             │
         │  ┌─ attempt 0 ──────────────┐│  Timeout: 12s hard          │
         │  │  ● timeout?              ││  3s soft → 返回 loading      │
         │  │  ● 429?                  ││                             │
         │  │  ● 5xx?                  ││  maxRetries: 2               │
         │  │  ● network?              ││  backoff: 1s → 2s → 4s       │
         │  │    └─ YES → attempt +1   ││                             │
         │  │  ● 4xx? (never retry)    ││  Never retry:                │
         │  │    └─ NO → FAIL fast     ││    ● 4xx errors              │
         │  └──────────────────────────┘│    ● auth errors             │
         └──────────────┬───────────────┘                             │
                        ▼                                              │
┌───────────────┐                                                      │
│ 8. Response   │  parseResponse()                                     │
│    Parser     │                                                      │
└───────┬───────┘                                                      │
        ▼                                                              │
┌───────────────┐                                                      │
│ 9. Safety     │  safetyFilter() → 敏感词检测                         │
│    Filter     │  4 种模式: filterText / BLOCK_PATTERNS / etc        │
└───────┬───────┘                                                      │
        ▼                                                              │
┌───────────────┐                                                      │
│ 10. Cache     │  setCache() → TTL按场景                              │
│     Write     │                                                      │
└───────┬───────┘                                                      │
        ▼                                                              │
┌───────────────┐                                                      │
│ 11. Log       │  ai_logs: tokens / retriesUsed / breakerState /      │
│     Output    │  budgetTruncated / fallback / model                  │
└───────────────┘                                                      │
        │                                                              │
        ▼                                                              │
    ┌───────────────────────┐                                          │
    │  Return to User       │                                          │
    │  { success, data,     │                                          │
    │    retriesUsed,       │                                          │
    │    breakerState,      │                                          │
    │    budgetSummary }    │                                          │
    └───────────────────────┘                                          │
```

## Failure Scenarios & Recovery

```
Scenario 1: LLM 超时
  attempt 0 → timeout 12s → retry (1s delay)
  attempt 1 → timeout 12s → retry (2s delay) 
  attempt 2 → timeout 12s → exhausted
  → fallback: "AI 引擎暂时过载，小事哥正在抢修中 🔧"
  → breaker failureCount +1

Scenario 2: LLM 持续 5xx
  call ×5 → each fails → breaker hits threshold 5
  → breaker: CLOSED → OPEN
  → 30s 内所有请求 → fallback (不调 LLM)
  → 30s 后 → HALF_OPEN, 3 次探活
  → 全部成功 → CLOSED
  → 任何失败 → re-OPEN

Scenario 3: RAG 爆了 (大量知识)
  → allocateBudget() → RAG budget 900
  → trimChunksByRelevance() → 按 relevanceScore 排序
  → 保留高相关性 top chunks
  → 如果 MEMORY/SYSTEM 未用满 → redistribute 给 USER_CONTEXT

Scenario 4: 免费用户超 ¥500/日
  → checkCostGuard() → overBudget = true
  → 强制降级 Lite 模型
  → 付费用户不受影响

Scenario 5: 正常调用 (happy path)
  → breaker CLOSED
  → retry 0 times
  → budget within limits
  → cache miss → LLM call → cache write
  → return data
```
