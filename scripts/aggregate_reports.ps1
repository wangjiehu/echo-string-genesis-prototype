param(
  [string]$ReportGlob = "production\latest*_report.json",
  [string]$OutputPath = "production\report_comparison.md"
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

function Add-Line {
  param(
    [System.Collections.Generic.List[string]]$Lines,
    [string]$Text = ""
  )
  $Lines.Add($Text) | Out-Null
}

$resolvedOutput = Resolve-ProjectPath $OutputPath
$globPath = Resolve-ProjectPath $ReportGlob
$globDir = Split-Path -Parent $globPath
$globName = Split-Path -Leaf $globPath
$files = Get-ChildItem -Path $globDir -Filter $globName -File |
  Where-Object { $_.Name -notmatch "_dom_click_report\.json$" } |
  Where-Object { $_.Name -notmatch "_visual_smoke_report\.json$" } |
  Sort-Object Name

if (-not $files) {
  Write-Error "No report files matched: $ReportGlob"
  exit 1
}

$rows = foreach ($file in $files) {
  $report = Get-Content -LiteralPath $file.FullName -Raw | ConvertFrom-Json
  if ($report.reports -and $report.reports.guided -and $report.reports.low) {
    $guidedFeedback = if ($null -ne $report.reports.guided.feedbackEvents) { $report.reports.guided.feedbackEvents } else { "-" }
    $lowFeedback = if ($null -ne $report.reports.low.feedbackEvents) { $report.reports.low.feedbackEvents } else { "-" }
    $guidedFailures = if ($null -ne $report.reports.guided.failureEvents) { $report.reports.guided.failureEvents } else { "-" }
    $lowFailures = if ($null -ne $report.reports.low.failureEvents) { $report.reports.low.failureEvents } else { "-" }
    [PSCustomObject]@{
      Name = $file.Name
      Completed = [bool]$report.passed
      Mode = "引导+低引导"
      Zone = "Z7"
      ElapsedText = "回归套件"
      Elapsed = 0
      IncludeInAverage = $false
      Scans = "$($report.reports.guided.scans)/$($report.reports.low.scans)"
      Extracts = "$($report.reports.guided.extracts)/$($report.reports.low.extracts)"
      Injects = "$($report.reports.guided.injects)/$($report.reports.low.injects)"
      Reactions = "$($report.reports.guided.reactions)/$($report.reports.low.reactions)"
      Mistakes = "$($report.reports.guided.mistakes)/$($report.reports.low.mistakes)"
      Undo = "0/0"
      Feedback = "$guidedFeedback/$lowFeedback"
      Failures = "$guidedFailures/$lowFailures"
      LongestText = "-"
    }
    continue
  }
  if ($report.metrics -and $report.summary) {
    $undoUses = if ($null -ne $report.metrics.undoUses) { [int]$report.metrics.undoUses } else { 0 }
    $feedbackEvents = if ($report.metrics.feedbackEvents) { $report.metrics.feedbackEvents.Count } else { 0 }
    $failureEvents = if ($report.metrics.failureEvents) { $report.metrics.failureEvents.Count } else { 0 }
    [PSCustomObject]@{
      Name = $file.Name
      Completed = [bool]$report.completed
      Mode = [string]$report.testModeLabel
      Zone = [string]$report.currentZone
      ElapsedText = (Format-Time ([int]$report.elapsedSec))
      Elapsed = [int]$report.elapsedSec
      IncludeInAverage = $true
      Scans = [string]$report.metrics.scans
      Extracts = [string]$report.metrics.extracts
      Injects = [string]$report.metrics.injects
      Reactions = [string]$report.metrics.reactions
      Mistakes = [string]$report.summary.totalMistakes
      Undo = [string]$undoUses
      Feedback = [string]$feedbackEvents
      Failures = [string]$failureEvents
      LongestText = "$($report.summary.longestZone.zone) / $(Format-Time ([int]$report.summary.longestZone.durationSec))"
    }
  }
}

$lines = [System.Collections.Generic.List[string]]::new()
Add-Line $lines "# 试玩报告对比"
Add-Line $lines ""
Add-Line $lines "生成时间：$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Add-Line $lines "报告范围：``$ReportGlob``"
Add-Line $lines ""
Add-Line $lines "| 报告 | 完成 | 模式 | 当前区 | 总用时 | 扫描 | 剥离 | 注入 | 反应 | 误操作 | 撤销 | 反馈 | 失败 | 最长区 |"
Add-Line $lines "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |"

foreach ($row in $rows) {
  Add-Line $lines "| $($row.Name) | $($row.Completed) | $($row.Mode) | $($row.Zone) | $($row.ElapsedText) | $($row.Scans) | $($row.Extracts) | $($row.Injects) | $($row.Reactions) | $($row.Mistakes) | $($row.Undo) | $($row.Feedback) | $($row.Failures) | $($row.LongestText) |"
}

$completedRows = @($rows | Where-Object { $_.Completed -and $_.IncludeInAverage })
if ($completedRows.Count -gt 0) {
  $avgElapsed = [Math]::Round((($completedRows | Measure-Object -Property Elapsed -Average).Average), 1)
  $avgMistakes = [Math]::Round((($completedRows | ForEach-Object { [int]$_.Mistakes } | Measure-Object -Average).Average), 1)
  $suiteRows = @($rows | Where-Object { $_.Completed -and -not $_.IncludeInAverage })
  Add-Line $lines ""
  Add-Line $lines "## 汇总"
  Add-Line $lines ""
  Add-Line $lines "- 完成人工/单路线报告数：$($completedRows.Count)"
  Add-Line $lines "- 完成回归套件报告数：$($suiteRows.Count)"
  Add-Line $lines "- 平均完成用时：$(Format-Time ([int]$avgElapsed))"
  Add-Line $lines "- 平均误操作：$avgMistakes"
}

Set-Content -LiteralPath $resolvedOutput -Value $lines -Encoding UTF8
Write-Output "Comparison written: $resolvedOutput"
