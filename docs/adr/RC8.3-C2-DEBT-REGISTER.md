# RC8.3 C2 Architecture Debt Register

## Status: C2 COMPLETE → C3 GATE

C2 is accepted and frozen. Below 3 debts must be resolved before C3 Blind Spot inference begins.

---

## P1 — TEXT_RULE_PARSER_DEBT

**Evidence:**
36 of 62 suppression triggers in `secondarySignalEvidenceMap.js` are free-text natural-language strings that the current structured parser cannot execute.

**Impact:**
Silent non-evaluation risk — free-text triggers are never matched, falling through to contradiction-first path (contradictoryEvidence) and structured triggers (`SIGNAL_ID detected ≥ X.X`). All 23 signals have at least one of these fallback paths, so no signal is completely un-suppressable. But the finer-grained suppression semantics encoded in free-text triggers are lost.

**Signals affected:**
All 23 signals have at least 1 free-text trigger (total 36). `CROSS_DOMAIN_FEEDBACK_THINKING` is the worst case — all 3 triggers are free-text, relying solely on 2 contradictoryEvidence items for suppression.

**Required C3 action:**
Replace executable natural-language rules with structured predicates:
```js
{
  operator: "AND" | "OR",
  conditions: [
    { signalId: "...", detected: true|false, minConfidence: 0.x }
  ]
}
```

**Status:** BLOCKING_FOR_C3

---

## P2 — INSUFFICIENT_SCORE_HALVING_HEURISTIC

**Evidence:**
`secondarySignalExtractor.js` halves the raw score when signal state is `INSUFFICIENT_EVIDENCE`. This behavior is not specified in `secondarySignalEvidenceMap.js` or any architecture document.

**Impact:**
- **Current:** Display/presentation only — does not affect state transitions (ACTIVE/SUPPRESSED/INSUFFICIENT)
- **Future risk:** If C3 Blind Spot inference consumes secondary signal scores, insufficient-evidence signals will be systematically underestimated

**Required C3 action:**
Either:
- (A) Formalize score halving in evidence contracts with explicit `insufficientScoreRule`, or
- (B) Remove the heuristic and let downstream consumers decide how to weight INSUFFICIENT signals

**Status:** BLOCKING_FOR_C3

---

## P2 — SERENDIPITOUS_PATH_DISCOVERY_CONTRADICTION_GAP

**Evidence:**
Contradiction coverage is 22/23. `SERENDIPITOUS_PATH_DISCOVERY` has only 1 `contradictoryEvidence` item (`MULTIPLE_SERENDIPITOUS_DISCOVERIES_ACTED_ON`), so strong contradiction (≥2 independent contradictory items) cannot be established through the contradiction-first path. Its only structured suppression trigger is `OPPORTUNITY_RECOGNITION detected`.

**Impact:**
The signal can still be suppressed via its structured trigger (`OPPORTUNITY_RECOGNITION detected`), but lacks the dual-path suppression safety net that the other 22 signals have (contradictoryEvidence + suppression trigger).

**Required C3 action:**
Repair through architecture-approved structured suppression/contradiction contract. Do NOT add arbitrary evidence just to reach 23/23. Evaluate whether:
- An additional contradictoryEvidence item is warranted by signal semantics, or
- The existing suppression trigger + single contradictoryEvidence is architecturally sufficient

**Status:** BLOCKING_FOR_C3

---

## C2 Module Summary

| Module | Status | Tests | Lines |
|---|---|---|---|
| C2-001 Secondary Signal Vocabulary | ACCEPTED | N/A | 23 signals, 4 dimensions, 5 boundary pairs |
| C2-002A Evidence Contracts | ACCEPTED | 23/23 contracts | 1962 |
| C2-002B Evidence Extractor | ACCEPTED | 51/51 | 758 |
| C2-002C Validation Dataset | ACCEPTED | 87/87 | 1355 |

## Frozen Architecture (C2 exit snapshot)

- `worldPrinciples.js` — unchanged since C1
- `blindSpotBoundaryDefinitions.js` — unchanged since C1
- `secondarySignalDefinitions.js` — unchanged since C2-001
- `secondarySignalEvidenceMap.js` — unchanged since C2-002A
- `secondarySignalExtractor.js` — unchanged since C2-002B

## Runtime Impact

**Zero.** No production file imports any C2 module. No runtime call chain changed. No cloud deployment.
