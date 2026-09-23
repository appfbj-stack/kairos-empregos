$ErrorActionPreference = 'Stop'
$env:NODE_ENV = 'production'
$env:PORT = '8031'
$env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/kairos_rh_test'
$env:JWT_SECRET = 'test-secret-key-for-isolation-tests-only-2026'
$env:LOG_LEVEL = 'warn'
$env:OPENAI_API_KEY = 'sk-cp-vrrgT5Bv-VpOfVV7G8ZVaG0FvBovzUOZVwEcxBBFr6cFqwNKJ48LvadhmPQj_mV39xZv9jQIlhLYbhZiMay9QMSJYdpLX5BACb0VYeYcuYfrRqbtJtcTpeY'
$env:OPENAI_BASE_URL = 'https://api.MiniMax.io/v1'
$env:OPENAI_MODEL = 'MiniMax-M3'

Set-Location 'C:\Users\ferna\Downloads\kairos-rh\backend'

$proc = Start-Process -FilePath cmd.exe -ArgumentList '/c','npx','tsx','src/server.ts' -WorkingDirectory 'C:\Users\ferna\Downloads\kairos-rh\backend' -NoNewWindow -PassThru -RedirectStandardOutput 'srv_out.txt' -RedirectStandardError 'srv_err.txt'
Start-Sleep -Seconds 4

function Try-Req([string]$method, [string]$url, [hashtable]$headers, [string]$body) {
  try {
    $params = @{ Uri = $url; UseBasicParsing = $true; TimeoutSec = 10; Headers = $headers }
    if ($method -ne 'GET') {
      $params.Method = $method
      $params.ContentType = 'application/json'
      $params.Body = $body
    }
    $r = Invoke-WebRequest @params
    return @{ ok = $true; status = $r.StatusCode; body = $r.Content }
  } catch {
    $status = $_.Exception.Response.StatusCode.value__
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = if ($stream) { New-Object System.IO.StreamReader($stream) } else { $null }
    $bodyStr = if ($reader) { $reader.ReadToEnd() } else { '' }
    return @{ ok = $false; status = $status; body = $bodyStr }
  }
}

try { $h = Invoke-WebRequest -Uri 'http://127.0.0.1:8031/health' -UseBasicParsing -TimeoutSec 5; Write-Host 'Health OK' } catch { Write-Host 'NAO subiu'; exit 1 }

$tokDemo = (Try-Req POST 'http://127.0.0.1:8031/api/auth/login' @{} '{"email":"admin@demo.com","password":"admin123"}').body | ConvertFrom-Json | Select-Object -ExpandProperty token
$tokTeste = (Try-Req POST 'http://127.0.0.1:8031/api/auth/login' @{} '{"email":"admin@teste.com","password":"admin123"}').body | ConvertFrom-Json | Select-Object -ExpandProperty token
$hDemo = @{ Authorization = "Bearer $tokDemo" }
$hTeste = @{ Authorization = "Bearer $tokTeste" }

Write-Host ''
Write-Host '=== 1. Dashboard DEMO ==='
$r = Try-Req GET 'http://127.0.0.1:8031/api/reports/dashboard' $hDemo $null
$dash = $r.body | ConvertFrom-Json
Write-Host "Status=$($r.status)"
Write-Host "  Vagas abertas: $($dash.totals.activeJobs)/$($dash.totals.totalJobs)"
Write-Host "  Candidatos: $($dash.totals.totalCandidates)"
Write-Host "  Candidaturas: $($dash.totals.totalApplications)"
Write-Host "  Contratados: $($dash.totals.hiredCount) (taxa $($dash.totals.conversionRate)%)"
Write-Host "  Pipeline:"
foreach ($s in $dash.byStage) { Write-Host "    $($s.stage): $($s.count)" }
Write-Host "  Top vagas:"
foreach ($j in $dash.topJobs) { Write-Host "    $($j.title): $($j.applicationsCount) cand" }
Write-Host "  Timeseries dias: $($dash.timeseries.Count)"

Write-Host ''
Write-Host '=== 2. Dashboard TESTE (isolado) ==='
$r = Try-Req GET 'http://127.0.0.1:8031/api/reports/dashboard' $hTeste $null
$dashTeste = $r.body | ConvertFrom-Json
Write-Host "Status=$($r.status) Candidatos=$($dashTeste.totals.totalCandidates) Candidaturas=$($dashTeste.totals.totalApplications)"

Write-Host ''
Write-Host '=== 3. Funil de vaga DEMO ==='
$r = Try-Req GET 'http://127.0.0.1:8031/api/jobs' $hDemo $null
$jobs = $r.body | ConvertFrom-Json
$jobId = $jobs[0].id
$r = Try-Req GET "http://127.0.0.1:8031/api/reports/jobs/$jobId/funnel" $hDemo $null
$funnel = $r.body | ConvertFrom-Json
Write-Host "Status=$($r.status) Vaga=$($funnel.job.title) total=$($funnel.total)"
foreach ($s in $funnel.funnel) { Write-Host "  $($s.stage): $($s.count)" }

Write-Host ''
Write-Host '=== 4. Cross-tenant funnel (404) ==='
$r = Try-Req GET "http://127.0.0.1:8031/api/reports/jobs/$jobId/funnel" $hTeste $null
Write-Host "Status=$($r.status)"

Write-Host ''
Write-Host '=== 5. Atividade recente ==='
$r = Try-Req GET 'http://127.0.0.1:8031/api/reports/activity' $hDemo $null
$acts = $r.body | ConvertFrom-Json
Write-Host "Status=$($r.status) items=$($acts.Count)"
foreach ($a in $acts | Select-Object -First 3) {
  Write-Host "  $($a.candidateName) -> $($a.jobTitle) ($($a.stage))"
}

Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 8031 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Write-Host ''
Write-Host '=== Backend encerrado ==='