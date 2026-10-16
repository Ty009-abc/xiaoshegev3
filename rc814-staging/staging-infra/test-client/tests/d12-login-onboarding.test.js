'use strict'
/**
 * RC8_14_D12_R5B — test-client-only static test for NORMAL-login onboarding.
 * Pure static assertions over the test-client sources (no wx runtime, no network,
 * no DB). Verifies the onboarding action's safety contract:
 *   - login() calls ONLY the `login` cloud function;
 *   - login() NEVER calls startChallenge (no challenge, no active session);
 *   - NO automatic retries anywhere (no setTimeout/setInterval retry loop);
 *   - identity is server-derived and redacted before logging;
 *   - env stays hard-pinned to staging (no prod value; no DYNAMIC_CURRENT_ENV).
 *
 * Run:  node rc814-staging/staging-infra/test-client/tests/d12-login-onboarding.test.js
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

const appJs = read('app.js')
const idxJs = read('pages/index/index.js')
const idxWxml = read('pages/index/index.wxml')

// ── login action present + calls ONLY `login` ──
ok(/async login\(\)/.test(appJs), 'app.js defines async login()')
ok(/name: 'login'/.test(appJs), "login() calls the 'login' cloud function")
const loginBlock = (appJs.match(/async login\(\)[\s\S]*?\n  \},/) || [''])[0]
ok(loginBlock.length > 0, 'login() body extracted')
ok(!/startChallenge/.test(loginBlock), 'login() body does NOT call startChallenge')
ok(!/callFunction[\s\S]*callFunction/.test(loginBlock), 'login() makes a single cloud call (no second call)')

// ── no automatic retries anywhere in the client ──
ok(!/setTimeout/.test(appJs), 'app.js has no setTimeout (no retry loop)')
ok(!/setInterval/.test(appJs), 'app.js has no setInterval')
ok(!/setTimeout/.test(idxJs), 'index.js has no setTimeout (no retry loop)')
ok(!/setInterval/.test(idxJs), 'index.js has no setInterval')
ok(!/retry|重试/.test(loginBlock.replace(/不自动重试[\s\S]{0,6}/g, '')), 'login() has no automatic retry')

// ── index page wiring ──
ok(/async onLogin \(\)/.test(idxJs), 'index.js has onLogin handler')
ok(/getApp\(\)\.login\(\)/.test(idxJs), 'onLogin delegates to app.login()')
ok(/data-login|bindtap="onLogin"/.test(idxWxml), 'wxml binds onLogin')
ok(/loginBusy/.test(idxJs), 'onLogin has an in-flight guard (double-tap blocked)')
const onLoginBlock = (idxJs.match(/async onLogin \(\)[\s\S]*?\n  \},/) || [''])[0]
ok(onLoginBlock.length > 0, 'onLogin body extracted')
ok(!/startChallenge/.test(onLoginBlock), 'onLogin body does NOT call startChallenge')

// ── no automatic login / startChallenge on launch ──
const launch = (appJs.match(/onLaunch\(\)[\s\S]*?async _resolveIdentity/) || [''])[0]
ok(launch.length > 0, 'onLaunch body extracted')
const launchNoComments = launch.replace(/\/\/[^\n]*/g, '')
ok(!/startChallenge/.test(launchNoComments), 'onLaunch does NOT start a challenge')
ok(!/\.login\(\)/.test(launch), 'onLaunch does NOT auto-login')

// ── identity redaction ──
ok(/redactOpenid/.test(appJs), 'app.js uses redactOpenid for identity logs')
ok(!/console\.log\([^\n]*\bopenid\b/.test(appJs.replace(/redactOpenid/g, 'R')), 'no raw openid in console.log')

// ── env pin (no prod fallback) ──
ok(/const STAGING_ENV = 'fanshen002-d9g0rjr3b6e313af5'/.test(appJs), 'app.js pins staging envId literal')
ok(!/env:\s*wx\.cloud\.DYNAMIC_CURRENT_ENV/.test(appJs + idxJs), 'no DYNAMIC_CURRENT_ENV (no silent prod fallback)')
ok(!/env:\s*['"]fanshex-d2g0adgv7dfbc9bdc['"]/.test(appJs + idxJs), 'no production envId used as env value')
ok(!/\bDYNAMIC_CURRENT_ENV\b/.test(idxJs), 'index.js has no DYNAMIC_CURRENT_ENV')

console.log('D12_LOGIN_ONBOARDING_TEST pass=' + pass + ' fail=' + fail)
process.exit(fail ? 1 : 0)
