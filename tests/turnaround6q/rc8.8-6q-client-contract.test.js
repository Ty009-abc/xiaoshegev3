'use strict'
/**
 * tests/turnaround6q/rc8.8-6q-client-contract.test.js
 *
 * Proves the CLIENT 6Q contract (§2/§3/§5):
 *   - exactly 6 questions, exact old content + keys
 *   - raw Q2/Q5/Q6 text preserved verbatim (never optionIds)
 *   - request contract = turnaround_strategy_6q_v1, type=diagnostic
 *   - per-field validation + complete-set validation
 */

const h = require('./_harness.js')
const q = require('../../utils/turnaround6q/turnaround6qQuestionnaire.js')

h.section('RC8.8 6Q — client questionnaire contract')

h.eq(q.QUESTION_COUNT_6Q, 6, 'QUESTION_COUNT = 6')
h.eq(q.QUESTIONNAIRE_VERSION, 'turnaround_strategy_6q_v1', 'request version')

const QS = q.getQuestions6Q()
h.eq(QS.length, 6, 'question list length')
h.eq(QS.map((x) => x.key), ['age', 'job', 'education', 'income', 'anxiety', 'rootCause'], 'canonical keys')
h.eq(QS.map((x) => x.title), [
  '你今年几岁？', '你现在做什么工作？', '你的学历？', '你现在月收入多少？', '你现在最焦虑什么？', '你觉得自己为什么翻不了身？',
], 'exact old question text')
h.eq(QS.map((x) => x.inputMode), ['number', 'text', 'text', 'number', 'textarea', 'textarea'], 'input modes')

// per-field validation
h.ok(q.validateField6Q(QS[0], '') !== '', 'empty age rejected')
h.ok(q.validateField6Q(QS[0], 'abc') !== '', 'non-numeric age rejected')
h.ok(q.validateField6Q(QS[0], '34') === '', 'valid age accepted')
h.ok(q.validateField6Q(QS[1], '外卖骑手') === '', 'any job text accepted')

// raw text preservation
const raw = {
  age: '34', job: '外卖骑手', education: '高中', income: '6000',
  anxiety: '每天跑十几个小时，钱还是不够用', rootCause: '我没学历也没关系，只能靠体力挣钱',
}
const norm = q.normalizeAnswers6Q(raw)
h.eq(norm.job, '外卖骑手', 'job raw text preserved')
h.eq(norm.anxiety, raw.anxiety, 'anxiety raw text preserved')
h.eq(norm.rootCause, raw.rootCause, 'rootCause raw text preserved')

const req = q.buildCloudRequest6Q(raw)
h.eq(req.name, 'generateAiReport', 'cloud function name')
h.eq(req.data.type, 'diagnostic', 'request type')
h.eq(req.data.diagnosticVersion, 'turnaround_strategy_6q_v1', 'request diagnosticVersion')
h.eq(Object.keys(req.data.answers).sort(), ['age', 'anxiety', 'education', 'income', 'job', 'rootCause'], 'payload keys')
h.ok(!('Q1' in req.data.answers) && !('optionId' in req.data.answers), 'no optionId / no Q-ids in payload')

const bad = q.validateAnswers6Q({ age: '34', job: '', education: '', income: '', anxiety: '', rootCause: '' })
h.ok(!bad.valid && bad.errors.length >= 5, 'incomplete set invalid')

h.summary('6Q client contract')
