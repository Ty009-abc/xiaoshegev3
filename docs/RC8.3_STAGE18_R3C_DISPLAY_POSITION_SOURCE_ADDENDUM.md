# RC8.3 Stage 18-R3C — Display Position Source Addendum

Status: CONTRACT ADDENDUM (DESIGN ONLY). 未改 production/client/cloud function，未 deploy，未切 MODE。
Date: 2026-08-28
Base: docs/RC8.3_STAGE18_R3B_RESPONSE_VALIDITY_ADDENDUM.md §2（position source 的定义与 fallback）
Authority priority: **R3C > R3B > R3A > R3 > R2 > R1**（本文件仅在 display-position / response-validity source 范围内 override）

---

## 1. Scope

本 addendum **只**裁定 response-validity 的 position source 最终定义，并废止 R3B 中为「randomization 尚未实现」保留的 semantic-optionId fallback。不重新设计 questionnaire / inference / thresholds，不修改 R1/R2/R3/R3A/R3B 原文。

## 2. Freeze the Source

```
RESPONSE_VALIDITY_POSITION_SOURCE = DISPLAY_POSITION
```

当 `DISPLAY_ORDER_RANDOMIZATION` 已实现时，以下「位置模式」检测**必须**基于用户实际看到并点击的 `displayPosition`：

- `SAME_POSITION_RATE`
- `ANSWER_ENTROPY`（当基于 position distribution 计算时）
- `alternating`
- `sequential`

**不得**基于 `semanticOptionId` 作为 position-pattern detector 的来源。

## 3. Strict Data Separation（两个独立数据通道）

```
semanticOptionId  → cognition inference ONLY
displayPosition   → response-validity ONLY
```

**禁止**：
- `displayPosition` → atomic evidence → typed signal → dimension → blindSpot（displayPosition 永不进入认知链）。
- `semanticOptionId` 作为 position-pattern detector 的替代来源（反之亦然）。

## 4. Remove R3B Fallback for V2.1

R3B §2 中「randomization 尚未实现的 shadow 首版中，可用 semantic optionId 字母作为 position fallback」——**对 `world_model_v2_1` 正式废止**。

- V2.1 contract 已要求 `DISPLAY_ORDER_RANDOMIZATION = REQUIRED`（R3 §C），因此不存在需要 semantic-optionId position fallback 的合规 V2.1 shadow implementation。
- 若 `displayPosition` 缺失：position-derived response-validity signals = **UNKNOWN**。**不得**从 `semanticOptionId` 推断 display position。

## 5. Payload Contract

V2.1 client 每个 answer 最小结构：

```json
{ "questionId": "SC_DEC_01", "optionId": "A", "displayPosition": 2 }
```

- `optionId` = 稳定 semantic option ID（cognition 用）。
- `displayPosition` = 用户本次实际看到的展示位置，**transport metadata**。

**DISPLAY_POSITION_ENCODING（本 addendum 选定，不再留给 009 猜）**：

```
displayPosition = 0 | 1 | 2 | 3   (0-based integer)
```

- 采用 0-based integer，**不再编码成 A/B/C/D**，避免与 semantic option ID 混淆。
- 若某题展示位置为 `[C, A, D, B]`，用户点击第 3 个 → `displayPosition = 2`（对应 semantic `optionId = "D"`）。

## 6. Server Trust Boundary

- **cognition inference**：只读 `questionId` + `optionId`。
- **response-validity**：可读 `displayPosition`，但 `displayPosition` 是 **client metadata**，仅用于 response-quality diagnostics，**不得当作认知事实**。
- 缺失/非法 `displayPosition`：**不得**导致 cognitive deficit；position-derived validity signals = **UNKNOWN**。

## 7. Shuffle Invariant（acceptance property）

同一组 semantic answers，在不同 display orders 下：

```
COGNITIVE_INFERENCE_DIFF = 0
```

允许 `RESPONSE_VALIDITY_POSITION_SIGNALS` 因实际点击位置不同而不同。即：

- **semantic meaning**：invariant（语义隔离）。
- **position behavior**：diagnostic variable（可随 display order 变化）。

两者必须隔离，互不污染。

## 8. Authority Priority

```
R3C > R3B > R3A > R3 > R2 > R1
```

R3C 仅在 display-position / response-validity source 范围内 override R3B；其余契约不变。

**STOP。** 未改 production/client/cloud function，未 deploy，未切 MODE，未改 DB。
