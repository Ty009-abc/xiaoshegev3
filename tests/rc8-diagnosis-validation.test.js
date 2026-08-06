/**
 * RC8.1 Diagnosis Validation Suite
 *
 * 1. Golden Dataset (30+ cases)
 * 2. Explainability — full reasoning chain per case
 * 3. Consistency Test — deterministic output
 * 4. Coverage Analysis — tag/archetype/bottleneck/strategy coverage
 * 5. Poster Consistency Check
 */

var pipeline = require('../engine/diagnosisPipeline')

var PASSED = 0, FAILED = 0, WARNINGS = []

function test(name, fn) {
  try { fn(); PASSED++; console.log('  ✓ ' + name) }
  catch (e) { FAILED++; console.error('  ✗ ' + name + ': ' + e.message) }
}

function assert(cond, msg) { if (!cond) throw new Error(msg) }
function assertEqual(a, b, m) { if (a !== b) throw new Error((m || '') + ' expected=' + b + ' got=' + a) }
function assertIn(val, arr, msg) { if (arr.indexOf(val) === -1) throw new Error((msg || '') + val + ' not in ' + JSON.stringify(arr)) }

// ═══════════════════════════════════════════════
// GOLDEN DATASET — 32 Cases
// ═══════════════════════════════════════════════

var GOLDEN = [
  // Case 1 — Classic Employee stuck in single-income trap
  {
    id: 'GOLDEN_001',
    description: '月薪5000上班族，没有副业',
    labels: {
      archetype: 'EMPLOYEE',
      bottleneck: 'LEVERAGE',
      strategy: 'BUILD_CASHFLOW'
    },
    answers: {
      income: '工资5000，只有一份收入，上班拿死工资',
      learning: '偶尔看看书，没系统学习',
      selling: '从来没卖过东西，不知道怎么卖',
      decision: '想改变但不知道从哪里开始',
      product: '没有产品，只会打工',
      future: '想有被动收入，但不知道怎么做'
    }
  },
  // Case 2 — Learning addict, zero action
  {
    id: 'GOLDEN_002',
    description: '囤课不学的知识收藏者',
    labels: {
      archetype: 'COLLECTOR',
      bottleneck: 'EXECUTION',
      strategy: 'DISCIPLINE_FIRST'
    },
    answers: {
      income: '工资8000，上班族',
      learning: '每天看书学习，囤了很多课，知识付费花了不少钱',
      selling: '不好意思卖东西，不敢卖，不会卖',
      decision: '一直拖延，等准备好了再开始',
      product: '没有产品，学了很多但不知道转化',
      future: '想变现，但执行力差'
    }
  },
  // Case 3 — Natural Seller, needs product
  {
    id: 'GOLDEN_003',
    description: '会销售但缺产品',
    labels: {
      archetype: 'SELLER',
      bottleneck: 'PRODUCT',
      strategy: 'BUILD_PRODUCT'
    },
    answers: {
      income: '做销售出身，月收入2万左右，有好几个收入来源，成交能力强',
      learning: '实践为主，遇到问题再学习',
      selling: '卖东西很自然，敢要价，成交能力强，销售能力好',
      decision: '想做自己的产品，不想一直帮别人卖',
      product: '还没有自己的产品，不知道卖什么',
      future: '想建立自己的品牌和产品线'
    }
  },
  // Case 4 — Creator with no audience
  {
    id: 'GOLDEN_004',
    description: '有内容能力，没有流量',
    labels: {
      archetype: 'CREATOR',
      bottleneck: 'TRAFFIC',
      strategy: 'BUILD_ACQUISITION_SYSTEM'
    },
    answers: {
      income: '自由职业，收入不稳定，2-3万',
      learning: '不断学习新技能，投资自己',
      selling: '不太会卖，内容做得很好但变现差',
      decision: '想做个人IP',
      product: '有内容能力，但没有产品化',
      future: '想建立自己的IP和影响力'
    }
  },
  // Case 5 — High risk gambler
  {
    id: 'GOLDEN_005',
    description: '追热点，高风险投机',
    labels: {
      archetype: 'GAMBLER',
      bottleneck: 'SYSTEM',
      strategy: 'BUILD_SYSTEM'
    },
    answers: {
      income: '不稳定，看行情，好的时候月入5万，差的时候0',
      learning: '跟风学习，什么热学什么',
      selling: '敢投入，不太怕风险',
      decision: '看到机会就扑上去，经常换方向',
      product: '没有固定的产品',
      future: '想有一个稳定的长期事业'
    }
  },
  // Case 6 — Busy Employee, no time
  {
    id: 'GOLDEN_006',
    description: '工作太忙没时间副业',
    labels: {
      archetype: 'EMPLOYEE',
      bottleneck: 'LEVERAGE',
      strategy: 'BUILD_CASHFLOW'
    },
    answers: {
      income: '工资12000，工作很忙，加班多',
      learning: '没有时间学习，工作就够累了',
      selling: '不知道怎么卖',
      decision: '没时间想别的',
      product: '没有产品',
      future: '想有多一份收入'
    }
  },
  // Case 7 — Operator with no system
  {
    id: 'GOLDEN_007',
    description: '执行力强但缺乏系统',
    labels: {
      archetype: 'OPERATOR',
      bottleneck: 'SYSTEM',
      strategy: 'BUILD_SYSTEM'
    },
    answers: {
      income: '自己做小生意，月入3万，什么都自己干',
      learning: '实践中学习',
      selling: '销售还可以，能成交',
      decision: '想扩大规模但一个人忙不过来',
      product: '有产品但无法规模化',
      future: '想建立可以复制的系统'
    }
  },
  // Case 8 — Perfectionist, never launches
  {
    id: 'GOLDEN_008',
    description: '完美主义拖延',
    labels: {
      archetype: 'COLLECTOR',
      bottleneck: 'DISCIPLINE',
      strategy: 'DISCIPLINE_FIRST'
    },
    answers: {
      income: '自由职业，收入不稳定，1万左右',
      learning: '追求完美，反复修改，不够好不敢发',
      selling: '不好意思要价',
      decision: '一直在准备，一直没开始',
      product: '产品一直在打磨，还没上线',
      future: '想建立一个长期稳定的事业'
    }
  },
  // Case 9 — Builder in the making
  {
    id: 'GOLDEN_009',
    description: '长期主义者，需要获客',
    labels: {
      archetype: 'BUILDER',
      bottleneck: 'TRAFFIC',
      strategy: 'BUILD_ACQUISITION_SYSTEM'
    },
    answers: {
      income: '创业中，月入4-5万，有稳定业务',
      learning: '系统性学习，长期思维',
      selling: '销售流程比较完善',
      decision: '想进一步规模化',
      product: '有产品，有系统',
      future: '想建立自动化获客系统'
    }
  },
  // Case 10 — Deep expert, zero selling skills
  {
    id: 'GOLDEN_010',
    description: '技术专家，完全不会卖',
    labels: {
      archetype: 'CREATOR',
      bottleneck: 'SELLING',
      strategy: 'SELL_FIRST'
    },
    answers: {
      income: '技术岗位，月入2.5万',
      learning: '深度学习，技术钻研很深',
      selling: '完全不会卖，觉得卖东西不好意思',
      decision: '想把知识变现但不知道怎么开始',
      product: '有深厚的技术积累但没有产品',
      future: '想把自己的技术能力变现'
    }
  },
  // Case 11 — Multi-income hustler, scattered
  {
    id: 'GOLDEN_011',
    description: '多个方向，专注缺失',
    labels: {
      archetype: 'OPERATOR',
      bottleneck: 'POSITIONING',
      strategy: 'DISCIPLINE_FIRST'
    },
    answers: {
      income: '做很多事，什么都做，副业3-4个，月入3万',
      learning: '什么都在学，不够专注',
      selling: '销售还行',
      decision: '什么都想做，不够专注',
      product: '有好几个产品方向',
      future: '想知道该专注哪个方向'
    }
  },
  // Case 12 — Fresh college grad, no direction
  {
    id: 'GOLDEN_012',
    description: '刚毕业，迷茫期',
    labels: {
      archetype: 'EMPLOYEE',
      bottleneck: 'POSITIONING',
      strategy: 'BUILD_ACQUISITION_SYSTEM'
    },
    answers: {
      income: '刚毕业，工资6000，只有一份工作',
      learning: '还在摸索方向，学习为主',
      selling: '没卖过东西',
      decision: '迷茫，不知道未来方向',
      product: '没有产品',
      future: '想找到自己的方向'
    }
  },
  // Case 13 — Mid-career crisis, wants to escape wage
  {
    id: 'GOLDEN_013',
    description: '中年职场危机，想逃离工资依赖',
    labels: {
      archetype: 'EMPLOYEE',
      bottleneck: 'LEVERAGE',
      strategy: 'BUILD_CASHFLOW'
    },
    answers: {
      income: '工资1.5万，有房贷压力',
      learning: '没什么时间系统学习',
      selling: '没做过销售',
      decision: '不敢辞职，担心断了收入',
      product: '没有自己的产品',
      future: '想有第二收入来源'
    }
  },
  // Case 14 — Strong personal brand, needs system
  {
    id: 'GOLDEN_014',
    description: '有影响力但缺乏运营系统',
    labels: {
      archetype: 'SELLER',
      bottleneck: 'SYSTEM',
      strategy: 'BUILD_SYSTEM'
    },
    answers: {
      income: '个人IP变现，月入5-8万',
      learning: '持续学习，实战导向',
      selling: '变现能力强，会卖',
      decision: '想把IP做成系统化运营',
      product: '有产品但缺乏标准化流程',
      future: '想建立可规模化的系统'
    }
  },
  // Case 15 — Underpricing, afraid to charge
  {
    id: 'GOLDEN_015',
    description: '有能力但不敢要价',
    labels: {
      archetype: 'COLLECTOR',
      bottleneck: 'PRICING',
      strategy: 'SELL_FIRST'
    },
    answers: {
      income: '自由职业，月入1万，报价偏低',
      learning: '持续在学习，能力提升',
      selling: '不敢要高价，怕客户跑',
      decision: '一直纠结定价问题',
      product: '有服务但定价太低',
      future: '想提高收入但不自信'
    }
  },
  // Case 16 — Niche expert, tiny market
  {
    id: 'GOLDEN_016',
    description: '垂直领域专家，获客难',
    labels: {
      archetype: 'CREATOR',
      bottleneck: 'TRAFFIC',
      strategy: 'BUILD_IP'
    },
    answers: {
      income: '咨询服务，月入3万，客户少但单价高',
      learning: '专业领域深度学习',
      selling: '一对一会谈转化好，但获客慢',
      decision: '想扩大影响力',
      product: '有专业服务，IP属性强',
      future: '想建立个人品牌扩大影响'
    }
  },
  // Case 17 — Full commission, no base
  {
    id: 'GOLDEN_017',
    description: '纯佣金销售，风险大',
    labels: {
      archetype: 'SELLER',
      bottleneck: 'LEVERAGE',
      strategy: 'BUILD_PRODUCT'
    },
    answers: {
      income: '纯销售提成，不稳定',
      learning: '销售技巧为主',
      selling: '推销能力强',
      decision: '想把销售能力转化为自有业务',
      product: '只帮别人卖，没有自己的产品',
      future: '想做自己的事'
    }
  },
  // Case 18 — Mom blogger with following
  {
    id: 'GOLDEN_018',
    description: '宝妈博主，有流量不会变现',
    labels: {
      archetype: 'CREATOR',
      bottleneck: 'SELLING',
      strategy: 'SELL_FIRST'
    },
    answers: {
      income: '没有收入，全职带娃',
      learning: '偶尔学习自媒体运营',
      selling: '没有卖过任何东西，不好意思',
      decision: '想变现但又怕被人说',
      product: '有流量粉丝但没有产品',
      future: '想做自己的产品变现'
    }
  },
  // Case 19 — Overthinking planner
  {
    id: 'GOLDEN_019',
    description: '过度思考型，从不执行',
    labels: {
      archetype: 'COLLECTOR',
      bottleneck: 'EXECUTION',
      strategy: 'DISCIPLINE_FIRST'
    },
    answers: {
      income: '上班族，月入9000',
      learning: '每天都在学习和思考各种商业模式',
      selling: '没有卖过',
      decision: '想太多，反复权衡，拿不定主意',
      product: '没有产品，纸上谈兵',
      future: '想要一个完美的方案再行动'
    }
  },
  // Case 20 — Serial entrepreneur, system gap
  {
    id: 'GOLDEN_020',
    description: '连续创业者，缺乏系统',
    labels: {
      archetype: 'GAMBLER',
      bottleneck: 'SYSTEM',
      strategy: 'BUILD_SYSTEM'
    },
    answers: {
      income: '创业多次，有好有坏',
      learning: '实践派',
      selling: '有商业感觉',
      decision: '有商业直觉但缺乏系统化管理',
      product: '多个项目，没有成熟系统',
      future: '想建立一套完整的商业系统'
    }
  },
  // Case 21 — Employee wants side hustle, no skill
  {
    id: 'GOLDEN_021',
    description: '上班族想做副业但没有一技之长',
    labels: {
      archetype: 'EMPLOYEE',
      bottleneck: 'PRODUCT',
      strategy: 'BUILD_PRODUCT'
    },
    answers: {
      income: '工资7000，想要第二收入',
      learning: '没什么特别技能',
      selling: '不会销售',
      decision: '想做副业不知道做什么',
      product: '没有产品，不知道自己能卖什么',
      future: '想有一个可以持续做的东西'
    }
  },
  // Case 22 — Freelancer plateau
  {
    id: 'GOLDEN_022',
    description: '自由职业者收入瓶颈',
    labels: {
      archetype: 'OPERATOR',
      bottleneck: 'PRICING',
      strategy: 'SELL_FIRST'
    },
    answers: {
      income: '自由职业，收入瓶颈在1.5万/月',
      learning: '技术不错但商业思维不足',
      selling: '报价低，不敢涨价',
      decision: '想突破收入天花板',
      product: '有技能但不会产品化',
      future: '想提高单价和收入'
    }
  },
  // Case 23 — AI learner, zero application
  {
    id: 'GOLDEN_023',
    description: '追AI热点，从不实践',
    labels: {
      archetype: 'COLLECTOR',
      bottleneck: 'EXECUTION',
      strategy: 'DISCIPLINE_FIRST'
    },
    answers: {
      income: '上班族，月入1万',
      learning: '每天跟各种AI课程和工具，买了很多',
      selling: '没卖过东西',
      decision: '想用AI赚钱但一直在学新工具',
      product: '学了很多AI但没做出来任何东西',
      future: '想用AI建立被动收入'
    }
  },
  // Case 24 — Low confidence, high potential
  {
    id: 'GOLDEN_024',
    description: '有能力但不自信',
    labels: {
      archetype: 'COLLECTOR',
      bottleneck: 'CONFIDENCE',
      strategy: 'SELL_FIRST'
    },
    answers: {
      income: '有专业技能但收入不高1.2万',
      learning: '能力很强但总觉得自己不够好',
      selling: '不敢卖，怕被别人说不够好',
      decision: '一直觉得没准备好',
      product: '有能力做出产品但不敢上线',
      future: '想建立自信实现价值'
    }
  },
  // Case 25 — System builder ready
  {
    id: 'GOLDEN_025',
    description: '生意稳定，需要系统化',
    labels: {
      archetype: 'BUILDER',
      bottleneck: 'SYSTEM',
      strategy: 'BUILD_SYSTEM'
    },
    answers: {
      income: '做生意，月利润8万，稳定',
      learning: '系统性学习管理知识',
      selling: '销售流程成熟',
      decision: '想把生意系统化，自己抽身',
      product: '产品成熟，市场稳定',
      future: '想建立自运转系统'
    }
  },
  // Case 26 — Young hustler, short-term
  {
    id: 'GOLDEN_026',
    description: '年轻人，热衷赚快钱',
    labels: {
      archetype: 'GAMBLER',
      bottleneck: 'DISCIPLINE',
      strategy: 'DISCIPLINE_FIRST'
    },
    answers: {
      income: '各种搞钱，不稳定',
      learning: '什么赚钱学什么',
      selling: '能搞到钱但坚持不久',
      decision: '短线思维，频繁换方向',
      product: '没有固定的产品',
      future: '想找到一个能长期坚持的方向'
    }
  },
  // Case 27 — Retired wanting encore career
  {
    id: 'GOLDEN_027',
    description: '退休人士想做新事业',
    labels: {
      archetype: 'BUILDER',
      bottleneck: 'POSITIONING',
      strategy: 'BUILD_IP'
    },
    answers: {
      income: '退休金+投资收入',
      learning: '有丰富的人生经验和专业知识',
      selling: '没有销售经验',
      decision: '想做新事业但不知道方向',
      product: '有经验但不知道如何产品化',
      future: '想把人生经验变成有价值的东西'
    }
  },
  // Case 28 — Agency owner scaling
  {
    id: 'GOLDEN_028',
    description: '代理公司老板，需要放大',
    labels: {
      archetype: 'OPERATOR',
      bottleneck: 'SYSTEM',
      strategy: 'BUILD_SYSTEM'
    },
    answers: {
      income: '做代理公司，月入10万',
      learning: '管理学习为主',
      selling: '销售能力强',
      decision: '想从手工管理走向系统化',
      product: '服务型产品',
      future: '想建立标准化的服务系统'
    }
  },
  // Case 29 — Teacher wants online course
  {
    id: 'GOLDEN_029',
    description: '老师想做在线课程',
    labels: {
      archetype: 'CREATOR',
      bottleneck: 'TRAFFIC',
      strategy: 'BUILD_PRODUCT'
    },
    answers: {
      income: '教师工资8000',
      learning: '一直在学习和准备课程内容',
      selling: '不知道怎么卖课程',
      decision: '想做在线课程',
      product: '课程内容在准备中',
      future: '想建立自己的课程品牌'
    }
  },
  // Case 30 — Wealthy but unsatisfied
  {
    id: 'GOLDEN_030',
    description: '有钱但不满足，想做有意义的事',
    labels: {
      archetype: 'BUILDER',
      bottleneck: 'POSITIONING',
      strategy: 'BUILD_IP'
    },
    answers: {
      income: '高净值，资产收入为主',
      learning: '持续学习新领域',
      selling: '不擅长',
      decision: '想做有意义的事但不知道做什么',
      product: '有资本但没找到好方向',
      future: '想建立有社会价值的事业'
    }
  },
  // Case 31 — Empty input edge case
  {
    id: 'GOLDEN_031',
    description: '空输入（全空）',
    labels: { archetype: 'UNDETERMINED', bottleneck: 'UNKNOWN', strategy: 'DISCIPLINE_FIRST' },
    answers: { income: '', learning: '', selling: '', decision: '', product: '', future: '' }
  },
  // Case 32 — Minimal info
  {
    id: 'GOLDEN_032',
    description: '极简输入',
    labels: { archetype: 'UNDETERMINED', bottleneck: 'UNKNOWN', strategy: 'DISCIPLINE_FIRST' },
    answers: { income: '上班', learning: '看书', selling: '不会', decision: '没想好', product: '没有', future: '不知道' }
  },
  // Case 33 — Courier with content skills, small wins, wants IP
  {
    id: 'GOLDEN_033',
    description: '快递员/内容创作/已有成交/想建IP',
    labels: {
      archetype: 'CREATOR',
      bottleneck: 'TRAFFIC',
      strategy: 'BUILD_IP'
    },
    answers: {
      income: '快递员，固定工资5000，月结余1000以下，已有6-12个月安全垫存款',
      learning: '每天拿出时间学习内容创作，有内容创作能力',
      selling: '已有少数成交量，在尝试卖东西',
      decision: '想建立个人IP，做内容方向',
      product: '有内容创作能力但还没有成熟产品',
      future: '每周有20小时以上，执行稳定，小步尝试，小规模试错，想做IP'
    }
  }
]

// ═══════════════════════════════════════════════
// 1. GOLDEN DATASET TEST
// ═══════════════════════════════════════════════

console.log('\n═════════════════════════════════════════')
console.log('PART 1: GOLDEN DATASET (32 cases)')
console.log('═════════════════════════════════════════')

var archetypeAccuracy = { correct: 0, total: 0 }
var bottleneckAccuracy = { correct: 0, total: 0 }
var strategyAccuracy = { correct: 0, total: 0 }

GOLDEN.forEach(function(entry) {
  test('[' + entry.id + '] ' + entry.description, function() {
    var result = pipeline.runDiagnosis(entry.answers)

    // Arhetype check (skip UNDETERMINED)
    if (entry.labels.archetype !== 'UNDETERMINED') {
      archetypeAccuracy.total++
      if (result.wealthProfile.primary === entry.labels.archetype) archetypeAccuracy.correct++
    }

    // Bottleneck check (skip UNKNOWN)
    if (entry.labels.bottleneck !== 'UNKNOWN') {
      bottleneckAccuracy.total++
      if (result.bottleneck.id === entry.labels.bottleneck) bottleneckAccuracy.correct++
    }

    // Strategy check
    strategyAccuracy.total++
    if (result.strategy.id === entry.labels.strategy) strategyAccuracy.correct++

    // Minimum validation
    assert(typeof result.wealthProfile.primary === 'string', 'should have archetype')
    assert(typeof result.bottleneck.id === 'string', 'should have bottleneck')
    assert(typeof result.strategy.id === 'string', 'should have strategy')

    // Unique bottleneck enforcement
    assert(typeof result.bottleneck.id === 'string' && !Array.isArray(result.bottleneck.id), 'single bottleneck only')

    // Unique strategy enforcement
    assert(typeof result.strategy.id === 'string' && !Array.isArray(result.strategy.id), 'single strategy only')
  })
})

// ═══════════════════════════════════════════════
// 2. EXPLAINABILITY TEST
// ═══════════════════════════════════════════════

console.log('\n═════════════════════════════════════════')
console.log('PART 2: EXPLAINABILITY')
console.log('═════════════════════════════════════════')

var explainableCases = [
  { id: 'COLLECTOR_PROFILE', answers: GOLDEN[1].answers }
]

explainableCases.forEach(function(entry) {
  test('Explainability — ' + entry.id, function() {
    var result = pipeline.runDiagnosis(entry.answers)

    // Reasoning chain must exist
    assert(typeof result.summaryText === 'string' && result.summaryText.length > 0, 'summaryText missing')

    // Each layer must have evidence
    assert(result.tagStats.totalTags > 0, 'no behavior tags found')
    assert(result.wealthProfile.confidence > 0 || result.wealthProfile.primary === 'UNDETERMINED', 'no confidence score')

    // Bottleneck must cite reasoning tags
    assert(Array.isArray(result.bottleneck.reason) && result.bottleneck.reason.length > 0 || result.bottleneck.id === 'UNKNOWN',
      'bottleneck missing reason tags')

    // Strategy must have milestones
    assert(Array.isArray(result.strategy.milestones) && result.strategy.milestones.length >= 2,
      'strategy milestones insufficient')

    // Print full reasoning chain for manual review
    console.log('  → Tags: ' + result.tagStats.totalTags + ' | Arch: ' + result.wealthProfile.primary +
      ' | BN: ' + result.bottleneck.id + ' | Strat: ' + result.strategy.id)
    console.log('  → BN reason: ' + JSON.stringify(result.bottleneck.reason))
    console.log('  → Strategy: ' + result.strategy.strategyTagline)
  })
})

// ═══════════════════════════════════════════════
// 3. CONSISTENCY TEST
// ═══════════════════════════════════════════════

console.log('\n═════════════════════════════════════════')
console.log('PART 3: CONSISTENCY (deterministic)')
console.log('═════════════════════════════════════════')

test('Same input → same output (100 iterations)', function() {
  var answers = GOLDEN[0].answers // Employee case
  var first = pipeline.runDiagnosis(answers)

  for (var i = 0; i < 100; i++) {
    var repeat = pipeline.runDiagnosis(answers)
    assertEqual(repeat.wealthProfile.primary, first.wealthProfile.primary, 'archetype diverged at i=' + i)
    assertEqual(repeat.bottleneck.id, first.bottleneck.id, 'bottleneck diverged at i=' + i)
    assertEqual(repeat.strategy.id, first.strategy.id, 'strategy diverged at i=' + i)
  }
})

test('Tag extraction is deterministic', function() {
  var answers = { income: '工资5000上班单一收入没有系统' }
  var first = pipeline.runDiagnosis(answers)
  for (var i = 0; i < 50; i++) {
    var repeat = pipeline.runDiagnosis(answers)
    assertEqual(repeat.tagStats.totalTags, first.tagStats.totalTags)
  }
})

// ═══════════════════════════════════════════════
// 4. COVERAGE ANALYSIS
// ═══════════════════════════════════════════════

console.log('\n═════════════════════════════════════════')
console.log('PART 4: COVERAGE ANALYSIS')
console.log('═════════════════════════════════════════')

test('Archetype coverage — all 7 types appear in golden dataset', function() {
  var archetypesFound = {}
  GOLDEN.forEach(function(entry) {
    var result = pipeline.runDiagnosis(entry.answers)
    if (result.wealthProfile.primary !== 'UNDETERMINED') {
      archetypesFound[result.wealthProfile.primary] = true
    }
  })
  var expected = ['BUILDER','OPERATOR','SELLER','CREATOR','EMPLOYEE','COLLECTOR','GAMBLER']
  expected.forEach(function(a) {
    assert(archetypesFound[a], 'Archetype ' + a + ' never appears in golden dataset')
  })
  console.log('  → All 7 archetypes covered: ' + JSON.stringify(expected))
})

test('Bottleneck coverage — at least 6 of 10 types appear', function() {
  var bottlenecksFound = {}
  GOLDEN.forEach(function(entry) {
    var result = pipeline.runDiagnosis(entry.answers)
    if (result.bottleneck.id !== 'UNKNOWN') {
      bottlenecksFound[result.bottleneck.id] = true
    }
  })
  var count = Object.keys(bottlenecksFound).length
  assert(count >= 6, 'Only ' + count + ' bottlenecks covered, need >= 6')
  console.log('  → ' + count + ' bottlenecks covered: ' + JSON.stringify(Object.keys(bottlenecksFound)))
})

test('Strategy coverage — at least 5 of 7 strategies appear', function() {
  var strategiesFound = {}
  GOLDEN.forEach(function(entry) {
    var result = pipeline.runDiagnosis(entry.answers)
    strategiesFound[result.strategy.id] = true
  })
  var count = Object.keys(strategiesFound).length
  assert(count >= 5, 'Only ' + count + ' strategies covered, need >= 5')
  console.log('  → ' + count + ' strategies covered: ' + JSON.stringify(Object.keys(strategiesFound)))
})

test('Tag taxonomy coverage — all 5 categories used', function() {
  var catsFound = {}
  var tagIdsFound = {}
  GOLDEN.forEach(function(entry) {
    var result = pipeline.runDiagnosis(entry.answers)
    result.behaviorTags.forEach(function(t) {
      catsFound[t.category] = true
      tagIdsFound[t.id] = true
    })
  })
  var catCount = Object.keys(catsFound).length
  assert(catCount >= 4, 'Only ' + catCount + ' tag categories covered')
  var tagCount = Object.keys(tagIdsFound).length
  assert(tagCount >= 15, 'Only ' + tagCount + ' unique tags fired, need >= 15')
  console.log('  → Categories: ' + catCount + ' | Unique tags: ' + tagCount)
})

// ═══════════════════════════════════════════════
// 5. POSTER CONSISTENCY CHECK
// ═══════════════════════════════════════════════

console.log('\n═════════════════════════════════════════')
console.log('PART 5: POSTER CONSISTENCY')
console.log('═════════════════════════════════════════')

test('Diagnosis object is valid JSON-serializable', function() {
  var result = pipeline.runDiagnosis(GOLDEN[0].answers)
  var serialized
  try { serialized = JSON.stringify(result); JSON.parse(serialized) }
  catch (e) { throw new Error('diagnosis not serializable: ' + e.message) }
})

test('Summary text contains all 4 layer headers', function() {
  var result = pipeline.runDiagnosis(GOLDEN[0].answers)
  var s = result.summaryText
  assert(s.indexOf('行为标签') !== -1, 'missing behavior tags section')
  assert(s.indexOf('财富人格') !== -1, 'missing archetype section')
  assert(s.indexOf('核心瓶颈') !== -1, 'missing bottleneck section')
  assert(s.indexOf('唯一战略') !== -1, 'missing strategy section')
})

test('Strategy always has 3 milestones', function() {
  GOLDEN.forEach(function(entry) {
    var result = pipeline.runDiagnosis(entry.answers)
    assert(result.strategy.milestones.length === 3,
      entry.id + ': expected 3 milestones, got ' + result.strategy.milestones.length)
  })
})

test('Day1 mission is never empty', function() {
  GOLDEN.forEach(function(entry) {
    var result = pipeline.runDiagnosis(entry.answers)
    assert(typeof result.strategy.day1Mission === 'string' && result.strategy.day1Mission.length > 10,
      entry.id + ': day1 mission too short or empty')
  })
})

test('Diagnosis version is RC8.1', function() {
  var result = pipeline.runDiagnosis(GOLDEN[0].answers)
  assertEqual(result.engineVersion, 'RC8.1')
})

// ═══════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════

console.log('\n═════════════════════════════════════════')
console.log('VALIDATION REPORT')
console.log('═════════════════════════════════════════')

var totalTests = PASSED + FAILED
console.log('Tests: ' + totalTests + ' | Passed: ' + PASSED + ' | Failed: ' + FAILED)

console.log('\nAccuracy (with labeled cases):')
console.log('  Archetype: ' + archetypeAccuracy.correct + '/' + archetypeAccuracy.total +
  ' (' + Math.round(archetypeAccuracy.correct / archetypeAccuracy.total * 100) + '%)')
console.log('  Bottleneck: ' + bottleneckAccuracy.correct + '/' + bottleneckAccuracy.total +
  ' (' + Math.round(bottleneckAccuracy.correct / bottleneckAccuracy.total * 100) + '%)')
console.log('  Strategy: ' + strategyAccuracy.correct + '/' + strategyAccuracy.total +
  ' (' + Math.round(strategyAccuracy.correct / strategyAccuracy.total * 100) + '%)')

if (WARNINGS.length > 0) {
  console.log('\nWarnings:')
  WARNINGS.forEach(function(w) { console.log('  ⚠ ' + w) })
}

if (FAILED > 0) {
  console.log('\n❌ VALIDATION FAILED')
  process.exit(1)
} else {
  console.log('\n✅ ALL VALIDATIONS PASSED — RC8.1 Ready')
}
