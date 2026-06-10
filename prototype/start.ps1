param(
  [int]$Port = 4174,
  [int]$MaxAttempts = 20,
  [switch]$NoReuse
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$node = Get-Command node -ErrorAction SilentlyContinue

if (-not $node) {
  Write-Error "Node.js was not found in PATH."
  exit 1
}

function Test-PortFree {
  param([int]$CandidatePort)
  $listener = $null
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), $CandidatePort)
    $listener.Start()
    return $true
  } catch {
    return $false
  } finally {
    if ($listener) {
      $listener.Stop()
    }
  }
}

function Test-HttpOk {
  param([int]$CandidatePort)
  $request = $null
  try {
    $request = [System.Net.HttpWebRequest]::Create("http://127.0.0.1:$CandidatePort/index.html")
    $request.Method = "GET"
    $request.Timeout = 1500
    $request.ReadWriteTimeout = 1500
    $response = $request.GetResponse()
    try {
      return ([int]$response.StatusCode -eq 200)
    } finally {
      $response.Close()
    }
  } catch {
    return $false
  }
}

$selectedPort = $null
$reused = $false
for ($i = 0; $i -lt $MaxAttempts; $i += 1) {
  $candidate = $Port + $i
  if (-not $NoReuse -and (Test-HttpOk $candidate)) {
    $selectedPort = $candidate
    $reused = $true
    break
  }
  if (Test-PortFree $candidate) {
    $selectedPort = $candidate
    break
  }
}

if (-not $selectedPort) {
  Write-Error "No free localhost port found from $Port to $($Port + $MaxAttempts - 1)."
  exit 1
}

$url = "http://127.0.0.1:$selectedPort/index.html"
if ($reused) {
  Write-Output "Prototype server already running."
  Write-Output "Prototype URL: $url"
  exit 0
}

$process = Start-Process -FilePath $node.Source -ArgumentList @("server.mjs", "$selectedPort") -WorkingDirectory $scriptDir -WindowStyle Hidden -PassThru
Start-Sleep -Milliseconds 700

if (-not (Test-HttpOk $selectedPort)) {
  Start-Sleep -Milliseconds 800
  if (-not (Test-HttpOk $selectedPort)) {
    Write-Warning "Server process started, but health check did not return HTTP 200 within the timeout."
  }
}

Write-Output "Prototype server PID: $($process.Id)"
Write-Output "Prototype URL: $url"
