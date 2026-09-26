'use strict'
/**
 * tests/legacy6q/legacy6q-route-entry.test.js
 *
 * RC8.8_STAGE2_R1_1 — 6Q ENTRY AUTHORITY route tests.
 *
 * Real-device evidence proved the primary "开始翻身策略" CTA still opened the
 * OLD 10-screen Hybrid questionnaire even though the new 6Q page was registered.
 * These tests pin the FIX so it cannot silently regress:
 *
 *   1. PRIMARY_HOME_CTA → 6Q questionnaire
 *   2. RETRY/RESTART (6Q report) → 6Q questionnaire
 *   3. 6Q page totalCount = 6 (contract, not hard-coded)
 *   4. no PRIMARY entry point targets the OLD 10Q hybrid page
 *
 * Old 10Q / hybrid pages remain as frozen reference (not deleted) — they are
 * simply NOT a primary entry anymore.
 */

const h = require('../turnaround6q/_harness.js')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../../')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

const SIX_Q_Q = '/pages/turnaround-6q-questionnaire/turnaround-6q-questionnaire'
const SIX_Q_R = '/pages/turnaround-6q-report/turnaround-6q-report'
const THINKING = '/pages/legacy6q-thinking/legacy6q-thinking'
const READY_REPORT = '/pages/legacy6q-report/legacy6q-report'
const OLD_HYBRID_Q = '/pages/turnaround-v6-hybrid-questionnaire/turnaround-v6-hybrid-questionnaire'

const homeJs = read('pages/home/home.js')
const q6Js = read('pages/turnaround-6q-questionnaire/turnaround-6q-questionnaire.js')
const r6Js = read('pages/turnaround-6q-report/turnaround-6q-report.js')
const thinkJs = read('pages/legacy6q-thinking/legacy6q-thinking.js')
const appJson = JSON.parse(read('app.json'))

h.section('RC8.8 Stage2 — 6Q entry authority')

// ── §1 PRIMARY_HOME_CTA → 6Q ──────────────────────────────────────────────
// Extract the goStrategy() body and assert the navigateTo target.
const goStrategyBody = (homeJs.match(/goStrategy\s*\([^)]*\)\s*\{([\s\S]*?)\n\s*\},/) || [])[1] || ''
h.ok(goStrategyBody.includes(SIX_Q_Q), 'PRIMARY_HOME_CTA navigateTo targets 6Q questionnaire')
h.ok(!goStrategyBody.includes(OLD_HYBRID_Q), 'PRIMARY_HOME_CTA does NOT target old 10Q hybrid')

// ── §2 RETRY / RESTART → 6Q, and the R5 thinking chain ────────────────────
// RC8.8_STAGE2_R2: restored 07/11 UI uses onRetry + QUESTIONNAIRE_ROUTE (the
// 07/11 result page names its retry action onRetry / 「重做诊断」).
// RC8.8_STAGE2_R5: Q6 submit now routes to the dedicated thinking page, which
// owns the ONE model call and redirects to the ready-report page.
h.ok(r6Js.includes("QUESTIONNAIRE_ROUTE = '" + SIX_Q_Q + "'"), '6Q report QUESTIONNAIRE_ROUTE constant = 6Q questionnaire')
h.ok(/onRetry[\s\S]{0,240}redirectTo\(\{\s*url:\s*QUESTIONNAIRE_ROUTE/.test(r6Js), '6Q report onRetry redirects to 6Q questionnaire')
// The legacy 07/11 report page is retained as a frozen reference while the R5
// ready-report page takes the primary chain.
h.ok(/QUESTIONNAIRE_ROUTE = '" + SIX_Q_Q + "'/.test(q6Js) || q6Js.includes('THINKING_ROUTE'), '6Q questionnaire declares its next-step route constant')
h.ok(q6Js.includes("THINKING_ROUTE = '" + THINKING + "'"), '6Q questionnaire THINKING_ROUTE = legacy6q-thinking')
h.ok(/redirectTo\(\{\s*url:\s*THINKING_ROUTE/.test(q6Js), '6Q submit redirects to the thinking page')
const tReport = read('pages/legacy6q-report/legacy6q-report.js')
h.ok(thinkJs.includes("REPORT_ROUTE = '" + READY_REPORT + "'"), 'thinking page REPORT_ROUTE = legacy6q-report')
h.ok(/redirectTo\(\{\s*url:\s*REPORT_ROUTE/.test(thinkJs), 'thinking page redirects to the ready-report page on success')
h.ok(tReport.includes("QUESTIONNAIRE_ROUTE = '" + SIX_Q_Q + "'"), 'ready-report QUESTIONNAIRE_ROUTE = 6Q questionnaire')

// ── §3 6Q page totalCount = 6 (contract, not hard-coded literal) ─────────
const clientQ = require(path.join(ROOT, 'utils/turnaround6q/turnaround6qQuestionnaire.js'))
h.eq(clientQ.QUESTION_COUNT_6Q, 6, '6Q client QUESTION_COUNT_6Q = 6')
// RC8.8_STAGE2_R2: the restored 07/11 UI declares its own 6-question data source
// (DIAGNOSTIC_QUESTIONS) and drives total from its length. Assert the contract
// (6 questions, 6th key = rootCause) rather than a specific helper name.
const Q_SRC = q6Js.includes('getQuestions6Q()')
  ? 'getQuestions6Q()'
  : 'DIAGNOSTIC_QUESTIONS'
h.ok(q6Js.includes(Q_SRC), '6Q questionnaire loads its questions from the 6Q data source')
const qCount = (q6Js.match(/\{ id:\s*'/g) || []).length
h.eq(qCount, 6, '6Q questionnaire declares exactly 6 questions')
h.ok(/\[.*'rootCause'/.test(q6Js) || /id:\s*'rootCause'/.test(q6Js), '6Q questionnaire includes rootCause (Q6)')
h.ok(/dQ\.total|totalCount|DIAGNOSTIC_QUESTIONS\.length/.test(q6Js), '6Q questionnaire total count is driven by the 6-question contract')

// ── §4 No PRIMARY entry point targets the OLD 10Q hybrid page ─────────────
// Primary entry points = home CTA, home hero, 6Q restart, tabbar pages.
// The hybrid page MAY still appear in app.json (frozen reference) and in tests.
const primarySources = {
  'pages/home/home.js': homeJs,
  'pages/turnaround-6q-questionnaire/turnaround-6q-questionnaire.js': q6Js,
  'pages/turnaround-6q-report/turnaround-6q-report.js': r6Js,
  'pages/legacy6q-thinking/legacy6q-thinking.js': thinkJs,
  'pages/legacy6q-report/legacy6q-report.js': tReport,
}
let oldHybridPrimaryCount = 0
for (const [file, src] of Object.entries(primarySources)) {
  // count actual navigation calls into the old hybrid page
  const navRe = new RegExp("(navigateTo|redirectTo|reLaunch|switchTab)\\s*\\(\\s*\\{\\s*url\\s*:\\s*['\"]" + OLD_HYBRID_Q.replace(/[/.]/g, '\\$&'), 'g')
  const hits = (src.match(navRe) || []).length
  oldHybridPrimaryCount += hits
  h.eq(hits, 0, `no primary navigation to old 10Q hybrid in ${file}`)
}
h.eq(oldHybridPrimaryCount, 0, 'OLD_10Q_PRIMARY_ENTRY_COUNT = 0')

// ── §registry: 6Q page is registered, old hybrid NOT deleted ───────────────
h.ok(appJson.pages.includes(SIX_Q_Q.slice(1)), 'app.json registers 6Q questionnaire')
h.ok(appJson.pages.includes(THINKING.slice(1)), 'app.json registers the R5 thinking page')
h.ok(appJson.pages.includes(READY_REPORT.slice(1)), 'app.json registers the R5 ready-report page')
h.ok(appJson.pages.includes(OLD_HYBRID_Q.slice(1)), 'old 10Q hybrid page retained (frozen reference, not deleted)')
h.summary('RC8.8 Stage2 R1.1 — 6Q ENTRY AUTHORITY')
