'use strict'
/**
 * RC8_14_D10_R4 — test-client-only helpers.
 *   1) parseSubmitResponse: read business flags from the CORRECT nesting (res.data.*),
 *      distinguish an ABSENT flag from an explicit false, never synthesize a PASS.
 *   2) redactOpenid / redactJson: strip full WeChat openid-like tokens BEFORE logging.
 *
 * Pure functions — no wx runtime, no network, no DB → directly unit-testable.
 */

// Full openid: 'o' + >=20 of [A-Za-z0-9_-] (real ids are ~28 chars). Keeps a 6-char prefix.
const OPENID_RE = /o[A-Za-z0-9_-]{20,}/g

function redactOpenid (s) {
  return String(s == null ? '' : s).replace(OPENID_RE, (m) => m.slice(0, 6) + '…')
}

function redactJson (obj, max) {
  let s
  try { s = JSON.stringify(obj) } catch (e) { s = String(obj) }
  s = redactOpenid(s)
  return (typeof max === 'number') ? s.slice(0, max) : s
}

// Read a boolean flag from data first, then top level. null === ABSENT (≠ false).
function pickFlag (res, data, key) {
  if (data && Object.prototype.hasOwnProperty.call(data, key)) return !!data[key]
  if (res && Object.prototype.hasOwnProperty.call(res, key)) return !!res[key]
  return null
}

function parseSubmitResponse (res) {
  const data = (res && typeof res.data === 'object' && res.data) ? res.data : null
  let currentEventIndex = null
  if (data && data.currentEventIndex !== undefined) currentEventIndex = data.currentEventIndex
  else if (res && res.currentEventIndex !== undefined) currentEventIndex = res.currentEventIndex
  return {
    code: res ? res.code : undefined,
    message: res ? (res.message || '') : '',
    data,
    duplicate: pickFlag(res, data, 'duplicate'),
    idempotent: pickFlag(res, data, 'idempotent'),
    conflict: pickFlag(res, data, 'conflict'),
    currentEventIndex,
  }
}

// null → '(absent)'; boolean → 'true'/'false'. Never turns an unexpected response into PASS.
function fmtFlag (v) { return v === null ? '(absent)' : String(v) }

module.exports = { redactOpenid, redactJson, parseSubmitResponse, fmtFlag, OPENID_RE }
