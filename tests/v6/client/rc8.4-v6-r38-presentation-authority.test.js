'use strict'
/**
 * tests/v6/client/rc8.4-v6-r38-presentation-authority.test.js
 *
 * R38 — ONE FINAL PRESENTATION AUTHORITY per card.
 * Proves the CLIENT view model renders each semantic idea exactly once and
 * cannot double-render aggregate source + structured copy, and that legacy
 * Card05 productivity advice cannot leak into an R35 reality-test report.
 *
 * Presentation-only. No backend semantic change. Deterministic.
 */

const assert = require('assert')
const path = require('path')
const ROOT = path.resolve(__dirname, '../../..')
const CF = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6')
const { diagnoseTurnaroundV6 } = require(path.join(CF, 'index.js'))
const { buildReportV6 } = require(path.join(CF, 'report/index.js'))
const VM = require(path.join(ROOT, 'utils/v6/turnaroundReportViewModelV6.js'))
const F = require(path.join(ROOT, 'tests/v6/fixtures.js'))

let pass = 0, fail = 0
function t (name, fn) { try { fn(); pass++; console.log('  ok  ' + name) } catch (e) { fail++; console.log('  FAIL ' + name + ' :: ' + e.message) } }

const LEGACY_CARD05 = [
  '先定一个每天固定的时间段',
  '只盯连续天数',
  '不盯做得多完美',
  '每天30分钟',
  '每天固定30分钟',
  '坚持5天',
  '连续做5天',
  '固定的时段',
]

function envelopeFor (answers) {
  const d = diagnoseTurnaroundV6(answers)
  const report = buildReportV6(d)
  return {
    code: 0,
    data: {
      reportType: 'turnaround_strategy_v6',
      diagnosticVersion: 'turnaround_strategy_v6',
      v6PrimaryActive: true,
      reportVersion: report.reportVersion,
      reportState: report.reportState,
      cards: report.cards,
    },
  }
}

// Render every PRIMARY case through the CLIENT view model (what the phone sees).
const rendered = []
for (const c of [...F.GOLDEN, ...F.ADVERSARIAL]) {
  const d = diagnoseTurnaroundV6(c.answers)
  if (d.diagnosisState !== 'PRIMARY') continue
  const vm = VM.buildTurnaroundReportViewModelV6(envelopeFor(c.answers))
  rendered.push({ id: c.id, vm })
}

console.log('R38 presentation authority tests (n=' + rendered.length + ')')

// ── §12 five cards remain present ───────────────────────────────
t('§12 CARD_COUNT = 5 on every case', () => {
  for (const x of rendered) assert.strictEqual(x.vm.cards.length, 5, x.id + ' card count')
  console.log('   CARD_COUNT = 5')
})

t('§12 card order + single presentation key per card', () => {
  const keys = ['fatalInsight', 'coreProblem', 'systemLoop', 'turnaroundPath', 'firstAction']
  for (const x of rendered) assert.strictEqual(x.vm.cards.map((c) => c.key).join(','), keys.join(','), x.id + ' order')
})

// ── §4 CARD01: oneLiner only, no duplicate body ─────────────────
t('§4 CARD01 renders oneLiner exactly once (no separate body)', () => {
  for (const x of rendered) {
    const c = x.vm.cards[0]
    assert.ok(c.oneLiner && c.oneLiner.length > 0, x.id + ' card01 oneLiner')
    assert.ok(!('body' in c), x.id + ' card01 must NOT carry a second body')
  }
})

// ── §4 CARD02: body once, never re-rendered as loopNodes ────────
t('§4 CARD02 renders body exactly once (no bullets)', () => {
  for (const x of rendered) {
    const c = x.vm.cards[1]
    assert.ok(c.body && c.body.length > 0, x.id + ' card02 body')
    assert.ok(!('loopNodes' in c), x.id + ' card02 must NOT carry loopNodes')
  }
})

// ── §4 CARD03: loopNodes + finalInsight, NO body paragraph ──────
t('§4 CARD03_USER_VISIBLE_BODY_DUPLICATE_COUNT = 0', () => {
  let dup = 0
  for (const x of rendered) {
    const c = x.vm.cards[2]
    assert.ok(Array.isArray(c.loopNodes) && c.loopNodes.length >= 4, x.id + ' card03 loopNodes')
    assert.ok(typeof c.finalInsight === 'string' && c.finalInsight.length > 0, x.id + ' card03 finalInsight')
    if ('body' in c) { dup++; console.log('   duplicate body:', x.id) }
  }
  console.log('   CARD03_USER_VISIBLE_BODY_DUPLICATE_COUNT = ' + dup)
  assert.strictEqual(dup, 0)
})

t('§4 CARD03_SEMANTIC_IDEA_RENDER_COUNT_PER_NODE = 1', () => {
  for (const x of rendered) {
    const nodes = x.vm.cards[2].loopNodes
    const uniq = new Set(nodes.map((s) => s.trim()))
    assert.strictEqual(uniq.size, nodes.length, x.id + ' duplicate loop node text')
  }
})

// ── §5 CARD04: from/to + worldRule, NO duplicate paragraph ──────
t('§5 CARD04_DUPLICATE_FROM_TO_COUNT = 0', () => {
  let dup = 0
  for (const x of rendered) {
    const c = x.vm.cards[3]
    assert.ok(c.from || c.to, x.id + ' card04 from/to')
    assert.ok(typeof c.worldRule === 'string' && c.worldRule.length > 0, x.id + ' card04 worldRule')
    // The aggregate `body`/`logic` paragraph (which restates FROM/TO) must NOT render.
    if ('body' in c) { dup++; console.log('   duplicate body:', x.id) }
  }
  console.log('   CARD04_DUPLICATE_FROM_TO_COUNT = ' + dup)
  assert.strictEqual(dup, 0)
})

// ── §6/§7 CARD05: R35 reality-test payload only, no legacy checks ─
t('§6 LEGACY_CARD05_ADVICE_LEAK_COUNT = 0', () => {
  let leak = 0
  for (const x of rendered) {
    const c = x.vm.cards[4]
    const blob = JSON.stringify(c)
    for (const p of LEGACY_CARD05) if (blob.includes(p)) { leak++; console.log('   leak:', x.id, p) }
    assert.ok(!('checks' in c), x.id + ' card05 must NOT render legacy checks')
  }
  console.log('   LEGACY_CARD05_ADVICE_LEAK_COUNT = ' + leak)
  assert.strictEqual(leak, 0)
})

t('§7 CARD05 renders primaryAction + target/timebox + signal + decision', () => {
  for (const x of rendered) {
    const c = x.vm.cards[4]
    assert.ok(typeof c.primaryAction === 'string' && c.primaryAction.length > 0, x.id + ' primaryAction')
    assert.ok(typeof c.timebox === 'string' && c.timebox.length > 0, x.id + ' timebox')
    assert.ok(typeof c.signal === 'string' && c.signal.length > 0, x.id + ' signal')
    assert.ok(typeof c.decision === 'string' && c.decision.length > 0, x.id + ' decision')
  }
})

// ── §8 no duplicate sentences / ideas inside a rendered card ────
t('§8 USER_VISIBLE_DUPLICATE_SENTENCE_COUNT = 0', () => {
  let dup = 0
  for (const x of rendered) {
    for (const c of x.vm.cards) {
      const lines = []
      if (c.oneLiner) lines.push(c.oneLiner)
      if (c.body) lines.push(c.body)
      if (c.loopNodes) lines.push(...c.loopNodes)
      if (c.finalInsight) lines.push(c.finalInsight)
      if (c.from) lines.push(c.from)
      if (c.to) lines.push(c.to)
      if (c.worldRule) lines.push(c.worldRule)
      if (c.primaryAction) lines.push(c.primaryAction)
      if (c.signal) lines.push(c.signal)
      if (c.decision) lines.push(c.decision)
      const uniq = new Set(lines.map((s) => String(s).trim()))
      if (uniq.size !== lines.length) { dup++; console.log('   dup lines:', x.id, c.key) }
    }
  }
  console.log('   USER_VISIBLE_DUPLICATE_SENTENCE_COUNT = ' + dup)
  assert.strictEqual(dup, 0)
})

t('§8 USER_VISIBLE_DUPLICATE_IDEA_COUNT = 0', () => {
  let dup = 0
  for (const x of rendered) {
    // An idea repeated across cards is a product defect; compare normalized card text.
    const seen = {}
    for (const c of x.vm.cards) {
      const idea = [c.oneLiner, c.body, c.finalInsight, c.worldRule].filter(Boolean).join(' ').replace(/\s+/g, '')
      if (idea.length > 12 && seen[idea]) { dup++; console.log('   dup idea:', x.id) }
      seen[idea] = 1
    }
  }
  console.log('   USER_VISIBLE_DUPLICATE_IDEA_COUNT = ' + dup)
  assert.strictEqual(dup, 0)
})

// ── §12 no content lost ─────────────────────────────────────────
t('§12 no content lost (each card carries its authoritative block)', () => {
  for (const x of rendered) {
    const [c1, c2, c3, c4, c5] = x.vm.cards
    assert.ok(c1.oneLiner, x.id + ' c1')
    assert.ok(c2.body, x.id + ' c2')
    assert.ok(c3.loopNodes.length && c3.finalInsight, x.id + ' c3')
    assert.ok((c4.from || c4.to) && c4.worldRule, x.id + ' c4')
    assert.ok(c5.primaryAction && c5.signal && c5.decision, x.id + ' c5')
  }
})

// ── §1/§6 DUPLICATE_RENDER_COUNT aggregate ──────────────────────
t('§12 DUPLICATE_RENDER_COUNT = 0', () => {
  let dup = 0
  for (const x of rendered) for (const c of x.vm.cards) if ('body' in c && (c.key === 'systemLoop' || c.key === 'turnaroundPath')) dup++
  console.log('   DUPLICATE_RENDER_COUNT = ' + dup)
  assert.strictEqual(dup, 0)
})

console.log('\nR38 presentation authority: ' + pass + ' passed, ' + fail + ' failed')
process.exit(fail ? 1 : 0)
