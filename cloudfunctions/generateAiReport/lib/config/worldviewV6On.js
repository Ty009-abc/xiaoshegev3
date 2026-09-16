/**
 * lib/config/worldviewV6On.js
 *
 * RC8.4 V6 (R21 §14/§15) — LIMITED ON runtime policy.
 *
 * ON is a SEPARATE, owner-authorized rollout gate (R21 §7/§8). It is NOT
 * implied by SHADOW: the SHADOW allowlist never authorizes ON. This module
 * defines only the SAFE latency / retry policy for the ON path; it contains no
 * allowlist and never reads env.
 *
 * Policy (derived from R20 48-sample evidence):
 *   - SHADOW_TOTAL P50 = 9387ms, P95 = 16491ms, MAX = 27710ms.
 *   - R20 retry rate 6.2%; residual retries were pure provider latency
 *     (MODEL_TIMEOUT attempts clustered at ~14000ms).
 *
 * Because an ON user ACTUALLY WAITS, ON must bound the wait:
 *   ON_MAX_USER_WAIT_MS = 20000
 *     → covers SHADOW P95 (16.5s) with headroom, and hard-caps the tail.
 *     → deadline reached → return deterministic B2 IMMEDIATELY (never wait for
 *        a runaway second attempt).
 *   ON_ATTEMPT_TIMEOUT_MS = 14000 (proven; unchanged).
 *   ON_RETRY_FAST_FAIL_MS = 6000   (OPTION B boundary).
 *   ON_MAX_ATTEMPTS = 2.
 *
 * RETRY POLICY = OPTION B (bounded retry only after a FAST failure):
 *   - one attempt always runs;
 *   - a second attempt runs ONLY if the first failed quickly (≤ 6000ms) AND the
 *     remaining deadline can still fit another full attempt. A slow failure
 *     (e.g. a 14000ms timeout) falls straight to deterministic B2 so the user
 *     is never made to wait for a second 14s attempt.
 *
 * This module is a pure constant/option builder — no execution, no network,
 * no DB, no user-visible mutation.
 *
 * @version turnaround_strategy_v6
 */

// Hard ceiling on how long an ON user is made to wait for an AI-edited report.
const ON_MAX_USER_WAIT_MS = 20000
// Per-attempt model timeout (unchanged from the proven SHADOW value).
const ON_ATTEMPT_TIMEOUT_MS = 14000
// A first-attempt failure slower than this is NOT retried (protects user wait).
const ON_RETRY_FAST_FAIL_MS = 6000
// Absolute attempt cap.
const ON_MAX_ATTEMPTS = 2

/**
 * Runtime options for the ON path. Passed straight into the draft runtime so
 * the deadline + bounded-retry policy is enforced inside the same loop that
 * already gates SHADOW (SHADOW never passes these, so its behavior is
 * unchanged).
 * @returns {{maxAttempts:number, attemptTimeoutMs:number, totalBudgetMs:number, retryFastFailMs:number}}
 */
function onRuntimeOpts () {
  return {
    maxAttempts: ON_MAX_ATTEMPTS,
    attemptTimeoutMs: ON_ATTEMPT_TIMEOUT_MS,
    totalBudgetMs: ON_MAX_USER_WAIT_MS,
    retryFastFailMs: ON_RETRY_FAST_FAIL_MS,
  }
}

module.exports = {
  ON_MAX_USER_WAIT_MS,
  ON_ATTEMPT_TIMEOUT_MS,
  ON_RETRY_FAST_FAIL_MS,
  ON_MAX_ATTEMPTS,
  onRuntimeOpts,
}
