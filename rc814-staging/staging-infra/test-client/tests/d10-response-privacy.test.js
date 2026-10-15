'use strict'
/**
 * RC8_14_D10_R4 — test-client-only unit tests for response parsing + privacy redaction.
 * Pure static/logic assertions (no wx runtime, no network, no DB).
 *
 * Run: node rc814-staging/staging-infra/test-client/tests/d10-response-privacy.test.js
 */
const path = require('path')
const { parseSubmitResponse, fmtFlag, redactOpenid, redactJson } = require(path.join(__dirname, '..', 'lib', 'preview-utils.js'))

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }

// ── same-choice duplicate (server nests flags under data) ──
let r = parseSubmitResponse({ code: 0, message: 'success', data: { duplicate: true, idempotent: true, choice: 'A', currentEventIndex: 1 } })
ok(r.duplicate === true, 'same-choice: duplicate=true from res.data')
ok(r.idempotent === true, 'same-choice: idempotent=true from res.data')
ok(r.conflict === null, 'same-choice: conflict ABSENT → null (not synthesized)')
ok(r.currentEventIndex === 1, 'same-choice: currentEventIndex from res.data')
ok(r.code === 0, 'same-choice: code preserved')

// ── different-choice conflict (flags under data.conflict) ──
r = parseSubmitResponse({ code: 409, message: '提交冲突，请刷新后重试', data: { conflict: true, submittedChoice: 'A', currentEventIndex: 1 } })
ok(r.code === 409, 'conflict: code 409 preserved')
ok(r.conflict === true, 'conflict: conflict=true from res.data')
ok(r.duplicate === null, 'conflict: duplicate ABSENT → null (not synthesized)')
ok(r.message.indexOf('冲突') >= 0, 'conflict: message preserved verbatim')

// ── first-submit duplicate false ──
r = parseSubmitResponse({ code: 0, message: 'success', data: { choice: 'A', currentEventIndex: 1 } })
ok(r.duplicate === null, 'first-submit: duplicate ABSENT → null (≠ false)')
ok(r.idempotent === null, 'first-submit: idempotent ABSENT → null')
ok(fmtFlag(r.duplicate) === '(absent)', 'first-submit: renders (absent), not false')

// ── missing data response ──
r = parseSubmitResponse({ code: 0, message: 'success' })
ok(r.data === null, 'missing data: data null')
ok(r.duplicate === null && r.conflict === null, 'missing data: flags absent → null (no crash)')

// ── authentication error ──
r = parseSubmitResponse({ code: 401, message: '登录态失效，请重新登录', data: null })
ok(r.code === 401, 'auth error: code preserved')
ok(r.duplicate === null, 'auth error: duplicate absent → null')

// ── undefined/null result (network failure path) ──
r = parseSubmitResponse(undefined)
ok(r.code === undefined && r.data === null, 'undefined response: no throw, data null')

// ── nested flag resolution (top-level fallback only when absent in data) ──
r = parseSubmitResponse({ code: 0, duplicate: true })
ok(r.duplicate === true, 'top-level fallback works when data absent')

// ── privacy: openid redaction ──
// synthetic, clearly-fake token (same SHAPE as a real openid: 'o' + >=20 base62); never a real id
const real = 'oSYNTH9999fakeopenidForTests000000'
ok(redactOpenid(real) === 'oSYNTH…', 'redactOpenid masks real openid to 6+…')
ok(redactOpenid('prefix ' + real + ' suffix').indexOf(real) === -1, 'redactOpenid removes full token in text')
ok(redactOpenid(JSON.stringify({ openid: real, x: 1 })).indexOf(real) === -1, 'redactOpenid handles nested JSON identity')
ok(redactOpenid(null) === '' && redactOpenid(undefined) === '', 'redactOpenid null/undefined safe')
ok(redactJson({ openid: real, nested: { openid: real } }).indexOf(real) === -1, 'redactJson removes nested identity fields')
ok(redactOpenid('ok-no-id-here') === 'ok-no-id-here', 'redactOpenid leaves non-id text intact')

console.log('D10_RESPONSE_PRIVACY_TEST pass=' + pass + ' fail=' + fail)
process.exit(fail ? 1 : 0)
