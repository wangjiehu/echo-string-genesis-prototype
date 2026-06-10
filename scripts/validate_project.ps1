param(
  [int]$Port = 0
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$failures = [System.Collections.Generic.List[string]]::new()

function Add-Pass {
  param([string]$Message)
  Write-Host "[PASS] $Message"
}

function Add-Fail {
  param([string]$Message)
  $failures.Add($Message) | Out-Null
  Write-Host "[FAIL] $Message"
}

function Read-ProjectJson {
  param([string]$RelativePath)
  $path = Join-Path $root $RelativePath
  try {
    $json = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    Add-Pass "$RelativePath parses"
    return $json
  } catch {
    Add-Fail "$RelativePath parse error: $($_.Exception.Message)"
    return $null
  }
}

function Test-TagRefs {
  param(
    [string]$Owner,
    [object[]]$Refs,
    [hashtable]$KnownTags
  )
  foreach ($ref in @($Refs)) {
    if (-not $KnownTags.ContainsKey([string]$ref)) {
      Add-Fail "$Owner references unknown tag: $ref"
    }
  }
}

$tagsDoc = Read-ProjectJson "data\semantic_tags_mvp.json"
$reactionsDoc = Read-ProjectJson "data\semantic_reactions_mvp.json"
$objectsDoc = Read-ProjectJson "data\semantic_objects_mvp.json"

$knownTags = @{}
if ($tagsDoc -and $tagsDoc.tags) {
  foreach ($tag in $tagsDoc.tags) {
    $knownTags[[string]$tag.tagId] = $true
  }
  if ($tagsDoc.tags.Count -eq 10) {
    Add-Pass "MVP tag count is 10"
  } else {
    Add-Fail "MVP tag count expected 10, got $($tagsDoc.tags.Count)"
  }
}

if ($reactionsDoc -and $reactionsDoc.reactions) {
  foreach ($reaction in $reactionsDoc.reactions) {
    Test-TagRefs "reaction $($reaction.reactionId).requiredTags" $reaction.requiredTags $knownTags
    Test-TagRefs "reaction $($reaction.reactionId).removesTagsAfterTrigger" $reaction.effect.removesTagsAfterTrigger $knownTags
  }
  Add-Pass "reaction tag references checked"
}

if ($objectsDoc -and $objectsDoc.objects) {
  foreach ($object in $objectsDoc.objects) {
    Test-TagRefs "object $($object.objectId).defaultTags" $object.defaultTags $knownTags
    Test-TagRefs "object $($object.objectId).providesTags" $object.providesTags $knownTags
    Test-TagRefs "object $($object.objectId).acceptsTags" $object.acceptsTags $knownTags
  }
  Add-Pass "object tag references checked"
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Add-Fail "Node.js was not found in PATH"
} else {
  Push-Location (Join-Path $root "prototype")
  try {
    & $node.Source --check ".\app.js" | Out-Null
    if ($LASTEXITCODE -eq 0) { Add-Pass "prototype/app.js syntax" } else { Add-Fail "prototype/app.js syntax check failed" }
    & $node.Source --check ".\regression.js" | Out-Null
    if ($LASTEXITCODE -eq 0) { Add-Pass "prototype/regression.js syntax" } else { Add-Fail "prototype/regression.js syntax check failed" }
    & $node.Source --check ".\server.mjs" | Out-Null
    if ($LASTEXITCODE -eq 0) { Add-Pass "prototype/server.mjs syntax" } else { Add-Fail "prototype/server.mjs syntax check failed" }
  } finally {
    Pop-Location
  }
  Push-Location $root
  try {
    foreach ($scriptFile in Get-ChildItem -Path ".\scripts" -Filter "*.mjs" -File) {
      & $node.Source --check $scriptFile.FullName | Out-Null
      if ($LASTEXITCODE -eq 0) { Add-Pass "$($scriptFile.Name) syntax" } else { Add-Fail "$($scriptFile.Name) syntax check failed" }
    }
    & $node.Source ".\scripts\check_app_data_consistency.mjs" | Out-Null
    if ($LASTEXITCODE -eq 0) { Add-Pass "app/data consistency" } else { Add-Fail "app/data consistency check failed" }
    & $node.Source ".\scripts\check_ui_contract.mjs" | Out-Null
    if ($LASTEXITCODE -eq 0) { Add-Pass "ui contract" } else { Add-Fail "ui contract check failed" }
    & $node.Source ".\scripts\run_app_regression.mjs" | Out-Null
    if ($LASTEXITCODE -eq 0) { Add-Pass "app regression suite" } else { Add-Fail "app regression suite failed" }
    & $node.Source ".\scripts\run_failure_audit.mjs" | Out-Null
    if ($LASTEXITCODE -eq 0) { Add-Pass "failure audit" } else { Add-Fail "failure audit failed" }
    & $node.Source ".\scripts\run_player_path_audit.mjs" | Out-Null
    if ($LASTEXITCODE -eq 0) { Add-Pass "player path audit" } else { Add-Fail "player path audit failed" }
  } finally {
    Pop-Location
  }
}

$indexPath = Join-Path $root "prototype\index.html"
$indexHtml = Get-Content -LiteralPath $indexPath -Raw
if ($indexHtml -match "app\.js\?v=1\.0\.0") {
  Add-Pass "index.html references current app cache key"
} else {
  Add-Fail "index.html does not reference app.js?v=1.0.0"
}

$appPath = Join-Path $root "prototype\app.js"
$appJs = Get-Content -LiteralPath $appPath -Raw
$regressionPath = Join-Path $root "prototype\regression.js"
$regressionJs = Get-Content -LiteralPath $regressionPath -Raw
$runtimeJs = "$appJs`n$regressionJs"
if ($appJs -match 'BUILD_LABEL = "1.0.0"') {
  Add-Pass "prototype/app.js build label is 1.0.0"
} else {
  Add-Fail "prototype/app.js build label is not 1.0.0"
}
if ($runtimeJs -match "runGuidedRegression") {
  Add-Pass "browser regression hook is exposed"
} else {
  Add-Fail "browser regression hook is missing"
}
if ($runtimeJs -match "runLowGuidanceRegression" -and $runtimeJs -match "runRegressionSuite") {
  Add-Pass "low-guidance and suite regression hooks are exposed"
} else {
  Add-Fail "low-guidance or suite regression hook is missing"
}
if ($appJs -match "checkpointRestores" -and $appJs -match "routeAssertions") {
  Add-Pass "checkpoint and route assertion metrics are present"
} else {
  Add-Fail "checkpoint or route assertion metrics are missing"
}
if ($appJs -match "experienceAudit" -and $appJs -match "failureEvents" -and $appJs -match "feedbackEvents") {
  Add-Pass "experience audit and feedback metrics are present"
} else {
  Add-Fail "experience audit or feedback metrics are missing"
}
if ($appJs -match "Route tried to extract non-visible tag" -and $appJs -match "runPlayerPathAudit") {
  Add-Pass "visible extraction guard is present"
} else {
  if ($regressionJs -match "Route tried to extract non-visible tag" -and $regressionJs -match "runPlayerPathAudit") {
    Add-Pass "visible extraction guard is present"
  } else {
    Add-Fail "visible extraction guard is missing"
  }
}

$rg = Get-Command rg -ErrorAction SilentlyContinue
if ($rg) {
  $markers = & $rg.Source -n "[T]ODO|[F]IXME|[H]ACK|[X]XX" $root
  if ($LASTEXITCODE -eq 0 -and $markers) {
    Add-Fail "stale engineering markers found"
    $markers | ForEach-Object { Write-Output "  $_" }
  } else {
    Add-Pass "no stale engineering markers"
  }
} else {
  Write-Output "[WARN] ripgrep not found; skipped stale marker scan"
}

if ($Port -gt 0) {
  $url = "http://127.0.0.1:$Port/index.html"
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
      Add-Pass "HTTP health check $url"
    } else {
      Add-Fail "HTTP health check returned $($response.StatusCode)"
    }
  } catch {
    Add-Fail "HTTP health check failed: $($_.Exception.Message)"
  }
  if ($node) {
    Push-Location $root
    try {
      & $node.Source ".\scripts\run_dom_click_regression.mjs" $url "production\latest_1_0_0_dom_click_report.json" | Out-Null
      if ($LASTEXITCODE -eq 0) { Add-Pass "DOM click regression" } else { Add-Fail "DOM click regression failed" }
      & $node.Source ".\scripts\run_visual_smoke.mjs" $url "production\latest_1_0_0_visual_smoke_report.json" | Out-Null
      if ($LASTEXITCODE -eq 0) { Add-Pass "visual smoke" } else { Add-Fail "visual smoke failed" }
      & $node.Source ".\scripts\write_ux_report.mjs" "production\latest_1_0_0_report.json" "production\latest_1_0_0_visibility_report.json" | Out-Null
      if ($LASTEXITCODE -eq 0) { Add-Pass "1.0.0 report refreshed" } else { Add-Fail "1.0.0 report refresh failed" }
      powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\summarize_report.ps1" -ReportPath "production\latest_1_0_0_report.json" -OutputPath "production\latest_1_0_0_summary.md" | Out-Null
      if ($LASTEXITCODE -eq 0) { Add-Pass "1.0.0 summary refreshed" } else { Add-Fail "1.0.0 summary refresh failed" }
      powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\aggregate_reports.ps1" -ReportGlob "production\latest*_report.json" -OutputPath "production\report_comparison.md" | Out-Null
      if ($LASTEXITCODE -eq 0) { Add-Pass "report comparison refreshed" } else { Add-Fail "report comparison refresh failed" }
    } catch {
      Add-Fail "browser validation failed: $($_.Exception.Message)"
    } finally {
      Pop-Location
    }
  }
}

if ($failures.Count -gt 0) {
  Write-Output ""
  Write-Output "Validation failed with $($failures.Count) issue(s)."
  exit 1
}

Write-Output ""
Write-Output "Validation passed."
