'use strict'
/**
 * tests/legacy6q/legacy6q-thinking-page.test.js
 *
 * RC8.8_STAGE2_R5_LEGACY_THINKING_PAGE_REVIVAL — contract + behaviour tests for
 * the restored full-screen LIGHT thinking page and the ready-report handoff.
 *
 * Pins:
 *   §3  ONE model call per submission (model call count = 1)
 *   §4  result page has NO loading skeletons (READY content)
 *   §5  the five exact thinking stages (no 10Q copy)
 *   §6  main title + no abandoned-architecture vocabulary
 *   §7  visual schedule 0/1400/2800/4200/5600
 *   §8  MIN_DISPLAY_MS in the 5500–6000 band; AI still → stay on STEP5
 *   §9  success → redirect to the ready-report route
 *   §10 failure stays on the thinking page; retry = ONE new call
 *   §11 double submit / re-entry / onShow never start a second call
 *   §12 temp handoff via globalData (no cloud DB, no regen on report load)
 */

const h = require('../turnaround6q/_harness.js')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const ROOT = path.resolve(__dirname, '../../')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

const thinkJs = read('pages/legacy6q-thinking/legacy6q-thinking.js')
const thinkWxml = read('pages/legacy6q-thinking/legacy6q-thinking.wxml')
const reportJs = read('pages/legacy6q-report/legacy6q-report.js')
const reportWxml = read('pages/legacy6q-report/legacy6q-report.wxml')

h.section('RC8.8 Stage2 R5 — legacy thinking page')

// ── §5 exact five stages ──────────────────────────────────────────────────
const stages = [
  ['正在读取你的现实底牌', '从年龄、职业、收入和学历里，\\n看清你现在站在哪里。'],
  ['正在拆解你真正卡住的地方', '对照你的焦虑与自我判断，\\n寻找表象下面的问题。'],
  ['正在推演困住你的系统', '看清你为什么努力了，\\n却仍然停在原来的位置。'],
  ['正在生成你的翻身路径', '从现有条件出发，\\n寻找最值得验证的突破口。'],
  ['正在收敛你的行动建议', '把判断压缩成下一步\\n真正能执行的动作。'],
]
stages.forEach((s, i) => {
  h.ok(thinkJs.indexOf(s[0]) >= 0, `STEP${i + 1} title present: ${s[0]}`)
  h.ok(thinkJs.indexOf(s[1]) >= 0, `STEP${i + 1} body present`)
})
const stepBlock = (thinkJs.match(/THINKING_STEPS\s*=\s*\[([\s\S]*?)\n\]/) || [])[1] || ''
h.eq((stepBlock.match(/title:/g) || []).length, 5, 'exactly five thinking stages')

// ── §6 main title + no abandoned-architecture vocabulary ──────────────────
h.ok(thinkJs.indexOf('小事哥正在推演你的翻身路径') >= 0, 'main title preserved')
const banned = ['现金流', '安全边界', '能力评分', '风险承受', 'world model', 'bottleneck', 'severity', 'world_model']
banned.forEach((w) => {
  h.ok(thinkJs.toLowerCase().indexOf(w.toLowerCase()) < 0, 'no abandoned-architecture term: ' + w)
})

// ── §7 visual schedule ────────────────────────────────────────────────────
const timeMatch = thinkJs.match(/STEP_TIMES\s*=\s*\[([^\]]+)\]/)
h.ok(!!timeMatch, 'STEP_TIMES declared')
h.eq(timeMatch && timeMatch[1].replace(/\s/g, ''), '0,1400,2800,4200,5600', 'schedule 0/1400/2800/4200/5600')

// ── §8 minimum display in the 5500–6000 band ──────────────────────────────
const minMatch = thinkJs.match(/MIN_DISPLAY_MS\s*=\s*(\d+)/)
const MIN = Number(minMatch && minMatch[1])
h.ok(MIN >= 5500 && MIN <= 6000, 'MIN_DISPLAY_MS in 5500–6000 band (' + MIN + ')')
h.ok(thinkJs.indexOf('正在完成最后推演...') >= 0, 'finalizing copy present after STEP5')

// ── §3 exactly ONE model-call site ────────────────────────────────────────
h.eq((thinkJs.match(/generateLegacy6QReport\s*\(/g) || []).length, 1, 'exactly one model-call site')
h.eq((reportJs.match(/generateLegacy6QReport\s*\(/g) || []).length, 0, 'result page makes NO model call')

// ── §4 no loading placeholders anywhere in the result path ────────────────
;['正在推演你的认知结构', '推演中', 'loading-typing', 'typing-dots'].forEach((token) => {
  h.ok(reportJs.indexOf(token) < 0, 'result js free of loading placeholder: ' + token)
  h.ok(reportWxml.indexOf(token) < 0, 'result wxml free of loading placeholder: ' + token)
})
h.ok(/REVEAL_DELAYS\s*=\s*\[300,\s*700,\s*1100,\s*1500,\s*1900\]/.test(reportJs), 'reveal sequence preserved (300/700/1100/1500/1900)')
h.ok(/report\.fatal_sentence|fatal_sentence/.test(reportJs) && /advice/.test(reportJs), 'result reads a ready five-field report')

// ── §10 failure + retry + back-to-edit present ────────────────────────────
h.ok(thinkWxml.indexOf('推演没有完成') >= 0, 'failure title present')
h.ok(thinkWxml.indexOf('网络或AI服务暂时没有返回结果') >= 0, 'failure body present')
h.ok(thinkWxml.indexOf('重新推演') >= 0 && thinkWxml.indexOf('返回修改答案') >= 0, 'failure actions present')
h.ok(/onRetryThinking/.test(thinkJs) && /onBackEdit/.test(thinkJs), 'failure handlers present')

// ── §12 temp handoff (globalData), no cloud DB ────────────────────────────
h.ok(/globalData\._legacy6qThinkingRequest/.test(thinkJs), 'thinking reads the temp request handoff')
h.ok(/globalData\._legacy6qReport\b/.test(thinkJs) && /globalData\._legacy6qReport\b/.test(reportJs), 'ready report handed off via globalData')
h.ok(!/db\.|database|collection|cloud\.database/.test(thinkJs + reportJs), 'no cloud DB in the handoff path')

// ═══════════════════════════════════════════════════════════════════════════
// Behaviour harness — the page MODULE is loaded ONCE (as in the mini program)
// and multiple page instances share the module-scoped in-flight registry and the
// single getApp() globalData, exactly like a real navigation / re-entry.
// ═══════════════════════════════════════════════════════════════════════════
function createRuntime (serviceRef) {
  let now = 0
  let seq = 0
  const timers = new Map()
  const navigations = []
  let calls = 0
  let pageConfig = null

  const globalData = {}
  const sandbox = {
    console,
    Math,
    Date: { now: () => now },
    require: (p) => {
      if (/legacy6qReportService/.test(p)) {
        return { generateLegacy6QReport: function () { calls++; return serviceRef.fn() } }
      }
      // RC8.8_MY_PAGE_FUNCTION_RECOVERY_D — the thinking page persists report
      // history on success. Sandbox-local stub (this test asserts on navigation
      // / one-call semantics, not on storage). Records are captured for assertions.
      if (/reportHistory/.test(p)) {
        const store = []
        sandbox.__reportHistoryStore = store
        return {
          KEY: 'legacy6q_report_history', MAX: 20,
          record: (report, handoff) => {
            if (!report || !report.fatal_sentence) return null
            const id = (handoff && handoff.requestId) || ''
            if (store.some((x) => x.id === id)) return store.find((x) => x.id === id)
            const rec = { id, createdAt: now, report }
            store.unshift(rec)
            return rec
          },
          list: () => store.slice(),
          count: () => store.length,
          get: (id) => store.find((x) => x.id === id) || null,
        }
      }
      return require(path.join(ROOT, p))
    },
    getApp: () => ({ globalData }),
    wx: { redirectTo: (o) => navigations.push(o.url), showToast: () => {} },
    setTimeout: (fn, ms) => { const id = ++seq; timers.set(id, { at: now + (ms || 0), fn }); return id },
    clearTimeout: (id) => { timers.delete(id) },
    module: { exports: {} },
    exports: {},
  }
  sandbox.Page = (obj) => { pageConfig = obj }
  vm.createContext(sandbox)
  vm.runInContext(thinkJs, sandbox, { filename: 'legacy6q-thinking.js' })

  function instantiate () {
    const inst = Object.create(pageConfig)
    inst.data = JSON.parse(JSON.stringify(pageConfig.data))
    inst.setData = function (patch) { Object.assign(this.data, patch) }
    return inst
  }

  function advance (ms) {
    const target = now + ms
    let guard = 0
    while (guard++ < 10000) {
      let nextId = null; let nextAt = Infinity
      for (const [id, t] of timers) { if (t.at <= target && t.at < nextAt) { nextAt = t.at; nextId = id } }
      if (nextId === null) break
      const t = timers.get(nextId); timers.delete(nextId)
      now = t.at
      t.fn()
    }
    now = target
  }

  return { instantiate, navigations, advance, globalData, get calls () { return calls } }
}

function newHandoff (id) {
  return {
    requestId: id,
    answers: { age: '34', job: '外卖骑手', education: '高中', income: '6000', anxiety: 'a', rootCause: 'r', diagnosticVersion: 'turnaround_strategy_6q_v1' },
    personality: { name: '认知教练', emoji: '🧠', style: 's' },
    diagnosticVersion: 'turnaround_strategy_6q_v1',
    createdAt: 0,
  }
}

async function behaviourChecks () {
  const okReport = { fatal_sentence: 'F', core_problem: 'C', system_trap: 'T', turnaround_path: 'P', advice: ['a1'] }

  // ── happy path: one call, stages advance, transition after MIN_DISPLAY ──
  {
    let resolveService
    const rt = createRuntime({ fn: () => new Promise((res) => { resolveService = res }) })
    rt.globalData._legacy6qThinkingRequest = newHandoff('req-1')
    const page = rt.instantiate()
    page.onLoad({ requestId: 'req-1' })
    h.eq(rt.calls, 1, 'one model call started on entry')
    h.eq(page.data.stepIndex, 1, 'starts on STEP1')
    h.eq(page.data.steps.filter((s) => s.active).length, 1, 'one active dot at STEP1')
    h.eq(rt.globalData._legacy6qThinkingRequest, null, 'temp request handoff consumed')

    rt.advance(1400); h.eq(page.data.stepIndex, 2, 'STEP2 at 1400ms')
    rt.advance(1400); h.eq(page.data.stepIndex, 3, 'STEP3 at 2800ms')
    rt.advance(1400); h.eq(page.data.stepIndex, 4, 'STEP4 at 4200ms')
    rt.advance(1400)
    h.eq(page.data.stepIndex, 5, 'STEP5 at 5600ms')
    h.eq(page.data.steps.filter((s) => s.active).length, 5, 'five dots lit at STEP5')
    h.eq(page.data.finalizing, true, 'finalizing while AI pending')
    h.eq(rt.navigations.length, 0, 'no transition before AI returns')

    resolveService({ code: 0, message: 'ok', data: okReport })
    await Promise.resolve(); await Promise.resolve()
    h.eq(rt.navigations.length, 0, 'AI ready but MIN_DISPLAY not elapsed → still on page')
    rt.advance(200)
    await Promise.resolve(); await Promise.resolve()
    h.eq(rt.navigations.length, 1, 'transition fired after MIN_DISPLAY')
    h.ok(/legacy6q-report/.test(rt.navigations[0]), 'redirects to the ready-report page')
    h.eq(rt.globalData._legacy6qReport && rt.globalData._legacy6qReport.fatal_sentence, 'F', 'ready report handed off')

    // §11 re-entry: handoff already consumed → no second call.
    const again = rt.instantiate()
    again.onLoad({ requestId: 'req-1' })
    again.onShow()
    h.eq(rt.calls, 1, 're-entry / onShow starts NO additional model call')
    h.eq(rt.navigations.length, 2, 'missing handoff → redirect back to questionnaire')
  }

  // ── double open with the SAME requestId re-armed → registry blocks 2nd call ──
  {
    const rt = createRuntime({ fn: () => new Promise(() => {}) })
    rt.globalData._legacy6qThinkingRequest = newHandoff('req-dup')
    const a = rt.instantiate()
    a.onLoad({ requestId: 'req-dup' })
    h.eq(rt.calls, 1, 'first open: one call')

    // Simulate back/forward re-entry re-arming the same requestId while in flight.
    rt.globalData._legacy6qThinkingRequest = newHandoff('req-dup')
    const b = rt.instantiate()
    b.onLoad({ requestId: 'req-dup' })
    h.eq(rt.calls, 1, 'DOUBLE_SUBMIT_BLOCKED: same requestId → no second model call')
  }

  // ── §10 failure stays on the page; retry = exactly one new call ─────────
  {
    let n = 0
    const rt = createRuntime({ fn: () => { n++; return Promise.resolve({ code: -1, message: 'AI 诊断引擎暂时离线', data: null }) } })
    rt.globalData._legacy6qThinkingRequest = newHandoff('req-f')
    const page = rt.instantiate()
    page.onLoad({ requestId: 'req-f' })
    rt.advance(6000)
    await Promise.resolve(); await Promise.resolve()
    h.eq(page.data.failed, true, 'failure stays on the thinking page')
    h.eq(rt.navigations.length, 0, 'failure does NOT navigate to five empty cards')

    page.onRetryThinking()
    h.eq(n, 2, 'retry creates exactly ONE new request')
    h.eq(page.data.failed, false, 'retry resets the failure state')
    h.eq(page.data.stepIndex, 1, 'retry restarts at STEP1')
  }

  h.summary('6Q legacy thinking page')
}

behaviourChecks()
