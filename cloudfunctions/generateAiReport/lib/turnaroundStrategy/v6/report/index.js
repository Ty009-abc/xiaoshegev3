'use strict'
/**
 * turnaroundStrategy/v6/report/index.js
 *
 * Public surface of the V6 five-card report builder.
 * Consumer layer only. Not wired into generateAiReport/index.js.
 */

const { buildReportV6, REPORT_VERSION } = require('./reportBuilderV6.js')
const { validateReportV6, visibleText, FORBIDDEN_USER_TOKENS, CARD_KEYS, CARD01_MAX_CHARS } = require('./reportValidatorV6.js')
const fatalInsightV6 = require('./fatalInsightV6.js')
const coreProblemV6 = require('./coreProblemV6.js')
const systemLoopV6 = require('./systemLoopV6.js')
const turnaroundPathV6 = require('./turnaroundPathV6.js')
const firstActionCopyV6 = require('./firstActionCopyV6.js')
const reportCopyV6 = require('./reportCopyV6.js')

module.exports = {
  buildReportV6,
  REPORT_VERSION,
  validateReportV6,
  visibleText,
  FORBIDDEN_USER_TOKENS,
  CARD_KEYS,
  CARD01_MAX_CHARS,
  fatalInsightV6,
  coreProblemV6,
  systemLoopV6,
  turnaroundPathV6,
  firstActionCopyV6,
  reportCopyV6
}
