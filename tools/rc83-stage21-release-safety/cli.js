/**
 * tools/rc83-stage21-release-safety/cli.js
 *
 * Read-only release-safety CLI. Default = LOCAL/FIXTURE (no production access).
 * Live readback requires explicit `--live-readonly` opt-in AND an injected
 * control-plane reader (never auto-reached in tests).
 *
 * Commands:
 *   node cli.js fingerprint --config <json>
 *   node cli.js compare --pre <json> --post <json>
 *   node cli.js classify --method "<deploy command>"
 *   node cli.js manifest --input <json>
 */

'use strict'

var fp = require('./lib/fingerprint')
var cfg = require('./lib/configReadback')
var ds = require('./lib/deploymentSafety')
var rm = require('./lib/releaseManifest')

function parseArgs(argv) {
  var out = { flags: {}, positional: [] }
  for (var i = 0; i < argv.length; i++) {
    var a = argv[i]
    if (a.indexOf('--') === 0) {
      var eq = a.indexOf('=')
      if (eq !== -1) {
        out.flags[a.slice(2, eq)] = a.slice(eq + 1)
      } else {
        var key = a.slice(2)
        var next = argv[i + 1]
        if (next !== undefined && next.indexOf('--') !== 0) {
          out.flags[key] = next
          i++
        } else {
          out.flags[key] = true
        }
      }
    } else {
      out.positional.push(a)
    }
  }
  return out
}

function loadJson(s) {
  if (s === undefined) throw new Error('missing JSON input')
  if (s[0] === '{') return JSON.parse(s)
  return JSON.parse(require('fs').readFileSync(s, 'utf8'))
}

function main() {
  var args = parseArgs(process.argv.slice(2))
  var cmd = args.positional[0]

  if (cmd === 'fingerprint') {
    var config = loadJson(args.flags.config)
    console.log(JSON.stringify({
      fingerprint: fp.fingerprintConfig(config),
      payload: fp.buildConfigFingerprintPayload(config),
    }, null, 2))
    return
  }

  if (cmd === 'compare') {
    var pre = loadJson(args.flags.pre)
    var post = loadJson(args.flags.post)
    console.log(JSON.stringify(ds.compareConfigState(pre, post), null, 2))
    return
  }

  if (cmd === 'classify') {
    var method = args.flags.method
    console.log(JSON.stringify(ds.classifyDeploymentPath(method, { description: args.flags.description }), null, 2))
    return
  }

  if (cmd === 'manifest') {
    var input = loadJson(args.flags.input)
    var manifest = rm.buildManifest(input)
    var check = rm.validateManifest(manifest)
    console.log(JSON.stringify({ manifest: manifest, validation: check }, null, 2))
    return
  }

  if (cmd === 'readback') {
    // Default LOCAL/FIXTURE. Live requires --live-readonly AND an injected reader.
    // For CLI safety, live reader is NOT wired by default; --live-readonly here
    // is rejected unless a reader is provided (documented contract).
    if (args.flags['live-readonly']) {
      console.error('ERROR: --live-readonly requires an injected control-plane reader (not available in this tool).')
      process.exit(2)
    }
    var fixture = loadJson(args.flags.fixture)
    var result = cfg.readProductionConfig({ liveReadonly: false, fixture: fixture })
    console.log(JSON.stringify({
      mode: result.mode,
      authority: cfg.PRODUCTION_CONFIG_AUTHORITY,
      fingerprint: cfg.productionConfigFingerprint(result.config),
      payload: cfg.normalizeProductionConfig(result.config),
    }, null, 2))
    return
  }

  console.error('Usage: node cli.js <fingerprint|compare|classify|manifest|readback> ...')
  process.exit(1)
}

if (require.main === module) {
  main()
}
