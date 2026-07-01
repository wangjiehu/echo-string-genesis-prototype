import fs from "node:fs";
import path from "node:path";
import { loadAppContext, summarizeSuite } from "./app_vm_harness.mjs";

const outputPath = process.argv[2] || "production/latest_1_0_0_report.json";
const visibilityPath = process.argv[3] || "production/latest_1_0_0_visibility_report.json";
const root = process.cwd();

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(path.resolve(root, filePath)), { recursive: true });
}

function compactReport(report) {
  return {
    completed: report.completed,
    mode: report.testMode,
    score: report.audit.score,
    grade: report.audit.grade,
    scans: report.metrics.scans,
    extracts: report.metrics.extracts,
    injects: report.metrics.injects,
    routeAssertions: report.metrics.routeAssertions.length,
    mistakes: report.summary.totalMistakes,
    bossPhaseCounters: report.metrics.bossPhaseCounters.length,
    reactions: report.metrics.reactions,
    checkpointSaves: report.metrics.checkpointSaves,
    checkpointRestores: report.metrics.checkpointRestores,
    feedbackEvents: report.metrics.feedbackEvents.length,
    failureEvents: report.metrics.failureEvents.length,
    experienceStatus: report.experience.status,
    experienceHeadline: report.experience.headline,
    experienceStrengths: report.experience.strengths,
    experienceFrictions: report.experience.frictions,
    playtestRisks: report.playtest?.risks || [],
    playtestCheckCount: report.playtest?.comprehensionChecks?.length || 0,
    z5DurationSec: report.playtest?.autoSignals?.z5DurationSec ?? null,
    bossCounterLabels: report.playtest?.autoSignals?.bossCounters?.map((item) => item.label) || [],
    failureLedger: report.failureLedger
  };
}

const { context } = loadAppContext();
const suite = context.window.__echoString.runRegressionSuite();
const summary = summarizeSuite(suite);
const failureAudit = context.window.__echoString.runFailureAudit();
const playerPathAudit = context.window.__echoString.runPlayerPathAudit();
const domClickReportPath = path.join(root, "production/latest_1_0_0_dom_click_report.json");
const domClickRegression = fs.existsSync(domClickReportPath)
  ? JSON.parse(fs.readFileSync(domClickReportPath, "utf8"))
  : null;
const visualSmokeReportPath = path.join(root, "production/latest_1_0_0_visual_smoke_report.json");
const visualSmoke = fs.existsSync(visualSmokeReportPath)
  ? JSON.parse(fs.readFileSync(visualSmokeReportPath, "utf8"))
  : null;
const guided = suite.reports.guided;
const low = suite.reports.low;
const generatedAt = new Date().toISOString();

const report = {
  project: guided.project,
  prototype: guided.prototype,
  uxBuild: suite.build,
  uxBuildName: guided.uxBuildName,
  source: "Node VM regression suite with guided and low-guidance routes",
  generatedAt,
  passed: suite.passed,
  rollout: guided.rollout,
  comparison: suite.comparison,
  failureAudit,
  playerPathAudit,
  domClickRegression,
  visualSmoke,
  validationCoverage: [
    "JSON解析与标签引用",
    "app/data一致性",
    "UI DOM合约",
    "双模式回归套件",
    "失败审计",
    "HTTP健康检查",
    "玩家反馈事件与体验审计",
    "真实可见路径审计",
    "真实DOM点击回归",
    "桌面/手机视觉Smoke",
    "低引导真人试玩观察包"
  ],
  reports: {
    guided: compactReport(guided),
    low: compactReport(low)
  },
  suiteSummary: summary
};

const visibility = {
  project: guided.project,
  prototype: guided.prototype,
  uxBuild: suite.build,
  uxBuildName: guided.uxBuildName,
  generatedAt,
  surfaces: [
    { surface: "resultPulse", status: "covered", note: "每次操作后显示成功、警告或阻塞反馈。" },
    { surface: "lowGuidanceLog", status: "covered", note: "低引导保留事件日志和行动反馈，不暴露完整步骤。" },
    { surface: "completionExperienceReview", status: "covered", note: "完成面板展示体验摩擦、整改线索和失败账本。" },
    { surface: "playtestObserverPack", status: "covered", note: "报告导出包含匿名试玩规则、理解追问、自动风险信号和观察者Markdown。" },
    { surface: "failureContext", status: "covered", note: "失败审计返回对象、词缀、原墨和词库上下文。" },
    { surface: "visiblePlayerPath", status: playerPathAudit.passed ? "covered" : "failed", note: "二次取空词、Z5词源误取和Boss核心裸露均被审计。" },
    { surface: "domClickRegression", status: domClickRegression?.passed ? "covered" : "missing", note: "通过真实浏览器DOM点击完成引导和低引导路线。" },
    { surface: "visualSmoke", status: visualSmoke?.passed ? "covered" : "missing", note: "桌面引导和手机低引导首屏无横向溢出，关键反馈可见，且存在可操作的首步入口。" },
    { surface: "vmRegression", status: suite.passed ? "covered" : "failed", note: "引导和低引导路线均完成到 Z7。" }
  ],
  metrics: {
    guidedFeedbackEvents: report.reports.guided.feedbackEvents,
    lowFeedbackEvents: report.reports.low.feedbackEvents,
    failureAuditEvents: failureAudit.failureEvents.length,
    playerPathChecks: playerPathAudit.checks.length,
    domClickPassed: Boolean(domClickRegression?.passed),
    visualSmokePassed: Boolean(visualSmoke?.passed),
    lowPlaytestRisks: report.reports.low.playtestRisks?.length ?? 0,
    lowPlaytestChecks: report.reports.low.playtestCheckCount ?? 0
  }
};

ensureParent(outputPath);
ensureParent(visibilityPath);
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
fs.writeFileSync(visibilityPath, `${JSON.stringify(visibility, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  report: outputPath,
  visibility: visibilityPath,
  build: suite.build,
  passed: suite.passed
}, null, 2));
