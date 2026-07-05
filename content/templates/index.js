/**
 * content/templates/index.js — 脚本模板（第六册 Part 2）
 *
 * 4 矩阵 × 2 格式（短脚本 / 短视频脚本）
 *
 * 结构：前3秒(炸裂) → 中段(tension) → 后段(认知暴击) → CTA
 */
const SCRIPT_TEMPLATES = {
  // ═══════════════════════════
  // casino 赌场认知
  // ═══════════════════════════
  casino: {
    short: {
      name: '赌场认知 · 短脚本',
      duration: '30-60秒',
      structure: [
        { phase: 'hook',     duration: '0-3s',   desc: '反常识赌场金句',        example: '赌场不出千，也能稳赚不赔——你信不信？' },
        { phase: 'conflict', duration: '3-20s',  desc: '揭露系统/逻辑/人性漏洞',  example: '灯光/路线/声音全是算法。你以为在跟庄家玩，其实在跟概率学玩。' },
        { phase: 'insight',  duration: '20-40s', desc: '上升到认知层 — 人生即赌场', example: '你不是在赌场才在赌。你的每一次"决策"，都是在对自己的人生下注。' },
        { phase: 'cta',      duration: '40-50s', desc: '结果驱动导流',             example: '想知道你的认知操作系统什么版本？小程序搜"珠澳小事哥"。' },
      ],
    },
    video: {
      name: '赌场认知 · 短视频脚本',
      duration: '40-90秒',
      structure: [
        { phase: 'hook',     duration: '0-2s',   action: '直接怼脸：一句反常识赌场金句' },
        { phase: 'build',    duration: '2-8s',   action: '快速蒙太奇：澳门街景/赌场环境/人群特写' },
        { phase: 'conflict', duration: '8-25s',  action: '揭露本质：赌场的底层逻辑是收割你的认知盲区' },
        { phase: 'insight',  duration: '25-35s', action: '认知暴击：你一生的决策都是"赌"——只是你没意识到' },
        { phase: 'cta',      duration: '35-42s', action: '字幕：搜"珠澳小事哥"测你的翻转概率' },
      ],
    },
  },

  // ═══════════════════════════
  // cognition 认知暴击
  // ═══════════════════════════
  cognition: {
    short: {
      name: '认知暴击 · 短观点',
      duration: '20-40秒',
      structure: [
        { phase: 'hook',     duration: '0-3s',   desc: '一句打脸金句',            example: '99%的人，根本不懂什么是赚钱。' },
        { phase: 'conflict', duration: '3-12s',  desc: '拆解错误认知',             example: '赚钱不是卖时间，是卖"认知差"。努力是放大器，认知才是方向。' },
        { phase: 'insight',  duration: '12-25s', desc: '给新框架',                example: '人和人的差距，本质是"决策质量"的差距。而决策质量，由信息完整度决定。' },
        { phase: 'cta',      duration: '25-30s', desc: '导流测试',                example: '你的决策质量现在多少分？去小程序测。' },
      ],
    },
    video: {
      name: '认知暴击 · 短视频',
      duration: '30-60秒',
      structure: [
        { phase: 'hook',     duration: '0-2s',   action: '黑底白字大字：金句冲击' },
        { phase: 'build',    duration: '2-8s',   action: '快速切换场景 — 环境感建立' },
        { phase: 'conflict', duration: '8-18s',  action: '拆解常见迷思 — 制造紧张感' },
        { phase: 'insight',  duration: '18-28s', action: '给新认知 — 观众"哦原来如此"' },
        { phase: 'cta',      duration: '28-35s', action: '引导去小程序 — 二维码/搜索引导' },
      ],
    },
  },

  // ═══════════════════════════
  // ai AI翻身
  // ═══════════════════════════
  ai: {
    short: {
      name: 'AI翻身 · 短脚本',
      duration: '30-50秒',
      structure: [
        { phase: 'hook',     duration: '0-3s',   desc: '危机型开局',              example: '注意——AI最先淘汰的，是你还没意识到的那种人。' },
        { phase: 'conflict', duration: '3-18s',  desc: 'AI的实际影响拆解',        example: '淘汰你的不是AI，是"会用AI的人"。一个人+AI = 一个团队。' },
        { phase: 'insight',  duration: '18-30s', desc: '机会在认知差',            example: '未来五年，最值钱的不是技术，是"知道怎么用AI"，叫"认知层的人"。' },
        { phase: 'cta',      duration: '30-40s', desc: '测你的可塑性',            example: '用AI测你的"认知可塑性"——看你会不会被淘汰。' },
      ],
    },
    video: {
      name: 'AI翻身 · 短视频',
      duration: '40-80秒',
      structure: [
        { phase: 'hook',     duration: '0-2s',   action: '黑屏 + 文字：AI第一个淘汰的人，是你吗？' },
        { phase: 'build',    duration: '2-10s',  action: 'AI能力演示 / 行业变化剪辑' },
        { phase: 'conflict', duration: '10-22s', action: '拆解"谁会被淘汰"的逻辑 — 颠覆认知' },
        { phase: 'insight',  duration: '22-32s', action: '展示反向思维 — 有人靠AI赚了多少' },
        { phase: 'cta',      duration: '32-40s', action: '引导去小程序测认知可塑性' },
      ],
    },
  },

  // ═══════════════════════════
  // trending 热点拆解
  // ═══════════════════════════
  trending: {
    short: {
      name: '热点拆解 · 短评',
      duration: '30-50秒',
      structure: [
        { phase: 'hook',     duration: '0-3s',   desc: '热点关联句',               example: '最近的数据说了一件事，大多数人只听懂了表面。' },
        { phase: 'conflict', duration: '3-18s',  desc: '数据深层解读',             example: '你以为经济在变差？不，是你的"认知框架"在变旧。' },
        { phase: 'insight',  duration: '18-30s', desc: '认知角度破题',             example: '热点会过去，但你的操作系统版本不会自动更新。' },
        { phase: 'cta',      duration: '30-40s', desc: '测认知版本',               example: '看看你的认知操作系统是什么版本——小程序搜"珠澳小事哥"。' },
      ],
    },
    video: {
      name: '热点拆解 · 短视频',
      duration: '40-80秒',
      structure: [
        { phase: 'hook',     duration: '0-2s',   action: '当前热点画面 + 一句话点破' },
        { phase: 'build',    duration: '2-10s',  action: '展开数据/事件细节' },
        { phase: 'conflict', duration: '10-22s', action: '揭示大多数人没看到的角度' },
        { phase: 'insight',  duration: '22-32s', action: '上升到认知层:什么决定了你看到什么' },
        { phase: 'cta',      duration: '32-40s', action: '引导去小程序测认知版本' },
      ],
    },
  },
}

module.exports = { SCRIPT_TEMPLATES }
