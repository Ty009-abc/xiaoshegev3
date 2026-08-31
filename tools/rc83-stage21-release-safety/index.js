/**
 * tools/rc83-stage21-release-safety/index.js
 *
 * Public surface for the Stage21 release-safety foundation tooling.
 * Pure Node built-ins. No production access unless explicitly opted in via
 * CLI flag `--live-readonly` (which requires an injected live reader).
 *
 * This tooling NEVER enters the inference decision path and NEVER mutates
 * production config.
 */

'use strict'

var fingerprint = require('./lib/fingerprint')
var configReadback = require('./lib/configReadback')
var deploymentSafety = require('./lib/deploymentSafety')
var releaseManifest = require('./lib/releaseManifest')

module.exports = {
  fingerprint: fingerprint,
  configReadback: configReadback,
  deploymentSafety: deploymentSafety,
  releaseManifest: releaseManifest,
}
