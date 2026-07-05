// pages/ai-analysis/ai-analysis.js
// v3.7.4 流式重构：「先跳后装」——秒跳 → 标题骨架先出 → 后台异步加载正文
const app = getApp();

// ── 5 大板块骨架定义 ──
const SECTIONS = [
  {
    key: 'trap',
    icon: '🔒',
    title: '你被什么系统困住',
    skeleton: '军师正在破译困住你的那张无形的网...'
  },
  {
    key: 'core',
    icon: '🎯',
    title: '真正的核心问题',
    skeleton: '正在从九维数据中提取你的核心矛盾...'
  },
  {
    key: 'path',
    icon: '🗺️',
    title: '翻身路径',
    skeleton: '正在为你绘制专属的上升通道地图...'
  },
  {
    key: 'action',
    icon: '⚡',
    title: '行动建议',
    skeleton: '正在生成可执行的拆解动作...'
  },
  {
    key: 'punch',
    icon: '💀',
    title: '致命一句',
    skeleton: '军师正在酝酿那句刺穿你认知防线的真话...'
  }
];

Page({
  data: {
    // 状态机：shell → loading → done | fallback | empty
    status: 'shell',
    sections: SECTIONS.map(s => ({
      ...s,
      content: '',           // 正文内容（AI返回后填入）
      loading: true,         // 骨架屏闪烁中
      loadingText: s.skeleton
    })),

    // 数据库存
    scores: null,
    userLevel: '',
    cvTotal: 0,

    // 报告头
    reportTitle: '',
    reportMeta: '',
    persona: '',

    // 雷达数据
    dims: [],
    avgScore: 0,

    // 请求守卫：防止 onShow 重复触发
    _requesting: false
  },

  // ═══ 生命周期 ═══
  onLoad: function (options) {
    const source = options.source || 'challenge';

    // 从全局状态读取九维思维埋点数据
    const scores = app.globalData._challengeScores || null;
    const userLevel = app.globalData._userLevel || 'Lv.1 困局打工人';
    const cvTotal = app.globalData._cvTotal || 100;

    this.setData({ scores, userLevel, cvTotal });

    if (!scores) {
      // 无数据：展示空态
      this.setData({ status: 'empty' });
      return;
    }

    // ★ 骨架已通过 data.sections 在页面中默认渲染（全部 loading:true）
    // 此时 WXML 中 5 大标题卡片已经可见，正文为骨架屏
    this.setData({ status: 'shell' });
  },

  onShow: function () {
    // 只在 shell 状态下触发异步加载（防止重复请求）
    if (this.data.status !== 'shell' || this.data._requesting) return;
    this._requesting = true;
    this.startReportGeneration();
  },

  // ═══ 异步触发云函数 ═══
  startReportGeneration: function () {
    const { scores, userLevel } = this.data;

    // 状态切 loading（骨架屏保持，额外指示器显示"分析中"）
    this.setData({ status: 'loading' });

    wx.cloud.callFunction({
      name: 'generateAiReport',
      data: {
        type: 'challenge_final',
        scores: scores,
        source: 'challenge',
        userLevel: userLevel
      },
      success: (res) => {
        const report = res.result && res.result.report ? res.result.report : res.result;
        let reportData = report;

        // 清洗：如果是 JSON 字符串则解析
        if (typeof report === 'string') {
          try { reportData = JSON.parse(report); } catch (e) { /* keep raw */ }
        }

        // 将 AI 报告的段落映射到 5 大板块
        this.applyReportData(reportData);
        this.setData({ status: 'done' });
      },
      fail: (err) => {
        console.error('[ai-analysis] generateAiReport failed:', err);

        // 兜底：本地生成基础报告
        this.generateFallbackReport();
        this.setData({ status: 'done' });
      }
    });
  },

  // ═══ AI 正文映射到骨架板块（核心：正文丝滑地"长"出来） ═══
  applyReportData: function (report) {
    if (!report) return;

    // 判断 report 是结构化对象还是纯文本字符串
    let structured = report;
    if (typeof report === 'string') {
      // 尝试从文本中抽取结构化段落
      try { structured = JSON.parse(report); } catch (e) {
        structured = this.parsePlainReport(report);
      }
    }

    const sections = this.data.sections.map(s => {
      let content = '';

      switch (s.key) {
        case 'trap':
          content = structured.trap || structured.systemTrap || structured['你被什么系统困住'] || '';
          break;
        case 'core':
          content = structured.core || structured.coreIssue || structured.coreProblem || structured['真正的核心问题'] || '';
          break;
        case 'path':
          content = structured.path || structured.risePath || structured.escapePath || structured['翻身路径'] || '';
          break;
        case 'action':
          content = structured.action || structured.actions || structured.actionAdvice || structured['行动建议'] || '';
          break;
        case 'punch':
          content = structured.punch || structured.fatalLine || structured.deadlyLine || structured['致命一句'] || '';
          break;
      }

      // 如果结构化解析失败（所有 key 都为空），退化为全文本截断分配
      if (!content && structured.summary) {
        content = structured.summary;
      }
      if (!content && structured.advice) {
        content = structured.advice;
      }

      return {
        ...s,
        content: content || '',
        loading: false,
        loadingText: content ? '' : '暂无分析数据'
      };
    });

    // 更新报告头和雷达数据
    this.setData({
      sections,
      reportTitle: structured.title || '九维认知诊断报告',
      reportMeta: '基于 30 天博弈行为数据 · DeepSeek 深度分析',
      persona: structured.persona || '',
      avgScore: structured.avgScore || this.calcAvgScore(),
      dims: structured.dims || this.buildDimsArray()
    });
  },

  // ═══ 兜底：AI 失败时本地生成 ═══
  generateFallbackReport: function () {
    const { scores } = this.data;
    if (!scores) return;

    const dims = [
      { key: 'laborMindset', label: '劳动思维' },
      { key: 'probabilityMindset', label: '概率思维' },
      { key: 'systemThinking', label: '系统思维' },
      { key: 'leverageMindset', label: '杠杆思维' },
      { key: 'capitalMindset', label: '资本思维' },
      { key: 'riskCognition', label: '风险认知' },
      { key: 'infoSensitivity', label: '信息敏感度' },
      { key: 'longTermism', label: '长期主义' },
      { key: 'decisionStability', label: '决策稳定性' }
    ];

    const ranked = dims.map(d => ({ ...d, value: scores[d.key] || 50 }));
    ranked.sort((a, b) => b.value - a.value);

    const top3 = ranked.slice(0, 3).map(d => d.label).join('、');
    const bottom3 = ranked.slice(-3).map(d => d.label).join('、');
    const avgScore = Math.round(ranked.reduce((s, d) => s + d.value, 0) / ranked.length);

    let persona = '';
    if (avgScore >= 75) persona = '你已是「认知觉醒者」——在系统思维和杠杆思维上展现出远超常人的洞察力。';
    else if (avgScore >= 60) persona = '你正在从「打工人」向「规则观察者」进化，已经隐约看清了游戏规则。';
    else if (avgScore >= 45) persona = '你还身处「困局打工人」的泥潭中，但每一条裂缝都透进了光。';
    else persona = '你的旧操作系统急需一次底层重装，而你已经踏出了最难的这一步。';

    // 为 5 大板块生成兜底文案
    const fallbackSections = [
      {
        key: 'trap', icon: '🔒', title: '你被什么系统困住',
        content: ranked.slice(-3).map(d => `「${d.label}」仅${d.value}分，这三大维度构成了你认知操作系统中最主要的锁定层。`).join(''),
        loading: false, loadingText: ''
      },
      {
        key: 'core', icon: '🎯', title: '真正的核心问题',
        content: `你的九维认知平均分数为${avgScore}分。在${bottom3}维度上的持续低分，表明你经常在这些领域的决策中陷入旧工业时代的思维惯性。`,
        loading: false, loadingText: ''
      },
      {
        key: 'path', icon: '🗺️', title: '翻身路径',
        content: `强化「${top3}」这三个你的核心武器维度，用你的长板去覆盖短板。不要面面俱到——找到你最锋利的刀，一刀劈开阶层天花板。`,
        loading: false, loadingText: ''
      },
      {
        key: 'action', icon: '⚡', title: '行动建议',
        content: avgScore >= 60
          ? '你已经拥有了核心武器。下一步不是更努力地内卷——而是找到你最强的那个维度，把它变成你的杠杆支点，然后用它撬动整个系统。每天至少花 30 分钟在你的最强维度上做深度积累。'
          : '别慌，破解阶层密码的第一步，就是看清自己在哪里弱。弱点不是羞耻，是精准修复的攻击面。每天在最弱的一个维度上做一个正 EV 决策，30 天后回头看你已经判若两人。',
        loading: false, loadingText: ''
      },
      {
        key: 'punch', icon: '💀', title: '致命一句',
        content: avgScore >= 60
          ? '你已经看见了规则。现在的问题是——你是想继续当一个看懂了规则的合格的赌客，还是成为一个制定规则的系统设计者？前者让你安全，后者让你自由。'
          : '你最大的风险不是你不努力。你最大的风险是你每天用体力上的勤奋，掩盖了认知上的懒惰。在旧地图上跑得再快，也到不了新大陆。你需要一次认知操作系统的底层升级。',
        loading: false, loadingText: ''
      }
    ];

    this.setData({
      sections: fallbackSections,
      reportTitle: '🛡️ 九维认知诊断报告（本地款）',
      reportMeta: '基于 30 天博弈行为数据 · AI 分析暂不可用，已启用本地引擎',
      persona,
      avgScore,
      dims: ranked
    });
  },

  // ═══ 辅助 ═══
  calcAvgScore: function () {
    const s = this.data.scores;
    if (!s) return 0;
    const vals = Object.values(s);
    if (!vals.length) return 0;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  },

  buildDimsArray: function () {
    const s = this.data.scores;
    if (!s) return [];
    const labels = {
      laborMindset: '劳动思维', probabilityMindset: '概率思维',
      systemThinking: '系统思维', leverageMindset: '杠杆思维',
      capitalMindset: '资本思维', riskCognition: '风险认知',
      infoSensitivity: '信息敏感度', longTermism: '长期主义',
      decisionStability: '决策稳定性'
    };
    return Object.entries(s).map(([key, value]) => ({
      key, label: labels[key] || key, value
    }));
  },

  parsePlainReport: function (text) {
    // 简单的文本 fallback：按双换行分块
    const result = {};
    const blocks = text.split(/\n{2,}/).filter(b => b.trim());
    if (blocks.length >= 1) result.trap = blocks[0];
    if (blocks.length >= 2) result.core = blocks[1];
    if (blocks.length >= 3) result.path = blocks[2];
    if (blocks.length >= 4) result.action = blocks[3];
    if (blocks.length >= 5) result.punch = blocks[4];
    if (blocks.length > 5) {
      result.summary = blocks.slice(5).join('\n\n');
    }
    return result;
  },

  // ═══ 交互 ═══
  handleRetry: function () {
    this._requesting = false;
    this.setData({
      status: 'shell',
      sections: SECTIONS.map(s => ({ ...s, content: '', loading: true, loadingText: s.skeleton })),
      reportTitle: '', reportMeta: '', persona: '', dims: [], avgScore: 0
    });
    this.onShow();
  },

  handleBack: function () {
    wx.switchTab({ url: '/pages/home/home' });
  },

  handleShare: function () {
    wx.navigateTo({ url: '/pages/share-poster/share-poster?source=ai-report' });
  },

  handleDimensionTap: function (e) {
    const dim = e.currentTarget.dataset.dim;
    wx.showToast({ title: dim + '详情开发中', icon: 'none' });
  }
});
