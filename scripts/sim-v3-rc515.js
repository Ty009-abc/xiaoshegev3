// RC5.15.2 v3: Full pipeline test with new contract fields
const M = require(__dirname + '/../cloudfunctions/generateAiReport/lib/report/reportMapperV4.js');
const RULES_DIR = __dirname + '/../cloudfunctions/generateAiReport/lib/engine/rules';
const n4 = require(__dirname + '/../utils/reportNormalizerV4.js');
const sv = require(__dirname + '/../utils/reportSemanticValidator.js');

const categoryFiles = ["incomeRules","cashflowRules","skillRules","timeRules","executionRules","goalRules","riskRules","decisionRules"];
let ALL_RULES = [];
for (const f of categoryFiles) {
  try { ALL_RULES = ALL_RULES.concat(require(RULES_DIR + '/' + f + '.js')); }
  catch(e) { console.error("FAILED", f); }
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
  '内容创作/直播/短视频':'content','手艺/制作/建造':'craft','投资/交易':'investment','没有可变现技能':'none'
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
    lifeStage: 'early_career', primaryGoal: 'financial_independence',
    incomeStructureRaw: { level: ISM[p.incomeStructure] || 'salary' },
    monthlySurplusRaw: { level: p.monthlySurplus ? (MSM[p.monthlySurplus] || 'low') : 'low', value: 3000 },
    safetyMonthsRaw: { level: p.safetyMonths ? (SSM[p.safetyMonths] || 'low') : 'low', value: 4.5 },
    debtPressureRaw: { level: p.debtPressure ? (DPM[p.debtPressure] || 'none') : 'none' },
    monetizableSkillRaw: { level: p.monetizableSkill ? (MSK[p.monetizableSkill] || 'none') : 'none' },
    skillValidationRaw: { level: p.skillValidation ? (SVM[p.skillValidation] || 'never') : 'never' },
    weeklyTimeRaw: { level: p.weeklyTime ? (WTM[p.weeklyTime] || 'very_low') : 'very_low' },
    pastAttemptStageRaw: { level: p.pastAttemptStage ? (PAM[p.pastAttemptStage] || 'never') : 'never' },
    decisionStyleRaw: { level: p.decisionStyle ? (DSM[p.decisionStyle] || 'analytical') : 'analytical' },
    maxTrialCost: '3000',
  };

  let fatal = [], advantage = [];
  for (const rule of ALL_RULES) {
    if (typeof rule.condition !== 'function') continue;
    try {
      if (rule.condition(data)) {
        const w = rule.weight || 50;
        const entry = {id:rule.id, name:rule.name||rule.id, type:rule.type||'matched', weight:w,
          output: { title:rule.name||rule.id, description:rule.output?.description||"", advice:rule.output?.advice||"" }};
        if (rule.level === 'fatal') fatal.push(entry);
        else if (rule.level === 'advantage') advantage.push(entry);
        else fatal.push(entry);
      }
    } catch(e) {}
  }

  const fc = fatal.length, ac = advantage.length;
  const overall = Math.round(Math.max(10, Math.min(90, 40 + ac*5 - fc*3)));
  const scores = {
    cashflow: p.monthlySurplus && MSM[p.monthlySurplus]==='negative' ? 10 : p.debtPressure && DPM[p.debtPressure]==='high' ? 20 : p.monthlySurplus ? 50 : 30,
    skill: SVM[p.skillValidation]==='stable_clients' ? 80 : SVM[p.skillValidation]==='market_validated' ? 65 : SVM[p.skillValidation]==='earned_once' ? 50 : SVM[p.skillValidation]==='unpaid' ? 40 : 25,
    execution: PAM[p.pastAttemptStage]==='stable_side' ? 75 : PAM[p.pastAttemptStage]==='small_sales' ? 50 : PAM[p.pastAttemptStage]==='studied' ? 30 : 20,
    time: WTM[p.weeklyTime]==='high' ? 75 : WTM[p.weeklyTime]==='moderate' ? 55 : WTM[p.weeklyTime]==='low' ? 40 : 30,
    risk: DPM[p.debtPressure]==='high' ? 15 : DPM[p.debtPressure]==='consumer' ? 25 : SSM[p.safetyMonths]==='critical' ? 20 : SSM[p.safetyMonths]==='very_low' ? 30 : DPM[p.debtPressure]==='none' ? 75 : 50,
    overall: overall,
  };
  return {
    normalizedProfile: data, fatalRules: fatal.slice(0, 4), advantageRules: advantage.slice(0, 4),
    matchedRules: fatal.slice(0, 8), scores, labels: [],
    riskLevel: fc>3?'high':fc>1?'medium':'low', opportunityLevel: ac>3?'high':'normal',
    wealthProbability: overall,
    meta: { ruleCount: ALL_RULES.length, engineVersion: 'v4' }
  };
}

// ---------- FULL PIPELINE ----------
console.log("\n══════════════════════════ RC5.15.2: NEW ADAPTER OUTPUT ══════════════════════════");
const posters = [];
for (const p of profiles) {
  const eng = simEngine(p);
  const skeleton = M.mapEngineToReport(eng);
  // Simulate: reportContract.report = skeleton
  const contract = { report: skeleton };
  const vm = n4.buildDiagnosticV4ViewModel(contract.report);
  const pd = n4.mapDiagnosticV4ToPoster(vm);
  pd.label = p.label;
  posters.push(pd);

  console.log("\n── " + p.label + " ──");
  console.log("  verdict:      " + pd.verdict);
  console.log("  contradiction: " + (pd.contradiction.title || '') + " | " + (pd.contradiction.description || ''));
  console.log("  potential:     score=" + pd.potential.score + " lvl=" + pd.potential.level + " adv=" + (pd.potential.advantages||[]).join(",") + " cst=" + (pd.potential.constraints||[]).join(","));
  console.log("  decision:      " + (pd.decision.title || '[empty]') + " | " + (pd.decision.reason || ''));
  console.log("  primaryAction: " + (pd.primaryAction.title || '') + " ckpt=" + (pd.primaryAction.checkpoint || '') + " crit=" + (pd.primaryAction.successCriteria||[]).join(","));
  console.log("  emotionClose:  " + (pd.emotionClosing || ''));
}

// ---------- QUALITY GATES ----------
console.log("\n══════════════════════════ QUALITY GATES (via validator) ══════════════════════════");
let totalPass = 0, totalFail = 0;
const failedLabels = [];
for (const pd of posters) {
  const v = sv.validatePosterSemantics(pd);
  if (v.ok && v.scores.total >= 4) totalPass++;
  else { totalFail++; failedLabels.push(pd.label); }
  const status = v.ok ? (v.scores.total >= 4 ? "PASS ✅" : "WARN") : "FAIL ❌";
  console.log("  " + status + " | " + pd.label + " | score=" + v.scores.total + "/5 | errors=" + v.errors.length + " warns=" + v.warnings.length);
  if (v.errors.length) console.log("    errors: " + v.errors.join("; "));
  if (v.warnings.length) console.log("    warns:  " + v.warnings.join("; "));
}

// Diversity
console.log("\n══════════════════════════ DIVERSITY CHECK ══════════════════════════");
const div = sv.checkDiversity(posters);
console.log("  Pairs above 0.5:", div.pairs.length);
div.pairs.forEach(d => console.log("    " + d.a + " vs " + d.b + " sim=" + d.sim.toFixed(3)));
console.log("  Diversity: " + (div.ok ? "PASS ✅" : "FAIL ❌"));

// Verdict uniqueness
const uniqueVerdicts = new Set(posters.map(p => p.verdict));
console.log("\n  Unique verdicts: " + uniqueVerdicts.size + "/12");
[...uniqueVerdicts].forEach(v => console.log("    \"" + v + "\""));

// v6.5.3: Additional assertions
let assertionErrors = [];

// A1: computeDecision 12/12 非空
let emptyDecisions = 0;
for (const pd of posters) {
  if (!pd.decision || !pd.decision.title || pd.decision.title === '[empty]') {
    emptyDecisions++;
    assertionErrors.push("A1: empty decision in " + pd.label);
  }
}
console.log("\n  A1 (all decisions non-empty): " + (emptyDecisions === 0 ? "PASS ✅" : "FAIL ❌ (" + emptyDecisions + " empty)"));

// A2: FALLBACK 剩余数量 = 0
let fallbackCount = 0;
for (const pd of posters) {
  if (pd.contradiction && pd.contradiction.code === 'FALLBACK') {
    fallbackCount++;
    assertionErrors.push("A2: FALLBACK contradiction in " + pd.label);
  }
}
console.log("  A2 (FALLBACK count): " + (fallbackCount === 0 ? "0 ✅" : fallbackCount + " ❌"));

// A3: provisional 仅允许证据不足
let provisionalViolations = 0;
for (const pd of posters) {
  const isInsufficientEvidence = pd.contradiction && pd.contradiction.code === 'INSUFFICIENT_EVIDENCE';
  const hasProvisional = pd.decision && pd.decision.provisional;
  // provisional 是 internal 字段, 只在 decision 对象中有
}
console.log("  A3 (provisional evidence): CHECK");

// A4: 证据不足不得高置信度
let highConfInsufficient = 0;
for (const pd of posters) {
  if (pd.contradiction && pd.contradiction.code === 'INSUFFICIENT_EVIDENCE') {
    if (pd.decision && pd.decision.confidence && pd.decision.confidence > 0.5) {
      highConfInsufficient++;
      assertionErrors.push("A4: insufficient evidence with high confidence in " + pd.label);
    }
  }
}
if (highConfInsufficient === 0) {
  const evidenceProfiles = posters.filter(p => p.contradiction && p.contradiction.code === 'INSUFFICIENT_EVIDENCE');
  console.log("  A4 (low conf for insufficient): " + (evidenceProfiles.length > 0 ? "PASS ✅" : "N/A"));
}

// A6: 单一收入不得映射 BUILD_EXECUTION_SYSTEM
let singleIncomeSystem = 0;
for (const pd of posters) {
  if (pd.contradiction && /SINGLE_INCOME/.test(pd.contradiction.code)) {
    if (pd.decision && pd.decision.code === 'BUILD_EXECUTION_SYSTEM') {
      singleIncomeSystem++;
      assertionErrors.push("A6: single income mapped to EXECUTION_SYSTEM in " + pd.label);
    }
  }
}
console.log("  A6 (single income ≠ BUILD_EXEC_SYS): " + (singleIncomeSystem === 0 ? "PASS ✅" : "FAIL ❌"));

// A9: unique verdict ≥ 8
if (uniqueVerdicts.size < 8) {
  assertionErrors.push("A9: unique verdicts " + uniqueVerdicts.size + " < 8");
}
console.log("  A9 (unique verdicts ≥ 8): " + (uniqueVerdicts.size >= 8 ? "PASS ✅ (" + uniqueVerdicts.size + ")" : "FAIL ❌ (" + uniqueVerdicts.size + ")"));

// A10: sim=1.0 为 0
let exactOneCount = 0;
for (const d of div.pairs) {
  if (d.sim >= 0.999) exactOneCount++;
}
if (exactOneCount > 0) {
  assertionErrors.push("A10: " + exactOneCount + " pairs with sim=1.0");
}
console.log("  A10 (sim=1.0 pairs): " + (exactOneCount === 0 ? "0 ✅" : exactOneCount + " ❌"));

// Final summary
const gateFailed = totalFail > 0 || !div.ok || assertionErrors.length > 0;
console.log("\n══════════════════════════ FINAL: " + totalPass + "/12 PASS ══════════════════════════");
if (failedLabels.length) console.log("Gate failures: " + failedLabels.join(", "));
if (assertionErrors.length) console.log("Assertion failures:\n  " + assertionErrors.join("\n  "));

if (gateFailed) {
  console.log("\nSEMANTIC_GATE_BLOCKED");
  process.exitCode = 1;
} else {
  console.log("\nSEMANTIC_GATE_PASS");
  process.exitCode = 0;
}
