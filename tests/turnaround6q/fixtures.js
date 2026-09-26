'use strict'
/**
 * tests/turnaround6q/fixtures.js — RC8.8 6Q product fixtures (§15).
 *
 * Each fixture preserves the FULL raw 6Q user text (age/job/education/income/
 * anxiety/rootCause). No personal information is invented for real people; the
 * owner-style fixture (§17) reuses the only real-ish sample available in the
 * repo — the legacy example job text 厨师/销售/程序员 captured in the old 6Q
 * placeholder — and is otherwise synthetically completed and clearly marked.
 */

const FIXTURES = [
  {
    id: 'F01',
    label: '31–40 外卖/快递/基层工作 低收入 现金流焦虑',
    answers: {
      age: '34',
      job: '外卖骑手',
      education: '高中',
      income: '6000',
      anxiety: '每天跑十几个小时，钱还是不够用，一停下来收入就没了',
      rootCause: '我没学历也没关系，只能靠体力挣钱，再拼也没用',
    },
  },
  {
    id: 'F02',
    label: '31–40 短视频运营 工资 职业/收入焦虑',
    answers: {
      age: '33',
      job: '短视频运营',
      education: '本科',
      income: '12000',
      anxiety: '干了五年还是在执行层，收入卡住了，担心再耗几年就被淘汰',
      rootCause: '我一直做执行，没做出自己的作品和账号，只有经验没有资产',
    },
  },
  {
    id: 'F03',
    label: '40+ 个体经营 生意压力',
    answers: {
      age: '46',
      job: '开了一家小餐馆',
      education: '大专',
      income: '15000',
      anxiety: '这两年生意越来越差，房租和人工压得喘不过气',
      rootCause: '我不懂营销也不会做线上，只能靠老客户撑着，越撑越怕',
    },
  },
  {
    id: 'F04',
    label: '20s 经验不足 方向焦虑',
    answers: {
      age: '24',
      job: '刚换的第二份工作，做行政',
      education: '本科',
      income: '5500',
      anxiety: '不知道自己适合什么，换了几份工作都没方向',
      rootCause: '我好像什么都试了一点，但没有一个能沉下来',
    },
  },
  {
    id: 'F05',
    label: '高学历专业人士 工资但停滞',
    answers: {
      age: '38',
      job: '护士长',
      education: '硕士',
      income: '18000',
      anxiety: '收入稳定但十年没涨过，看不到往上走的空间',
      rootCause: '我把所有精力都放在了把活干好，从没想过怎么放大自己的价值',
    },
  },
  {
    id: 'F06',
    label: '模糊 / 自相矛盾的自我评估',
    answers: {
      age: '30',
      job: '说是做销售，但也接点零碎的兼职',
      education: '大专',
      income: '9000',
      anxiety: '说不上来，就是很焦虑，觉得自己其实还行但又很慌',
      rootCause: '可能是我运气不好，也可能是我没坚持，我自己也说不清',
    },
  },
]

// §17 owner-style sample — built ONLY from data already present in the repo
// (the legacy 6Q example job text). Not a real person's private data.
const OWNER_STYLE_FIXTURE = {
  id: 'OWNER_STYLE',
  label: 'owner-style sample (legacy example job text reused; remainder synthetic)',
  note: 'Reuses the legacy placeholder example 厨师 / 销售 / 程序员. No new private information invented.',
  answers: {
    age: '31',
    job: '厨师',
    education: '高中',
    income: '8000',
    anxiety: '在厨房干了快十年，工资到顶了，想换个能往上走的方向',
    rootCause: '我只会在厨房里干活，出去别的什么都不会',
  },
}

module.exports = { FIXTURES, OWNER_STYLE_FIXTURE }
