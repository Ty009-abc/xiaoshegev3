/**
 * 珠澳小事哥 · 认知操作系统 v3.0
 * 认知标签 & 徽章种子数据
 */

const now = () => Date.now()

const ts = now()

const DEFAULT_COGNITION_TAGS = [
  { tagId: 'CT001', name: '行动派', category: 'positive', description: '说干就干，用行动代替犹豫', sort: 1, status: 'active', createdAt: ts, updatedAt: ts },
  { tagId: 'CT002', name: '低成本试错', category: 'positive', description: '用小成本验证大假设', sort: 2, status: 'active', createdAt: ts, updatedAt: ts },
  { tagId: 'CT003', name: '观望型', category: 'neutral', description: '谨慎但不失机会意识', sort: 3, status: 'active', createdAt: ts, updatedAt: ts },
  { tagId: 'CT004', name: '机会延迟', category: 'negative', description: '因过度观望错过窗口期', sort: 4, status: 'active', createdAt: ts, updatedAt: ts },
  { tagId: 'CT005', name: '防御型认知', category: 'negative', description: '把新事物一律当成威胁', sort: 5, status: 'active', createdAt: ts, updatedAt: ts },
  { tagId: 'CT006', name: '机会屏蔽', category: 'negative', description: '主动过滤一切新信息', sort: 6, status: 'active', createdAt: ts, updatedAt: ts },
  { tagId: 'CT007', name: '长期主义', category: 'positive', description: '用时间换复利', sort: 7, status: 'active', createdAt: ts, updatedAt: ts },
  { tagId: 'CT008', name: '系统思维', category: 'positive', description: '看见结构而非碎片', sort: 8, status: 'active', createdAt: ts, updatedAt: ts },
  { tagId: 'CT009', name: '理性求证', category: 'positive', description: '用证据替代直觉', sort: 9, status: 'active', createdAt: ts, updatedAt: ts },
  { tagId: 'CT010', name: '赌徒倾向', category: 'negative', description: '追求高风险高回报的极端行为', sort: 10, status: 'active', createdAt: ts, updatedAt: ts },
  { tagId: 'CT011', name: '杠杆依赖', category: 'negative', description: '过度依赖债务和杠杆', sort: 11, status: 'active', createdAt: ts, updatedAt: ts },
  { tagId: 'CT012', name: '知行合一', category: 'positive', description: '知道并做到', sort: 12, status: 'active', createdAt: ts, updatedAt: ts },
  { tagId: 'CT013', name: '延迟满足', category: 'positive', description: '用今天的克制换明天的自由', sort: 13, status: 'active', createdAt: ts, updatedAt: ts },
  { tagId: 'CT014', name: '稳健防御', category: 'positive', description: '先不败而后求胜', sort: 14, status: 'active', createdAt: ts, updatedAt: ts },
  { tagId: 'CT015', name: '断臂求生', category: 'positive', description: '果断放弃沉没成本', sort: 15, status: 'active', createdAt: ts, updatedAt: ts },
]

const DEFAULT_BADGES = [
  { badgeId: 'BDG001', name: '初次觉醒', description: '完成第一次认知挑战', icon: '🧠', category: 'challenge', condition: { type: 'challenge_complete', count: 1 }, status: 'active', createdAt: ts, updatedAt: ts },
  { badgeId: 'BDG002', name: '坚持7天', description: '连续7天完成每日挑战', icon: '🔥', category: 'streak', condition: { type: 'streak_days', count: 7 }, status: 'active', createdAt: ts, updatedAt: ts },
  { badgeId: 'BDG003', name: '30天通关', description: '完成完整30天挑战', icon: '🏆', category: 'challenge', condition: { type: 'challenge_complete', count: 30 }, status: 'active', createdAt: ts, updatedAt: ts },
  { badgeId: 'BDG004', name: '认知跃迁', description: '认知评分突破70分', icon: '🚀', category: 'growth', condition: { type: 'cognition_score', min: 70 }, status: 'active', createdAt: ts, updatedAt: ts },
  { badgeId: 'BDG005', name: '信息猎手', description: '连续阅读15条认知暴击', icon: '🔍', category: 'reading', condition: { type: 'insights_read', count: 15 }, status: 'active', createdAt: ts, updatedAt: ts },
  { badgeId: 'BDG006', name: '规则大师', description: '解锁全部世界规则', icon: '📜', category: 'reading', condition: { type: 'rules_unlocked', count: 15 }, status: 'active', createdAt: ts, updatedAt: ts },
  { badgeId: 'BDG007', name: '翻身战士', description: '翻身概率突破60%', icon: '⚔️', category: 'growth', condition: { type: 'turnaround_probability', min: 60 }, status: 'active', createdAt: ts, updatedAt: ts },
  { badgeId: 'BDG008', name: '分享达人', description: '分享报告10次', icon: '📤', category: 'social', condition: { type: 'share_count', count: 10 }, status: 'active', createdAt: ts, updatedAt: ts },
]

module.exports = { DEFAULT_COGNITION_TAGS, DEFAULT_BADGES }
