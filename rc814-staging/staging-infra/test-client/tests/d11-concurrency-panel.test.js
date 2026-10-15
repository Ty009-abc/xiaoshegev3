'use strict'
/**
 * RC8_14_D11 — test-client-only static + logic tests for the authenticated-concurrency panel.
 * Pure assertions (no wx runtime, no network, no DB).
 *
 * Run: node rc814-staging/staging-infra/test-client/tests/d11-concurrency-panel.test.js
 */
const fs = require('fs')
const path = require('path')
const idxJs = fs.readFileSync(path.join(__dirname, '..', 'pages', 'index', 'index.js'), 'utf8')
const idxWxml = fs.readFileSync(path.join(__dirname, '..', 'pages', 'index', 'index.wxml'), 'utf8')
const { parseSubmitResponse, fmtFlag } = require(path.join(__dirname, '..', 'lib', 'preview-utils.js'))

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

// ── implementation present ──
ok(/onD11Run/.test(idxJs), 'has onD11Run handler')
ok(/onD11VerifyTarget/.test(idxJs), 'has onD11VerifyTarget handler')
ok(/onD11GetEvent/.test(idxJs), 'has onD11GetEvent handler')
ok(/_d11Guard/.test(idxJs) && /_d11RunTwo/.test(idxJs), 'has guard + run-two helpers')
ok(/d11: \{/.test(idxJs), 'has d11 state object')
ok(/GAME015/.test(idxJs), 'defaults eventId to GAME015 (current unanswered event)')
ok(/RC8\.14 D11 真实并发CAS测试/.test(idxWxml), 'panel title rendered in wxml')
ok(/VERIFY_TARGET/.test(idxWxml) && /RUN_TWO_CONCURRENT_CHOICES/.test(idxWxml) && /GET_CURRENT_EVENT/.test(idxWxml), 'three D11 actions in wxml')

// ── concurrency dispatch: construct both, no sequential await, allSettled ──
const runTwo = idxJs.match(/_d11RunTwo[\s\S]*?onD11GetEvent/)[0]
ok(/const pA = wx\.cloud\.callFunction/.test(runTwo) && /const pB = wx\.cloud\.callFunction/.test(runTwo), 'both requests constructed independently')
ok(/Promise\.allSettled\(\[pA, pB\]\)/.test(runTwo), 'uses Promise.allSettled([pA,pB])')
ok(!/await wx\.cloud\.callFunction[\s\S]{0,80}await wx\.cloud\.callFunction/.test(runTwo), 'no sequential await between the two calls')
ok(/recordId: d\.recordId/.test(runTwo) && /eventId: d\.eventId/.test(runTwo), 'both requests share recordId + eventId')
ok(/choiceKey: d\.choiceA/.test(runTwo) && /choiceKey: d\.choiceB/.test(runTwo), 'requests use different choiceKeys A/B')
ok(/tA0/.test(runTwo) && /tB0/.test(runTwo) && /tA1/.test(runTwo) && /tB1/.test(runTwo), 'captures independent dispatch + completion timestamps')
ok(/overlap = \(tA0 < tB1 && tB0 < tA1\)/.test(runTwo), 'computes client-side overlap interval')
ok(/__netError/.test(runTwo), 'distinguishes network error from business result')
ok(!/retry|重试/.test(runTwo.replace(/不自动重试[\s\S]{0,4}/g, '')), 'no automatic retry in run-two')

// ── safety: confirmation required, double-tap blocked, no startChallenge, hard-pinned env ──
ok(/wx\.showModal/.test(idxJs.match(/onD11Run[\s\S]*?_d11RunTwo/)[0]), 'explicit confirmation before running')
ok(/d11\.inFlight/.test(idxJs), 'in-flight guard (double-tap blocked)')
const d11Handlers = idxJs.match(/onD11VerifyTarget[\s\S]*?goRunner/)[0].replace(/\/\/[^\n]*/g, '')
ok(!/startChallenge/.test(d11Handlers), 'no startChallenge in D11 handlers')
ok(/const STAGING_ENV = 'fanshen002-d9g0rjr3b6e313af5'/.test(idxJs), 'staging env hard-pin present (literal)')
ok(/fanshen002-d9g0rjr3b6e313af5/.test(idxJs), 'staging env pinned')
ok(!/DYNAMIC_CURRENT_ENV/.test(idxJs), 'no DYNAMIC_CURRENT_ENV (no prod fallback)')
ok(!/fanshex-d2g0adgv7dfbc9bdc/.test(idxJs), 'no production envId in client')
ok(!/openid/.test(idxJs.match(/onD11VerifyTarget[\s\S]*?goRunner/)[0].replace(/\/\/[^\n]*/g, '').replace(/getWXContext/g, '')), 'no client-supplied openid in D11 flow')
ok(/_redact|redactOpenid|redactJson/.test(idxJs.match(/onD11VerifyTarget[\s\S]*?goRunner/)[0]), 'D11 logs use redaction')
ok(!/onLoad[\s\S]{0,200}(callFunction|startChallenge)/.test(idxJs), 'no hidden callFunction on load')

// ── guard logic: different choices, valid keys ──
ok(/d\.choiceA === d\.choiceB/.test(idxJs), 'guard rejects identical choiceKeys')
ok(/\/\^\[A-Z\]\$\//.test(idxJs), 'guard validates single-letter choiceKey')

// ── response parsing reuse (correct nesting) ──
let r = parseSubmitResponse({ code: 0, data: { duplicate: true, idempotent: true, currentEventIndex: 2 } })
ok(r.duplicate === true && r.idempotent === true && r.currentEventIndex === 2, 'parses accepted choice flags from res.data')
r = parseSubmitResponse({ code: 409, data: { conflict: true, submittedChoice: 'A', currentEventIndex: 2 } })
ok(r.code === 409 && r.conflict === true && r.data.submittedChoice === 'A', 'parses rejected choice conflict + submittedChoice')
r = parseSubmitResponse(undefined)
ok(r.code === undefined, 'undefined response safe (network path)')

// ── D10 regression: still present ──
ok(/onD10Submit/.test(idxJs) && /onD10GetEvent/.test(idxJs), 'D10 panel handlers still present')
ok(/RC8\.14 D10 CAS验证/.test(idxWxml), 'D10 panel still in wxml')

console.log('D11_CONCURRENCY_PANEL_TEST pass=' + pass + ' fail=' + fail)
process.exit(fail ? 1 : 0)
