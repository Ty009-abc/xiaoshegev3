# ADR-RC8.3-C2-002B — Secondary Signal Extractor

## Status
ACCEPTED (MERGED: `2f634bd`, Tag: `RC8_3_C2_002B_EXTRACTOR_BASELINE`)

## Context
C2-002A established 23 evidence contracts in `secondarySignalEvidenceMap.js` mapping secondary signals to required/contextual/contradictory evidence rules. C2-002B builds the extractor that executes those contracts — a pure function transforming normalized evidence + primary signals into 23 secondary signal states.

## Decision
Build `secondarySignalExtractor.js` as a pure, deterministic function with no production integration:

- **Contract-driven**: all signal state transitions driven by `secondarySignalEvidenceMap.js`, zero hardcoded per-signal exceptions
- **Contradiction-first**: suppression overrides activation (strong contradiction ≥2 independent contradictory items)
- **Evidence independence checking**: same origin items do NOT count as independent evidence (prevents false dual-evidence activation)
- **Two activation modes**: `TWO_SUPPORTING` (Mode A, 2 independent evidence items) and `STRONG_PLUS_CONTEXT` (Mode B, 1 strong + 1 contextual from independent origins)
- **Three states**: `ACTIVE`, `SUPPRESSED`, `INSUFFICIENT_EVIDENCE`
- **Deterministic**: 100-run identical output, no timestamps, no random, no idOffset

## Constraints Satisfied
- 0 frozen C1/C2-001 files modified
- 0 runtime call chain changes
- 0 production imports (no index.js, pipeline, router)
- 0 hardcoded per-signal special cases
- 0 direct Blind Spot / Archetype / Strategy determination
- 0 contamination

## Test Results
51/51 PASS — covering activation modes, independence, contradiction suppression, insufficient evidence, malformed input, 100-run determinism, 5 confusion pairs, and empty input.

## Architecture Debt (Recorded)

### P1: TEXT_RULE_PARSER_DEBT
`suppressionRule` triggers in `secondarySignalEvidenceMap.js` are free-text strings. `isSuppressionTriggerMet` parses them via regex to extract signal ids, confidence thresholds, and detected/not-detected semantics.

**Required next action (C3):** Migrate to structured predicates:
```js
{
  operator: "AND" | "OR",
  conditions: [
    { signalId: "...", detected: true|false, minConfidence: 0.x }
  ]
}
```

### P2: INSUFFICIENT_SCORE_HALVING_HEURISTIC
`INSUFFICIENT_EVIDENCE` state halves the raw score. Contract (`secondarySignalEvidenceMap.js`) does not specify this behavior — it is an extractor-level implementation heuristic.

**Required next action (C3):** Either (A) formalize in evidence contracts, or (B) remove the heuristic.

## Consequences
- Ready for C2-002C (Blind Spot → Secondary Signal cascading inference engine)
- All extractor logic is auditable and contract-traceable
- No runtime impact — no cloud deployment required

## Related
- `ADR-RC8.3-C2-001-SECONDARY-SIGNAL-VOCABULARY.md`
- `docs/adr/ADR-RC8.3-C1-*` (World Principles + Blind Spot Boundaries)
