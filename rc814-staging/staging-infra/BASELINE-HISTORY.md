# RC8.14 Baseline History (append-only — preserve old baselines)

| when | HEAD | bundle sha256 | note |
|---|---|---|---|
| RC8_14_A_R2 | `57b4e4f` | — | legacy recovery + conditional persistence |
| RC8_14_D4 (initial) | `57b4e4f` | `6779950009c12e8b6cabfba846bcfb2c293668009db4b4dac0759f6a8f51355f` | 86 entries |
| RC8_14_D4_RESUME | `57b4e4f` | `acfd59d9722c248b46d51ab767c009a194ec8ff808dcecd3d0024d6d9e92c52a` | +d4-resume-verification.md, 87 entries |
| RC8_14 G (guard fix) | _(this commit)_ | _(see bundle.sha256)_ | preflight hardened; guard-selftest; staging-infra tracked |

Old baseline artifacts remain under `rc814-staging/releases/rc814-d4/`; the bundle is
rebuilt in place and the prior sha is preserved here.
