// pages/challenge/challenge.js
// v3.7.4 重构：点击"生成报告"直接跳转，不在原页等待云函数
const app = getApp();

Page({
  data: {
    currentDay: 1,
    totalDays: 30,
    currentCV: 100,
    userLevel: "Lv.1 困局打工人",

    // 9.0 评分系统初始化数值
    laborMindset: 50,
    probabilityMindset: 50,
    systemThinking: 50,
    leverageMindset: 50,
    capitalMindset: 50,
    riskCognition: 50,
    infoSensitivity: 50,
    longTermism: 50,
    decisionStability: 50,

    // 30 天硬核博弈情境事件池
    eventsPool: [
      {
        day: 1,
        title: "⚡ 努力陷阱的红蓝药片",
        description: "下班后，主管暗示只要你留下来继续加班，每小时可以多拿 50 元加班费。而此时，你手里刚好有一套通过 AI 批量生成内容杠杆的自媒体副业架构刚搭了一半。你如何抉择？",
        options: [
          { text: "A. 留下来加班。看得见的50块才是确定的，积累本金最重要。", effects: { laborMindset: 15, leverageMindset: -10, longTermism: -5 } },
          { text: "B. 准时下班回家。死磕内容杠杆，用时间换取未来放大100倍的系统价值。", effects: { laborMindset: -10, leverageMindset: 20, longTermism: 15 } }
        ]
      },
      {
        day: 2,
        title: "🎰 赌场世界观与正 EV 牌桌",
        description: "你手头攒下了 1 万元。一个号称稳赚的投机群组向你推荐了一个高波动、高返还率的项目，但规则由庄家完全掌控；同时，另一个项目虽然见效慢，但你拥有信息敏感度与长期胜率（正 EV）。你怎么选？",
        options: [
          { text: "A. 搏一把高波动。只要我跑得快，庄家的概率就割不到我！", effects: { probabilityMindset: -15, riskCognition: -10, decisionStability: -10 } },
          { text: "B. 拒绝下注。看不见庄家时自己就是筹码，宁可去构建胜率可控的正 EV 系统。", effects: { probabilityMindset: 20, riskCognition: 15, systemThinking: 15 } }
        ]
      },
      {
        day: 3,
        title: "👑 工业时代的逻辑终结",
        description: "行业遭遇 AI 降维打击，原有的高学历、存钱买房、安稳升职的旧世界操作系统开始剧烈动荡。面对新的AI + 杠杆 + 系统新世界，你的核心行动是什么？",
        options: [
          { text: "A. 更加努力地内卷，考取更多传统证书，试图用执行力填补结构性行业鸿沟。", effects: { laborMindset: 20, systemThinking: -15, infoSensitivity: -10 } },
          { text: "B. 砍掉低价值重复劳动。全面接入 AI 放大 10 倍生产力，把精力转向资本与人脉复利。", effects: { leverageMindset: 20, systemThinking: 15, infoSensitivity: 20 } }
        ]
      },
      {
        day: 4, title: "💰 你中了 10 万彩票",
        description: "一笔横财突然落到你手里。你是立刻消费掉享受生活，还是冷静规划让这笔钱成为你人生的第一块财富跳板？",
        options: [
          { text: "A. 买新手机换新车请朋友大吃一顿，人生苦短及时行乐。", effects: { capitalMindset: -15, longTermism: -10, riskCognition: -5 } },
          { text: "B. 5万备用金+3万投资自己学技能+2万奖励自己，让钱生钱。", effects: { capitalMindset: 20, longTermism: 15, riskCognition: 10 } }
        ]
      },
      {
        day: 5, title: "🤖 AI 吃掉你的工作",
        description: "公司引进了新的 AI 系统，你发现你一半的日常工作可以在几秒内被它完成。同事都在抱怨，老板说不用担心。你怎么办？",
        options: [
          { text: "A. 和大家一起抱怨，继续原来的工作节奏等待公司安排。", effects: { leverageMindset: -15, systemThinking: -10, decisionStability: -5 } },
          { text: "B. 第一个冲上去学 AI 工具，把每天省下的 4 小时用来做更高价值的事。", effects: { leverageMindset: 20, infoSensitivity: 15, systemThinking: 10 } }
        ]
      },
      {
        day: 6, title: "🧠 知识付费的智商税",
        description: "你在短视频刷到一个博主在卖翻身秘籍课程，原价 9999 今天只要 199。评论区都在刷已买太值了。",
        options: [
          { text: "A. 买！199 也不多，万一有用就赚大了。", effects: { infoSensitivity: -15, probabilityMindset: -10, capitalMindset: -5 } },
          { text: "B. 先搜索他过去一年的免费内容质量，再判断这个人值不值得信。", effects: { infoSensitivity: 20, probabilityMindset: 15, decisionStability: 10 } }
        ]
      },
      {
        day: 7, title: "🕳️ 同事甩锅给你的 Bug",
        description: "周会上，一个同事把导致系统崩溃的代码指向了你——但那其实是他自己写的。所有人都看着你。",
        options: [
          { text: "A. 先忍下来，会后私下找他谈，不想在大家面前搞得难看。", effects: { decisionStability: -10, systemThinking: -5, laborMindset: 5 } },
          { text: "B. 用 Git 提交记录和需求文档冷静还原事实，不指责但也不背锅。", effects: { systemThinking: 15, decisionStability: 15, leverageMindset: 5 } }
        ]
      },
      {
        day: 8, title: "📉 你的工资贬值了",
        description: "今年涨薪 10%，但查了一下物价——房租涨了 15%，菜价涨了 12%。你的实际购买力下降了多少？",
        options: [
          { text: "A. 起码涨了就是好事，比没涨强，继续这样过下去。", effects: { capitalMindset: -10, systemThinking: -5, infoSensitivity: -5 } },
          { text: "B. 清醒意识到单一工资是被通胀慢性收割，开始搭建多元收入管道。", effects: { capitalMindset: 20, systemThinking: 15, longTermism: 10 } }
        ]
      },
      {
        day: 9, title: "🌐 信息差的套利机会",
        description: "你偶然发现了一个行业的巨大信息差——一个服务的成本只有市场价的 1/10，但大多数人不知道。你会怎么做？",
        options: [
          { text: "A. 告诉身边的朋友，大家一起省钱，做好事嘛。", effects: { capitalMindset: -10, leverageMindset: -5, infoSensitivity: 5 } },
          { text: "B. 系统性利用它：写文章→建服务→做平台，把认知变成可持续收入。", effects: { capitalMindset: 20, leverageMindset: 20, infoSensitivity: 15 } }
        ]
      },
      {
        day: 10, title: "🎭 朋友借钱不还第三次",
        description: "一个老朋友第三次开口向你借 5000 块，理由是最后一次周转。前两次都没还。你们认识十年了。",
        options: [
          { text: "A. 再借一次，毕竟是老友，拒绝了面子上过不去。", effects: { decisionStability: -15, systemThinking: -10, riskCognition: -5 } },
          { text: "B. 拒绝借钱，但真诚地和他说：我们能不能坐下来看看你为什么一直陷入这个循环？", effects: { decisionStability: 15, systemThinking: 15, leverageMindset: 10 } }
        ]
      },
      {
        day: 11, title: "🏦 父母让你考公务员",
        description: "你 27 岁了，父母每天都在给你打电话催你考公。\外面太不稳定了，安稳才是一辈子的保障。",
        options: [
          { text: "A. 听父母的，他们经历过的大风大浪比我多，考公是最安全的选择。", effects: { laborMindset: 10, leverageMindset: -15, longTermism: -5 } },
          { text: "B. 理解他们的好意，但我选择搭建自己的不可替代性——不等别人给铁饭碗，自己锻造。", effects: { leverageMindset: 20, systemThinking: 15, decisionStability: 15 } }
        ]
      },
      {
        day: 12, title: "📱 每天 3 小时短视频",
        description: "你统计了一下——每天在刷短视频、朋友圈上花掉 3 小时。如果这些时间用来学一项新技能，一年是 1095 小时。",
        options: [
          { text: "A. 这点放松时间都不给自己，活着也太累了。", effects: { longTermism: -10, leverageMindset: -10, infoSensitivity: -5 } },
          { text: "B. 强制限到 30 分钟/天，多出的 2.5 小时用来学 AI 提示词工程。", effects: { longTermism: 20, leverageMindset: 15, infoSensitivity: 15 } }
        ]
      },
      {
        day: 13, title: "🔺 金字塔骗局识别",
        description: "一个朋友信誓旦旦地拉你进他的新项目：只需要拉 5 个人，每人再拉 5 个，层数越多每个人分成越多！每月躺赚！",
        options: [
          { text: "A. 加入干！先到先得，晚进的人才是冤大头。", effects: { probabilityMindset: -20, systemThinking: -15, infoSensitivity: -10 } },
          { text: "B. 拒绝并算了一笔账：到第 12 层需要超过 2 亿人口才撑得住。这是数学上的死亡螺旋。", effects: { probabilityMindset: 20, systemThinking: 15, capitalMindset: 10 } }
        ]
      },
      {
        day: 14, title: "💪 努力崇拜的陷阱",
        description: "你的朋友圈被一句话刷屏：只要你足够努力，就没有实现不了的梦想。你认同吗？",
        options: [
          { text: "A. 没错！努力就是回报的绝对值，不够成功是因为不够努力。", effects: { laborMindset: 15, systemThinking: -10, probabilityMindset: -5 } },
          { text: "B. 努力只是必要不充分条件。正确的公式是：稀缺性×杠杆×系统价值=回报。", effects: { systemThinking: 20, probabilityMindset: 10, leverageMindset: 10 } }
        ]
      },
      {
        day: 15, title: "🃏 庄家从不赌钱",
        description: "你第一次听说了澳门赌场的真相——庄家不赌，庄家只设计游戏规则并收取 2.5% 的数学税。你的感受是什么？",
        options: [
          { text: "A. 哇那赌客也太可怜了，以后不进了——然后继续过自己的普通人生活。", effects: { systemThinking: -5, capitalMindset: -5 } },
          { text: "B. 猛然顿悟：那我的人生选择里，哪些相当于坐在赌桌上，哪些相当于开着赌场？", effects: { systemThinking: 20, capitalMindset: 20, probabilityMindset: 15 } }
        ]
      },
      {
        day: 16, title: "🔄 35 岁被裁恐慌",
        description: "你 33 岁了，公司里一个 35 岁的老员工刚被优化。你看着他的工位空了，老板说拥抱变化。接下来怎么办？",
        options: [
          { text: "A. 更加拼命地加班，祈祷裁员的刀不要落在自己头上。", effects: { laborMindset: 10, leverageMindset: -15, decisionStability: -10 } },
          { text: "B. 立刻开始：用你的行业经验叠加 AI 工具，把个人能力变成标准化产品。", effects: { leverageMindset: 20, capitalMindset: 15, decisionStability: 15 } }
        ]
      },
      {
        day: 17, title: "🗣️ 说真话被批评了",
        description: "你在会议上指出了领导方案的一个明显漏洞，被当场驳斥，气氛尴尬。下次你还会说真话吗？",
        options: [
          { text: "A. 算了，以后闭紧嘴，保住饭碗最重要。", effects: { decisionStability: -10, longTermism: -5, systemThinking: -5 } },
          { text: "B. 学会三明治沟通法——赞赏+事实+建议。说真话的方式比内容本身更重要。", effects: { decisionStability: 15, systemThinking: 15, leverageMindset: 10 } }
        ]
      },
      {
        day: 18, title: "📊 概率思维的启蒙",
        description: "一个朋友说：我就没那个命，干啥啥赔。你想起了一句话：世界上没有好运气坏运气——只有正 EV 和负 EV。你会怎么回应？",
        options: [
          { text: "A. 拍拍他肩膀：是的，有时候运气就是这么不公平。", effects: { probabilityMindset: -10, systemThinking: -5 } },
          { text: "B. 你说的命，其实是你每次决策的期望值决定的。每天往正 EV 方向走 1%，365 天后你的人生概率曲线就完全不同了。", effects: { probabilityMindset: 20, systemThinking: 15, longTermism: 10 } }
        ]
      },
      {
        day: 19, title: "💍 存款锁定三十年",
        description: "你终于攒够了买房的首付。但算了一笔账——背负 30 年的房贷，等于把你的未来 30 年所有重大人生选择都锁在了月供上。",
        options: [
          { text: "A. 买。有房才有家，安全感大于一切。", effects: { capitalMindset: -10, leverageMindset: -10, longTermism: 5 } },
          { text: "B. 算了这笔账：首付投入技能+年化收益率，对比房贷利率。如果租+投更合理，那就放弃买房=成功的叙事。", effects: { capitalMindset: 20, systemThinking: 15, leverageMindset: 10 } }
        ]
      },
      {
        day: 20, title: "🌪️ 后悔的算法",
        description: "你想起两年前放弃的那个项目——现在那个团队估值已经过亿了。你的第一反应是什么？",
        options: [
          { text: "A. 后悔得想撞墙。我当初为什么那么蠢？这辈子没机会了。", effects: { decisionStability: -15, longTermism: -10, riskCognition: -5 } },
          { text: "B. 冷静复盘那次决策的系统缺陷：我当时缺了什么信息？在哪个判断节点出了问题？", effects: { decisionStability: 15, systemThinking: 15, longTermism: 10 } }
        ]
      },
      {
        day: 21, title: "🔄 系统认知升级",
        description: "如果让你给自己的认知操作系统进行一次大版本更新——你会卸载什么旧信念，安装什么新信念？",
        options: [
          { text: "A. 没什么特别需要更新的，靠经验慢慢积累就好。", effects: { systemThinking: -10, leverageMindset: -5 } },
          { text: "B. 卸载努力=成功.exe，安装稀缺性×杠杆×系统价值=回报.exe。卸载打工思维.exe，安装庄家思维.exe。", effects: { systemThinking: 20, leverageMindset: 15, capitalMindset: 15 } }
        ]
      },
      {
        day: 22, title: "⚡ 黑天鹅事件",
        description: "你所在的城市突然推出AI 技能人才免费培训+5 万政府补贴政策。但需要你签字承诺一年内不离职。",
        options: [
          { text: "A. 太麻烦了，而且一年不离职太久了，万一有更好的机会呢？", effects: { leverageMindset: -10, longTermism: -10, infoSensitivity: -5 } },
          { text: "B. 利用这次免费升级自己的机会，一年后用新技能+行业经验形成跨界稀缺壁垒。", effects: { leverageMindset: 20, longTermism: 15, infoSensitivity: 15 } }
        ]
      },
      {
        day: 23, title: "🪞 你在为谁的情绪买单",
        description: "你花大价钱买了一件奢侈大牌T恤——但你发现你买它的核心原因，不是质量好不好，而是怕被别人看不起。",
        options: [
          { text: "A. 哪有人不在乎外表的？活在这个社会就得认，这就是人际成本。", effects: { decisionStability: -10, laborMindset: 5 } },
          { text: "B. 脱下这件T恤，问自己：如果全世界没人知道我今天穿了什么，我还是我吗？", effects: { decisionStability: 15, systemThinking: 15 } }
        ]
      },
      {
        day: 24, title: "💼 副业的突破口",
        description: "你的朋友通过做 AI 内容号月入八万。他告诉你秘诀是用 AI 把他枯燥的行业知识转化成短视频脚本。你觉得？",
        options: [
          { text: "A. 他运气好找到了蓝海赛道，现在做太晚了，红利早过了。", effects: { leverageMindset: -10, probabilityMindset: -5 } },
          { text: "B. 任何行业知识叠加上AI再输出，至少有 2-3 年的信息差窗口。立刻把我会的东西转化成可分发资产。", effects: { leverageMindset: 20, capitalMindset: 15, probabilityMindset: 10 } }
        ]
      },
      {
        day: 25, title: "🧭 你的人生操作系统",
        description: "回顾过去 24 天的所有选择。你发现自己在哪些维度上反复选对了？在哪些维度上像一个没有升级系统的旧人类？",
        options: [
          { text: "A. 不想回头看，往前看就完了。", effects: { decisionStability: -5, systemThinking: -5, longTermism: -5 } },
          { text: "B. 写下一张纸：左边是我选对最多的维度（我的武器），右边是我反复跌倒的维度（我的战役）。", effects: { systemThinking: 15, decisionStability: 15, longTermism: 15 } }
        ]
      },
      {
        day: 26, title: "🏰 你的不可替代性",
        description: "如果明天你的工作消失了，你能在 72 小时内变出一个新的收入来源吗？",
        options: [
          { text: "A. 不能，但我会想办法找下一份差不多的工作。", effects: { leverageMindset: -15, capitalMindset: -10 } },
          { text: "B. 能。因为我已经用我的技能搭建了 3 条独立的微收入管道，互不依赖。", effects: { leverageMindset: 20, capitalMindset: 20, systemThinking: 10 } }
        ]
      },
      {
        day: 27, title: "👁️ 信息茧房打破了",
        description: "你同时关注了一个年收入是你的 100 倍的人和一个年收入是你的 1/10 的人。你发现他们的朋友圈、关注的话题、每天讨论的事——完全不同。",
        options: [
          { text: "A. 有钱人的烦恼我也不理解，各活各的吧。", effects: { infoSensitivity: -10, systemThinking: -5 } },
          { text: "B. 阶层不同 = 操作系统的版本不同。我决定每天花 30 分钟读高阶人的信息流，升级我的信息食谱。", effects: { infoSensitivity: 20, systemThinking: 15, longTermism: 10 } }
        ]
      },
      {
        day: 28, title: "🎯 成为庄家",
        description: "给你一天当庄家——你可以设计一个小型社会游戏规则，在让参与者感到公平的同时，你获得 2% 的系统收益。你设计什么？",
        options: [
          { text: "A. 不知道，我这辈子没当过庄家，想不出来。", effects: { systemThinking: -10, capitalMindset: -5 } },
          { text: "B. 把我最擅长的专业领域做成一个轻量级付费评测服务——我投入时间建立测算模型，用户付费获取决策建议。", effects: { systemThinking: 20, capitalMindset: 20, leverageMindset: 15 } }
        ]
      },
      {
        day: 29, title: "⏰ 最后复盘",
        description: "29 天的博弈走完了。你终于有资格和自己的内心对话：你最大的改变是什么？",
        options: [
          { text: "A. 没什么本质变化，就是做完了题目而已。", effects: { longTermism: -10, decisionStability: -5 } },
          { text: "B. 我开始用庄家的视角看每一个生活决策——这件事的正 EV 是多少？我在这件事上是在做赌客还是庄家？", effects: { systemThinking: 15, capitalMindset: 15, decisionStability: 15 } }
        ]
      },
      {
        day: 30,
        title: "🔥 终极觉醒",
        description: "30 天。30 个选择题。你在每一题中都在定义你是谁。现在，请回答最本质的问题：你最大的对手，究竟是谁？",
        options: [
          { text: "A. 阶级固化、不公平的出身、那些含着金钥匙的人。", effects: { systemThinking: -5, decisionStability: -5, longTermism: -5 } },
          { text: "B. 昨天那个操作系统还没升级的我自己。只有我赢了我自己，才有资格赢这个世界的规则。", effects: { systemThinking: 20, probabilityMindset: 20, longTermism: 20, decisionStability: 20, leverageMindset: 15 } }
        ]
      }
    ],

    showEvent: true,
    animating: false,
    completed: false,
    selectedOption: -1
  },

  onLoad: function () {
    this.nextEvent();
  },

  nextEvent: function () {
    const { currentDay, totalDays, eventsPool } = this.data;
    if (currentDay > totalDays) {
      this.finishChallenge();
      return;
    }
    const event = eventsPool.find(e => e.day === currentDay);
    if (!event) {
      this.finishChallenge();
      return;
    }
    this.setData({
      showEvent: true,
      animating: false,
      selectedOption: -1
    });
  },

  selectOption: function (e) {
    if (this.data.animating) return;
    const index = e.currentTarget.dataset.index;
    this.setData({ selectedOption: index });
  },

  confirmChoice: function () {
    const { selectedOption, currentDay, eventsPool, currentCV } = this.data;
    if (selectedOption < 0 || this.data.animating) return;

    const event = eventsPool.find(ev => ev.day === currentDay);
    if (!event) return;

    const effects = event.options[selectedOption].effects;

    // 动画启动
    this.setData({ animating: true });

    const newCV = currentCV + 20;

    // 延迟更新数值 + 推进天数
    setTimeout(() => {
      let update = { currentDay: currentDay + 1, currentCV: newCV, showEvent: false };
      Object.keys(effects).forEach(key => {
        if (this.data[key] !== undefined) {
          update[key] = Math.max(0, Math.min(100, this.data[key] + effects[key]));
        }
      });
      // 等级联动
      if (newCV >= 500) update.userLevel = "Lv.5 认知觉醒者";
      else if (newCV >= 300) update.userLevel = "Lv.3 系统观察者";
      else if (newCV >= 200) update.userLevel = "Lv.2 规则学习者";

      this.setData(update, () => {
        setTimeout(() => this.nextEvent(), 300);
      });
    }, 400);
  },

  finishChallenge: function () {
    const scores = {
      laborMindset: this.data.laborMindset,
      probabilityMindset: this.data.probabilityMindset,
      systemThinking: this.data.systemThinking,
      leverageMindset: this.data.leverageMindset,
      capitalMindset: this.data.capitalMindset,
      riskCognition: this.data.riskCognition,
      infoSensitivity: this.data.infoSensitivity,
      longTermism: this.data.longTermism,
      decisionStability: this.data.decisionStability
    };

    if (!app.globalData) app.globalData = {};
    app.globalData._challengeScores = scores;

    this.setData({ completed: true, showEvent: false, currentCV: this.data.currentCV + 50, userLevel: "认知觉醒者" });
  },

  // ═══ v3.7.4 重构：零拦截，秒跳 ═══
  // 不再在此页发起云函数调用。点击按钮直接 navigateTo，
  // 九维数据通过 app.globalData._challengeScores 完整传入目标页。
  goToReport: function () {
    wx.navigateTo({ url: '/pages/ai-analysis/ai-analysis?source=challenge' });
  },

  goHome: function () {
    wx.switchTab({ url: '/pages/home/home' });
  },

  restart: function () {
    this.setData({
      currentDay: 1, currentCV: 100,
      userLevel: "Lv.1 困局打工人",
      laborMindset: 50, probabilityMindset: 50, systemThinking: 50,
      leverageMindset: 50, capitalMindset: 50, riskCognition: 50,
      infoSensitivity: 50, longTermism: 50, decisionStability: 50,
      completed: false, showEvent: true, selectedOption: -1
    });
    this.nextEvent();
  }
});
