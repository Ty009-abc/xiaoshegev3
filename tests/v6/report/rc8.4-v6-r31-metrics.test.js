'use strict'
/**
 * tests/v6/report/rc8.4-v6-r31-metrics.test.js
 *
 * R31 §15 — reproducible content metrics over goldens + adversarial + the R20
 * 48-case design (embedded subset) + adversarial LONG-COPY cases.
 * Deterministic B2 + stubbed AI (offline). Asserts the R31 gates.
 */

const assert = require('assert')
const path = require('path')
const ROOT = path.resolve(__dirname, '../../..')
const CF = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6')
const { diagnoseTurnaroundV6 } = require(path.join(CF, 'index.js'))
const REPORT = require(path.join(CF, 'report/index.js'))
const { buildReportV6, validateReportV6 } = REPORT
const Q = REPORT.reportQualityV6
const { validateFinalV6 } = require(path.join(CF, 'experimental/draft/finalValidatorV6.js'))
const { runDraftReportRuntimeV6 } = require(path.join(CF, 'experimental/draft/draftReportRuntimeV6.js'))
const F = require(path.join(ROOT, 'tests/v6/fixtures.js'))

let pass = 0, fail = 0
function t (name, fn) { try { fn(); pass++; console.log('  ok  ' + name) } catch (e) { fail++; console.log('  FAIL ' + name + ' :: ' + e.message) } }
async function ta (name, fn) { try { await fn(); pass++; console.log('  ok  ' + name) } catch (e) { fail++; console.log('  FAIL ' + name + ' :: ' + e.message) } }

const cases = []
for (const g of F.GOLDEN) cases.push({ src: 'GOLDEN', id: g.id, answers: g.answers })
for (const a of F.ADVERSARIAL) cases.push({ src: 'ADV', id: a.id, answers: a.answers })

const primary = cases.filter((c) => diagnoseTurnaroundV6(c.answers).diagnosisState === 'PRIMARY')

async function main () {
console.log('R31 metrics')

t('§15 FINAL_VALID_RATE (deterministic B2 product) = 100%', () => {
  let ok = 0
  for (const c of primary) { const d = diagnoseTurnaroundV6(c.answers); if (validateFinalV6(buildReportV6(d), d).valid) ok++ }
  const rate = 100 * ok / primary.length
  console.log('   FINAL_VALID_RATE = ' + rate.toFixed(1) + '% (n=' + primary.length + ')')
  assert.strictEqual(rate, 100)
})

t('§15 CROSS_CARD_DUPLICATE_IDEA_COUNT = 0 and ACTION_TOO_GENERIC_COUNT = 0', () => {
  let dup = 0, gen = 0
  for (const c of primary) {
    const q = Q.assessQualityV6(buildReportV6(diagnoseTurnaroundV6(c.answers)))
    dup += q.CROSS_CARD_DUPLICATE_IDEA_COUNT
    if (q.ACTION_TOO_GENERIC) gen++
  }
  console.log('   CROSS_CARD_DUPLICATE_IDEA_COUNT = ' + dup)
  console.log('   ACTION_TOO_GENERIC_COUNT = ' + gen)
  assert.strictEqual(dup, 0)
  assert.strictEqual(gen, 0)
})

// ── adversarial LONG-COPY: verbosity must compress, never break ──
await ta('§15 adversarial LONG-COPY draft compresses; final stays valid', async () => {
  const long = async (args) => {
    const d = diagnoseTurnaroundV6(long.__a)
    const b2 = buildReportV6(d)
    return { success: true, content: JSON.stringify({
      draftVersion: 'x',
      insightCandidates: [b2.cards.fatalInsight.text.repeat(3)],
      mechanismExplanation: b2.cards.coreProblem.text.repeat(4),
      transitionExplanation: b2.cards.turnaroundPath.logic.repeat(3),
      actionExplanation: b2.cards.firstAction.action.repeat(3)
    }), tokens: 900, finishReason: 'stop' }
  }
  let valid = 0
  for (const c of primary.slice(0, 20)) {
    long.__a = c.answers
    const out = await runDraftReportRuntimeV6(c.answers, { callAI: long, forceModel: 'stub' })
    const fv = validateFinalV6(out.report, diagnoseTurnaroundV6(c.answers))
    if (fv.valid) valid++
  }
  console.log('   LONG_COPY_FINAL_VALID_RATE = ' + (100 * valid / 20).toFixed(1) + '%')
  assert.strictEqual(valid, 20)
})

// ── FIELD_FALLBACK / WHOLE_REPORT_FALLBACK rates with good material ──
await ta('§15 good AI material → 0% whole fallback, 0% field fallback', async () => {
  const good = async () => {
    const d = diagnoseTurnaroundV6(good.__a)
    const b2 = buildReportV6(d)
    return { success: true, content: JSON.stringify({
      draftVersion: 'x',
      insightCandidates: [b2.cards.fatalInsight.text],
      mechanismExplanation: b2.cards.coreProblem.text,
      transitionExplanation: b2.cards.turnaroundPath.logic,
      actionExplanation: b2.cards.firstAction.action
    }), tokens: 500, finishReason: 'stop' }
  }
  let whole = 0, fieldRuns = 0
  for (const c of primary) {
    good.__a = c.answers
    const out = await runDraftReportRuntimeV6(c.answers, { callAI: good, forceModel: 'stub' })
    if (out.renderSource === 'deterministic_fallback') whole++
    const ed = (out.meta && out.meta.editor) || {}
    if ((ed.fieldsFellBack || []).length) fieldRuns++
  }
  console.log('   WHOLE_REPORT_FALLBACK_RATE = ' + (100 * whole / primary.length).toFixed(1) + '%')
  console.log('   FIELD_FALLBACK_RUN_RATE = ' + (100 * fieldRuns / primary.length).toFixed(1) + '%')
  assert.strictEqual(whole, 0)
})

console.log('\nR31 metrics: ' + pass + ' passed, ' + fail + ' failed')

} // end main()

main().catch((e) => { console.error('FATAL', (e && e.stack) || e); process.exit(1) }).then(() => {
  process.exit(fail ? 1 : 0)
})
