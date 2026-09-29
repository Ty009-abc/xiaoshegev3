#!/usr/bin/env node
'use strict'
/**
 * tests/rc8.9/world-model-labels.test.js
 *
 * PAYMENT_STAGE5A_R7 — canonical world-model type presenter.
 *
 * Proves that every enum emitted by startChallenge/lib/scoring.js
 * calcFinalType() renders as a human-readable Chinese label and that a raw
 * internal enum key is NEVER shown to users.
 */

const path = require('path')
const fs = require('fs')

let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m) } }
const eq = (a, b, m) => ok(a === b, (m || 'eq') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b))

const ROOT = path.resolve(__dirname, '..', '..')
const labels = require(path.join(ROOT, 'utils', 'worldModelLabels.js'))
const { WORLD_MODEL_TYPE_LABELS, WORLD_MODEL_TYPE_FALLBACK, worldModelTypeLabel, isInternalEnum } = labels

console.log('PAYMENT_STAGE5A_R7 world model type presenter')

// ── 1. every calcFinalType() enum has a label (audit against source) ──
{
  const scoringSrc = fs.readFileSync(path.join(ROOT, 'cloudfunctions', 'startChallenge', 'lib', 'scoring.js'), 'utf8')
  const m = scoringSrc.match(/function calcFinalType[\s\S]*?\n}/)
  ok(!!m, '1.0 calcFinalType found in scoring.js')
  const body = m ? m[0] : ''
  const enums = Array.from(new Set((body.match(/return\s+'([a-z_]+)'/g) || []).map((s) => s.replace(/return\s+'|'/g, ''))))
  ok(enums.length >= 6, '1.1 discovered ≥6 enums (' + enums.join(',') + ')')
  for (const e of enums) {
    ok(Object.prototype.hasOwnProperty.call(WORLD_MODEL_TYPE_LABELS, e), '1.2 enum has label: ' + e)
  }
  // no label defined for an enum that calcFinalType never emits (drift guard)
  for (const k of Object.keys(WORLD_MODEL_TYPE_LABELS)) {
    ok(enums.includes(k), '1.3 label key is a real enum: ' + k)
  }
}

// ── 2. the R7 headline case ──
{
  eq(worldModelTypeLabel('normal_awakened'), '普通觉醒型', '2.1 normal_awakened → 普通觉醒型')
  ok(worldModelTypeLabel('normal_awakened') !== 'normal_awakened', '2.2 RAW ENUM NOT RETURNED')
}

// ── 3. all mapped enums → Chinese, never the raw key ──
{
  for (const [k, v] of Object.entries(WORLD_MODEL_TYPE_LABELS)) {
    eq(worldModelTypeLabel(k), v, '3.1 ' + k + ' → ' + v)
    ok(worldModelTypeLabel(k) !== k, '3.2 ' + k + ' not raw')
    ok(/[\u4e00-\u9fa5]/.test(v), '3.3 ' + k + ' label is Chinese')
  }
}

// ── 4. unknown / missing / malformed → generic fallback, NEVER raw key ──
{
  eq(worldModelTypeLabel('mystery_type'), WORLD_MODEL_TYPE_FALLBACK, '4.1 unknown → fallback')
  eq(worldModelTypeLabel(''), WORLD_MODEL_TYPE_FALLBACK, '4.2 empty → fallback')
  eq(worldModelTypeLabel(undefined), WORLD_MODEL_TYPE_FALLBACK, '4.3 undefined → fallback')
  eq(worldModelTypeLabel(null), WORLD_MODEL_TYPE_FALLBACK, '4.4 null → fallback')
  eq(worldModelTypeLabel(12345), WORLD_MODEL_TYPE_FALLBACK, '4.5 number → fallback')
  eq(worldModelTypeLabel('NORMAL_AWAKENED'), WORLD_MODEL_TYPE_FALLBACK, '4.6 case-sensitive unknown → fallback (not raw)')
  ok(WORLD_MODEL_TYPE_FALLBACK !== '认知探索者' === false, '4.7 fallback is the generic Chinese label')
  ok(/[\u4e00-\u9fa5]/.test(WORLD_MODEL_TYPE_FALLBACK), '4.8 fallback is Chinese')
  ok(!/^[a-z_]+$/.test(worldModelTypeLabel('mystery_type')), '4.9 fallback is not a raw snake_case key')
}

// ── 5. isInternalEnum helper ──
{
  eq(isInternalEnum('normal_awakened'), true, '5.1 known enum detected')
  eq(isInternalEnum('whatever'), false, '5.2 unknown not internal')
}

// ── 6. challenge-result page wires the presenter (imports + uses it) ──
{
  const pageSrc = fs.readFileSync(path.join(ROOT, 'pages', 'challenge-result', 'challenge-result.js'), 'utf8')
  ok(pageSrc.indexOf("require('../../utils/worldModelLabels.js')") >= 0, '6.1 page requires canonical presenter')
  ok(pageSrc.indexOf('worldModelTypeLabel(') >= 0, '6.2 page calls worldModelTypeLabel')
  ok(pageSrc.indexOf("raw.finalType || ") < 0, '6.3 page no longer falls back to raw finalType')
}

console.log(`\nworld-model-labels_TEST pass=*** fail=${fail}`)
process.exit(fail ? 1 : 0)
