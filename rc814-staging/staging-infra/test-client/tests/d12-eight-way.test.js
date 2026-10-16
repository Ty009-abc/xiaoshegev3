'use strict'
/**
 * RC8_14_D12_R5B_4 — test-client-only static test for the AUTHORIZED 8-way
 * concurrency control. Pure static assertions (no wx runtime, no network, no
 * DB). Verifies the batch's safety contract:
 *   - exactly ONE 8-way control; dispatches exactly 8 (count param, default 8);
 *   - uses startChallenge with mode:'challenge';
 *   - Promise.allSettled used; NO await between dispatches (no serialization);
 *   - independent per-request dispatch + settlement timestamps (not one shared);
 *   - NO automatic retries, NO submitChallengeChoice, NO replay, NO payment;
 *   - single-batch lock (done latch) — cannot run a second batch;
 *   - identity server-derived + redacted; env hard-pinned to staging.
 *
 * Run:  node rc814-staging/staging-infra/test-client/tests/d12-eight-way.test.js
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

// ── control present, exactly one ──
ok(/async startChallengeEightWay \(count, onProgress\)/.test(appJs), 'app.js defines startChallengeEightWay(count, onProgress)')
ok((idxWxml.match(/bindtap="onEightWayRun"/g) || []).length === 1, 'exactly ONE 8-way control in wxml')
ok(/onEightWayRun \(\)/.test(idxJs), 'index.js defines onEightWayRun')

// ── function + mode ──
const block = (appJs.match(/async startChallengeEightWay \(count, onProgress\)[\s\S]*?\n  \},/) || [''])[0]
ok(block.length > 0, 'startChallengeEightWay body extracted')
ok(/name: 'startChallenge'/.test(block), "dispatches the 'startChallenge' function")
ok(/mode: 'challenge'/.test(block), "uses mode:'challenge'")
ok(/count > 0 \? count : 8/.test(block), 'defaults to 8 and honours count')
ok(/Promise\.allSettled/.test(block), 'collects with Promise.allSettled')

// ── no serialization: dispatch loop pushes promises without awaiting ──
const loop = (block.match(/for \(let i = 0; i < n; i\+\+\)[\s\S]*?slots\.push\(p\)/) || [''])[0]
ok(loop.length > 0, 'dispatch loop extracted')
const loopNoComments = loop.replace(/\/\/[^\n]*/g, '')
ok(!/await/.test(loopNoComments), 'dispatch loop contains NO await (no serialization)')
ok(/const dispatchTs = now\(\)/.test(loop), 'per-slot dispatch timestamp captured')
ok(/settlementTs: now\(\)/.test(block), 'per-slot settlement timestamp captured')
ok(!/settlementTs:\s*win1|settlementTimestamp:\s*win1/.test(block), 'no single shared settlement time assigned')

// ── hard rules: no retry / no submit / no replay / no payment ──
ok(!/setTimeout|setInterval/.test(block), 'no automatic retry timers in batch')
ok(!/submitChallengeChoice/.test(block), 'batch does NOT call submitChallengeChoice')
ok(!/replay/.test(block), 'batch does NOT call replay')
ok(!/createVirtualOrder|verifyVirtualPayment|virtualPayCallback/.test(block), 'batch does NOT call payment functions')
ok(!/entitlement/i.test(block), 'batch does NOT touch entitlements')

// ── single-batch enforcement ──
ok(/eight\.done/.test(idxJs), 'index has a done latch')
ok(/已执行过单次批次/.test(idxJs), 'second batch is refused (done latch message)')
ok(/runText|批次进行中/.test(idxJs), 'in-flight guard present')

// ── identity + env ──
ok(/this\.globalData\.identityPresent/.test(block), 'batch requires verified identity')
ok(/redactOpenid/.test(appJs), 'identity redaction helper used')
ok(!/env:\s*wx\.cloud\.DYNAMIC_CURRENT_ENV/.test(appJs), 'no DYNAMIC_CURRENT_ENV (no silent prod fallback)')
ok(!/openid:\s*[^n]/.test((idxWxml.match(/onEightWayRun[\s\S]*?eight\.perReqText/) || [''])[0]), 'no client openid emitted in 8-way UI')

console.log('D12_EIGHT_WAY_TEST pass=' + pass + ' fail=' + fail)
process.exit(fail ? 1 : 0)
