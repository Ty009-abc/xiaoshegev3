#!/usr/bin/env node
/**
 * importRules.js — 世界运行规则军火库 · 第一批扩容导入
 * 
 * 运行方式：在云函数可访问的环境或通过 HTTP API 注入
 * 
 * ⚠️ 本脚本通过云函数代理写入，避免客户端直连数据库的转义死锁问题。
 *    实际注入由 writeRules 云函数承接。
 * 
 * 运行：node importRules.js
 */

const RULES_BATCH_1 = [
  {
    ruleId: 'WR101',
    title: '工业社会的努力陷阱',
    rule: '传统操作系统的底层逻辑，是通过"时间×体力"向雇主兜售高确定性的初级劳动力。系统最精妙的剪刀差在于：不断利用通胀缩减你的储蓄，同时用"考证、内卷、资历"将你的精力锁死在边际效益递减的轨道上，从而阻断你构建属于自己的内容与代码杠杆。',
    reverseLogic: '如果努力=回报，为什么流水线工人和基金经理同样工作8小时，收入差距100倍？因为前者兜售的是可替代的体力，后者兜售的是不可替代的判断力。系统的精妙之处在于让前者相信自己只是"不够努力"。',
    example: '一个人加班到凌晨，老板夸赞敬业，第二天继续加班。另一个人用 AI 写完当天代码后，晚上在搭建自己的 SaaS 产品。前者在系统内精疲力竭，后者在系统外搭建杠杆。三年后，前者被优化，后者有了自己的资产。',
    action: '今天写下你工作时长的比例分配：有多少时间在"完成系统给你的任务"，有多少时间在"搭建属于你自己的系统"？如果后者低于20%，从今天开始调整。',
    category: 'system',
    tags: ['资本剪刀差', '劳动力经济学', '通胀陷阱', '杠杆觉醒'],
    unlockLevel: 'free',
    status: 'active',
  },
  {
    ruleId: 'WR102',
    title: '大数定律下的抽水逻辑',
    rule: '凡是依靠"运气"和"大数法则"支配的牌桌，庄家的胜率哪怕只比你高出 1.5%，在无限次的下注循环中，你的本金都必然会归零。弱者试图用"运气"去击败不可控的概率，而强者只在属于自己的正 EV（正期望值）系统里，通过无限重复执行来收割确定性复利。',
    reverseLogic: '如果赌场会亏钱，为什么澳门每个赌场都在赚钱？因为庄家不是跟你对赌——庄家是在收取数学税。你在赔率表上看到的每一场独立游戏，庄家都拥有不可动摇的数学优势。你不是"运气不好"，你是"在负 EV 的游戏里待得太久"。',
    example: '一个人连续去澳门三年，每年输10万——他归因于"手气"。另一个人把10万投入ETF定投，每年获得7%年化——他归因于系统。三年后，前者净亏30万+时间成本，后者净赚复合增长+认知升级。',
    action: '审视你过去一年的所有"赌"的行为：包括投机性投资、盲目跟风项目、赌博性质的消费。写下每一笔的"你的期望值计算"，看有多少笔是在负EV游戏里投入的。',
    category: 'probability',
    tags: ['正EV', '期望值', '大数定律', '概率思维', '庄家思维'],
    unlockLevel: 'free',
    status: 'active',
  },
  {
    ruleId: 'WR103',
    title: '出卖时间 vs 复制边际成本',
    rule: 'AI 时代的核心分水岭是：你是在使用体力被动执行系统的指令，还是在用 AI 批量生产内容资产与自动化代码？前者的边际生产成本是恒定的，后者通过数字互联网可以被无限次零成本分发、放大。用 AI 代替自己干活，本质上是把时间从"单次售卖"升级为"无限复利复制"。',
    reverseLogic: '如果一个顶级的体力劳动者（如外科医生），一天最多能做4台手术。但如果他把手术经验写成AI辅助诊断系统，这个系统可以被一百万次使用。同样的知识，不同的杠杆系数。你不是在"用AI偷懒"，你是在把你的认知进行一次"数字铸造"。',
    example: '一个设计师一天最多做3个LOGO，月入2万。另一个设计师用AI批量生成LOGO模板库，定价99元订阅，卖了5000份。前者在售卖时间，后者在售卖数字资产。两者的核心区别不是AI能力，而是"对杠杆的认知"。',
    action: '今天问自己：你的核心技能是否可以"一次生产、无限复制"？如果能，列出你可以数字化的最小可行产品（MCP）。如果不能，思考如何叠加AI让它变得可复制。',
    category: 'leverage',
    tags: ['数字杠杆', '边际成本', 'AI工具', '内容资产', '自动化'],
    unlockLevel: 'free',
    status: 'active',
  },
  {
    ruleId: 'WR104',
    title: '执行力执行了错误的逻辑',
    rule: '当一个人的底层操作系统过时了（例如坚信"努力就能翻身"的幻觉），他的执行力越强，在体力内卷系统里的年龄贬值就越快。大厨师颠勺20年不会跑，现在却说自己执行力差。真正的核心问题不是不努力，而是用极度的身体勤奋掩盖了深度思考的懒惰，拒绝使用工具杠杆更新认知版本。',
    reverseLogic: '如果执行力是核心竞争力，那么全中国最富有的人应该是建筑工人和富士康流水线普工。但事实正好相反——顶层玩家往往"看起来不那么忙"，因为他们把时间花在了系统设计和认知升级上，而不是执行重复劳动。',
    example: '一个人每天工作12小时，周末也不休息，但十年后仍然月薪8000。另一个人每天花2个小时学习新技能、搭建被动收入管道，三年后月入3万。前者用"我很忙"安慰自己，后者用"我在升级"兑现未来。努力没错，但"在错误的轨道上努力"是在给自己的认知缺陷交加速折旧税。',
    action: '今天做一个"认知审计"：写下你最近三年一直在重复但没有实质性突破的一件事。问自己：是我不够努力，还是我的方法本身就是旧版本的系统逻辑？',
    category: 'cognition',
    tags: ['认知升级', '执行力陷阱', '系统版本', '深度思考', '工具杠杆'],
    unlockLevel: 'free',
    status: 'active',
  },
];

/**
 * 通过云函数代理写入，复用 generateAiReport 云函数所在的环境。
 * 
 * 最优方案：临时在 cloudfunctions/ 下创建 writeWorldRules 或者
 * 直接通过现有的 admin 接口注入。
 * 
 * 本脚本首选的注入路径：
 *   1. 如果有 admin 云函数支持 world_rules 写入 → 直接调用
 *   2. 否则 → 生成 JSON 推送文件，在微信 IDE 中手动导入
 */
async function main() {
  console.log('🧬 珠澳小事哥 · 世界规则军火库 v1.0');
  console.log(`   待注入规则: ${RULES_BATCH_1.length} 条`);
  console.log('');

  // 输出完整 JSON 到文件，作为手动导入或云函数注入的 payload
  const fs = require('fs');
  const path = require('path');

  const payload = {
    batch: 1,
    source: 'importRules.js · 系统与概率篇',
    timestamp: new Date().toISOString(),
    rules: RULES_BATCH_1,
  };

  const outputDir = path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'world_rules_batch1.json');
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf-8');

  console.log(`📦 Payload 已写入: ${outputPath}`);
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('  第一批规则清单：');
  console.log('═══════════════════════════════════════');
  RULES_BATCH_1.forEach((r, i) => {
    console.log(`  ${i + 1}. [${r.category}] ${r.title}`);
    console.log(`     ID: ${r.ruleId} | Tags: ${r.tags.join(', ')}`);
  });
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('  注入方案：');
  console.log('═══════════════════════════════════════');
  console.log('  方案A（推荐）：通过云函数 writeWorldRules 注入');
  console.log('    1. 检查 cloudfunctions/writeWorldRules 是否已部署');
  console.log('    2. 如果已部署 → 在当前目录已生成 payload，可直接注入');
  console.log('  方案B：微信 IDE 手动导入');
  console.log(`    文件路径: ${outputPath}`);
  console.log('    在微信云开发控制台 → 数据库 → world_rules → 导入');
  console.log('');

  // 尝试方案 A：如果 wx-server-sdk 可用，直接写入
  try {
    const cloud = require('wx-server-sdk');
    cloud.init({ env: 'fanshex-d2g0adgv7dfbc9bdc' });
    const db = cloud.database();
    const _ = db.command;

    console.log('⚡ 方案A：尝试通过 wx-server-sdk 直接写入...');

    const collection = db.collection('world_rules');
    let successCount = 0;
    let skipCount = 0;

    for (const rule of RULES_BATCH_1) {
      // 检查是否已存在
      const existing = await collection.where({ ruleId: rule.ruleId }).get();

      if (existing.data && existing.data.length > 0) {
        console.log(`  ⏭ 跳过已存在: ${rule.ruleId} — ${rule.title}`);
        skipCount++;
        continue;
      }

      // 写入新规则
      await collection.add({
        data: {
          ...rule,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      console.log(`  ✅ 注入成功: ${rule.ruleId} — ${rule.title}`);
      successCount++;
    }

    console.log('');
    console.log('═══════════════════════════════════════');
    console.log(`  🎉 军火库到账报告`);
    console.log('═══════════════════════════════════════');
    console.log(`  ✅ 成功注入: ${successCount} 条`);
    console.log(`  ⚠️  跳过重复: ${skipCount} 条`);
    console.log(`  📊 总计处理: ${successCount + skipCount}/${RULES_BATCH_1.length} 条`);
    console.log('');
  } catch (sdkErr) {
    console.log('⚠️  wx-server-sdk 不可用（非云函数环境）');
    console.log(`   错误: ${sdkErr.message.substring(0, 80)}`);
    console.log('');
    console.log('🔄 切换到方案B：已生成 JSON 文件，请在微信云开发控制台手动导入');
    console.log(`   文件: ${outputPath}`);
    console.log('');
  }
}

main().catch(console.error);
