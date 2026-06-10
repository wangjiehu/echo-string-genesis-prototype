param(
  [string]$ReportPath = "production\latest_mode_report.json",
  [string]$OutputPath = "production\latest_mode_summary.md"
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Resolve-ProjectPath {
  param([string]$Path)
  if ([System.IO.Path]::IsPathRooted($Path)) {
    return $Path
  }
  return Join-Path $root $Path
}

function Format-Time {
  param([int]$Seconds)
  $minutes = [Math]::Floor($Seconds / 60)
  $remaining = $Seconds % 60
  return ("{0}:{1:D2}" -f $minutes, $remaining)
}

function Format-OptionalTime {
  param($Seconds)
  if ($null -eq $Seconds) {
    return "-"
  }
  return Format-Time ([int]$Seconds)
}

function Add-Line {
  param(
    [System.Collections.Generic.List[string]]$Lines,
    [string]$Text = ""
  )
  $Lines.Add($Text) | Out-Null
}

$resolvedReport = Resolve-ProjectPath $ReportPath
$resolvedOutput = Resolve-ProjectPath $OutputPath

if (-not (Test-Path -LiteralPath $resolvedReport)) {
  Write-Error "Report not found: $resolvedReport"
  exit 1
}

$report = Get-Content -LiteralPath $resolvedReport -Raw | ConvertFrom-Json
$lines = [System.Collections.Generic.List[string]]::new()

if ($report.reports -and $report.reports.guided -and $report.reports.low) {
  Add-Line $lines "# 回归套件报告摘要"
  Add-Line $lines ""
  Add-Line $lines "生成时间：$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
  Add-Line $lines "报告来源：``$ReportPath``"
  Add-Line $lines ""
  Add-Line $lines "## 1. 总览"
  Add-Line $lines ""
  Add-Line $lines "| 项目 | 数值 |"
  Add-Line $lines "| --- | --- |"
  Add-Line $lines "| 构建 | $($report.uxBuild) |"
  Add-Line $lines "| 套件通过 | $($report.passed) |"
  Add-Line $lines "| 引导质量 | $($report.reports.guided.grade) / $($report.reports.guided.score) |"
  Add-Line $lines "| 低引导质量 | $($report.reports.low.grade) / $($report.reports.low.score) |"
  Add-Line $lines "| 引导误操作 | $($report.reports.guided.mistakes) |"
  Add-Line $lines "| 低引导误操作 | $($report.reports.low.mistakes) |"
  Add-Line $lines ""
  Add-Line $lines "## 2. 双模式指标"
  Add-Line $lines ""
  Add-Line $lines "| 模式 | 完成 | 扫描 | 剥离 | 注入 | 断言 | Boss反制 | 组合反应 | 反馈事件 | 失败事件 | 体验状态 |"
  Add-Line $lines "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"
  Add-Line $lines "| 引导 | $($report.reports.guided.completed) | $($report.reports.guided.scans) | $($report.reports.guided.extracts) | $($report.reports.guided.injects) | $($report.reports.guided.routeAssertions) | $($report.reports.guided.bossPhaseCounters) | $($report.reports.guided.reactions) | $($report.reports.guided.feedbackEvents) | $($report.reports.guided.failureEvents) | $($report.reports.guided.experienceStatus) |"
  Add-Line $lines "| 低引导 | $($report.reports.low.completed) | $($report.reports.low.scans) | $($report.reports.low.extracts) | $($report.reports.low.injects) | $($report.reports.low.routeAssertions) | $($report.reports.low.bossPhaseCounters) | $($report.reports.low.reactions) | $($report.reports.low.feedbackEvents) | $($report.reports.low.failureEvents) | $($report.reports.low.experienceStatus) |"
  Add-Line $lines ""
  Add-Line $lines "## 3. 推进账本"
  Add-Line $lines ""
  Add-Line $lines "| 版本 | 重点 |"
  Add-Line $lines "| --- | --- |"
  foreach ($item in @($report.rollout)) {
    Add-Line $lines "| $($item.version) | $($item.focus) |"
  }
  if ($report.failureAudit) {
    Add-Line $lines ""
    Add-Line $lines "## 4. 失败审计"
    Add-Line $lines ""
    Add-Line $lines "| 分类 | 场景 |"
    Add-Line $lines "| --- | --- |"
    foreach ($item in @($report.failureAudit.checks)) {
      Add-Line $lines "| $($item.category) | $($item.label) |"
    }
    if ($report.failureAudit.failureEvents) {
      Add-Line $lines ""
      Add-Line $lines "失败上下文事件：$($report.failureAudit.failureEvents.Count)"
    }
  }
  if ($report.playerPathAudit) {
    Add-Line $lines ""
    Add-Line $lines "## 5. 真实可见路径审计"
    Add-Line $lines ""
    Add-Line $lines "| 检查 | 通过 |"
    Add-Line $lines "| --- | --- |"
    foreach ($item in @($report.playerPathAudit.checks)) {
      Add-Line $lines "| $($item.label) | $($item.passed) |"
    }
  }
  if ($report.domClickRegression) {
    Add-Line $lines ""
    Add-Line $lines "## 6. 真实DOM点击回归"
    Add-Line $lines ""
    Add-Line $lines "| 项目 | 数值 |"
    Add-Line $lines "| --- | --- |"
    Add-Line $lines "| 通过 | $($report.domClickRegression.passed) |"
    Add-Line $lines "| 浏览器 | $($report.domClickRegression.browser) |"
    Add-Line $lines "| 引导完成 | $($report.domClickRegression.reports.guided.completed) |"
    Add-Line $lines "| 低引导完成 | $($report.domClickRegression.reports.low.completed) |"
    Add-Line $lines "| 引导误操作 | $($report.domClickRegression.reports.guided.mistakes) |"
    Add-Line $lines "| 低引导误操作 | $($report.domClickRegression.reports.low.mistakes) |"
  }
  if ($report.visualSmoke) {
    Add-Line $lines ""
    Add-Line $lines "## 7. 视觉Smoke"
    Add-Line $lines ""
    Add-Line $lines "| 场景 | 通过 | 视口 | 横向溢出 | 首屏对象 | 首屏动作 | 可操作入口 | 截图 |"
    Add-Line $lines "| --- | --- | --- | --- | --- | --- | --- | --- |"
    foreach ($item in @($report.visualSmoke.scenarios)) {
      $viewport = "$($item.viewport.width)x$($item.viewport.height)"
      Add-Line $lines "| $($item.name) | $($item.passed) | $viewport | $($item.inspection.overflowX) | $($item.inspection.firstObjectVisible) | $($item.inspection.firstActionVisible) | $($item.inspection.firstUsableStepVisible) | $($item.screenshot) |"
    }
  }
  if ($report.validationCoverage) {
    Add-Line $lines ""
    Add-Line $lines "## 8. 校验覆盖"
    Add-Line $lines ""
    foreach ($item in @($report.validationCoverage)) {
      Add-Line $lines "- $item"
    }
  }
  Set-Content -LiteralPath $resolvedOutput -Value $lines -Encoding UTF8
  Write-Output "Suite summary written: $resolvedOutput"
  exit 0
}

$metrics = $report.metrics
$summary = $report.summary

Add-Line $lines "# 试玩报告摘要"
Add-Line $lines ""
Add-Line $lines "生成时间：$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Add-Line $lines "报告来源：``$ReportPath``"
Add-Line $lines ""
Add-Line $lines "## 1. 总览"
Add-Line $lines ""
Add-Line $lines "| 项目 | 数值 |"
Add-Line $lines "| --- | --- |"
Add-Line $lines "| 当前区域 | $($report.currentZone) |"
Add-Line $lines "| 是否完成 | $($report.completed) |"
Add-Line $lines "| 测试模式 | $($report.testModeLabel) |"
Add-Line $lines "| 总用时 | $(Format-Time ([int]$report.elapsedSec)) |"
Add-Line $lines "| 最长区域 | $($summary.longestZone.zone) / $(Format-Time ([int]$summary.longestZone.durationSec)) |"
Add-Line $lines "| 误操作总量 | $($summary.totalMistakes) |"
Add-Line $lines ""
Add-Line $lines "## 2. 关键指标"
Add-Line $lines ""
Add-Line $lines "| 指标 | 数值 |"
Add-Line $lines "| --- | --- |"
Add-Line $lines "| 扫描 | $($metrics.scans) |"
Add-Line $lines "| 剥离 | $($metrics.extracts) |"
Add-Line $lines "| 注入 | $($metrics.injects) |"
Add-Line $lines "| 组合反应 | $($metrics.reactions) |"
Add-Line $lines "| Boss语义操作 | $($metrics.bossSemanticActions) |"
Add-Line $lines "| 撤销 | $($metrics.undoUses) |"
Add-Line $lines "| 首次扫描 | $(Format-OptionalTime $metrics.firstScanSec) |"
Add-Line $lines "| 首次剥离 | $(Format-OptionalTime $metrics.firstExtractSec) |"
Add-Line $lines "| 首次注入 | $(Format-OptionalTime $metrics.firstInjectSec) |"
Add-Line $lines ""
Add-Line $lines "## 3. 每区耗时"
Add-Line $lines ""
Add-Line $lines "| 区域 | 模式 | 起始 | 结束 | 耗时 | 结果 |"
Add-Line $lines "| --- | --- | --- | --- | --- | --- |"
foreach ($zone in @($report.zoneDurations)) {
  Add-Line $lines "| $($zone.zone) | $($zone.mode) | $(Format-Time ([int]$zone.startedAtSec)) | $(Format-Time ([int]$zone.endedAtSec)) | $(Format-Time ([int]$zone.durationSec)) | $($zone.outcome) |"
}
Add-Line $lines ""
Add-Line $lines "## 4. 模式变化"
Add-Line $lines ""
Add-Line $lines "| 时间 | 区域 | 模式 |"
Add-Line $lines "| --- | --- | --- |"
foreach ($change in @($metrics.modeChanges)) {
  Add-Line $lines "| $(Format-Time ([int]$change.t)) | $($change.zone) | $($change.label) |"
}
Add-Line $lines ""
if ($report.experience) {
  Add-Line $lines "## 5. 体验审计"
  Add-Line $lines ""
  Add-Line $lines "结论：$($report.experience.headline)"
  Add-Line $lines ""
  Add-Line $lines "摩擦："
  foreach ($item in @($report.experience.frictions)) {
    Add-Line $lines "- $item"
  }
  if (-not $report.experience.frictions -or $report.experience.frictions.Count -eq 0) {
    Add-Line $lines "- 未记录明显体验摩擦。"
  }
  Add-Line $lines ""
  Add-Line $lines "整改线索："
  foreach ($item in @($report.experience.nextFixes)) {
    Add-Line $lines "- $item"
  }
  if (-not $report.experience.nextFixes -or $report.experience.nextFixes.Count -eq 0) {
    Add-Line $lines "- 保持低引导真人复测。"
  }
  Add-Line $lines ""
  Add-Line $lines "## 6. 最近事件"
} else {
  Add-Line $lines "## 5. 最近事件"
}
Add-Line $lines ""
foreach ($item in @($report.latestLog)) {
  Add-Line $lines "- $item"
}

Set-Content -LiteralPath $resolvedOutput -Value $lines -Encoding UTF8
Write-Output "Summary written: $resolvedOutput"
