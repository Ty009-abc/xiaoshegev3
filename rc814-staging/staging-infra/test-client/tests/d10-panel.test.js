'use strict'
/**
 * RC8_14_D10_R1 — test-client-only STATIC test for the D10 CAS gate panel.
 * Pure static assertions over the test-client sources (no wx runtime, no network,
 * no DB). Verifies the panel's safety contract without executing any cloud call.
 *
 * Run:  node rc814-staging/staging-infra/test-client/tests/d10-panel.test.js
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

const idxJs = read('pages/index/index.js')
const idxWxml = read('pages/index/index.wxml')
const appJs = read('app.js')

// ── env pin ──
ok(/const STAGING_ENV = 'fanshen002-d9g0rjr3b6e313af5'/.test(idxJs), 'index.js pins staging envId literal')
ok(/const STAGING_ENV = 'fanshen002-d9g0rjr3b6e313af5'/.test(appJs), 'app.js pins staging envId literal')
ok(!/env:\s*wx\.cloud\.DYNAMIC_CURRENT_ENV/.test(idxJs + appJs), 'env not set to DYNAMIC_CURRENT_ENV (no silent prod fallback)')
// prod envId may appear ONLY inside comments (warning text); never as an env value
ok(!/env:\s*['"]fanshex-d2g0adgv7dfbc9bdc['"]/.test(idxJs + appJs), 'no production envId used as env value')
ok((idxJs + appJs).split('\n').filter(l => /fanshex-d2g0adgv7dfbc9bdc/.test(l)).every(l => /(^|\s)(\*|\/\/)/.test(l)), 'prod envId only in comment lines')

// ── D10 defaults ──
ok(/recordId: 'CR17920376443640tylag'/.test(idxJs), 'D10 default recordId = CR17920376443640tylag')
ok(/eventId: 'CE012'/.test(idxJs), 'D10 default eventId = CE012')
ok(/choiceKey: 'A'/.test(idxJs), 'D10 default choiceKey = A')
ok(/choiceOptions: \['A', 'B'\]/.test(idxJs), 'D10 choice options = [A, B]')

// ── request schemas ──
ok(/name: 'submitChallengeChoice', data: req/.test(idxJs), 'submit calls submitChallengeChoice with {recordId,eventId,choiceKey}')
ok(/const req = \{ recordId: d\.recordId, eventId: d\.eventId, choiceKey: d\.choiceKey \}/.test(idxJs), 'submit request schema exact')
ok(/name: 'getChallengeEvent', data: \{ recordId: d\.recordId \}/.test(idxJs), 'get calls getChallengeEvent with {recordId} only')
ok(!/openid/.test(idxJs.match(/const req = [^\n]+/)[0]), 'submit request sends no openid')

// ── no automatic startChallenge in D10 handlers ──
ok(!/name: 'startChallenge'/.test(idxJs.match(/onD10RecordIdInput[\s\S]*?goRunner/)[0]), 'D10 handlers call no startChallenge')
ok(!/startChallenge/.test(idxJs.match(/onD10Submit[\s\S]*?goRunner/)[0].replace(/\/\/[^\n]*/g, '')), 'no startChallenge call between D10 handlers (comments stripped)')

// ── guards ──
ok(/if \(!d\.recordId\)/.test(idxJs), 'guard: reject empty recordId')
ok(/if \(!d\.eventId\)/.test(idxJs), 'guard: reject empty eventId')
ok(/d\.choiceKey !== 'A' && d\.choiceKey !== 'B'/.test(idxJs), 'guard: reject invalid choiceKey')
ok(/if \(this\.data\.d10\.inFlight\)/.test(idxJs), 'guard: reject double tap while in flight')
ok(/wx\.showModal\(/.test(idxJs) && /if \(m\.confirm\)/.test(idxJs), 'guard: visible confirmation before submit')
ok(!/retry/i.test(idxJs.match(/onD10Submit[\s\S]*?_d10DoSubmit/)[0]), 'no automatic retry on 409')

// ── response handling: preserve, don't synthesize ──
ok(/dup = !!\(res && res\.duplicate\)/.test(idxJs), 'reads duplicate flag from server response')
ok(/idem = !!\(res && res\.idempotent\)/.test(idxJs), 'reads idempotent flag from server response')
ok(/conflict = !!\(res && res\.data && res\.data\.conflict\)/.test(idxJs), 'reads conflict flag from server data')
ok(!/= 'PASS'/.test(idxJs), 'never converts response to a PASS string')
ok(/setData\(\{ 'd10\.submitResp': res/.test(idxJs), 'preserves original server response object')

// ── redaction + timestamps ──
ok(/_redact/.test(idxJs), 'has openid redaction helper')
ok(/replace\(\/o\[A-Za-z0-9_-\]\{20,\}\/g/.test(idxJs), 'redaction masks openid-like tokens')
ok(/const t0 = this\._nowMs\(\)/.test(idxJs) && /const t1 = this\._nowMs\(\)/.test(idxJs), 'captures request + response timestamps')
ok(/code=' \+ \(res && res\.code\)/.test(idxJs), 'displays response code')

// ── no hidden mutation on load ──
ok(!/onLoad[\s\S]*callFunction/.test(idxJs.split('goRunner')[0]), 'no callFunction on page onLoad (no hidden mutation)')

// ── UI wiring present ──
;['onD10Submit', 'onD10GetEvent', 'onD10RecordIdInput', 'onD10EventIdInput', 'onD10ChoiceChange']
  .forEach(h => ok(new RegExp('bindtap="' + h + '"|bindinput="' + h + '"|bindchange="' + h + '"').test(idxWxml), 'wxml binds ' + h))
ok(/RC8.14 D10 CAS验证/.test(idxWxml), 'wxml shows D10 panel title')
ok(/recordId/.test(idxWxml) && /eventId/.test(idxWxml) && /choiceKey/.test(idxWxml), 'wxml shows recordId/eventId/choiceKey')
ok(/\{\{stagingEnv\}\}/.test(idxWxml), 'wxml displays actual target envId')

console.log('D10_PANEL_TEST pass=' + pass + ' fail=' + fail)
process.exit(fail ? 1 : 0)
