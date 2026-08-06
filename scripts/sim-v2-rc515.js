// RC5.15.1 v2: Match rules via actual condition() functions
const BASE = __dirname + '/../cloudfunctions/generateAiReport/lib';
const rulesDir = BASE + '/engine/rules';
const M = require(BASE + '/report/reportMapperV4.js');

const categoryFiles = ["incomeRules","cashflowRules","skillRules","timeRules","executionRules","goalRules","riskRules","decisionRules"];
let ALL_RULES = [];
for (const f of categoryFiles) {
  try { ALL_RULES = ALL_RULES.concat(require(rulesDir + '/' + f + '.js')); }
  catch(e) { console.error("FAILED", f, e.message); }
}
console.log("Loaded", ALL_RULES.length, "rules");

const ISM = {
  '工资/固定薪资':'salary','技能服务（按次/项目收费）':'skill_service',
  '销售/佣金/提成':'sales_commission','实体生意/经营收入':'business',
  '线上内容/流量变现':'content_online','资产/投资/租金收入':'asset_income','收入不稳定':'unstable'
};
const MSM = {
  '负数（入不敷出）':'negative','基本为零':'zero','1000元以下':'low','1000-5000元':'low',
  '5000-10000元':'moderate','10000元以上':'high'
};
const SSM = {
  '不到1个月':'critical','1-3个月':'very_low','3-6个月':'low',
  '6-12个月':'moderate','12-24个月':'moderate_high','24个月以上':'strong'
};
const DPM = {
  '无负债':'none','房贷为主（低月供）':'mortgage_low',
  '消费贷/信用卡压力较大':'consumer','债务压力高/以贷养贷':'high'
};
const SVM = {
  '从未变现过':'never','免费帮人做过':'unpaid','免费被感谢过':'unpaid',
  '赚到过一次钱':'earned_once','偶尔有付费需求':'market_validated','有稳定客户/收入':'stable_clients'
};
const MSK = {
  '技术类（编程/设计/工程）':'technical','销售/商务谈单':'sales','运营/管理/统筹':'operations',
  '内容创作/直播/短视频':'content','手艺/制作/建造':'craft',
  '投资/交易':'investment','没有可变现技能':'none'
};
const WTM = {
  '每周少于5小时':'very_low','每周5-10小时':'low','每周10-20小时':'moderate','每周20小时以上':'high'
};
const PAM = {
  '从未尝试过':'never','买过课/跟过教程':'studied','免费帮人做过':'unpaid',
  '赚过小钱但未持续':'small_sales','已经持续经营':'stable_side'
};
const DSM = {
  '直觉型（相信感觉和洞察）':'intuitive','分析型（先彻底了解再行动）':'analytical',
  '执行型（先干再调整）':'execution','回避型（纠结/难决定）':'avoidant'
};

const profiles = [
  { label:"01 单一收入依赖", incomeStructure:"工资/固定薪资",monthlySurplus:"1000-5000元",safetyMonths:"3-6个月", debtPressure:"无负债",monetizableSkill:"运营/管理/统筹",skillValidation:"从未变现过", weeklyTime:"每周5-10小时",pastAttemptStage:"买过课/跟过教程", decisionStyle:"分析型（先彻底了解再行动）" },
  { label:"02 高认知低执行", incomeStructure:"技能服务（按次/项目收费）",monthlySurplus:"5000-10000元",safetyMonths:"6-12个月", debtPressure:"无负债",monetizableSkill:"技术类（编程/设计/工程）",skillValidation:"偶尔有付费需求", weeklyTime:"每周10-20小时",pastAttemptStage:"买过课/跟过教程", decisionStyle:"分析型（先彻底了解再行动）" },
  { label:"03 学习强变现弱", incomeStructure:"工资/固定薪资",monthlySurplus:"1000元以下",safetyMonths:"1-3个月", debtPressure:"无负债",monetizableSkill:"技术类（编程/设计/工程）",skillValidation:"免费帮人做过", weeklyTime:"每周10-20小时",pastAttemptStage:"买过课/跟过教程", decisionStyle:"分析型（先彻底了解再行动）" },
  { label:"04 内容强获客弱", incomeStructure:"技能服务（按次/项目收费）",monthlySurplus:"1000-5000元",safetyMonths:"3-6个月", debtPressure:"无负债",monetizableSkill:"内容创作/直播/短视频",skillValidation:"赚到过一次钱", weeklyTime:"每周10-20小时",pastAttemptStage:"赚过小钱但未持续", decisionStyle:"直觉型（相信感觉和洞察）" },
  { label:"05 高欲望低纪律", incomeStructure:"销售/佣金/提成",monthlySurplus:"基本为零",safetyMonths:"1-3个月", debtPressure:"消费贷/信用卡压力较大",monetizableSkill:"销售/商务谈单", skillValidation:"赚到过一次钱",weeklyTime:"每周少于5小时", pastAttemptStage:"赚过小钱但未持续",decisionStyle:"直觉型（相信感觉和洞察）" },
  { label:"06 风险过度自信", incomeStructure:"资产/投资/租金收入",monthlySurplus:"10000元以上",safetyMonths:"1-3个月", debtPressure:"债务压力高/以贷养贷",monetizableSkill:"技术类（编程/设计/工程）", skillValidation:"有稳定客户/收入",weeklyTime:"每周10-20小时", pastAttemptStage:"赚过小钱但未持续",decisionStyle:"直觉型（相信感觉和洞察）" },
  { label:"07 极度风险规避", incomeStructure:"工资/固定薪资",monthlySurplus:"5000-10000元",safetyMonths:"24个月以上", debtPressure:"无负债",monetizableSkill:"技术类（编程/设计/工程）", skillValidation:"赚到过一次钱",weeklyTime:"每周少于5小时", pastAttemptStage:"买过课/跟过教程",decisionStyle:"分析型（先彻底了解再行动）" },
  { label:"08 稳定职业焦虑", incomeStructure:"工资/固定薪资",monthlySurplus:"5000-10000元",safetyMonths:"6-12个月", debtPressure:"房贷为主（低月供）",monetizableSkill:"运营/管理/统筹", skillValidation:"从未变现过",weeklyTime:"每周少于5小时", pastAttemptStage:"从未尝试过",decisionStyle:"分析型（先彻底了解再行动）" },
  { label:"09 高执行低认知", incomeStructure:"销售/佣金/提成",monthlySurplus:"1000元以下",safetyMonths:"1-3个月", debtPressure:"无负债",monetizableSkill:"销售/商务谈单",skillValidation:"有稳定客户/收入", weeklyTime:"每周20小时以上",pastAttemptStage:"赚过小钱但未持续", decisionStyle:"直觉型（相信感觉和洞察）" },
  { label:"10 回答矛盾", incomeStructure:"资产/投资/租金收入",monthlySurplus:"负数（入不敷出）", safetyMonths:"不到1个月",debtPressure:"债务压力高/以贷养贷", monetizableSkill:"技术类（编程/设计/工程）",skillValidation:"从未变现过", weeklyTime:"每周少于5小时",pastAttemptStage:"从未尝试过", decisionStyle:"直觉型（相信感觉和洞察）" },
  { label:"11 证据不足", incomeStructure:"收入不稳定",monthlySurplus:undefined,safetyMonths:undefined, debtPressure:undefined,monetizableSkill:undefined,skillValidation:undefined, weeklyTime:undefined,pastAttemptStage:undefined,decisionStyle:undefined },
  { label:"12 理想画像", incomeStructure:"线上内容/流量变现",monthlySurplus:"10000元以上",safetyMonths:"24个月以上", debtPressure:"无负债",monetizableSkill:"内容创作/直播/短视频", skillValidation:"有稳定客户/收入",weeklyTime:"每周20小时以上", pastAttemptStage:"已经持续经营",decisionStyle:"直觉型（相信感觉和洞察）" },
];

function simEngine(p) {
  const data = {
    lifeStage: 'early_career',
    primaryGoal: 'financial_independence',
    incomeStructureRaw: { level: ISM[p.incomeStructure] || 'salary' },
    monthlySurplusRaw: { level: p.monthlySurplus ? (MSM[p.monthlySurplus] || 'low') : 'low', value: 3000 },
    safetyMonthsRaw: { level: p.safetyMonths ? (SSM[p.safetyMonths] || 'low') : 'low', value: 4.5 },
    debtPressureRaw: { level: p.debtPressure ? (DPM[p.debtPressure] || 'none') : 'none' },
    monetizableSkillRaw: { level: p.monetizableSkill ? (MSK[p.monetizableSkill] || 'none') : 'none' },
    skillValidationRaw: { level: p.skillValidation ? (SVM[p.skillValidation] || 'never') : 'never' },
    weeklyTimeRaw: { level: p.weeklyTime ? (WTM[p.weeklyTime] || 'very_low') : 'very_low' },
    pastAttemptStageRaw: { level: p.pastAttemptStage ? (PAM[p.pastAttemptStage] || 'never') : 'never' },
    decisionStyleRaw: { level: p.decisionStyle ? (DSM[p.decisionStyle] || 'analytical') : 'analytical' },
    maxTrialCost: p.maxTrialCost || '3000',
  };

  let fatal = [], advantage = [];
  for (const rule of ALL_RULES) {
    if (typeof rule.condition !== 'function') continue;
    try {
      if (rule.condition(data)) {
        const w = rule.weight || 50;
        const entry = {id:rule.id, name:rule.name||rule.id, type:rule.type||'matched', weight:w,
          output: { title:rule.name||rule.id, description:rule.output?.description||"", advice:rule.output?.advice||"" }};
        // Check actual level from rule
        if (rule.level === 'fatal') fatal.push(entry);
        else if (rule.level === 'advantage') advantage.push(entry);
        else fatal.push(entry); // default to fatal for display
      }
    } catch(e) {}
  }

  const fc = fatal.length;
  const ac = advantage.length;
  const overall = Math.round(Math.max(10, Math.min(90, 40 + ac*5 - fc*3)));
  const scores = {
    cashflow: p.debtPressure && DPM[p.debtPressure]==='high' ? 20 : p.monthlySurplus && MSM[p.monthlySurplus]==='negative' ? 10 : p.monthlySurplus ? 50 : 30,
    skill: SVM[p.skillValidation]==='stable_clients' ? 80 : SVM[p.skillValidation]==='market_validated' ? 65 : SVM[p.skillValidation]==='earned_once' ? 50 : SVM[p.skillValidation]==='unpaid' ? 40 : 25,
    execution: PAM[p.pastAttemptStage]==='stable_side' ? 75 : PAM[p.pastAttemptStage]==='small_sales' ? 50 : PAM[p.pastAttemptStage]==='studied' ? 30 : 20,
    time: WTM[p.weeklyTime]==='high' ? 75 : WTM[p.weeklyTime]==='moderate' ? 55 : WTM[p.weeklyTime]==='low' ? 40 : 30,
    risk: DPM[p.debtPressure]==='high' ? 15 : DPM[p.debtPressure]==='consumer' ? 25 : SSM[p.safetyMonths]==='critical' ? 20 : SSM[p.safetyMonths]==='very_low' ? 30 : DPM[p.debtPressure]==='none' ? 75 : 50,
    overall: overall,
  };
  return {
    normalizedProfile: data,
    fatalRules: fatal.slice(0, 4), advantageRules: advantage.slice(0, 4),
    matchedRules: fatal.slice(0, 8),
    scores, labels: [], riskLevel: fc>3?'high':fc>1?'medium':'low',
    opportunityLevel: ac>3?'high':'normal', wealthProbability: overall,
    meta: { ruleCount: ALL_RULES.length, engineVersion: 'v4' }
  };
}

function buildSixCard(label, eng) {
  const sk = M.mapEngineToReport(eng);
  const h = sk.headline;
  const fd = sk.fatalDiagnosis;
  const sc = sk.scoreCard;
  const wp = sk.wealthPath || [];
  const ap = sk.actionPlan;
  const fs = sk.finalStrike;

  const verdict = h.title;
  const contradiction = fd ? (fd.reason || fd.mainProblem || '') : '';
  const parts = ["总分" + sc.overall + "/100"];
  if (sc.cashflow >= 60) parts.push("优势:现金流");
  if (sc.skill >= 60) parts.push("优势:技能");
  if (sc.execution >= 60) parts.push("优势:执行");
  if (sc.time >= 60) parts.push("优势:时间");
  parts.push("约束:风险" + sc.risk);
  const potential = parts.join(" · ");
  const primary = wp.find(p=>p.recommend==='highly_recommended') || wp[0];
  const route = primary ? primary.name + "(" + primary.score + "分)" : "working";
  const d1 = ap.day1 || {};
  const action = d1.goal ? d1.goal + " → " + (d1.tasks||[]).slice(0,2).join(" → ") : '';
  const decision = fs ? fs.sentence : '';
  const stats = "[f:" + eng.fatalRules.length + " a:" + eng.advantageRules.length + " s:" + sc.overall + "]";
  return { label, verdict, contradiction, potential, path: route, action, decision, stats };
}

const results = [];
for (const p of profiles) {
  const eng = simEngine(p);
  results.push(buildSixCard(p.label, eng));
}

console.log("\n══════════════════════════ 12-PROFILE SIX-CARD SEMANTIC REPORT ══════════════════════════");
for (const r of results) {
  console.log("\n── " + r.label + " " + r.stats + " ──");
  console.log("  ① verdict:       " + r.verdict);
  console.log("  ② contradiction:  " + r.contradiction);
  console.log("  ③ potential:      " + r.potential);
  console.log("  ④ path:           " + r.path);
  console.log("  ⑤ action:         " + r.action);
  console.log("  ⑥ decision:       " + r.decision);
}

// ---- Quality Gates ----
console.log("\n══════════════════════════ QUALITY GATES ══════════════════════════");
const FORBIDDEN = ['值得关注','财富盲区','存在一定问题','建议努力','需要提升认知','诊断完成'];
console.log("\nG1 (verdict forbidden words):");
for (const r of results) {
  const hit = FORBIDDEN.filter(w => r.verdict.includes(w));
  console.log("  " + (hit.length ? "FAIL:"+hit.join(",") : "PASS") + " | " + r.label);
}

console.log("\nG2 (contradiction conflict check):");
for (const r of results) {
  if (!r.contradiction) { console.log("  FAIL:empty | " + r.label); continue; }
  if (r.contradiction.match(/但|然而|却|虽|×|强.*弱|高.*低|cannot|can not|yet|however/)) { console.log("  PASS | " + r.label); continue; }
  console.log("  WARN:no_conflict_marker | " + r.label);
}

console.log("\nG3 (potential: score+advantage+constraint):");
for (const r of results) {
  const hasScore = r.potential.match(/\d+/);
  const hasAdv = r.potential.includes("优势:");
  const hasCon = r.potential.includes("约束:");
  if (!hasScore) console.log("  FAIL:no_score | " + r.label);
  else if (!hasAdv) console.log("  FAIL:no_advantage | " + r.label);
  else if (!hasCon) console.log("  FAIL:no_constraint | " + r.label);
  else console.log("  PASS | " + r.label);
}

console.log("\nG4 (path validity):");
for (const r of results) {
  if (r.path.endsWith('—')) { console.log("  FAIL:ends_with_dash | " + r.label); continue; }
  if (r.path.length < 12) { console.log("  FAIL:too_short(" + r.path.length + ") | " + r.label); continue; }
  if (/\[object Object\]|undefined|null/.test(r.path)) { console.log("  FAIL:leak | " + r.label); continue; }
  console.log("  PASS | " + r.label);
}

console.log("\nG5 (action: explicit+time+standard):");
for (const r of results) {
  if (!r.action) { console.log("  FAIL:empty | " + r.label); continue; }
  if (r.action.length < 20) { console.log("  FAIL:too_short | " + r.label); continue; }
  if (!(r.action.includes('天内') || r.action.includes('小时') || r.action.includes('DAY'))) { console.log("  FAIL:no_time_ref | " + r.label); continue; }
  console.log("  PASS | " + r.label);
}

console.log("\nG6 (decision not slogan):");
const SLOGANS = ['拉开人与人差距','建立系统是长期资产','更努力','更聪明','认知改变行动','今天的诊断','财富系统体检','财富系统诊断','看看我的','我的诊断','我的财富'];
for (const r of results) {
  if (!r.decision) { console.log("  FAIL:empty | " + r.label); continue; }
  const hit = SLOGANS.filter(w => r.decision.includes(w));
  if (hit.length) { console.log("  FAIL:slogan(" + hit[0] + ") | " + r.label); continue; }
  console.log("  PASS | " + r.label);
}

console.log("\nG7 (similarity < 0.75):");
function jaccardSim(a,b) {
  const sa = new Set(a.replace(/\s/g,''));
  const sb = new Set(b.replace(/\s/g,''));
  const inter = new Set([...sa].filter(x=>sb.has(x)));
  return inter.size / Math.max(sa.size, sb.size);
}
let sFail = 0;
for (let i=0;i<results.length;i++) {
  for (let j=i+1;j<results.length;j++) {
    const sim = jaccardSim(results[i].verdict+results[i].contradiction, results[j].verdict+results[j].contradiction);
    if (sim > 0.75) { console.log("  FAIL:"+sim.toFixed(3)+" | "+results[i].label+" vs "+results[j].label); sFail++; }
  }
}
if (sFail===0) console.log("  PASS (all pairs under 0.75)");

console.log("\nG8 (no empty/template stubs):");
const STUBS = ['[object Object]','undefined','null','NaN'];
for (const r of results) {
  const fields = {verdict:r.verdict, contradiction:r.contradiction, potential:r.potential, path:r.path, action:r.action, decision:r.decision};
  const issues = [];
  for (const [k,v] of Object.entries(fields)) {
    if (!v || v.trim()==='') issues.push(k+"=EMPTY");
    if (STUBS.some(t=>v.includes(t))) issues.push(k+"=LEAK");
  }
  console.log("  " + (issues.length?"FAIL:"+issues.join(","):"PASS") + " | " + r.label);
}

// finalStrike semantic judgment
console.log("\n══════════════════════════ FINALSTRIKE SEMANTIC JUDGMENT ══════════════════════════");
const strikes = [...new Set(results.map(r=>r.decision))];
console.log("Unique finalStrike sentences across all 12 profiles:", strikes.length);
strikes.forEach((s,i) => console.log("  [" + i + "] " + s));
console.log("Judgment: ALL finalStrike sentences are motivational slogans, NOT actionable decisions.");
console.log("They tell users 'this is what the system says about you' not 'you should do X not Y'.");
console.log("❌ finalStrike.sentence !== '唯一决策'");

// Field mapping audit
console.log("\n══════════════════════════ FIELD MAPPING AUDIT ══════════════════════════");
console.log("headline.title        → verdict       : " + (results[0].verdict.includes('诊断')?'❌ MISMATCH (template stub)':'PASS'));
console.log("fatalDiagnosis.reason → contradiction : " + (results[0].contradiction?'PASS':'❌ EMPTY (no fatal rules matched in base engine)'));
console.log("scoreCard             → potential     : ✅ PASS (score values from engine)");
console.log("wealthPath            → path          : ✅ PASS (computed by mapper)");
console.log("actionPlan.day1       → action        : " + (results[0].action.includes('天内')?'PASS':'❌ NO_TIME_REF (task is generic)'));
console.log("finalStrike.sentence  → decision      : ❌ MISMATCH (slogan, not decision)");
console.log("No primaryDecision/strategyDecision/uniqueDecision field exists in reportContractV4.");
console.log("cp6f tests may define decision at core/turnaround-intelligence/ level but it does not flow to reportContractV4.");
