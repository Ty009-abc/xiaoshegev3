#!/usr/bin/env node
'use strict'
/**
 * scripts/check-payment-signing.js
 * ─────────────────────────────────────────────────────────────
 * PAYMENT_STAGE2 deploy gate for merchant signing material.
 *
 * Fails HARD (exit 1) when a candidate env/config declares a payment-signing
 * function whose:
 *   - WXPAY_PRIVATE_KEY is missing / placeholder / non-PEM
 *   - WXPAY_SERIAL_NO is not a 40-hex merchant certificate serial
 *
 * Prints KEY NAMES + reason tokens ONLY. NEVER prints secret values.
 *
 * USAGE:
 *   node scripts/check-payment-signing.js --fn createOrder --config path.json
 *   node scripts/check-payment-signing.js --env ./merged-env.json --fns createOrder,verifyPayment
 *   echo '{"WXPAY_PRIVATE_KEY":"...","WXPAY_SERIAL_NO":"..."}' | \
 *     node scripts/check-payment-signing.js --fn createOrder --stdin
 *
 * EXIT: 0 = safe; 1 = blocked; 2 = usage/config error.
 */

const fs = require('fs')
const path = require('path')
const guard = require('./lib/secret-guard.js')

function parseArgs (argv) {
  const a = { config: null, fn: null, fns: null, env: null, stdin: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config') a.config = argv[++i]
    else if (argv[i] === '--fn') a.fn = argv[++i]
    else if (argv[i] === '--fns') a.fns = argv[++i]
    else if (argv[i] === '--env') a.env = argv[++i]
    else if (argv[i] === '--stdin') a.stdin = true
  }
  return a
}

function main () {
  const args = parseArgs(process.argv.slice(2))
  let issues = []

  if (args.stdin || args.env) {
    // Validate a single merged env object against one-or-more function specs.
    const raw = args.stdin ? fs.readFileSync(0, 'utf8') : fs.readFileSync(args.env, 'utf8')
    let env
    try { env = JSON.parse(raw) } catch (e) {
      process.stderr.write('❌ payment-signing: cannot parse env JSON\n')
      process.exit(2)
    }
    const names = (args.fns || args.fn || '').split(',').map((s) => s.trim()).filter(Boolean)
    if (names.length === 0) {
      process.stderr.write('❌ payment-signing: --fn or --fns required with --env/--stdin\n')
      process.exit(2)
    }
    for (const n of names) issues.push(...guard.scanPaymentSigning(n, env))
  } else {
    const cfgPath = args.config || path.resolve(__dirname, '..', 'cloudbaserc.json')
    let cfg
    try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) } catch (e) {
      process.stderr.write('❌ payment-signing: cannot read/parse config: ' + cfgPath + '\n')
      process.exit(2)
    }
    const fns = (cfg.functions || []).filter((f) => !args.fn || f.name === args.fn)
    for (const f of fns) issues.push(...guard.scanPaymentSigning(f.name, f.envVariables))
  }

  if (issues.length === 0) {
    process.stdout.write('✓ payment-signing: merchant signing material valid — allowed\n')
    process.exit(0)
  }

  process.stderr.write('\n╔══════════════════════════════════════════════════════════╗\n')
  process.stderr.write('║  ⛔ PAYMENT-SIGNING GUARD: BLOCKED                        ║\n')
  process.stderr.write('╚══════════════════════════════════════════════════════════╝\n')
  process.stderr.write('Merchant signing material would be unusable (key names only):\n')
  for (const it of issues) {
    process.stderr.write('  • ' + it.function + ' → ' + it.key + '  [' + it.reason + ']\n')
  }
  process.stderr.write('\nFIX: provide a valid PEM merchant private key and a 40-hex\n')
  process.stderr.write('WXPAY_SERIAL_NO. NEVER commit real key values.\n\n')
  process.exit(1)
}

if (require.main === module) main()

module.exports = { parseArgs, main }
