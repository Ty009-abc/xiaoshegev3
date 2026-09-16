'use strict'
/**
 * tests/v6/draft/rc8.4-v6-r21-copy-completeness.test.js
 *
 * R21 Part A §3–§5 — final copy-completeness invariant for CARD01 + CARD04.
 * Deterministic; no network.
 *
 * Guarantees:
 *   CARD01_COMPLETENESS_INVARIANT
 *   CARD04_COMPLETENESS_INVARIANT
 *   CARD01_INCOMPLETE_FALLS_BACK_TO_B2
 *   CARD04_INCOMPLETE_FALLS_BACK_TO_B2
 *   USER_VISIBLE_HARD_TRUNCATED_FRAGMENT_COUNT_IS_ZERO
 *   R20_RESIDUALS_NOW_COMPLETE
 */

const h = require('../_harness.js')
const path = require('path')
const ROOT = path.resolve(__dirname, '../../..')
const V6 = path.join(ROOT, 'cloudfunctions/generateAiReport/lib/turnaroundStrategy/v6')
const E = require(path.join(V6, 'experimental/draft/reportEditorV6.js'))
const { diagnoseTurnaroundV6 } = require(path.join(V6, 'index.js'))
const { buildReportV6 } = require(path.join(V6, 'report/index.js'))
const { validateDraftV6 } = require(path.join(V6, 'experimental/draft/draftValidatorV6.js'))
const { validateFinalV6 } = require(path.join(V6, 'experimental/draft/finalValidatorV6.js'))
const F = require('../fixtures.js')

const SENT = new Set('。！？!?'); const CLAUSE = new Set('；;：:')
function complete (s) { s = (s || '').trim().replace(/[”"』）)】」]+$/, ''); if (!s) return false; return SENT.has(s.slice(-1)) || CLAUSE.has(s.slice(-1)) }

const G06 = F.GOLDEN.find((x) => x.id === 'G06')

function editWith (draft) {
  const d = diagnoseTurnaroundV6(G06.answers)
  const b2 = buildReportV6(d)
  const dv = validateDraftV6(draft, d)
  const ed = E.editReportV6({ diagnosis: d, b2Report: b2, draft, draftVerdict: dv })
  const v = validateFinalV6(ed, d)
  return { ed, v, d, b2 }
}

function run () {
  h.section('CARD01_COMPLETENESS_INVARIANT')
  {
    // a candidate >60 with only commas → tier-2 comma accumulation used to ship a
    // 19-char unpunctuated stub. It must now end at a boundary (or fall back).
    const draft = {
      insightCandidates: ['你以为要先等时间更充裕、信息更全再开始'],
      mechanismExplanation: '', transitionExplanation: '', actionExplanation: ''
    }
    const { ed } = editWith(draft)
    h.ok(complete(ed.cards.fatalInsight.text), 'CARD01 ends at a semantic boundary')
    h.ok(!ed.cards.fatalInsight.text.endsWith('开始'), 'CARD01 is not the unpunctuated stub')

    // a long comma-only candidate → must not ship unpunctuated
    const d2 = {
      insightCandidates: ['你以为核心问题是总在换方向，其实换方向更像是结果，你开始过，但一遇不确定就先等、一忙就停，几次中断后才需要用新方向重新启动'],
      mechanismExplanation: '', transitionExplanation: '', actionExplanation: ''
    }
    const r2 = editWith(d2)
    h.ok(complete(r2.ed.cards.fatalInsight.text), 'long comma-only CARD01 candidate ends at a boundary')
  }

  h.section('CARD04_COMPLETENESS_INVARIANT')
  {
    // R20 residual material: the AI transition with no terminator inside the
    // soft window must NOT ship a mid-clause cut.
    const mat = '现在你已经在“开始过”这一层，下一阶段要验证的不是哪个方向最好，而是一个低投入动作能否在你忙碌的时候也保持节奏'
    const r = editWith({ insightCandidates: [], mechanismExplanation: '', transitionExplanation: mat, actionExplanation: '' })
    h.ok(complete(r.ed.cards.turnaroundPath.logic), 'CARD04 ends at a semantic boundary')
    h.ok(!r.ed.cards.turnaroundPath.logic.endsWith('忙碌'), 'CARD04 is not the mid-clause cut')

    // adversarial: material with a very late terminator beyond soft window
    const mat2 = '这是一段很长的过渡说明' + '，补充说明继续延长内容'.repeat(6) + '，最终结论落在很后面。'
    const r2 = editWith({ insightCandidates: [], mechanismExplanation: '', transitionExplanation: mat2, actionExplanation: '' })
    h.ok(complete(r2.ed.cards.turnaroundPath.logic), 'CARD04 long-material ends at a boundary')

    // material that is ONLY a lead-in opener → B2 complete copy
    const r3 = editWith({ insightCandidates: [], mechanismExplanation: '', transitionExplanation: '在有一点稳定结果之后', actionExplanation: '' })
    h.ok(complete(r3.ed.cards.turnaroundPath.logic), 'CARD04 lead-in-only → complete B2 copy')
  }

  h.section('CARD01_INCOMPLETE_FALLS_BACK_TO_B2')
  {
    const draft = {
      insightCandidates: ['你以为要先等时间更充裕、信息更全再开始'],
      mechanismExplanation: '', transitionExplanation: '', actionExplanation: ''
    }
    const { ed, b2 } = editWith(draft)
    h.ok(ed.cards.fatalInsight.text === b2.cards.fatalInsight.text, 'CARD01 fell back to complete B2 copy')
    h.ok(ed.editor.fieldsFellBack.indexOf('insightCandidates') !== -1, 'insightCandidates recorded as fell-back')
  }

  h.section('CARD04_INCOMPLETE_FALLS_BACK_TO_B2')
  {
    const mat = '现在你已经在“开始过”这一层，下一阶段要验证的不是哪个方向最好，而是一个低投入动作能否在你忙碌的时候也保持节奏'
    const { ed, b2 } = editWith({ insightCandidates: [], mechanismExplanation: '', transitionExplanation: mat, actionExplanation: '' })
    const out = ed.cards.turnaroundPath.logic
    const b2Material = b2.cards.turnaroundPath.logic || b2.cards.turnaroundPath.text || ''
    const norm = (s) => String(s).replace(/\s+/g, '')
    h.ok(complete(out), 'CARD04 fell back to a complete boundary')
    h.ok(norm(b2Material).indexOf(norm(out)) !== -1, 'CARD04 copy is derived from B2 (no fabrication)')
    h.ok(out.indexOf(mat) === -1, 'CARD04 does not ship the incomplete AI material')
    h.ok(ed.editor.fieldsFellBack.indexOf('transitionExplanation') !== -1, 'transitionExplanation recorded as fell-back')
  }

  h.section('USER_VISIBLE_HARD_TRUNCATED_FRAGMENT_COUNT_IS_ZERO')
  {
    // a broad sweep of awkward materials must NEVER produce a non-boundary final.
    const mats = [
      '这是一个没有终结符的长句子' + '，继续延伸内容'.repeat(8),
      '首先需要明确一点，然后继续展开说明，接着补充更多细节，最后还没有结束',
      '短的很短',
      '结尾是逗号，',
      '结尾是分号；',
      '结尾是句号。',
      'a'.repeat(50),
      '你以为要等准备好，其实可以先动，只要开始，就会发现',
    ]
    let bad = 0
    for (const m of mats) {
      const r = editWith({ insightCandidates: [m], mechanismExplanation: '', transitionExplanation: m, actionExplanation: '' })
      if (!complete(r.ed.cards.fatalInsight.text)) bad++
      if (!complete(r.ed.cards.turnaroundPath.logic)) bad++
    }
    h.eq(bad, 0, 'no user-visible hard-truncated fragment across sweep')
  }

  h.section('R20_RESIDUALS_NOW_COMPLETE')
  {
    // exact R20 residual reproductions
    const c4mat = '现在你已经在“开始过”这一层，下一阶段要验证的不是哪个方向最好，而是一个低投入动作能否在你忙碌，那就先保护一段固定时间再决定。'
    const c1mat = '你以为要先等时间更充裕、信息更全再开始，其实在没动手之前，信息只会越攒越多。'
    const r4 = editWith({ insightCandidates: [], mechanismExplanation: '', transitionExplanation: c4mat, actionExplanation: '' })
    h.ok(complete(r4.ed.cards.turnaroundPath.logic), 'R20 CARD04 residual now complete')
    const r1 = editWith({ insightCandidates: [c1mat], mechanismExplanation: '', transitionExplanation: '', actionExplanation: '' })
    h.ok(complete(r1.ed.cards.fatalInsight.text), 'R20 CARD01 residual now complete')
  }
}

run()
const s = h.summary('R21 copy completeness')
if (s.failed) process.exitCode = 1
