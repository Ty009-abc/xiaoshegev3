'use strict'
/**
 * tests/rc8.10/challenge-events.fixture.js — the REAL 30-day bank (CE001–CE030),
 * mirrored for offline tests. Domains/affinity come from challengeEventCatalog.
 * Each event carries 2 synthetic choices used only to exercise the adaptive
 * engine (A = steady, B = impulsive).
 */

function ev (eventId, day, difficulty, title, tags) {
  return {
    eventId, day, difficulty, title,
    description: title,
    status: 'active',
    choices: [
      { key: 'A', text: '稳健处理', tags: [tags[0]].filter(Boolean), effects: { systemThinking: 5, longTermism: 4 } },
      { key: 'B', text: '冲动搏一把', tags: [tags[1] || '高欲望'].filter(Boolean), effects: { riskAwareness: -6, longTermism: -3, decisionStability: -4 } },
    ],
  }
}

const EVENTS = [
  ev('CE001', 1, 1, '你发现一个AI副业机会', ['机会识别', 'AI副业']),
  ev('CE011', 2, 2, '稳定的死工资 vs 不稳定的复利', ['复利', '死工资']),
  ev('CE002', 3, 1, '老板画饼：加班换股权', ['股权', '加班']),
  ev('CE012', 4, 1, '沉没成本：你那门学了90%但用不到的课程', ['沉没成本']),
  ev('CE003', 5, 2, '朋友拉你做投资：年化18%的理财', ['投资', '高收益陷阱']),
  ev('CE013', 6, 1, '免费陷阱：有人付费请你做免费内容平台', ['免费陷阱', '内容资产']),
  ev('CE014', 7, 2, '连续失败后，你还敢下注吗', ['连续失败', '再次下注']),
  ev('CE004', 8, 1, '培训机构说：零基础学IT，四个月月薪过万', ['培训陷阱', '转行']),
  ev('CE015', 9, 2, '幸存者偏差：朋友圈里全是赚到钱的人', ['幸存者偏差']),
  ev('CE016', 10, 3, '90%胜率但输一次就清零', ['胜率', '清零风险']),
  ev('CE017', 11, 2, '信息不足时的紧急决策', ['紧急决策']),
  ev('CE005', 12, 1, '同事跳槽薪资翻倍，你该怎么办', ['跳槽', '职业选择']),
  ev('CE018', 13, 2, '你每天都在重复做的事，可以变成系统吗', ['系统化', '重复']),
  ev('CE019', 14, 2, '一次性交付 vs 可复制产品', ['可复制产品']),
  ev('CE006', 15, 2, '父母生病：亲情与财务的双重考验', ['家庭', '财务']),
  ev('CE020', 16, 3, '个人能力很强，但你离开系统就转不动了', ['离开系统']),
  ev('CE021', 17, 2, '项目增长后的混乱：系统崩塌时刻', ['增长混乱', '系统崩塌']),
  ev('CE007', 18, 2, '股市内幕消息：兄弟说有只股票下周要重组', ['内幕消息', '股市']),
  ev('CE022', 19, 2, '10万块的三种人生：消费？储蓄？还是投资自己', ['10万块', '配置']),
  ev('CE023', 20, 3, '内部消息：信息优势到底值多少钱', ['信息优势']),
  ev('CE024', 21, 2, '跟高手合作，但眼前的钱会变少', ['合作', '长期']),
  ev('CE008', 22, 2, '第一笔理财：5万块放哪里', ['理财', '第一笔']),
  ev('CE025', 23, 2, '赚快钱 vs 建立长期信誉', ['快钱', '信誉']),
  ev('CE026', 24, 3, '半年没结果，你的长期项目还值得坚持吗', ['长期项目', '坚持']),
  ev('CE009', 25, 1, '短视频上瘾：时间黑洞与认知腐蚀', ['短视频', '注意力']),
  ev('CE027', 26, 3, '新证据证明你过去的判断是错的', ['证伪', '承认错误']),
  ev('CE028', 27, 3, '你的成功模式突然失效了', ['成功模式失效']),
  ev('CE010', 28, 1, 'AI浪潮：你的岗位将被替代还是升级？', ['AI', '岗位升级']),
  ev('CE029', 29, 3, '不可逆风险：这笔交易输了就回不去了', ['不可逆风险']),
  ev('CE030', 30, 3, '如果重新设计未来三年的人生系统', ['人生系统', '三年']),
]

function eventsById () {
  const m = {}
  for (const e of EVENTS) m[e.eventId] = e
  return m
}

module.exports = { EVENTS, eventsById }
