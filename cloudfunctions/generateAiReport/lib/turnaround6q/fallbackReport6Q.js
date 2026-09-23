'use strict'
/**
 * cloudfunctions/generateAiReport/lib/turnaround6q/fallbackReport6Q.js
 *
 * RC8.8 — DETERMINISTIC fallback report for the 6Q product line. Used ONLY when
 * the AI report is invalid (structural/semantic). It is built strictly from the
 * raw user facts — never invents anything — and satisfies the same five-field
 * contract + the same validator.
 *
 * @version turnaround_strategy_6q_v1
 */

function s (v) { return (v === undefined || v === null) ? '' : String(v).trim() }

function buildFallbackReport6Q (facts) {
  const f = facts || {}
  const job = s(f.job)
  const anxiety = s(f.anxiety)
  const root = s(f.rootCause)
  const income = s(f.income)

  // R4.1 §7 — if the raw answers conflict (job history), ACKNOWLEDGE it; never
  // silently pick one side.
  const jobHistoryConflict = /第[二两]份工作/.test(job) && /(几份|好几份|好多份|很多份|多份)/.test(anxiety + root)
  const corePrefix = jobHistoryConflict
    ? '你对自己工作经历的说法本身就有矛盾——一边说这是「刚换的第二份工作」，一边又说「换了几份」，先不纠结到底是第二份还是好几份。'
    : ''

  return {
    system_trap: '你在一份收入和投入都不成正比的位置上，反复用更多时间换取几乎不变的回报。',
    system_loop: [
      '当前职业：' + (job || '现有工作'),
      '收入停留在 ' + (income || '现有') + ' 元一带',
      '为此持续焦虑：' + (anxiety || '想改变'),
      '投入的时间无法沉淀成可积累的东西',
      '于是又回到同样的位置',
    ],
    core_problem: corePrefix + '你把自己现在的位置归因为「' + (root || '外部条件不够') + '」，但更真实的问题可能是：你一直在用时间换收入，缺少一件能反复产生价值的、可积累的东西。焦虑不会因为更努力而消失，只会因为结构改变而消失。',
    fatal_sentence: '你不是不够努力，你是一直在做一件「今天做完、明天归零」的事——所以你才总觉得原地打转。',
    strategy_path: '把一部分时间从「换钱」转向「做一件能被反复使用的东西」，哪怕一开始很小。',
    path_from: '用时间换固定收入',
    path_to: '做出可重复使用的东西',
    advice: [],
    experiment: {
      goal: '验证你的能力是否有人愿意买单',
      actions: ['列出 3 个潜在需求方', '发出一次真实报价或试用邀请'],
      target: '你能力对口的需求方',
      output: '一份最小可交付物',
      success_signal: '收到至少 1 条真实反馈或询问',
      time_horizon: '7天',
    },
    _source: 'deterministic_fallback_6q_v1',
  }
}

module.exports = { buildFallbackReport6Q }
