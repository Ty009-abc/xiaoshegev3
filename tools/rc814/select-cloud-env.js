#!/usr/bin/env node
'use strict'
/**
 * tools/rc814/select-cloud-env.js — BUILD-TIME cloud env selector.
 *
 *   node tools/rc814/select-cloud-env.js production
 *   node tools/rc814/select-cloud-env.js staging
 *   node tools/rc814/select-cloud-env.js --check        (report only, no write)
 *
 * Why a generator instead of process.env: a WeChat mini program has no
 * process.env at runtime, and the devtools build does not substitute env vars.
 * Rewriting config/cloudEnv.generated.js is the only mechanism that makes the
 * shipped bytes unambiguous.
 *
 * Fail-closed rules:
 *   - Unknown target => exit non-zero, NO write.
 *   - Missing target    => exit non-zero, NO write.
 *   - Env id must match the allowlist AND the CloudBase id shape.
 *   - Production ids are never emitted into a staging target.
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..', '..')
const OUT = path.join(ROOT, 'config', 'cloudEnv.generated.js')

/** Canonical allowlist. Adding a target here is a reviewed act, not a runtime one. */
const TARGETS = Object.freeze({
  production: 'fanshex-d2g0adgv7dfbc9bdc',
  staging: 'fanshen002-d9g0rjr3b6e313af5',
})

const ENV_ID_RE = /^[a-z0-9][a-z0-9-]{5,60}$/

function render (target, envId) {
  return `'use strict'
/**
 * config/cloudEnv.generated.js — GENERATED FILE. DO NOT EDIT BY HAND.
 *
 * Produced by:   node tools/rc814/select-cloud-env.js <production|staging>
 * Build target:  ${target}
 *
 * A staging build must NOT contain the production envId anywhere in the shipped
 * tree (verified by tools/rc814/verify-client-env.js).
 */
module.exports = {
  buildTarget: '${target}',
  envId: '${envId}',
  buildTargetSealed: true,
}
`
}

function currentTarget () {
  try {
    const gen = require(OUT)
    return gen && gen.buildTarget ? gen.buildTarget : null
  } catch (e) {
    return null
  }
}

function main () {
  const argv = process.argv.slice(2)
  const checkOnly = argv.includes('--check')
  const target = argv.filter((a) => !a.startsWith('--'))[0]

  if (checkOnly) {
    const cur = currentTarget()
    console.log('CURRENT_BUILD_TARGET: ' + String(cur))
    console.log('ALLOWED_TARGETS: ' + Object.keys(TARGETS).join(', '))
    const pcPath = path.join(ROOT, 'project.config.json')
    if (fs.existsSync(pcPath)) {
      const pc = fs.readFileSync(pcPath, 'utf8')
      const mm = pc.match(/"cloudEnvironmentId"\s*:\s*"([^"]*)"/)
      console.log('PROJECT_CONFIG_ENV: ' + (mm ? mm[1] : '<absent>'))
    }
    process.exit(0)
  }

  if (!target) {
    console.error('REFUSED: no build target given. Allowed: ' + Object.keys(TARGETS).join(', '))
    process.exit(2)
  }
  if (!Object.prototype.hasOwnProperty.call(TARGETS, target)) {
    console.error('REFUSED: unknown build target "' + target + '". Allowed: ' + Object.keys(TARGETS).join(', '))
    process.exit(2)
  }

  const envId = TARGETS[target]
  if (!ENV_ID_RE.test(envId)) {
    console.error('REFUSED: env id for target "' + target + '" is malformed')
    process.exit(2)
  }

  const before = currentTarget()
  const body = render(target, envId)
  fs.writeFileSync(OUT, body, 'utf8')

  // Read the bytes back from disk. `require` would return the module cache and
  // falsely report the PREVIOUS target (this was a real bug: it made a
  // successful staging switch look like a failure).
  const written = fs.readFileSync(OUT, 'utf8')
  const m = written.match(/buildTarget:\s*'([^']+)'/)
  const after = m ? m[1] : null
  if (after !== target) {
    console.error('FAILED: generated file did not round-trip (disk read got ' + String(after) + ')')
    process.exit(1)
  }

  // project.config.json tells the WeChat devtools which env to bind. A staging
  // build must bind staging, otherwise the IDE routes to production.
  const pcPath = path.join(ROOT, 'project.config.json')
  if (fs.existsSync(pcPath)) {
    const beforePc = fs.readFileSync(pcPath, 'utf8')
    const patched = beforePc.replace(
      /("cloudEnvironmentId"\s*:\s*")[^"]*(")/,
      '$1' + envId + '$2'
    )
    if (patched === beforePc && !beforePc.includes(envId)) {
      console.error('FAILED: project.config.json has no cloudEnvironmentId field to bind')
      process.exit(1)
    }
    fs.writeFileSync(pcPath, patched, 'utf8')
    const check = fs.readFileSync(pcPath, 'utf8')
    if (!check.includes('"cloudEnvironmentId": "' + envId + '"') &&
        !new RegExp('"cloudEnvironmentId"\\s*:\\s*"' + envId + '"').test(check)) {
      console.error('FAILED: project.config.json cloudEnvironmentId did not bind to target')
      process.exit(1)
    }
    console.log('BOUND: project.config.json cloudEnvironmentId -> target')
  }

  console.log('BUILD_TARGET_SET: ' + target)
  console.log('PREVIOUS_TARGET:  ' + String(before))
  console.log('ENV_ID_FINGERPRINT: ' + require('crypto').createHash('sha256').update(envId).digest('hex').slice(0, 16))
  console.log('WROTE: config/cloudEnv.generated.js')
}

main()
