# ARCHITECTURE_FACT_SOURCE.md

## Turnaround OS V6 唯一事实源架构

**版本**: 6.0  
**状态**: ENFORCED

---

## 事实链（单向，不可逆）

```
┌─────────┐
│ Identity │  用户原始输入 → 标准化画像
│ Engine   │  输出: profile
└────┬────┘
     │
┌────▼───────┐
│ WrongGame  │  识别错误游戏模式
│ Engine     │  输出: wrongGameResult
└────┬───────┘
     │
┌────▼────────┐
│ Leverage    │  评分并选择主杠杆
│ Engine      │  输出: leverageResult
└────┬────────┘
     │
     │     ┌─────────────────────────────┐
     │     │                             │
┌────▼─────▼────┐                        │
│  Turnaround   │  聚合 Identity +       │
│  Strategy     │  WrongGame + Leverage  │
│  Engine       │  → 完整战略输出        │
│               │                        │
│  ★ 唯一事实源 ★                       │
│               │                        │
│  提供:        │                        │
│  - verdict    │                        │
│  - summary    │                        │
│  - wrongGame  │                        │
│  - leverage   │                        │
│  - evidence   │                        │
└────┬──────────┘                        │
     │                                    │
     │  所有下游模块必须从此读取，        │
     │  不得重新调用上游 Engine           │
     │                                    │
┌────▼────────────┐                       │
│  Destiny        │  双路径命运推演       │
│  Projection     │  输入: profile +     │
│  Engine         │  wrongGame* +        │
│                 │  strategy +          │
│                 │  leverageResult*     │
│                 │  * 仅 WorldA/B       │
│                 │  需要 raw 数据       │
└────┬────────────┘                       │
     │                                    │
┌────▼────────────┐                       │
│  Mission        │  任务计划生成         │
│  Engine         │  ★ 消费者 ★          │
│  (未来)         │  输入: profile +     │
│                 │  strategy +          │
│                 │  projection          │
│                 │  ←───────────────────┘
│                 │  禁止: 调用任何       │
│                 │  上游 Engine          │
└────┬────────────┘
     │
┌────▼────────────┐
│  Coach          │  AI 层（未来）
│  (未来)         │  基于所有上游事实
│                 │  追加 AI 增强
└────┬────────────┘
     │
┌────▼────────────┐
│  Adapter        │  V4 兼容层（未来）
│  (未来)         │  桥接 V6 → V4
└─────────────────┘
```

---

## 禁止重新推导的原则

```
Every downstream module MUST NOT re-derive:
  → Wrong Game detection
  → Leverage scoring
  → Strategy generation
  → Destiny projection

These facts are authoritative once computed upstream.
```

### 具体禁止

| 模块 | 禁止调用 |
|------|---------|
| Mission | buildIdentity(), detectWrongGame(), determineLeverage(), generateStrategy(), projectDestiny() |
| Coach | detectWrongGame(), determineLeverage(), generateStrategy(), projectDestiny() |
| Adapter | 任何 V6 Engine — 仅转换数据结构 |

---

## Strategy 作为唯一事实源的内容

strategy (generateStrategy 输出) 聚合了：

| 来源 | strategy 中的位置 |
|------|-----------------|
| Identity 摘要 | strategy.identitySummary |
| WrongGame 结果 | strategy.wrongGame |
| Leverage 选择 | strategy.primaryStrategy.primaryLeverage |
| 综合判断 | strategy.verdict (headline, confidence, assumptions, limitingFactors) |
| 证据链 | strategy.evidence (ruleHits, sourceFields) |

**下游模块应优先从 strategy 取值，而非从上游中间结果取值。**

---

## 违规检测清单

Code review 时检查：

1. grep `require.*identityEngineV6` — 不允许在 Mission / Coach / Adapter 中出现
2. grep `require.*wrongGameEngineV6` — 同上
3. grep `require.*leverageEngineV6` — 同上
4. grep `require.*turnaroundEngineV6` — 不允许在 Coach / Adapter 中（Mission 可引用其输出但不重新调用）
5. grep `require.*destinyProjectionEngineV6` — 不允许在 Coach / Adapter 中
