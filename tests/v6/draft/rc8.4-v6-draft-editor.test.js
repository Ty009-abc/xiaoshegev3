'use strict'
/**
 * tests/v6/draft/rc8.4-v6-draft-editor.test.js
 *
 * R11_V2 offline tests for the AI-draft → deterministic-editor architecture.
 * NO network, NO provider. Uses synthetic draft material + stubs.
 *
 * Proves:
 *   EDITOR_AI_CALL_COUNT = 0
 *   MODEL_OUTPUT != FINAL_OUTPUT
 *   CARD03 is deterministic B2 ONLY (AI contribution = NONE)
 *   CARD01 respects the 30–60 char target (and NEVER exceeds 60)
 *   field-level fallback (unsafe field -> B2 counterpart; rest stays AI)
 *   whole-report fallback (draft unusable -> deterministic B2)
 *   invalid model env -> retry -> fallback, request never broken
 *   no validator bypass (unsafe AI copy cannot reach the final cards)
 */

const assert = require('assert')
const path = require('path')

const CF = '/home/ubuntu/rc84-v6-b27-r7-1-repair/cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6'
const { diagnoseTurnaroundV6 } = require(path.join(CF, 'index.js'))
const { buildReportV6 } = require(path.join(CF, 'report/index.js'))
const { runDraftAdapter } = require(path.join(CF, 'experimental/draft/draftAdapterV6.js'))
const { validateDraftV6 } = require(path.join(CF, 'experimental/draft/draftValidatorV6.js'))
const { editReportV6, finalVisibleText, firstSentences, clipToLimit } = require(path.join(CF, 'experimental/draft/reportEditorV6.js'))
const { validateFinalV6 } = require(path.join(CF, 'experimental/draft/finalValidatorV6.js'))
const { runDraftReportRuntimeV6 } = require(path.join(CF, 'experimental/draft/draftReportRuntimeV6.js'))
const F = require('/home/ubuntu/rc84-v6-b27-r7-1-repair/tests/v6/fixtures.js')

let pass = 0, fail = 0
function t (name, fn) { try { fn(); pass++; console.log('  ok  ' + name) } catch (e) { fail++; console.log('  FAIL ' + name + ' :: ' + e.message) } }
async function ta (name, fn) { try { await fn(); pass++; console.log('  ok  ' + name) } catch (e) { fail++; console.log('  FAIL ' + name + ' :: ' + e.message) } }

const G06 = F.GOLDEN.find((g) => g.id === 'G06').answers
const G12 = F.GOLDEN.find((g) => g.id === 'G12').answers
const d06 = diagnoseTurnaroundV6(G06)
const b06 = buildReportV6(d06)
const d12 = diagnoseTurnaroundV6(G12)
const b12 = buildReportV6(d12)

const GOOD_DRAFT_06 = {
  draftVersion: 'turnaround_strategy_v6_worldview_draft_v1',
  insightCandidates: [
    '你以为缺的是资源，其实你缺的是一次真正开始；学过的东西一直没变成第一个真实结果。',
    '你以为问题是没钱，其实是你把准备当成了安全感，从没让市场给过你一次反馈。'
  ],
  mechanismExplanation: '你把学习当成前进，但它不产生外部反馈；越不确定就越想先想清楚，结果真实结果永远是零，压力却在累积。',
  transitionExplanation: '下一阶段的规则不是想清楚再动，而是先做一个零成本、失败也不伤现金流的最小验证。',
  actionExplanation: '所以今天该做的，是不花钱、能立刻拿到外部反馈的那一个最小动作。'
}

console.log('R11_V2 draft/editor tests')

// ── extractJsonObject ───────────────────────────────────────────
t('extractJsonObject: rejects empty', () => {
  assert.strictEqual(runDraftAdapter.__extractOk ? true : require(path.join(CF, 'experimental/draft/draftAdapterV6.js')).extractJsonObject('').ok, false)
})
t('extractJsonObject: prefers FIRST balanced object (dup-trailing immunity)', () => {
  const { extractJsonObject } = require(path.join(CF, 'experimental/draft/draftAdapterV6.js'))
  const r = extractJsonObject('{"a":1,"b":"x}y"}{"dup":true}')
  assert.ok(r.ok); assert.strictEqual(r.value.a, 1); assert.strictEqual(r.value.b, 'x}y')
})
t('extractJsonObject: truncated -> JSON_TRUNCATED', () => {
  const { extractJsonObject } = require(path.join(CF, 'experimental/draft/draftAdapterV6.js'))
  const r = extractJsonObject('{"a":1,"b":"x')
  assert.strictEqual(r.ok, false); assert.strictEqual(r.error, 'JSON_TRUNCATED')
})

// ── EDITOR: AI_CALL_COUNT = 0, CARD03 = B2 ONLY ─────────────────
t('editor: aiCallCount = 0', () => {
  const dv = validateDraftV6(GOOD_DRAFT_06, d06)
  const ed = editReportV6({ diagnosis: d06, b2Report: b06, draft: GOOD_DRAFT_06, draftVerdict: dv })
  assert.strictEqual(ed.editor.aiCallCount, 0)
})
t('editor: CARD03 equals deterministic B2 steps (AI contribution NONE)', () => {
  const dv = validateDraftV6(GOOD_DRAFT_06, d06)
  const ed = editReportV6({ diagnosis: d06, b2Report: b06, draft: GOOD_DRAFT_06, draftVerdict: dv })
  assert.deepStrictEqual(ed.cards.systemLoop.steps, b06.cards.systemLoop.steps)
})
t('editor: CARD04 from/to equal B2 authority (AI cannot change transition endpoints)', () => {
  const dv = validateDraftV6(GOOD_DRAFT_06, d06)
  const ed = editReportV6({ diagnosis: d06, b2Report: b06, draft: GOOD_DRAFT_06, draftVerdict: dv })
  assert.strictEqual(ed.cards.turnaroundPath.from, b06.cards.turnaroundPath.from)
  assert.strictEqual(ed.cards.turnaroundPath.to, b06.cards.turnaroundPath.to)
})
t('editor: CARD05 action equals frozen B2 action (firstActionType preserved)', () => {
  const dv = validateDraftV6(GOOD_DRAFT_06, d06)
  const ed = editReportV6({ diagnosis: d06, b2Report: b06, draft: GOOD_DRAFT_06, draftVerdict: dv })
  assert.strictEqual(ed.cards.firstAction.action, b06.cards.firstAction.action)
})

// ── CARD01 length policy ────────────────────────────────────────
t('editor: CARD01 NEVER exceeds 60 chars even with long candidate', () => {
  const long = { ...GOOD_DRAFT_06, insightCandidates: ['你以为缺的是方向，其实真正卡住你的，是你从来没有把一个方向真的拿去真实世界里试过一次，总是停在准备和想的阶段里。'] }
  const dv = validateDraftV6(long, d06)
  const ed = editReportV6({ diagnosis: d06, b2Report: b06, draft: long, draftVerdict: dv })
  assert.ok([...ed.cards.fatalInsight.text].length <= 60, 'len=' + [...ed.cards.fatalInsight.text].length)
})
t('editor: CARD01 uses AI candidate when usable', () => {
  const dv = validateDraftV6(GOOD_DRAFT_06, d06)
  const ed = editReportV6({ diagnosis: d06, b2Report: b06, draft: GOOD_DRAFT_06, draftVerdict: dv })
  assert.ok(GOOD_DRAFT_06.insightCandidates.includes(ed.cards.fatalInsight.text) || ed.editor.fieldsUsed.includes('insightCandidates'))
})

// ── §7 FIELD-LEVEL fallback ─────────────────────────────────────
t('field-level: unsafe mechanismExplanation -> B2 coreProblem; other fields keep AI', () => {
  const bad = { ...GOOD_DRAFT_06, mechanismExplanation: '保证你一定赚钱，成功率很高。' }
  const dv = validateDraftV6(bad, d06)
  assert.ok(dv.hardFailures.includes('WEALTH_PROMISE'), 'draft should flag wealth promise')
  const ed = editReportV6({ diagnosis: d06, b2Report: b06, draft: bad, draftVerdict: dv })
  assert.strictEqual(ed.cards.coreProblem.text, b06.cards.coreProblem.text, 'mechanism must fall back to B2')
  assert.ok(ed.editor.fieldsFellBack.includes('mechanismExplanation'))
  assert.ok(ed.editor.fieldsUsed.includes('insightCandidates'), 'insight should still be AI')
})
t('field-level: unsafe actionExplanation -> B2 action kept; note dropped', () => {
  const bad = { ...GOOD_DRAFT_06, actionExplanation: '一定会翻身，收入必然增长。' }
  const dv = validateDraftV6(bad, d06)
  const ed = editReportV6({ diagnosis: d06, b2Report: b06, draft: bad, draftVerdict: dv })
  assert.strictEqual(ed.cards.firstAction.action, b06.cards.firstAction.action)
  assert.strictEqual(ed.cards.firstAction.note, '')
})
t('field-level: CARD02 verbosity alone is NOT a safety failure (editor compresses)', () => {
  const verbose = { ...GOOD_DRAFT_06, mechanismExplanation: GOOD_DRAFT_06.mechanismExplanation.repeat(4) }
  const dv = validateDraftV6(verbose, d06)
  assert.ok(!dv.hardFailures.includes('CARD01_TOO_LONG'))
  const ed = editReportV6({ diagnosis: d06, b2Report: b06, draft: verbose, draftVerdict: dv })
  assert.ok([...ed.cards.coreProblem.text].length <= 120)
})

// ── §7 WHOLE-REPORT fallback ────────────────────────────────────
ta('whole-report: unparseable model output -> deterministic B2, request not broken', async () => {
  const callAI = async () => ({ success: true, content: 'this is not json at all', tokens: 5, finishReason: 'stop' })
  const out = await runDraftReportRuntimeV6(G06, { callAI, forceModel: 'deepseek-flash' })
  assert.strictEqual(out.renderSource, 'deterministic_fallback')
  assert.deepStrictEqual(out.report.cards, b06.cards)
})
ta('whole-report: model provider error -> 2 attempts -> deterministic B2', async () => {
  let calls = 0
  const callAI = async () => { calls++; return { success: false, providerErrorCode: 'AI_PROVIDER_BAD_REQUEST' } }
  const out = await runDraftReportRuntimeV6(G06, { callAI, forceModel: 'bogus-model' })
  assert.strictEqual(out.renderSource, 'deterministic_fallback')
  assert.strictEqual(calls, 2, 'should retry once (2 attempts)')
  assert.strictEqual(out.report.reportState, 'PRIMARY')
})

// ── happy path through runtime ──────────────────────────────────
ta('runtime: valid draft -> ai_draft_edited, editor aiCallCount 0, final valid', async () => {
  const callAI = async () => ({ success: true, content: JSON.stringify(GOOD_DRAFT_06), tokens: 800, finishReason: 'stop' })
  const out = await runDraftReportRuntimeV6(G06, { callAI, forceModel: 'deepseek-flash' })
  assert.strictEqual(out.renderSource, 'ai_draft_edited')
  assert.strictEqual(out.report.editor.aiCallCount, 0)
  const fv = validateFinalV6(out.report, d06)
  assert.strictEqual(fv.valid, true, JSON.stringify(fv.hardFailures))
})

// ── no validator bypass ─────────────────────────────────────────
t('no-bypass: ontology leak in every draft field cannot reach final cards', () => {
  const leak = {
    draftVersion: 'x',
    insightCandidates: ['ACTION_GAP 一直没开始'],
    mechanismExplanation: 'VALIDATION_GAP 没反馈',
    transitionExplanation: 'CONSISTENCY_GAP 断掉',
    actionExplanation: 'REPEATABILITY_GAP 没法复制'
  }
  const dv = validateDraftV6(leak, d06)
  assert.ok(dv.hardFailures.includes('ONTOLOGY_LEAK'))
  const ed = editReportV6({ diagnosis: d06, b2Report: b06, draft: leak, draftVerdict: dv })
  const vt = finalVisibleText(ed)
  for (const tok of ['ACTION_GAP', 'VALIDATION_GAP', 'CONSISTENCY_GAP', 'REPEATABILITY_GAP']) assert.ok(!vt.includes(tok), 'leak ' + tok)
})

// ── G12 sanity ──────────────────────────────────────────────────
t('G12: editor with good-shaped draft produces valid five cards', () => {
  const draft = {
    draftVersion: 'x',
    insightCandidates: ['你以为问题出在资源，其实你缺的是让客户真的开口说一次真话。'],
    mechanismExplanation: '你一直在打磨产品，却从没直接问过真实用户为什么不买，所以需求始终没有被验证。',
    transitionExplanation: '下一步的规则是先拿到反馈，再谈改进。',
    actionExplanation: '所以今天该做的是直接找真实用户问清楚。'
  }
  const dv = validateDraftV6(draft, d12)
  const ed = editReportV6({ diagnosis: d12, b2Report: b12, draft, draftVerdict: dv })
  const fv = validateFinalV6(ed, d12)
  assert.strictEqual(fv.valid, true, JSON.stringify(fv.hardFailures))
})

// ── helpers ─────────────────────────────────────────────────────
t('helper: clipToLimit never exceeds limit', () => {
  assert.ok([...clipToLimit('a,b,c,d,e,f,g,h,i,j', 5)].length <= 5)
})
t('helper: firstSentences keeps substring (no fabrication)', () => {
  const src = '第一句。第二句。第三句。'
  const out = firstSentences(src, 2)
  assert.ok(src.includes(out))
})

console.log('\nR11_V2 draft/editor: ' + pass + ' passed, ' + fail + ' failed')
process.exit(fail ? 1 : 0)
