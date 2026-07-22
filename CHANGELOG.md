# CHANGELOG.md — Turnaround OS

## [6.5.0-rc1] — 2026-07-22

### Added
- **Turnaround Analytics (V6.5)** — 全链路产品化基础设施
  - Event Schema + Catalog: 35 events, 10 categories
  - Report Analytics: 7-card funnel with drop-off analysis
  - Quality Dashboard: AI P95, empty report rate, decision TOP5
  - Experiment Engine: 4 A/B tests (HERO_HEADLINE, HERO_GAP, CARD_ORDER, ACTION_WORDING)
  - Gate System: A (Analytics) → B (RC) → C (Beta) → D (Stable)
  - Turnaround Console: 5-tab admin dashboard
  - Beta Metrics: 7 KPI, 100→300→1000 rollout, feedback system
- **PPV Fixes:** timer cleanup in splash.js and membership.js

### Changed
- None (feature additions only)

### Fixed
- splash page: `setTimeout` not cleared → added `_splashTimer` + `onUnload`
- membership page: `setTimeout navigateBack` not cleared → added `_navTimer` + `onUnload`

---

## [6.4.0] — 2026-07-22

### Added
- **Report Experience System (CP6-F)** — 7 fixed cards + experience layer
  - Card Builder: Hero, Insight, Potential, Strategy, Timeline, Action, Evidence Drawer
  - Report Composer: share (3 cards) + premium (4 cards)
  - Experience Builder: reading rhythm, progressive disclosure, visual hierarchy, emotion curve, animation timeline
  - Evidence Drawer: collapsed by default, expandable chain (Q→Pattern→Risk→Decision)
  - Commercial layering: free share cards → premium unlock

---

## [6.3.0] — 2026-07-22

### Added
- **Narrative Intelligence Engine (CP6-E)** — 8 renderers + consistency checker
  - Verdict Renderer: ≤35字 headline, 6 CC→template mapping
  - Reality Gap Renderer: fixed 3-segment (你以为/实际上/真正的问题)
  - Potential Renderer: score + reversibility + recovery window + disclaimer
  - Strategy Renderer: Roadmap→user-readable phases
  - Timeline Renderer: Milestone→timeline with success criteria
  - Action Renderer: single PrimaryAction only
  - Consistency Checker: 7 rules, <85 blocks report output
  - Emotion Renderer: tagline + verdict restatement (only LLM-allowed layer)
- **Core Rule:** Narrative never creates facts. Narrative only explains decisions.

---

## [6.2.0] — 2026-07-22

### Added
- **Decision Operating System (CP6-D)** — 5 engines + 5 contracts
  - Decision Engine: 12 fixed codes, CONTRADICTION_TO_DECISION mapping
  - Roadmap Engine: fixed 4-phase (Repair/Build/Expand/Compound)
  - Feasibility Engine: independent scoring (execution×35 + resource×25 + window×20 + evidence×20)
  - Bottleneck Engine: 8 codes, Pattern→Bottleneck mapping
  - Milestone Planner: ≥3 milestones per decision
  - Pipeline: Evidence → Pattern → Risk → Profile → Cognitive → Leverage → Conflict → Opportunity → CoreContradiction → Decision → Roadmap → Feasibility → Bottleneck → Milestone

---

## [6.1.0] — 2026-07-22

### Added
- **CP6-C.1:** Opportunity Engine (12 opportunities) + Core Contradiction Engine + Evidence Chain
- **CP6-C:** Pattern Engine (12 unified patterns) + Risk Engine (12 codes) + Leverage Engine + Conflict Resolver (6 types, 13 rules)
- **CP6-B.1:** Pattern Graph (25 patterns, 3 categories)
- **CP6-B:** Profile Engine + Cognitive Engine

---

## [6.0.0] — 2026-07-22

### Added
- **CP6-A:** Data Contract & Evidence Model (7 files)
- **Complete pipeline architecture:** Evidence → Pattern → Profile → Cognitive → Risk → Leverage → Conflict → Opportunity → CoreContradiction → Decision → Roadmap → Feasibility → Bottleneck → Milestone → Verdict

---

## V5 Series

### CP5 — Action + Decider + Execution + Learn engines
### CP4 — Personality + Profile + Cognitive engines
### CP3 — Answers + Evidence + Pattern engines
### CP2 — Question + Selection engines
