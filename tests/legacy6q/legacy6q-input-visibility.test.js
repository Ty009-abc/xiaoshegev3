'use strict'
/**
 * tests/legacy6q/legacy6q-input-visibility.test.js
 *
 * RC8.8_STAGE2_R2 — 6Q INPUT VISIBILITY contract tests (LEGACY 07/11 UI).
 *
 * The recovery restores the proven 2026-07-11 diagnostic UI. Its input contract
 * is an EXPLICIT light-theme one: a light field (#F9FAFB) on a light page
 * (#f8f9fa), dark readable text (#101828), a visible border (#E5E7EB) and a
 * muted placeholder (#D0D5DD). These tests pin it so it cannot silently regress.
 *
 * The page renders ONE dynamic <input>/<textarea> bound to dQ.idx, so all six
 * questions share the same `.d-input-area input/textarea` rule.
 */

const h = require('../turnaround6q/_harness.js')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

const wxss = read('pages/turnaround-6q-questionnaire/turnaround-6q-questionnaire.wxss')
const wxml = read('pages/turnaround-6q-questionnaire/turnaround-6q-questionnaire.wxml')
const js = read('pages/turnaround-6q-questionnaire/turnaround-6q-questionnaire.js')

// ── extract the .d-input-area input/textarea rule block ────────────────────
const block = (wxss.match(/\.d-input-area\s+input\s*,\s*\.d-input-area\s+textarea\s*\{([\s\S]*?)\}/) || [])[1] || ''
const areaBlock = (wxss.match(/\.d-input-area\s*\{([\s\S]*?)\}/) || [])[1] || ''
const prop = (src, name) => {
  const m = src.match(new RegExp(name + '\\s*:\\s*([^;]+);'))
  return m ? m[1].trim() : ''
}

h.section('RC8.8 Stage2 R2 — 6Q legacy input visibility contract')

// ── §1 page vs field background must differ & field must be a solid light ──
const pageBg = (wxss.match(/\.page\s*\{[\s\S]*?background\s*:\s*([^;]+);/) || [])[1] || ''
h.ok(pageBg !== '', 'page background is set explicitly')
const areaBg = prop(areaBlock, 'background')
h.ok(areaBg !== '', 'input area background is set explicitly')
h.ok(areaBg.toUpperCase() !== pageBg.toUpperCase(), 'INPUT_BACKGROUND != PAGE_BACKGROUND')
h.ok(!/rgba\(0\s*,\s*0\s*,\s*0\s*,|rgba\(255\s*,\s*255\s*,\s*255/.test(areaBg), 'field bg is a solid colour (not translucent over the page)')

// ── §2 dark readable text ─────────────────────────────────────────────────
const inputColor = prop(block, 'color')
h.ok(inputColor !== '', 'input text colour is set explicitly')
h.ok(!/#fff|#ffffff|white/i.test(inputColor), 'input text is NOT near-white')
h.ok(/#101828|#0{0,3}0{0,3}0{0,3}/i.test(inputColor), 'input text is a dark readable colour (#101828)')

// ── §3 field well is explicitly set (07/11: light well inside the white card) ──
// The proven 07/11 UI distinguishes the field from the surrounding WHITE card by
// an explicit light-grey well (#F9FAFB) — there is NO border in the original.
const cardBg = (wxss.match(/\.d-card\s*\{([\s\S]*?)\}/) || [])[1] || ''
h.ok(prop(cardBg, 'background') !== '', 'question card background is set explicitly (white)')
h.ok(areaBg.toUpperCase() !== prop(cardBg, 'background').toUpperCase(), 'INPUT_AREA_BACKGROUND != CARD_BACKGROUND (field is a distinct well)')
h.ok(/#F9FAFB|#F[0-9A-F]{2}[0-9A-F]{2}[0-9A-F]{2}/i.test(areaBg), 'field well is an explicit light colour (#F9FAFB)')

// ── §4 placeholder readability ────────────────────────────────────────────
const ph = (wxss.match(/\.d-placeholder\s*\{([\s\S]*?)\}/) || [])[1] || ''
h.ok(/color\s*:\s*#[0-9a-fA-F]{3,6}/.test(ph), 'placeholder class has an explicit hex colour')
h.ok(wxml.indexOf('placeholder-class="d-placeholder"') !== -1, 'controls bind placeholder-class="d-placeholder"')

// ── §5 one dynamic control → applies to ALL SIX questions ──────────────────
h.ok(/<input\s+wx:if="\{\{dQ\.idx<=3\}\}"/.test(wxml), 'one dynamic <input> for Q1..Q4')
h.ok(/<textarea\s+wx:else/.test(wxml), 'one dynamic <textarea> for Q5..Q6')
h.ok(/DIAGNOSTIC_QUESTIONS\s*=\s*\[/.test(js), 'questionnaire declares the 6-question data source')
h.eq((js.match(/\{ id:\s*'/g) || []).length, 6, 'exactly 6 questions share the control contract')

// ── §6 empty current question cannot advance (07/11 contract preserved) ────
h.ok(/onDNext\s*\(\)\s*\{[\s\S]*?if\s*\(!answers\[idx\]\s*\|\|\s*!String\(answers\[idx\]\)\.trim\(\)\)/.test(js), 'onDNext blocks an empty/whitespace answer')
h.ok(/onDNext[\s\S]*?showToast[\s\S]*?return/.test(js), 'onDNext toasts + returns on invalid input')
h.ok(/disabled="\{\{!dQ\.canNext\}\}"/.test(wxml), '下一题 is disabled until valid input (07/11 canNext contract)')
h.ok(/onDInput[\s\S]*?'dQ\.canNext':\s*valid/.test(js), 'onDInput drives dQ.canNext from input validity')

h.summary('RC8.8 Stage2 R2 — 6Q legacy input visibility')
