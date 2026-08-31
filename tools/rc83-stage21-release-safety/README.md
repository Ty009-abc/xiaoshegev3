# RC8.3 Stage21 — Release Safety Foundation (W3/W4/W5/W9)

Read-only, secret-safe, identity-safe release tooling. **Not** part of the
inference decision path; does **not** change World Model diagnosis, V2/V2.1
runtime behavior, AI output, user-visible report, DB persistence semantics,
Gate-B schema, or feature mode.

## Authority

```text
PRODUCTION_CONFIG_AUTHORITY = DEPLOYED_CLOUDBASE_FUNCTION_ENV
NON_AUTHORITIES = [cloudbaserc.json, local .env, repository config]
```

Live production readback is **only** available behind an explicit
`--live-readonly` opt-in with an injected control-plane reader. This tool ships
no live reader; default mode is LOCAL/FIXTURE.

## Modules

| Module | Purpose |
|---|---|
| `lib/fingerprint.js` | W4 — deterministic SHA-256 config fingerprint (secret/identity-free) |
| `lib/configReadback.js` | W3 — authoritative read-only config abstraction |
| `lib/deploymentSafety.js` | W5 — deploy path classifier + pre/post config comparator |
| `lib/releaseManifest.js` | W9 — machine-readable release manifest generator |
| `index.js` | public surface |
| `cli.js` | read-only CLI |

## Invariants

- `CODE_ONLY_DEPLOY MUST NOT SYNC_RUNTIME_MODE_CONFIG`
- Fingerprint payload: canonical key ordering, deterministic serialization,
  **no secrets**, **no identity**, allowlist → presence/count only (no
  reversible identity hash).
- Evidence fields: `PASS | FAIL | NOT_RUN | NOT_APPLICABLE | BLOCKED` (never
  bare `null`). Gate-B ACTIVE is never represented as PASS.

## Test

```bash
node tests/rc8.3-stage21-release-safety.test.js
```

## Fixtures

All test fixtures are explicitly labeled `TEST_FIXTURE` / `SYNTHETIC_METADATA`.
No fixture resembles a real release manifest.
