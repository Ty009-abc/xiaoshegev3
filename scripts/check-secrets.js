#!/usr/bin/env node
'use strict'
/**
 * scripts/check-secrets.js
 * ─────────────────────────────────────────────────────────────
 * RC8.9B_P0_SECRET_CLOBBER_GUARD — deploy gate (CLI).
 *
 * Fails HARD (exit 1) when cloudbaserc.json declares a production secret whose
 * value is a placeholder / empty / committed-real-secret, or a partial secret
 * env block that would delete a live secret under SCF's wholesale replace.
 *
 * Prints KEY NAMES + reason tokens ONLY. NEVER prints secret values.
 *
 * USAGE:
 *   node scripts/check-secrets.js                       # whole config
 *   node scripts/check-secrets.js --fn generateAiReport # one function
 *   node scripts/check-secrets.js --config path.json
 *
 * EXIT: 0 = safe to deploy; 1 = blocked; 2 = usage/config error.
 */

const fs = require('fs')
const path = require('path')
const { scanConfig, scanFunction } = require('./lib/secret-guard.js')

function parseArgs (argv) {
  const a = { config: null, fn: null }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config') a.config = argv[++i]
    else if (argv[i] === '--fn') a.fn = argv[++i]
  }
  return a
}

function main () {
  const args = parseArgs(process.argv.slice(2))
  const cfgPath = args.config || path.resolve(__dirname, '..', 'cloudbaserc.json')

  let cfg
  try {
    cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
  } catch (e) {
    process.stderr.write('❌ secret-guard: cannot read/parse config: ' + cfgPath + '\n')
    process.exit(2)
  }

  let issues
  if (args.fn) {
    const fn = (cfg.functions || []).find((f) => f.name === args.fn)
    if (!fn) {
      process.stderr.write('❌ secret-guard: function not found in config: ' + args.fn + '\n')
      process.exit(2)
    }
    issues = scanFunction(fn)
  } else {
    issues = scanConfig(cfg)
  }

  if (issues.length === 0) {
    process.stdout.write('✓ secret-guard: no placeholder/committed secrets in config — deploy allowed\n')
    process.exit(0)
  }

  process.stderr.write('\n╔══════════════════════════════════════════════════════════╗\n')
  process.stderr.write('║  ⛔ SECRET-GUARD: DEPLOY BLOCKED                          ║\n')
  process.stderr.write('╚══════════════════════════════════════════════════════════╝\n')
  process.stderr.write('Deploying this config would materialize placeholder/committed\n')
  process.stderr.write('secrets into the cloud and DESTROY live production secrets.\n\n')
  process.stderr.write('Offending entries (key NAMES only — values never printed):\n')
  for (const it of issues) {
    process.stderr.write('  • ' + it.function + ' → ' + it.key + '  [' + it.reason + ']\n')
  }
  process.stderr.write('\nFIX: remove the envVariables block from the function in\n')
  process.stderr.write('cloudbaserc.json so production secrets stay CLOUD-SIDE /\n')
  process.stderr.write('runtime-managed. Use scripts/set-env.sh (merge-safe) to change\n')
  process.stderr.write('values out-of-band. NEVER commit real secret values.\n\n')
  process.exit(1)
}

if (require.main === module) main()

module.exports = { parseArgs, main }
