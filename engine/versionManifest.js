/**
 * RC8 VERSION MANIFEST
 * Single source of truth for all engine/build versions.
 * Updated automatically at build time.
 */

module.exports = {
  clientBuildSha: '160ec8be35db3b4dc0cd4f3ebc667f2c9997684',
  clientBuildTimestamp: '2026-08-06T14:15:07+08:00',

  // Cloud function versions (updated when cloud function is deployed)
  cloudFunctionBuildSha: '09c3bccb79a8aa717cc7e7511dcb586348cdc184',
  cloudFunctionBuildTimestamp: '2026-08-04T21:56:33+08:00',

  // Engine versions
  diagnosisEngineVersion: 'RC8.2',
  promptVersion: 'RC8_PROMPT_V2',
  rulesetVersion: 'RC8_RULESET_V3',
  snapshotVersion: '2.0'  // Incremented on snapshot schema changes
}
