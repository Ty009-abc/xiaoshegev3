'use strict'
/**
 * tests/turnaround6q/goldenExamples.js — RC8.8 GOLDEN EXAMPLE 6Q reports.
 *
 * Hand-authored example reports (not model output). They exist so the OWNER can
 * review card content (§16) and so the validators can be proven to ACCEPT good,
 * fact-grounded copy. Each example must pass both validators.
 *
 * R4 — EVIDENCE BOUNDARY + ACTION FOCUS: each report keeps the sharp Card01 /
 * Card02 voice but expresses Card05 as exactly ONE experiment (goal / actions /
 * target / output / success_signal / time_horizon). Industry/mechanism claims are
 * kept only when grounded in the user's own words; otherwise phrased as
 * interpretation, never as bare fact.
 *
 * Shape matches the 6Q AI output schema exactly.
 */

const GOLDEN_EXAMPLES = {
  F01: {
    system_trap: '你被困在一个"当天结算"的循环里：收入完全取决于今天跑了几单，停一天就归零。',
    system_loop: ['跑单量决定当天收入', '停下一天，收入归零', '越焦虑越离不开这条线', '体力在下降，单价没变', '又回到更拼命地跑'],
    core_problem: '34岁、月收入6000元的你在做外卖骑手，学历是高中。你以为卡住你的是"没学历没关系"，但你现在最焦虑的其实不是学历，而是收入结构：一单一天结，停下就断。学历不是你的天花板，"当天结算"才是——它让每一份力气都在当天清零，攒不下任何可积累的东西。',
    fatal_sentence: '你不是被学历困住，是被"干一天才有一天钱"的收入结构困住了——再拼十年，你手里也不会多出任何能自己产生价值的东西。',
    strategy_path: '用跑单之外的时间，攒一件离开时间也能产生价值的东西，先从外卖这条线上找。',
    path_from: '用体力当天换钱',
    path_to: '攒出可重复使用的东西',
    advice: [],
    experiment: {
      goal: '验证跑单经验能不能换到钱以外的东西',
      actions: ['整理3条最熟的送餐路线', '向2家常点的店提出一次合作'],
      target: '你常点的那3家店',
      output: '一份能发给10个人的小服务清单',
      success_signal: '收到至少1条愿意合作的回复',
      time_horizon: '7天',
    },
  },
  F02: {
    system_trap: '你被困在"帮别人做增长"的位置上：方法你都会，但增长的红利从没落到你自己名下。',
    system_loop: ['你帮公司做出爆款', '账号和粉丝归公司', '你换来的只是经验', '经验会随规则过期', '你的位置却没变'],
    core_problem: '33岁、月收入12000元的你在做短视频运营，本科学历。你以为自己是"没做出账号"，但你现在最焦虑的是收入卡在执行层——你五年攒下的是"帮别人做爆款"的经验，不是属于你自己的作品或账号。经验会随平台规则过期，账号和数据不会。',
    fatal_sentence: '你不缺经验，缺的是一个写着你自己名字的东西——你帮别人做的每一个爆款，流量最终都流向了别人的账户。',
    strategy_path: '把给公司做的那套方法，用在你自己的一个小账号上，哪怕是同一个赛道。',
    path_from: '帮别人做增长',
    path_to: '把方法用在自己名下',
    advice: [],
    experiment: {
      goal: '验证你的方法离开公司也能起量',
      actions: ['建一个只做单一选题的小号', '7天发3条并记录数据'],
      target: '你选定选题的那类观众',
      output: '3条内容的数据记录',
      success_signal: '出现1条自然播放明显高于均值的视频',
      time_horizon: '7天',
    },
  },
  F03: {
    system_trap: '你被困在"靠回头客吃饭"的循环里：客人越稳定，能变的余地就越小，越不动，新客就越进不来。',
    system_loop: ['一家店只靠老客户撑着', '老客户只会慢慢变少', '越依赖就越怕它断', '菜单和价格迟迟动不了', '可周转的余地越来越小'],
    core_problem: '46岁、月收入15000元的你开着一家小餐馆，学历是大专。你以为问题是"不会做线上"，但你现在最焦虑的是房租和人工的固定支出，而你的客源高度依赖回头客——一家靠老客撑着的店，客人越老，能带新客的入口就越窄。你缺的不是一次营销活动，而是一条能持续带来新客的通道。',
    fatal_sentence: '你的店不是被竞争对手打败的，是被"老客户会一直在"这个假设打败的——你在用一张越来越小的牌桌，赌一个不会缩小的客人池。',
    strategy_path: '先别扩大投入，把"老客户带新客"设计成一条可重复的通道，再谈别的。',
    path_from: '靠老客维持现金流',
    path_to: '设计出老带新的通道',
    advice: [],
    experiment: {
      goal: '验证老客户是否愿意帮你带来新客',
      actions: ['整理30位老客的到店记录', '在店内测一次老带新机制'],
      target: '你店里的老客户',
      output: '一份老带新机制的观察记录',
      success_signal: '7天内出现至少1位由老客带来的新客',
      time_horizon: '7天',
    },
  },
  F04: {
    system_trap: '你被困在"试一点就换"的循环里：每次都从头开始，所以每次都不够好。',
    system_loop: ['你试了一个方向', '还没出结果就怀疑不合适', '换到下一个方向', '又从头开始', '别人已经走远，你还在起点'],
    core_problem: '24岁、月收入5500元的你在做行政，本科学历。你自己说"什么都试过一点，但没有一个能沉下来"——不过你一边把现在这份说成"刚换的第二份工作"，一边又说"换了几份"，这两个说法本身就矛盾。先不纠结换了几次：方向从来不是想出来的，你缺的也许不是选择，而是一次把某件事做到"有人愿意为它付钱"的记录。',
    fatal_sentence: '你缺的不是下一个方向，而是把一件事做到能拿出手的那一次——没有结果，方向永远只能靠猜。',
    strategy_path: '别急着换工作，先在现在的位置上挑一件最小的事，做到能拿出结果。',
    path_from: '一直在换还没出结果',
    path_to: '先把一件事做出结果',
    advice: [],
    experiment: {
      goal: '验证你能不能把一件小事做出结果',
      actions: ['从行政工作里挑一件能出成果的小事', '做出一版并交给上级看一次'],
      target: '你的直属上级',
      output: '一件看得见的小成果',
      success_signal: '拿到上级一次明确反馈',
      time_horizon: '7天',
    },
  },
  F05: {
    system_trap: '你被困在"越专业越忙"的循环里：你越可靠，系统就越把活压给你，而从不多给回报。',
    system_loop: ['你把活干得无可替代', '系统把更多活压给你', '你用更多时间维持同样的收入', '专业没变成资产', '回报停在原地'],
    core_problem: '38岁、月收入18000元的你是护士长，硕士学历。你以为只要把活干到最好就够了，但你现在最焦虑的是收入十年没涨——你把自己的价值锁在了"把事做好"里，却没让它被更多人看见或使用。专业能力强的人很多，能把自己的专业变成可传播价值的人很少。',
    fatal_sentence: '你把十年都用来证明自己"干得好"，却很少用来证明自己"值得更多"——只有让价值离开你的工位，别人才可能为它付钱。',
    strategy_path: '把你在科室里已经验证有效的方法，整理成别人能用的东西，先从同行开始。',
    path_from: '把价值锁在岗位里',
    path_to: '把专业变成可传递的东西',
    advice: [],
    experiment: {
      goal: '验证你的专业方法是否有人愿意买单',
      actions: ['写一份一页的方法清单', '在2个同行渠道发布'],
      target: '同行渠道里的护士长',
      output: '一份可对外的方法清单',
      success_signal: '收到至少1个付费或约讲的询问',
      time_horizon: '7天',
    },
  },
  F06: {
    system_trap: '你被困在"什么都做一点"的循环里：每条路都只走了一小段，所以每条都看不到尽头。',
    system_loop: ['你同时打开好几条路', '精力被分成很多小块', '每条路都推进得很慢', '看不出哪条有用', '又去开一条新路'],
    core_problem: '30岁、月收入9000元的你现在做销售，同时也接些零碎兼职，学历是大专。你觉得说不清问题在哪，但你现在最焦虑的恰恰是这种"说不清"——你自己认为可能是运气，也可能是没坚持。两边都占，通常意味着你还没有一件能长期押注的主线，精力被切成了许多小块。',
    fatal_sentence: '你说不清自己卡在哪，往往是因为你把精力同时押在了太多不确定的方向上——不聚焦的人生，连失败都失败得没有重点。',
    strategy_path: '从你所有尝试里挑出唯一一件愿意见到结果的事，其他先全部放下。',
    path_from: '把精力分得太散',
    path_to: '只押注一条主线',
    advice: [],
    experiment: {
      goal: '验证只做一件事时会发生什么',
      actions: ['暂时停掉2件非核心的事', '7天只推进剩下的那件'],
      target: '你现在做的销售主线',
      output: '一条主线一周的推进记录',
      success_signal: '7天内这件事出现一个明确进展',
      time_horizon: '7天',
    },
  },
  OWNER_STYLE: {
    system_trap: '你被困在"只有后厨买你的手艺"的循环里：能力没变，可买家只有一个，价格就由他定。',
    system_loop: ['手艺只能卖给一个买家', '价格由那一个买家定', '干得再好也涨到头', '想换又不知从哪开始', '只能继续留在原地'],
    core_problem: '31岁、月收入8000元的你是厨师，高中学历。你以为自己只会厨房里的活，但你现在最焦虑的是工资到了顶、看不到往上走的路。厨师的手艺本身就是一种能卖钱的能力，问题在于你可能只把它卖给了后厨——同一个能力换个买家，价格可能完全不同。',
    fatal_sentence: '你以为自己离不开厨房，其实是你只会把厨艺卖给一个买家——不是能力不够，是买家只有一个。',
    strategy_path: '先别急着改行，试着把你的厨艺卖给厨房以外的第一种买家。',
    path_from: '把厨艺只卖给一个买家',
    path_to: '找到第二个买家',
    advice: [],
    experiment: {
      goal: '验证你的厨艺在厨房外是否有人买单',
      actions: ['写出3道最拿手的菜', '向1个小活动或家庭提出一次上门做饭'],
      target: '一个小活动或一个家庭',
      output: '一次上门做饭的体验',
      success_signal: '7天内收到1次真实的付费或预约',
      time_horizon: '7天',
    },
  },
}

module.exports = { GOLDEN_EXAMPLES }
