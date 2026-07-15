/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * 认知挑战题库种子数据 · 30道题 (Phase 1-5)
 */

const now = () => Date.now()

const ts = now()

const DEFAULT_CHALLENGE_EVENTS = [
  {
    "eventId": "CE001",
    "day": 1,
    "title": "你发现一个AI副业机会",
    "description": "朋友告诉你，现在有人用AI批量生成短视频脚本，并通过本地生活账号变现。你只有晚上2小时空闲时间。",
    "choices": [
      {
        "key": "A",
        "text": "马上学习，先做7天测试",
        "effects": {
          "probabilityMindset": 5,
          "leverageThinking": 6,
          "riskAwareness": 2,
          "cv": 5
        },
        "tags": [
          "行动派",
          "低成本试错"
        ]
      },
      {
        "key": "B",
        "text": "先观望，等别人做出结果再说",
        "effects": {
          "decisionStability": 2,
          "informationSensitivity": -3,
          "cv": 1
        },
        "tags": [
          "观望型",
          "机会延迟"
        ]
      },
      {
        "key": "C",
        "text": "觉得都是割韭菜，不碰",
        "effects": {
          "laborMindset": 5,
          "leverageThinking": -5,
          "informationSensitivity": -5,
          "cv": -2
        },
        "tags": [
          "防御型认知",
          "机会屏蔽"
        ]
      }
    ],
    "blackSwanRate": 0.03,
    "difficulty": 1,
    "status": "active",
    "createdAt": 1784073486572,
    "updatedAt": 1784073486572
  },
  {
    "eventId": "CE011",
    "day": 2,
    "title": "稳定的死工资 vs 不稳定的复利",
    "description": "你在一家国企做了5年，月薪8000，年终2万。朋友邀请你加入他的创业项目，底薪只有5000但给5%股份。项目处于早期阶段，过去6个月营收为零。",
    "choices": [
      {
        "key": "A",
        "text": "兼职方式加入：保留国企工作，利用晚上和周末帮朋友项目",
        "effects": {
          "systemThinking": 6,
          "decisionStability": 4,
          "laborMindset": -2,
          "cv": 5
        },
        "tags": [
          "对冲策略",
          "双轨并进"
        ],
        "tradeoff": "同时保留两条轨道，但精力被分散，两边都可能不够深入"
      },
      {
        "key": "B",
        "text": "留在国企，至少稳定有保障",
        "effects": {
          "laborMindset": 8,
          "leverageThinking": -4,
          "riskAwareness": 3,
          "cv": -3
        },
        "tags": [
          "确定性偏好",
          "安全优先"
        ],
        "tradeoff": "获得极端稳定，但放弃了杠杆机会，五年内收入天花板清晰可见"
      },
      {
        "key": "C",
        "text": "加入创业项目，用5%股份搏未来",
        "effects": {
          "leverageThinking": 8,
          "riskAwareness": -2,
          "probabilityMindset": 4,
          "cv": 3
        },
        "tags": [
          "高杠杆",
          "机会主义"
        ],
        "tradeoff": "获得股权杠杆，但短期现金流减半，项目失败则一年后从头开始"
      }
    ],
    "blackSwanRate": 0.05,
    "difficulty": 2,
    "status": "active",
    "createdAt": 1752570000000,
    "updatedAt": 1752570000000
  },
  {
    "eventId": "CE002",
    "day": 3,
    "title": "老板画饼：加班换股权",
    "description": "老板说公司快要融资了，周末加班冲一冲。但你已经三个月没见过加班费了，而且你知道公司财务报表不怎么样。",
    "choices": [
      {
        "key": "A",
        "text": "信老板一次，全力加班冲期权",
        "effects": {
          "probabilityMindset": -3,
          "riskAwareness": -5,
          "cv": -3
        },
        "tags": [
          "赌徒心态",
          "信息盲从"
        ]
      },
      {
        "key": "B",
        "text": "只做分内事，下班学新技能准备跳槽",
        "effects": {
          "systemThinking": 5,
          "longTermism": 4,
          "cv": 3
        },
        "tags": [
          "理性选择",
          "长期主义"
        ]
      },
      {
        "key": "C",
        "text": "跟老板谈判：加班可以，但要即时现金补贴",
        "effects": {
          "leverageThinking": 4,
          "decisionStability": 3,
          "cv": 2
        },
        "tags": [
          "谈判能力",
          "价值交换"
        ]
      }
    ],
    "blackSwanRate": 0.05,
    "difficulty": 1,
    "status": "active",
    "createdAt": 1784073486572,
    "updatedAt": 1784073486572
  },
  {
    "eventId": "CE012",
    "day": 4,
    "title": "沉没成本：你那门学了90%但用不到的课程",
    "description": "你花了3000元报名一门数据分析课程，已经学了80%的内容。但你越来越发现这个方向你并不喜欢，也没有找到相关的工作机会。市场上另一个方向（AI应用）你更感兴趣，但得从零开始。",
    "choices": [
      {
        "key": "A",
        "text": "坚持学完数据分析，至少拿到证书",
        "effects": {
          "decisionStability": -3,
          "longTermism": 2,
          "cv": -2
        },
        "tags": [
          "沉没成本谬误",
          "路径依赖"
        ],
        "tradeoff": "浪费更多时间在一件已确认不喜欢的事情上，只为不承认之前的投入是错误"
      },
      {
        "key": "B",
        "text": "先学完数据分析，同时B站免费学AI，找到结合点",
        "effects": {
          "systemThinking": 5,
          "leverageThinking": 4,
          "cv": 3
        },
        "tags": [
          "系统思维",
          "技能叠加"
        ],
        "tradeoff": "时间翻倍但可能同时获得两个领域的交集能力——虽然效率打折"
      },
      {
        "key": "C",
        "text": "立刻转去学AI应用，之前的课就当买了教训",
        "effects": {
          "informationSensitivity": 6,
          "longTermism": 5,
          "cv": 4
        },
        "tags": [
          "止损意识",
          "果断转型"
        ],
        "tradeoff": "损失3000元学费，但把剩余时间投入真正有复利的方向"
      }
    ],
    "blackSwanRate": 0.02,
    "difficulty": 1,
    "status": "active",
    "createdAt": 1752570000000,
    "updatedAt": 1752570000000
  },
  {
    "eventId": "CE003",
    "day": 5,
    "title": "朋友拉你做投资：年化18%的理财",
    "description": "同事老张说有个P2P平台年化18%，他投了20万每月按时回款。你手上有3万闲钱，正在犹豫要不要跟。",
    "choices": [
      {
        "key": "A",
        "text": "投3万进去，搏一把",
        "effects": {
          "capitalThinking": -4,
          "riskAwareness": -6,
          "cv": -4
        },
        "tags": [
          "高欲望",
          "赌徒倾向"
        ]
      },
      {
        "key": "B",
        "text": "小试5000，亏了不心疼",
        "effects": {
          "probabilityMindset": 2,
          "riskAwareness": 1,
          "cv": 1
        },
        "tags": [
          "理性试错",
          "仓位管理"
        ]
      },
      {
        "key": "C",
        "text": "拒绝，并把反诈贴转给了老张",
        "effects": {
          "riskAwareness": 8,
          "informationSensitivity": 5,
          "cv": 5
        },
        "tags": [
          "风险识别",
          "利他行为"
        ]
      }
    ],
    "blackSwanRate": 0.1,
    "difficulty": 2,
    "status": "active",
    "createdAt": 1784073486572,
    "updatedAt": 1784073486572
  },
  {
    "eventId": "CE013",
    "day": 6,
    "title": "免费陷阱：有人付费请你做免费内容平台",
    "description": "一个新兴短视频平台邀请你成为首批创作者，承诺大量流量扶持，但不支付任何基础费用。你需要每天投入2小时创作内容，平台说\"做好了未来可以带货变现\"。你目前本职工作就很忙。",
    "choices": [
      {
        "key": "A",
        "text": "试试看，反正免费，万一火了呢",
        "effects": {
          "probabilityMindset": -2,
          "laborMindset": 5,
          "cv": -4
        },
        "tags": [
          "免费陷阱",
          "时间福利"
        ],
        "tradeoff": "可能获得免费曝光，但实际上你用免费劳动力为一个商业平台创造内容资产"
      },
      {
        "key": "B",
        "text": "每周做1条视频测试数据，不承诺每天投入",
        "effects": {
          "systemThinking": 4,
          "probabilityMindset": 5,
          "cv": 4
        },
        "tags": [
          "低成本测试",
          "数据驱动"
        ],
        "tradeoff": "用最小投入验证流量价值，既不放弃机会也不all-in免费劳动"
      },
      {
        "key": "C",
        "text": "直接拒绝，除非对方愿意支付保底费用",
        "effects": {
          "capitalThinking": 5,
          "leverageThinking": 3,
          "cv": 2
        },
        "tags": [
          "价值意识",
          "交易尊严"
        ],
        "tradeoff": "守住时间定价权，但可能错过一个早期流量红利"
      }
    ],
    "blackSwanRate": 0.06,
    "difficulty": 1,
    "status": "active",
    "createdAt": 1752570000000,
    "updatedAt": 1752570000000
  },
  {
    "eventId": "CE014",
    "day": 7,
    "title": "连续失败后，你还敢下注吗",
    "description": "你尝试了三个副业：闲鱼卖货亏了2000、公众号写了两个月没阅读量、抖音带货只卖了一单。现在第四个机会出现了——帮本地商家做AI客服系统，需要你投入5000元和一个月时间学习。",
    "choices": [
      {
        "key": "A",
        "text": "算了，我不是做生意的料，回单位好好上班吧",
        "effects": {
          "riskAwareness": 3,
          "leverageThinking": -5,
          "cv": -3
        },
        "tags": [
          "习得性无助",
          "统计盲区"
        ],
        "tradeoff": "三个样本就否定了所有可能性，把失败概率从统计问题变成了身份问题"
      },
      {
        "key": "B",
        "text": "投5000块进去做，反正前面已经亏了4000，不在乎多亏5000",
        "effects": {
          "riskAwareness": -6,
          "probabilityMindset": -3,
          "cv": -5
        },
        "tags": [
          "赌徒谬误",
          "损失厌恶"
        ],
        "tradeoff": "用\"已经亏了\"为新的冲动决策背书——这是赌博逻辑，不是商业逻辑"
      },
      {
        "key": "C",
        "text": "再试最后一次，这次先花一周调研需求再决定",
        "effects": {
          "probabilityMindset": 6,
          "informationSensitivity": 5,
          "cv": 6
        },
        "tags": [
          "贝叶斯更新",
          "验证先行"
        ],
        "tradeoff": "用信息降低不确定性，不是盲目重复上一次的失败模式"
      }
    ],
    "blackSwanRate": 0.04,
    "difficulty": 2,
    "status": "active",
    "createdAt": 1752570000000,
    "updatedAt": 1752570000000
  },
  {
    "eventId": "CE004",
    "day": 8,
    "title": "培训机构说：零基础学IT，四个月月薪过万",
    "description": "培训机构在商场发传单：\"零基础转行IT，四个月包就业，月薪8000起。\"课程费23800，可以办教育分期贷款。",
    "choices": [
      {
        "key": "A",
        "text": "签贷款合同，四个月后就是IT精英了",
        "effects": {
          "leverageThinking": -5,
          "riskAwareness": -8,
          "cv": -5
        },
        "tags": [
          "暴富幻觉",
          "信息盲从"
        ]
      },
      {
        "key": "B",
        "text": "不贷，用B站免费课程+GitHub自学",
        "effects": {
          "systemThinking": 8,
          "longTermism": 6,
          "cv": 6
        },
        "tags": [
          "自学能力",
          "理性求证"
        ]
      },
      {
        "key": "C",
        "text": "先查口碑+试听一周+对比免费资源再决定",
        "effects": {
          "decisionStability": 6,
          "informationSensitivity": 4,
          "cv": 3
        },
        "tags": [
          "系统思维",
          "信息验证"
        ]
      }
    ],
    "blackSwanRate": 0.03,
    "difficulty": 1,
    "status": "active",
    "createdAt": 1784073486572,
    "updatedAt": 1784073486572
  },
  {
    "eventId": "CE015",
    "day": 9,
    "title": "幸存者偏差：朋友圈里全是赚到钱的人",
    "description": "你朋友圈最近有三个人都在晒：做跨境电商月入5万、做知识付费年入50万、做AI培训三个月赚了20万。你开始怀疑自己是不是走错了路。",
    "choices": [
      {
        "key": "A",
        "text": "立刻选一个方向all-in，别人能做到我也可以",
        "effects": {
          "probabilityMindset": -4,
          "riskAwareness": -3,
          "cv": -3
        },
        "tags": [
          "幸存者偏差",
          "竞争幻觉"
        ],
        "tradeoff": "你看到的是1%的成功案例，没看到99%的失败者——他们不发朋友圈"
      },
      {
        "key": "B",
        "text": "深入研究这三个方向的真实成功率、进入门槛和退出人数",
        "effects": {
          "informationSensitivity": 8,
          "systemThinking": 5,
          "cv": 6
        },
        "tags": [
          "信息验证",
          "数据驱动"
        ],
        "tradeoff": "花时间获取全面信息再做决策，而不是被朋友圈的幸存者报道驱动"
      },
      {
        "key": "C",
        "text": "不跟风，继续深耕自己现有的技能树",
        "effects": {
          "longTermism": 5,
          "decisionStability": 6,
          "cv": 4
        },
        "tags": [
          "长期主义",
          "能力护城河"
        ],
        "tradeoff": "守住现有赛道积累，但可能错过真正的风口——需验证风口是否真实"
      }
    ],
    "blackSwanRate": 0.08,
    "difficulty": 2,
    "status": "active",
    "createdAt": 1752570000000,
    "updatedAt": 1752570000000
  },
  {
    "eventId": "CE016",
    "day": 10,
    "title": "90%胜率但输一次就清零",
    "description": "你发现一个量化交易策略：回测显示胜率高达90%，每次赚8%。但那个10%的失败会亏损100%——也就是一次亏损全部本金。这个策略过去12个月都没触发过那10%。",
    "choices": [
      {
        "key": "A",
        "text": "不碰，但有高胜率且每次只投10%本金的策略可以考虑",
        "effects": {
          "capitalThinking": 7,
          "riskAwareness": 6,
          "cv": 5
        },
        "tags": [
          "凯利公式",
          "永不下牌桌"
        ],
        "tradeoff": "承认单次归零不可接受，用仓位管理把任何策略变成可持续游戏"
      },
      {
        "key": "B",
        "text": "这样的高胜率不投可惜，先拿2万试试",
        "effects": {
          "riskAwareness": -8,
          "probabilityMindset": -3,
          "cv": -6
        },
        "tags": [
          "毁灭性风险",
          "期望值盲区"
        ],
        "tradeoff": "90%胜率×8%收益 看起来很美，但10%×-100%让期望值为负——而你不知道那个10%什么时候来"
      },
      {
        "key": "C",
        "text": "先拿500块做100次实验，看真实胜率是不是真的90%",
        "effects": {
          "systemThinking": 5,
          "probabilityMindset": 6,
          "cv": 4
        },
        "tags": [
          "实验思维",
          "小样本验证"
        ],
        "tradeoff": "用最小成本做长期实验验证策略真实性，但500本金太小可能缺乏统计显著性"
      }
    ],
    "blackSwanRate": 0.03,
    "difficulty": 3,
    "status": "active",
    "createdAt": 1752570000000,
    "updatedAt": 1752570000000
  },
  {
    "eventId": "CE017",
    "day": 11,
    "title": "信息不足时的紧急决策",
    "description": "你的老板突然通知你：公司下个月要搬迁到另一个城市，你可以选择跟着去（涨薪20%）或者拿N+1赔偿走人（约3个月工资）。你对新城市完全不了解，而且一周内必须给答复。",
    "choices": [
      {
        "key": "A",
        "text": "拿赔偿走人，先休息一个月再找工作",
        "effects": {
          "capitalThinking": 4,
          "decisionStability": 3,
          "cv": 2
        },
        "tags": [
          "确定性偏好",
          "即时收益"
        ],
        "tradeoff": "获得3个月工资的安全垫，但中断了现有职业生涯的连续性"
      },
      {
        "key": "B",
        "text": "跟去新城市，涨薪20%加上新环境的可能性",
        "effects": {
          "leverageThinking": 5,
          "riskAwareness": -2,
          "cv": 3
        },
        "tags": [
          "机会捕捉",
          "移动增值"
        ],
        "tradeoff": "用不确定性换20%加薪和新城市的机会池——但可能高估了新环境的回报"
      },
      {
        "key": "C",
        "text": "先花3天飞过去看一圈，了解当地行业和房价再做决定",
        "effects": {
          "informationSensitivity": 7,
          "systemThinking": 5,
          "cv": 6
        },
        "tags": [
          "信息优先",
          "决策前置"
        ],
        "tradeoff": "用几天时间把\"信息不足\"变成\"信息充分\"之后再决定——但这3天老板不一定等"
      }
    ],
    "blackSwanRate": 0.07,
    "difficulty": 2,
    "status": "active",
    "createdAt": 1752570000000,
    "updatedAt": 1752570000000
  },
  {
    "eventId": "CE005",
    "day": 12,
    "title": "同事跳槽薪资翻倍，你该怎么办",
    "description": "跟你同组的老周跳槽后薪资从9500涨到17000。你回到工位，看着自己9500的工资条，鼠标悬停在招聘APP上。",
    "choices": [
      {
        "key": "A",
        "text": "立刻裸辞海投简历，我也要翻倍",
        "effects": {
          "probabilityMindset": -2,
          "decisionStability": -5,
          "cv": -2
        },
        "tags": [
          "情绪交易",
          "冲动决策"
        ]
      },
      {
        "key": "B",
        "text": "不跳槽，但用老周的offer跟老板谈涨薪",
        "effects": {
          "leverageThinking": 5,
          "decisionStability": 4,
          "cv": 3
        },
        "tags": [
          "谈判杠杆",
          "稳健策略"
        ]
      },
      {
        "key": "C",
        "text": "请老周吃饭取经，搞清楚他凭什么翻倍",
        "effects": {
          "informationSensitivity": 7,
          "systemThinking": 5,
          "cv": 4
        },
        "tags": [
          "理性求证",
          "信息获取"
        ]
      }
    ],
    "blackSwanRate": 0.02,
    "difficulty": 1,
    "status": "active",
    "createdAt": 1784073486572,
    "updatedAt": 1784073486572
  },
  {
    "eventId": "CE018",
    "day": 13,
    "title": "你每天都在重复做的事，可以变成系统吗",
    "description": "你每天上班花2小时整理数据报表、发邮件、汇总周报。你发现这些工作有80%可以自动化——写个Python脚本就行。但你需要花两周学Python基础，而且学会了可能让老板觉得你的工作\"变少了\"。",
    "choices": [
      {
        "key": "A",
        "text": "学Python自动化报表，省下时间用来学更高价值技能",
        "effects": {
          "systemThinking": 8,
          "leverageThinking": 6,
          "cv": 7
        },
        "tags": [
          "自动化思维",
          "杠杆升级"
        ],
        "tradeoff": "短期可能被质疑工作饱和度，但长期把低级劳动变成高级技能的垫脚石"
      },
      {
        "key": "B",
        "text": "继续手做，这样至少看起来很忙、有价值",
        "effects": {
          "laborMindset": 6,
          "systemThinking": -5,
          "cv": -4
        },
        "tags": [
          "忙碌焦虑",
          "劳动崇拜"
        ],
        "tradeoff": "用\"看起来忙\"保护职位安全，但把自己锁死在低价值重复劳动里"
      },
      {
        "key": "C",
        "text": "自动化但不告诉任何人，省下的时间自己接私活",
        "effects": {
          "leverageThinking": 7,
          "decisionStability": 2,
          "cv": 3
        },
        "tags": [
          "隐性杠杆",
          "双份收入"
        ],
        "tradeoff": "用自动化创造自己的时间窗口，但在公司看来可能涉及诚信问题"
      }
    ],
    "blackSwanRate": 0.04,
    "difficulty": 2,
    "status": "active",
    "createdAt": 1752570000000,
    "updatedAt": 1752570000000
  },
  {
    "eventId": "CE019",
    "day": 14,
    "title": "一次性交付 vs 可复制产品",
    "description": "你接了个设计外包项目，客户出价8000元做一个品牌VI。项目周期约两周。但你想到可以把这个设计流程做成一套模板系统——卖给更多客户收500元/套。开发模板需要额外两周，且不确定销量。",
    "choices": [
      {
        "key": "A",
        "text": "接8000元项目，稳稳到手的钱不香吗",
        "effects": {
          "capitalThinking": -3,
          "leverageThinking": -4,
          "cv": -2
        },
        "tags": [
          "确定性偏好",
          "线性收入"
        ],
        "tradeoff": "拿确定的8000元，但你的时间和收入永远绑定——卖一次只有一次"
      },
      {
        "key": "B",
        "text": "先接项目再开发模板：用项目款养模板开发",
        "effects": {
          "systemThinking": 6,
          "capitalThinking": 5,
          "cv": 5
        },
        "tags": [
          "渐进杠杆",
          "现金流+资产"
        ],
        "tradeoff": "用项目养产品开发，不饿死也尝试建立可复制资产"
      },
      {
        "key": "C",
        "text": "拒掉项目专注模板，做出来卖100套就是50000",
        "effects": {
          "leverageThinking": 8,
          "probabilityMindset": -2,
          "cv": 3
        },
        "tags": [
          "高风险杠杆",
          "产品化思维"
        ],
        "tradeoff": "放弃了确定的8000元去赌一个可复制产品——杠杆很美，但模板市场可能饱和"
      }
    ],
    "blackSwanRate": 0.06,
    "difficulty": 2,
    "status": "active",
    "createdAt": 1752570000000,
    "updatedAt": 1752570000000
  },
  {
    "eventId": "CE006",
    "day": 15,
    "title": "父母生病：亲情与财务的双重考验",
    "description": "妈妈被诊断需要做手术，费用约8万，新农合只能报40%。你手上有6万存款，是你攒了两年的全部积蓄。",
    "choices": [
      {
        "key": "A",
        "text": "拿出全部积蓄6万，先做手术再说",
        "effects": {
          "capitalThinking": -5,
          "longTermism": 2,
          "cv": -1
        },
        "tags": [
          "情感驱动",
          "责任担当"
        ]
      },
      {
        "key": "B",
        "text": "用储蓄+跟医院协商分期+申请大病救助",
        "effects": {
          "decisionStability": 7,
          "riskAwareness": 5,
          "cv": 4
        },
        "tags": [
          "风险管理",
          "政策利用"
        ]
      },
      {
        "key": "C",
        "text": "筹措多方来源：公司预支+医疗众筹+亲戚借款",
        "effects": {
          "systemThinking": 6,
          "informationSensitivity": 4,
          "cv": 3
        },
        "tags": [
          "资源整合",
          "系统思维"
        ]
      }
    ],
    "blackSwanRate": 0.05,
    "difficulty": 2,
    "status": "active",
    "createdAt": 1784073486572,
    "updatedAt": 1784073486572
  },
  {
    "eventId": "CE020",
    "day": 16,
    "title": "个人能力很强，但你离开系统就转不动了",
    "description": "你在行业内口碑很好，客户都指定找你做。但你每天被需求淹没，团队招了人却接不住你的水准。你的收入完全取决于你的个人时间——生病就没收入。",
    "choices": [
      {
        "key": "A",
        "text": "继续一个人做，提高单价——我值这个价",
        "effects": {
          "laborMindset": 4,
          "leverageThinking": -3,
          "cv": -1
        },
        "tags": [
          "工匠瓶颈",
          "时间桎梏"
        ],
        "tradeoff": "单价高了但总时长有限——你的收入上限就是你醒着的小时数"
      },
      {
        "key": "B",
        "text": "只保留最高价值客户，少做但做得更好",
        "effects": {
          "decisionStability": 5,
          "capitalThinking": 3,
          "cv": 2
        },
        "tags": [
          "精益主义",
          "品质壁垒"
        ],
        "tradeoff": "筛选高价值客户减少工作量但不解决系统瓶颈——你还是在卖时间"
      },
      {
        "key": "C",
        "text": "把核心流程写成操作手册，培训团队能顶75%的质量",
        "effects": {
          "systemThinking": 8,
          "leverageThinking": 5,
          "cv": 6
        },
        "tags": [
          "系统化",
          "能力复制"
        ],
        "tradeoff": "放弃对质量的绝对控制，交换时间和收入的脱钩——质量降25%但规模增5倍"
      }
    ],
    "blackSwanRate": 0.05,
    "difficulty": 3,
    "status": "active",
    "createdAt": 1752570000000,
    "updatedAt": 1752570000000
  },
  {
    "eventId": "CE021",
    "day": 17,
    "title": "项目增长后的混乱：系统崩塌时刻",
    "description": "你的淘宝店从月销50单暴涨到500单，但供应链、客服、发货全乱了。客户投诉暴增，有两个大客户要退款。你可以选择暂停接单整顿，或者硬着头皮继续发货碰运气。",
    "choices": [
      {
        "key": "A",
        "text": "暂停接新单，花一周理顺供应链和客服流程",
        "effects": {
          "systemThinking": 8,
          "longTermism": 6,
          "cv": 6
        },
        "tags": [
          "系统优先",
          "长期价值"
        ],
        "tradeoff": "损失一周营收但建立可支撑10倍增长的系统——这是从生意到企业的分水岭"
      },
      {
        "key": "B",
        "text": "继续接单别停，雇更多临时工解决眼下问题",
        "effects": {
          "laborMindset": 3,
          "riskAwareness": -5,
          "cv": -3
        },
        "tags": [
          "短视扩张",
          "战术堆人"
        ],
        "tradeoff": "堆人解决短期问题，但人越多越乱——这是把系统性故障伪装成人力不足"
      },
      {
        "key": "C",
        "text": "先处理最紧急的投诉，同时开始写操作手册做交接",
        "effects": {
          "decisionStability": 5,
          "systemThinking": 4,
          "cv": 3
        },
        "tags": [
          "渐进系统化",
          "紧急优先"
        ],
        "tradeoff": "平衡短期危机和长期建设，但可能两边都只能做到及格而非优秀"
      }
    ],
    "blackSwanRate": 0.04,
    "difficulty": 2,
    "status": "active",
    "createdAt": 1752570000000,
    "updatedAt": 1752570000000
  },
  {
    "eventId": "CE007",
    "day": 18,
    "title": "股市内幕消息：兄弟说有只股票下周要重组",
    "description": "大学同学深夜发来消息：\"我一个券商朋友透露，XX科技下周要重组，现在2块多一股，买了闭眼数钱。\"你翻了一下K线，确实连续放量。",
    "choices": [
      {
        "key": "A",
        "text": "ALL IN 2万，人生能有几回搏",
        "effects": {
          "capitalThinking": -6,
          "riskAwareness": -8,
          "cv": -5
        },
        "tags": [
          "赌徒倾向",
          "暴富幻觉"
        ]
      },
      {
        "key": "B",
        "text": "小仓位试5000，严格设止损",
        "effects": {
          "probabilityMindset": 4,
          "riskAwareness": 3,
          "cv": 2
        },
        "tags": [
          "仓位管理",
          "纪律执行"
        ]
      },
      {
        "key": "C",
        "text": "不碰个股，定投指数基金",
        "effects": {
          "longTermism": 8,
          "capitalThinking": 5,
          "cv": 4
        },
        "tags": [
          "长期主义",
          "稳健防御"
        ]
      }
    ],
    "blackSwanRate": 0.08,
    "difficulty": 2,
    "status": "active",
    "createdAt": 1784073486572,
    "updatedAt": 1784073486572
  },
  {
    "eventId": "CE022",
    "day": 19,
    "title": "10万块的三种人生：消费？储蓄？还是投资自己",
    "description": "你终于攒了10万块。你可以买一辆二手车方便通勤和接私活（残值约70%），存在银行年化3%吃利息，或者报一个AI+数据分析的全日制培训班（脱产学4个月）。",
    "choices": [
      {
        "key": "A",
        "text": "买车，提升通勤效率和接单能力",
        "effects": {
          "laborMindset": 3,
          "capitalThinking": -3,
          "cv": 0
        },
        "tags": [
          "消费升级",
          "工具投资"
        ],
        "tradeoff": "买了贬值资产但有实用价值——关键看买车带来的额外收入能否覆盖车辆折损"
      },
      {
        "key": "B",
        "text": "报培训班，用10万赌一个更高收入的未来",
        "effects": {
          "leverageThinking": 7,
          "longTermism": 5,
          "cv": 4
        },
        "tags": [
          "自我投资",
          "人力资本"
        ],
        "tradeoff": "投资自己回报率最高但需要验证培训的真实价值——很多培训班只是信息差套利"
      },
      {
        "key": "C",
        "text": "存银行，这笔钱是我的安全垫不能动",
        "effects": {
          "riskAwareness": 4,
          "capitalThinking": 2,
          "cv": -1
        },
        "tags": [
          "安全偏好",
          "通胀盲区"
        ],
        "tradeoff": "3%利率在6%通胀下实际每年亏3%——安全垫正在被悄悄吃掉"
      }
    ],
    "blackSwanRate": 0.05,
    "difficulty": 2,
    "status": "active",
    "createdAt": 1752570000000,
    "updatedAt": 1752570000000
  },
  {
    "eventId": "CE023",
    "day": 20,
    "title": "内部消息：信息优势到底值多少钱",
    "description": "你在一个行业论坛上认识了一位前辈，他私下告诉你：某上市公司的核心供应商下个月要换，现在低价供应合同还没签完。这对你所在行业是一个巨大的信息优势——你可以提前囤货赚差价。",
    "choices": [
      {
        "key": "A",
        "text": "按这个信息提前囤一批货，信息差不赚白不赚",
        "effects": {
          "informationSensitivity": 5,
          "riskAwareness": -6,
          "cv": -3
        },
        "tags": [
          "内幕交易边缘",
          "灰色杠杆"
        ],
        "tradeoff": "信息价值巨大但可能触碰法律红线——你确定这不是内幕交易？"
      },
      {
        "key": "B",
        "text": "不用这个消息赚钱，但研究它是怎么流出的，建立自己的信息网络",
        "effects": {
          "systemThinking": 6,
          "longTermism": 5,
          "cv": 5
        },
        "tags": [
          "网络建设",
          "长期信息资产"
        ],
        "tradeoff": "这次不赚差价，但学习如何建立信息渠道——下次机会来临时你是第一批知道的人"
      },
      {
        "key": "C",
        "text": "先验证消息来源：查公开合同数据、供应链报告交叉确认",
        "effects": {
          "informationSensitivity": 8,
          "systemThinking": 5,
          "cv": 6
        },
        "tags": [
          "信息验证",
          "合法套利"
        ],
        "tradeoff": "花时间把\"内部消息\"变成\"公开可验证信息\"——才能在合法范围内利用信息差"
      }
    ],
    "blackSwanRate": 0.08,
    "difficulty": 3,
    "status": "active",
    "createdAt": 1752570000000,
    "updatedAt": 1752570000000
  },
  {
    "eventId": "CE024",
    "day": 21,
    "title": "跟高手合作，但眼前的钱会变少",
    "description": "你有一个项目，自己做的话月利润2万。现在一个行业大V愿意合伙——他的资源和渠道能让项目规模翻5倍，但你要分50%股权。短期看你的收入从2万降到1万+未来分成。",
    "choices": [
      {
        "key": "A",
        "text": "接受合作，短期吃亏但长期规模翻5倍",
        "effects": {
          "leverageThinking": 8,
          "longTermism": 5,
          "cv": 6
        },
        "tags": [
          "合作杠杆",
          "规模优先"
        ],
        "tradeoff": "放弃短期一半收益换规模和渠道，关键看大V是否真的能带来5倍增长"
      },
      {
        "key": "B",
        "text": "自己做，2万全归自己不用分",
        "effects": {
          "laborMindset": 4,
          "leverageThinking": -5,
          "cv": -4
        },
        "tags": [
          "所有权幻觉",
          "小农思维"
        ],
        "tradeoff": "你拥有一个小饼干的100%，而不是大蛋糕的50%——在绝对值上可能亏了"
      },
      {
        "key": "C",
        "text": "先合作一个季度试试，合同设退出条款",
        "effects": {
          "systemThinking": 5,
          "decisionStability": 6,
          "cv": 4
        },
        "tags": [
          "渐进合作",
          "风险可控"
        ],
        "tradeoff": "用试合作期验证对方价值，既不错过也不all-in——但大V可能不愿意签短期"
      }
    ],
    "blackSwanRate": 0.04,
    "difficulty": 2,
    "status": "active",
    "createdAt": 1752570000000,
    "updatedAt": 1752570000000
  },
  {
    "eventId": "CE008",
    "day": 22,
    "title": "第一笔理财：5万块放哪里",
    "description": "你终于攒了5万块。银行理财经理推荐\"稳健型基金年化4%\"。你姐夫说他认识一个私募经理\"年薪8%\"，名额有限。",
    "choices": [
      {
        "key": "A",
        "text": "按4321法则分散配置：活期+稳健+指数+试水",
        "effects": {
          "systemThinking": 8,
          "capitalThinking": 6,
          "cv": 5
        },
        "tags": [
          "资产配置",
          "系统思维"
        ]
      },
      {
        "key": "B",
        "text": "买一本《指数基金投资指南》花两周自学再决定",
        "effects": {
          "longTermism": 7,
          "informationSensitivity": 5,
          "cv": 4
        },
        "tags": [
          "延迟满足",
          "认知优先"
        ]
      },
      {
        "key": "C",
        "text": "投给姐夫的私募，搏一把",
        "effects": {
          "capitalThinking": -5,
          "riskAwareness": -7,
          "cv": -4
        },
        "tags": [
          "信息盲从",
          "高欲望"
        ]
      }
    ],
    "blackSwanRate": 0.05,
    "difficulty": 2,
    "status": "active",
    "createdAt": 1784073486572,
    "updatedAt": 1784073486572
  },
  {
    "eventId": "CE025",
    "day": 23,
    "title": "赚快钱 vs 建立长期信誉",
    "description": "你接到一个大客户短期项目：利用热度做一个\"AI算命\"小程序，一个月能赚10万。但这明显是割韭菜的生意，且与你想建立的\"靠谱AI服务商\"品牌形象完全相反。",
    "choices": [
      {
        "key": "A",
        "text": "先赚了这10万再说，品牌以后可以重建",
        "effects": {
          "capitalThinking": 3,
          "longTermism": -6,
          "cv": -5
        },
        "tags": [
          "短视套利",
          "信用透支"
        ],
        "tradeoff": "10万是确定的，但你在行业里的信用标签从\"靠谱\"变成了\"割韭菜\"——这个标签很难洗"
      },
      {
        "key": "B",
        "text": "拒绝这个项目，把精力投入真正的AI应用开发",
        "effects": {
          "longTermism": 8,
          "decisionStability": 6,
          "cv": 5
        },
        "tags": [
          "长期主义",
          "信用复利"
        ],
        "tradeoff": "放弃短期快钱，但行业信誉是时间的指数函数——今天拒绝一次，未来每个合作都更值钱"
      },
      {
        "key": "C",
        "text": "接项目但做成真正有用的AI工具（比如AI心理评估），包装成\"算命\"推广",
        "effects": {
          "systemThinking": 5,
          "informationSensitivity": 4,
          "cv": 2
        },
        "tags": [
          "灰色创新",
          "产品转型"
        ],
        "tradeoff": "试图把劣质需求转化成优质产品——但用户心智一旦绑定\"算命\"，很难再升级"
      }
    ],
    "blackSwanRate": 0.06,
    "difficulty": 2,
    "status": "active",
    "createdAt": 1752570000000,
    "updatedAt": 1752570000000
  },
  {
    "eventId": "CE026",
    "day": 24,
    "title": "半年没结果，你的长期项目还值得坚持吗",
    "description": "你半年前开始做一个SaaS工具，投入了3万元和大量业余时间。目前只有7个付费用户，月收入420元。竞争者中有一个拿到融资的团队正在快速追赶你的方向。",
    "choices": [
      {
        "key": "A",
        "text": "跟竞争对手差异化：他们做大客户，你深耕个人用户",
        "effects": {
          "systemThinking": 7,
          "capitalThinking": 5,
          "cv": 6
        },
        "tags": [
          "市场定位",
          "差异化战略"
        ],
        "tradeoff": "不和融资对手正面打，选择他们看不上的细分市场——小而美有时是最好的防御"
      },
      {
        "key": "B",
        "text": "既然没钱没用户，及时止损找新方向",
        "effects": {
          "riskAwareness": 2,
          "longTermism": -5,
          "cv": -3
        },
        "tags": [
          "过早止损",
          "时间盲区"
        ],
        "tradeoff": "7个付费用户=需求验证已通过，剩下的是增长问题——但你可能把推广问题当成了需求问题"
      },
      {
        "key": "C",
        "text": "把SaaS转为开源项目，靠咨询和定制化服务赚钱",
        "effects": {
          "leverageThinking": 6,
          "systemThinking": 4,
          "cv": 4
        },
        "tags": [
          "模式转换",
          "开源杠杆"
        ],
        "tradeoff": "放弃直接的产品收入，用开源获取用户和信任——咨询费才是真正的收入来源"
      }
    ],
    "blackSwanRate": 0.05,
    "difficulty": 3,
    "status": "active",
    "createdAt": 1752570000000,
    "updatedAt": 1752570000000
  },
  {
    "eventId": "CE009",
    "day": 25,
    "title": "短视频上瘾：时间黑洞与认知腐蚀",
    "description": "下班后你往床上一躺，打开了短视频。算法精准推送你喜欢的。等你抬头，已经凌晨2:37。手机屏幕使用时间：今日7小时12分钟。明天6点要起。",
    "choices": [
      {
        "key": "A",
        "text": "再看一会，今天太累了需要放松",
        "effects": {
          "longTermism": -5,
          "decisionStability": -4,
          "cv": -3
        },
        "tags": [
          "即时满足",
          "注意力税"
        ]
      },
      {
        "key": "B",
        "text": "设置屏幕时间限制，卸载短视频APP",
        "effects": {
          "systemThinking": 6,
          "longTermism": 7,
          "cv": 5
        },
        "tags": [
          "断臂求生",
          "注意力管理"
        ]
      },
      {
        "key": "C",
        "text": "不卸载但重新训练算法：只搜技能类和深度内容",
        "effects": {
          "systemThinking": 4,
          "informationSensitivity": 3,
          "cv": 2
        },
        "tags": [
          "工具驯化",
          "算法意识"
        ]
      }
    ],
    "blackSwanRate": 0.02,
    "difficulty": 1,
    "status": "active",
    "createdAt": 1784073486572,
    "updatedAt": 1784073486572
  },
  {
    "eventId": "CE027",
    "day": 26,
    "title": "新证据证明你过去的判断是错的",
    "description": "你一直坚信\"学历决定一切\"，所以花了大量时间考各种证书。但最近数据显示：在AI时代，通用技能（沟通、决策、系统思维）比学历证书的薪资溢价高40%。你过去的战略基础被动摇了。",
    "choices": [
      {
        "key": "A",
        "text": "这数据可能是特例，继续考证书增加安全垫",
        "effects": {
          "laborMindset": 5,
          "informationSensitivity": -6,
          "cv": -4
        },
        "tags": [
          "确认偏差",
          "认知免疫"
        ],
        "tradeoff": "你选择忽略与过去信念矛盾的数据——这是认知免疫系统在保护你的自我一致性"
      },
      {
        "key": "B",
        "text": "立即调整策略：停止考证，转攻AI工具+系统思维",
        "effects": {
          "decisionStability": 7,
          "leverageThinking": 5,
          "cv": 6
        },
        "tags": [
          "认知更新",
          "策略转向"
        ],
        "tradeoff": "承认过去方向有误需要勇气，但调整方向比捍卫错误更省时间"
      },
      {
        "key": "C",
        "text": "两手准备：完成最后一个证书的同时学AI技能",
        "effects": {
          "systemThinking": 4,
          "decisionStability": 2,
          "cv": 1
        },
        "tags": [
          "过渡策略",
          "并行切换"
        ],
        "tradeoff": "渐进式转变降低心理成本，但可能两边都不够投入——证书贬值的速度可能比你学AI快"
      }
    ],
    "blackSwanRate": 0.04,
    "difficulty": 3,
    "status": "active",
    "createdAt": 1752570000000,
    "updatedAt": 1752570000000
  },
  {
    "eventId": "CE028",
    "day": 27,
    "title": "你的成功模式突然失效了",
    "description": "你过去三年靠低买高卖的\"信息差模式\"赚到了第一桶金——在闲鱼和拼多多之间倒货。但今年平台算法升级了，价格越来越透明，你的利润率从40%降到了5%。",
    "choices": [
      {
        "key": "A",
        "text": "加大投入找新的信息差品类，跑得比算法快就行",
        "effects": {
          "laborMindset": 3,
          "informationSensitivity": 2,
          "cv": -3
        },
        "tags": [
          "路径依赖",
          "战术勤奋"
        ],
        "tradeoff": "算法消灭信息差的速度远快于你发现新信息差的速度——你在跟机器比爬取效率"
      },
      {
        "key": "B",
        "text": "转型做选品+内容：把你找好货的能力变成短视频推荐",
        "effects": {
          "leverageThinking": 7,
          "systemThinking": 5,
          "cv": 5
        },
        "tags": [
          "模式升级",
          "能力迁移"
        ],
        "tradeoff": "从\"信息差套利者\"变成\"消费决策参考\"——你的核心能力（选品眼光）不需要丢掉"
      },
      {
        "key": "C",
        "text": "用过去赚的钱学习供应链管理，从赚差价变成做品牌",
        "effects": {
          "capitalThinking": 7,
          "longTermism": 6,
          "cv": 7
        },
        "tags": [
          "价值链升级",
          "长期资产"
        ],
        "tradeoff": "从最底层的价差套利，迁移到价值链上游——这是从\"倒爷\"到\"老板\"的认知跃迁"
      }
    ],
    "blackSwanRate": 0.03,
    "difficulty": 3,
    "status": "active",
    "createdAt": 1752570000000,
    "updatedAt": 1752570000000
  },
  {
    "eventId": "CE010",
    "day": 28,
    "title": "AI浪潮：你的岗位将被替代还是升级？",
    "description": "公司宣布引入AI自动化系统。你所在的部门有30%的岗位在\"被评估替代\"的名单上。你听到消息后，手心全是汗。",
    "choices": [
      {
        "key": "A",
        "text": "恐慌报班，把所有积蓄投入AI培训",
        "effects": {
          "probabilityMindset": -3,
          "riskAwareness": -4,
          "cv": -2
        },
        "tags": [
          "情绪交易",
          "焦虑驱动"
        ]
      },
      {
        "key": "B",
        "text": "忽视变化，坚守现有工作方式",
        "effects": {
          "laborMindset": 5,
          "leverageThinking": -6,
          "cv": -4
        },
        "tags": [
          "机会恐惧",
          "随波逐流"
        ]
      },
      {
        "key": "C",
        "text": "主动学习AI工具提升效率，让自己成为\"驾驭AI的人\"",
        "effects": {
          "leverageThinking": 8,
          "systemThinking": 6,
          "cv": 7
        },
        "tags": [
          "认知觉醒",
          "主动升级"
        ]
      }
    ],
    "blackSwanRate": 0.06,
    "difficulty": 1,
    "status": "active",
    "createdAt": 1784073486572,
    "updatedAt": 1784073486572
  },
  {
    "eventId": "CE029",
    "day": 29,
    "title": "不可逆风险：这笔交易输了就回不去了",
    "description": "一个投资人愿意出300万买你项目的51%股份，但合同里有一个条款：如果你后续项目失败，你需要用个人资产偿还投资款的30%（即90万）。你目前个人存款20万，房产价值150万。",
    "choices": [
      {
        "key": "A",
        "text": "不签，但有诚意的方案：谈一个个人财务独立条款",
        "effects": {
          "systemThinking": 6,
          "capitalThinking": 6,
          "cv": 6
        },
        "tags": [
          "风险隔离",
          "法律杠杆"
        ],
        "tradeoff": "用法律结构（如成立有限责任公司）隔断个人资产和商业风险——这是最基本的资本常识"
      },
      {
        "key": "B",
        "text": "拒绝这个条款，宁可慢慢做也不赌上家底",
        "effects": {
          "riskAwareness": 8,
          "decisionStability": 6,
          "cv": 5
        },
        "tags": [
          "风险底线",
          "永不下牌桌"
        ],
        "tradeoff": "放弃快速增长的机会，但保住东山再起的资本——在任何博弈中，活着是最重要的"
      },
      {
        "key": "C",
        "text": "签！300万可以让我团队扩张、快速抢市场",
        "effects": {
          "leverageThinking": 3,
          "riskAwareness": -7,
          "cv": -4
        },
        "tags": [
          "赌徒陷阱",
          "毁灭性风险"
        ],
        "tradeoff": "输了你就不是回到原点而是负数——个人破产在中国意味着至少3年的黑名单"
      }
    ],
    "blackSwanRate": 0.02,
    "difficulty": 3,
    "status": "active",
    "createdAt": 1752570000000,
    "updatedAt": 1752570000000
  },
  {
    "eventId": "CE030",
    "day": 30,
    "title": "如果重新设计未来三年的人生系统",
    "description": "经过了29天的认知挑战，你了解了自己的思维盲区、杠杆机会和风险底线。现在你可以重新配置：时间、精力、金钱、关系、技能的投入比例。没有人逼你做选择——但沉默也是一种选择。",
    "choices": [
      {
        "key": "A",
        "text": "保持现有轨道：工作为主，业余时间小心尝试",
        "effects": {
          "laborMindset": 4,
          "decisionStability": 3,
          "cv": 0
        },
        "tags": [
          "稳健保守",
          "渐进变化"
        ],
        "tradeoff": "把你的核心引擎保持在8小时工作制内——这是大多数人的默认选项，也是大多数人之所以是大多数人的原因"
      },
      {
        "key": "B",
        "text": "先做三个月实验：每周测一种新模式，用数据决定最终方案",
        "effects": {
          "probabilityMindset": 7,
          "systemThinking": 5,
          "informationSensitivity": 4,
          "cv": 6
        },
        "tags": [
          "实验主义",
          "数据驱动"
        ],
        "tradeoff": "不提前做三年计划，而是用三个月密集实验跑出最优解——数据比直觉更诚实"
      },
      {
        "key": "C",
        "text": "激进重构：60%时间投入可复制资产，30%学AI杠杆，10%维护现金流",
        "effects": {
          "leverageThinking": 7,
          "systemThinking": 6,
          "longTermism": 5,
          "cv": 5
        },
        "tags": [
          "系统重构",
          "主动设计"
        ],
        "tradeoff": "把未来三年当作一款游戏来设计——你的角色数值是你自己分配的，没有系统默认"
      }
    ],
    "blackSwanRate": 0.01,
    "difficulty": 3,
    "status": "active",
    "createdAt": 1752570000000,
    "updatedAt": 1752570000000
  }
]

module.exports = { DEFAULT_CHALLENGE_EVENTS };
