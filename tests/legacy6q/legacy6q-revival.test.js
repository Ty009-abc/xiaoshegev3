'use strict'
/**
 * tests/legacy6q/legacy6q-revival.test.js
 *
 * RC8.8 Stage2 (§25) — revived legacy 6Q PRODUCT CONTRACT tests.
 *
 * Aligned to the PRODUCT contract, NOT to semantic phrase lists:
 *   - exact 6Q contract (keys / wording / input modes / maxlength)
 *   - raw answer preservation (job/anxiety/rootCause verbatim)
 *   - persona injection (6 personas, full inject reached, exclude-previous)
 *   - five-field parsing (tolerant parser: fences / trailing commas / regex)
 *   - field-level fallback (only the missing field is defaulted)
 *   - visible card remap (fatal_sentence promoted to Card01)
 *   - progressive reveal sequence (300/700/1100/1500/1900)
 *   - poster mapping (same copy, product order)
 *   - provider error behaviour (total failure → deterministic whole report only)
 */

const h = require('../turnaround6q/_harness.js')
const path = require('path')
const vm = require('vm')
const fs = require('fs')

const ROOT = path.resolve(__dirname, '../../')

const contract = require(path.join(ROOT, 'cloudfunctions/generateAiReport/lib/legacy6q/legacy6qContract.js'))
const personas = require(path.join(ROOT, 'cloudfunctions/generateAiReport/lib/legacy6q/personas.js'))
const prompt = require(path.join(ROOT, 'cloudfunctions/generateAiReport/lib/legacy6q/legacy6qPrompt.js'))
const parser = require(path.join(ROOT, 'cloudfunctions/generateAiReport/lib/legacy6q/legacy6qParser.js'))
const guards = require(path.join(ROOT, 'cloudfunctions/generateAiReport/lib/legacy6q/legacy6qGuards.js'))
const runtime = require(path.join(ROOT, 'cloudfunctions/generateAiReport/lib/legacy6q/legacy6qRuntime.js'))
const clientQ = require(path.join(ROOT, 'utils/turnaround6q/turnaround6qQuestionnaire.js'))
const clientVM = require(path.join(ROOT, 'utils/legacy6q/legacy6qReportViewModel.js'))

h.section('RC8.8 Stage2 — legacy 6Q revival contract')

// ── §3 exact 6Q contract (server + client agree) ──────────────────────────
h.eq(contract.QUESTION_COUNT, 6, 'server QUESTION_COUNT=6')
h.eq(contract.FACT_KEYS, ['age', 'job', 'education', 'income', 'anxiety', 'rootCause'], 'server canonical keys')
h.eq(clientQ.QUESTION_COUNT_6Q, 6, 'client QUESTION_COUNT=6')
h.eq(clientQ.QUESTIONNAIRE_VERSION, 'turnaround_strategy_6q_v1', 'request version unchanged')

const QS = clientQ.getQuestions6Q()
h.eq(QS.map((x) => x.title), [
  '你今年几岁？', '你现在做什么工作？', '你的学历？', '你现在月收入多少？', '你现在最焦虑什么？', '你觉得自己为什么翻不了身？',
], 'exact question wording')
h.eq(QS.map((x) => x.key), ['age', 'job', 'education', 'income', 'anxiety', 'rootCause'], 'exact keys')
h.eq(QS.map((x) => x.inputMode), ['number', 'text', 'text', 'number', 'textarea', 'textarea'], 'input modes')
h.eq(QS[4].maxlength, 300, 'anxiety maxlength 300')
h.eq(QS[5].maxlength, 500, 'rootCause maxlength 500')

// ── §4 raw answer preservation ────────────────────────────────────────────
const raw = {
  age: '34', job: '外卖骑手', education: '高中', income: '6000',
  anxiety: '每天跑十几个小时，钱还是不够用', rootCause: '我没学历也没关系，只能靠体力挣钱',
}
const norm = clientQ.normalizeAnswers6Q(raw)
h.eq(norm.job, raw.job, 'job verbatim')
h.eq(norm.anxiety, raw.anxiety, 'anxiety verbatim')
h.eq(norm.rootCause, raw.rootCause, 'rootCause verbatim')
h.ok(!('optionId' in norm), 'no optionId in payload')

const nf = contract.normalizeFacts6Q(raw)
h.ok(nf.valid, 'server accepts valid facts')
h.eq(nf.facts.anxiety, raw.anxiety, 'server keeps anxiety verbatim')

// ── §5 persona system ─────────────────────────────────────────────────────
h.eq(personas.PERSONALITY_NAMES.length, 6, 'six personas')
h.eq(personas.PERSONALITY_NAMES, ['赌场庄家', '现实拆解者', '流量猎人', 'AI军师', '资本视角', '认知教练'], 'exact persona names')
h.eq(personas.PERSONALITY_MODES['赌场庄家'].emoji, '🎰', '赌场庄家 emoji')
h.eq(personas.PERSONALITY_MODES['认知教练'].emoji, '🧠', '认知教练 emoji')
for (const n of personas.PERSONALITY_NAMES) {
  h.ok(/你的角色是/.test(personas.PERSONALITY_MODES[n].inject), n + ' carries a full analytical inject (not a tone tag)')
  h.ok(personas.PERSONALITY_MODES[n].inject.length > 60, n + ' inject is substantial')
}
// exclude immediate previous
const seen = {}
let repeat = 0
for (let i = 0; i < 400; i++) {
  const p = personas.getRandomPersonality('认知教练')
  seen[p.name] = true
  if (p.name === '认知教练') repeat++
}
h.eq(repeat, 0, 'getRandomPersonality excludes immediate previous')
h.eq(Object.keys(seen).length, 5, 'excludes exactly the previous persona')

// full inject reaches the prompt
const built = prompt.buildLegacy6QPrompt(raw, '赌场庄家')
h.ok(built.systemPrompt.indexOf(personas.PERSONALITY_MODES['赌场庄家'].inject) >= 0, 'full persona inject injected into system prompt')
h.eq(built.personality.name, '赌场庄家', 'persona returned to caller')
h.ok(built.userMessage.indexOf(raw.job) >= 0 && built.userMessage.indexOf(raw.anxiety) >= 0 && built.userMessage.indexOf(raw.rootCause) >= 0, 'raw user facts reach the prompt verbatim')

// §6 no modern machinery in the short prompt
const SP = built.systemPrompt
for (const banned of ['A/B/C/D', 'evidence taxonomy', 'MISSING_FACT_GROUNDING', 'UNSUPPORTED_TREND', 'bottleneck', 'world_model', 'grounding', 'repair']) {
  h.ok(SP.toLowerCase().indexOf(banned.toLowerCase()) < 0, 'short prompt free of modern machinery: ' + banned)
}
h.ok(SP.length < 2500, 'short prompt stays close to the legacy length (' + SP.length + ')')

// ── §7 five-field business contract ───────────────────────────────────────
h.eq(contract.OUTPUT_FIELDS, ['system_trap', 'core_problem', 'fatal_sentence', 'strategy_path', 'advice'], 'exactly five output fields')

// ── §11 tolerant parser ───────────────────────────────────────────────────
const fenced = '```json\n{"system_trap":"A","core_problem":"B","fatal_sentence":"☠️ C","strategy_path":"D","advice":["x","y"],}\n```'
const p1 = parser.parseLegacy6QReport(fenced)
h.eq(p1.parsePath, 'JSON_PARSE', 'fenced JSON + trailing comma parsed')
h.eq(p1.fallbackFields.length, 0, 'no field fallback when JSON is complete')
h.eq(p1.report.advice.length, 2, 'advice array preserved')

const messy = '好的，以下是分析：\n{"system_trap":"A",// note\n"core_problem":"B","fatal_sentence":"C","strategy_path":"D","advice":["x"]} 希望有用'
const p2 = parser.parseLegacy6QReport(messy)
h.eq(p2.parsePath, 'JSON_PARSE', 'prose-wrapped JSON with comment + trailing text parsed')
h.eq(p2.report.system_trap, 'A', 'field recovered')

const broken = 'system_trap: "陷阱"; core_problem: "问题"; fatal_sentence: "☠️ 句"; strategy_path: "路径"; advice: ["一","二"]'
const p3 = parser.parseLegacy6QReport(broken)
h.eq(p3.parsePath, 'REGEX_RECOVERY', 'non-JSON → regex field recovery')
h.eq(p3.report.core_problem, '问题', 'regex recovered a field')

// ── §11/§14 field-level fallback only ─────────────────────────────────────
const partial = parser.parseLegacy6QReport('{"system_trap":"A","core_problem":"B","fatal_sentence":"C","strategy_path":"","advice":[]}')
h.eq(partial.parsePath, 'JSON_PARSE', 'parse kept')
h.eq(partial.report.system_trap, 'A', 'present field preserved')
h.eq(partial.fallbackFields.sort(), ['advice', 'strategy_path'], 'ONLY the missing fields defaulted')
h.ok(partial.report.strategy_path === parser.FIELD_DEFAULTS.strategy_path, 'missing field → field-level default')

const total = parser.parseLegacy6QReport('完全不是 JSON 的一段话')
h.eq(total.parsePath, 'TOTAL_FAILURE', 'nothing recoverable → TOTAL_FAILURE')

// ── §10 minimal guards ────────────────────────────────────────────────────
const strong = { system_trap: '你被结构困住了。', core_problem: '你在用时间换钱。', fatal_sentence: '☠️ 你不是不努力，是在做今天做完明天归零的事。', strategy_path: '把一部分时间用来做能被反复使用的东西。', advice: ['列出三个需求方'] }
h.ok(guards.inspectLegacy6QReport(strong).ok, 'a STRONG interpretation is NOT rejected')

const g1 = guards.inspectLegacy6QReport({ ...strong, strategy_path: '去澳门赌场梭哈一把' })
h.ok(!g1.safeReport.strategy_path.includes('赌场'), 'prohibited industry repaired at field level')
h.ok(g1.safeReport.strategy_path !== strong.strategy_path, 'only the offending field changed')

const g2 = guards.inspectLegacy6QReport({ ...strong, fatal_sentence: '跟着做你一定能翻身，包你发财。' })
h.ok(!/一定能翻身|包你发财/.test(g2.safeReport.fatal_sentence), 'guarantee promise repaired')

const g3 = guards.inspectLegacy6QReport({ ...strong, core_problem: '按 MISSING_FACT_GROUNDING 处理 world_model_v1。' })
h.ok(!/MISSING_FACT_GROUNDING|world_model_v1/.test(g3.safeReport.core_problem), 'enum leakage stripped')

const g4 = guards.inspectLegacy6QReport({ system_trap: '', core_problem: 'B', fatal_sentence: 'C', strategy_path: 'D', advice: ['x'] })
h.ok(!g4.ok, 'empty required field is blocking')

// ── §15 visible card remap (fatal_sentence → Card01) ──────────────────────
const envelope = {
  code: 0,
  data: {
    reportType: 'turnaround_6q', diagnosticVersion: 'turnaround_strategy_6q_v1', reportState: 'PRIMARY',
    system_trap: 'TRAP', core_problem: 'CORE', fatal_sentence: '☠️ FATAL', strategy_path: 'PATH', advice: ['a1', 'a2'],
    personality: { name: '赌场庄家', emoji: '🎰' },
  },
}
const v = clientVM.buildTurnaroundReportViewModel6Q(envelope)
h.eq(v.uiState, 'PRIMARY', 'primary state')
h.eq(v.cards.map((c) => c.key), ['fatalInsight', 'coreProblem', 'systemLoop', 'turnaroundPath', 'firstAction'], 'visible order 01..05')
h.eq(v.cards[0].oneLiner, '☠️ FATAL', 'Card01 = fatal_sentence (hero)')
h.eq(v.cards[0].hero, true, 'Card01 marked hero')
h.eq(v.cards[1].body, 'CORE', 'Card02 = core_problem')
h.eq(v.cards[2].loopNodes[0], 'TRAP', 'Card03 = system_trap')
h.eq(v.cards[3].to, 'PATH', 'Card04 = strategy_path')
h.eq(v.cards[4].actionItems.map((x) => x.text), ['a1', 'a2'], 'Card05 = advice[]')
h.eq(v.cards[4].actionItems.map((x) => x.label), ['行动1', '行动2'], 'advice items labelled')

const badEnv = { code: 0, data: { reportState: 'INVALID_INPUT' } }
h.eq(clientVM.buildTurnaroundReportViewModel6Q(badEnv).uiState, 'INVALID_INPUT', 'invalid input state')

// ── §16 progressive reveal sequence ───────────────────────────────────────
const pageSrc = fs.readFileSync(path.join(ROOT, 'pages/turnaround-6q-report/turnaround-6q-report.js'), 'utf8')
const revealMatch = pageSrc.match(/REVEAL_DELAYS\s*=\s*\[([^\]]+)\]/)
h.ok(!!revealMatch, 'report page declares REVEAL_DELAYS')
h.eq(revealMatch && revealMatch[1].replace(/\s/g, ''), '300,700,1100,1500,1900', 'reveal sequence 300/700/1100/1500/1900')
// RC8.8_STAGE2_R2: the restored 07/11 result UI marks Card01 as the red hero
// via the `red-card` class (the proven online style).
const reportWxml = fs.readFileSync(path.join(ROOT, 'pages/turnaround-6q-report/turnaround-6q-report.wxml'), 'utf8')
h.ok(/red-card/.test(reportWxml), 'Card01 red hero class present (red-card)')
h.ok(/sections\[0\]\?|wx:for="\{\{sections\}\}"/.test(reportWxml + pageSrc), 'result renders the five-card section list in order')

// ── §18 poster mapping (same copy, product order) ─────────────────────────
// RC8.8_STAGE2_R2: the restored 07/11 result page draws its OWN poster from the
// SAME section copy (no poster-specific AI rewrite, no separate page).
h.ok(/cards\s*=\s*\[[\s\S]*?'01'[\s\S]*?'02'[\s\S]*?'03'[\s\S]*?'04'[\s\S]*?'05'/.test(pageSrc), 'poster draws cards 01..05 in product order')
h.ok(/致命一句话/.test(pageSrc) && /核心问题/.test(pageSrc) && /系统困局/.test(pageSrc) && /翻身路径/.test(pageSrc) && /行动建议/.test(pageSrc), 'poster uses the SAME five product titles (no rewrite)')
h.ok(/sections\[0\]/.test(pageSrc) && /sections\[4\]/.test(pageSrc), 'poster reads the SAME rendered section copy')
h.ok(/canvas-id="posterCanvas"/.test(reportWxml), 'poster uses the restored Canvas runtime')

// ── §12/§13/§14 runtime model config + single-call model-first ────────────
h.eq(runtime.REPORT_MAX_TOKENS, 2048, 'max_tokens 2048')
h.eq(runtime.REPORT_TEMPERATURE, 0.65, 'temperature 0.65')
h.eq(runtime.MAX_MODEL_ATTEMPTS, 1, 'single model call (no whole-report regeneration)')
h.eq(runtime.ATTEMPT_TIMEOUT_MS, 15000, '15s attempt window (unchanged)')
h.eq(runtime.THINKING_DISABLED, { thinking: { type: 'disabled' } }, 'thinking disabled')

// ── runtime provider-error behaviour (fakes, no network) ──────────────────
async function runRuntimeChecks () {
  // provider total failure → deterministic whole report only
  const failCall = async () => ({ success: false, error: 'HTTP 500', providerErrorCode: 'AI_PROVIDER_UNAVAILABLE', httpStatus: 500 })
  const rf = await runtime.runLegacy6QReport({ event: { answers: raw }, callAI: failCall })
  h.eq(rf.reportState, 'FALLBACK', 'provider failure → FALLBACK')
  h.eq(rf._meta.renderSource, 'deterministic_fallback', 'provider failure → deterministic whole report')
  h.eq(rf.advice.length >= 1, true, 'fallback advice non-empty')

  // happy path → PRIMARY via tolerant parse, keep model output
  const okCall = async () => ({ success: true, content: '```json\n{"system_trap":"S","core_problem":"C","fatal_sentence":"☠️ F","strategy_path":"P","advice":["a","b"]}\n```', tokens: 100, finishReason: 'stop' })
  const ro = await runtime.runLegacy6QReport({ event: { answers: raw, personality: '流量猎人' }, callAI: okCall })
  h.eq(ro.reportState, 'PRIMARY', 'valid model output → PRIMARY')
  h.eq(ro._meta.renderSource, 'ai', 'renderSource ai')
  h.eq(ro._meta.modelCalls, 1, 'exactly ONE model call')
  h.eq(ro.system_trap, 'S', 'model output preserved')
  h.eq(ro.personality.name, '流量猎人', 'persona carried')

  // one weak field → field-level repair only, NOT a whole-report replacement
  const weakCall = async () => ({ success: true, content: '{"system_trap":"S","core_problem":"C","fatal_sentence":"F","strategy_path":"","advice":["a"]}', finishReason: 'stop' })
  const rw = await runtime.runLegacy6QReport({ event: { answers: raw }, callAI: weakCall })
  h.eq(rw.reportState, 'PRIMARY', 'one weak field still PRIMARY (no whole-report fallback)')
  h.eq(rw.system_trap, 'S', 'other fields NOT regenerated')
  h.eq(rw._meta.fallbackFields, ['strategy_path'], 'only the weak field defaulted')

  // timeout → total failure → fallback
  const slowCall = () => new Promise((r) => setTimeout(() => r({ success: true, content: '{}' }), 50))
  const rt = await runtime.runLegacy6QReport({ event: { answers: raw }, callAI: slowCall, attemptTimeoutMs: 5 })
  h.eq(rt.reportState, 'FALLBACK', 'timeout → FALLBACK')

  // invalid input
  const ri = await runtime.runLegacy6QReport({ event: { answers: { age: 'x', job: '', education: '', income: '', anxiety: '', rootCause: '' } }, callAI: okCall })
  h.eq(ri.reportState, 'INVALID_INPUT', 'invalid input rejected')

  h.summary('6Q legacy revival contract')
}

runRuntimeChecks()
