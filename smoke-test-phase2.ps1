$ErrorActionPreference = 'Stop'
$env:NODE_ENV = 'production'
$env:PORT = '8031'
$env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/kairos_rh_test'
$env:JWT_SECRET = 'test-secret-key-for-isolation-tests-only-2026'
$env:LOG_LEVEL = 'warn'
Set-Location 'C:\Users\ferna\Downloads\kairos-rh\backend'

$job = Start-Job -ScriptBlock {
  $env:NODE_ENV = 'production'
  $env:PORT = '8031'
  $env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/kairos_rh_test'
  $env:JWT_SECRET = 'test-secret-key-for-isolation-tests-only-2026'
  $env:LOG_LEVEL = 'warn'
  Set-Location 'C:\Users\ferna\Downloads\kairos-rh\backend'
  & cmd.exe /c "npx tsx src/server.ts" 2>&1
}
Start-Sleep -Seconds 3

function Try-Req([string]$method, [string]$url, [hashtable]$headers, [string]$body) {
  try {
    $params = @{ Uri = $url; UseBasicParsing = $true; TimeoutSec = 5; Headers = $headers }
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

# Login
$tok1 = (Try-Req POST 'http://127.0.0.1:8031/api/auth/login' @{} '{"email":"admin@demo.com","password":"admin123"}').body | ConvertFrom-Json | Select-Object -ExpandProperty token
$tok2 = (Try-Req POST 'http://127.0.0.1:8031/api/auth/login' @{} '{"email":"admin@teste.com","password":"admin123"}').body | ConvertFrom-Json | Select-Object -ExpandProperty token
$h1 = @{ Authorization = "Bearer $tok1" }
$h2 = @{ Authorization = "Bearer $tok2" }

Write-Host '=== 1. /api/companies da DEMO (esperado 3) ==='
$r = Try-Req GET 'http://127.0.0.1:8031/api/companies' $h1 $null
$demoCo = $r.body | ConvertFrom-Json
Write-Host "Status=$($r.status) count=$($demoCo.Count)"

Write-Host ''
Write-Host '=== 2. /api/companies da TESTE (esperado 1) ==='
$r = Try-Req GET 'http://127.0.0.1:8031/api/companies' $h2 $null
$testCo = $r.body | ConvertFrom-Json
Write-Host "Status=$($r.status) count=$($testCo.Count)"

Write-Host ''
Write-Host '=== 3. DEMO tenta acessar empresa da TESTE por ID (esperado 404) ==='
$r = Try-Req GET "http://127.0.0.1:8031/api/companies/$($testCo[0].id)" $h1 $null
Write-Host "Status=$($r.status) body=$($r.body)"

Write-Host ''
Write-Host '=== 4. /api/jobs da DEMO (esperado 10) ==='
$r = Try-Req GET 'http://127.0.0.1:8031/api/jobs' $h1 $null
$demoJobs = $r.body | ConvertFrom-Json
Write-Host "Status=$($r.status) count=$($demoJobs.Count)"

Write-Host ''
Write-Host '=== 5. /api/jobs da TESTE (esperado 2) ==='
$r = Try-Req GET 'http://127.0.0.1:8031/api/jobs' $h2 $null
$testJobs = $r.body | ConvertFrom-Json
Write-Host "Status=$($r.status) count=$($testJobs.Count)"

Write-Host ''
Write-Host '=== 6. PUBLIC lista de vagas demo (esperado 10) ==='
$r = Try-Req GET 'http://127.0.0.1:8031/api/public/agencies/demo/jobs' @{} $null
$pubJobs = ($r.body | ConvertFrom-Json).jobs
Write-Host "Status=$($r.status) count=$($pubJobs.Count)"

Write-Host ''
Write-Host '=== 7. PUBLIC vaga individual ==='
$r = Try-Req GET 'http://127.0.0.1:8031/api/public/agencies/demo/jobs/auxiliar-de-producao-abc-industrial-sorocaba' @{} $null
Write-Host "Status=$($r.status) title=$((($r.body | ConvertFrom-Json).job).title)"

Write-Host ''
Write-Host '=== 8. PUBLIC vaga rascunho da TESTE (esperado 404) ==='
$r = Try-Req GET 'http://127.0.0.1:8031/api/public/agencies/teste/jobs/outra-vaga-teste' @{} $null
Write-Host "Status=$($r.status)"

Write-Host ''
Write-Host '=== 9. PUBLIC agência inexistente (esperado 404) ==='
$r = Try-Req GET 'http://127.0.0.1:8031/api/public/agencies/inexistente/jobs' @{} $null
Write-Host "Status=$($r.status)"

Write-Host ''
Write-Host '=== 10. POST /api/jobs (criar nova vaga na DEMO) ==='
$newJob = @{
  companyId = $demoCo[0].id
  title = 'Auxiliar de Limpeza Industrial'
  city = 'Sorocaba'
  state = 'SP'
  contractType = 'CLT'
  modality = 'PRESENCIAL'
  salary = 1850
  vacancies = 2
  status = 'PUBLICADA'
  description = 'Vaga de teste E2E'
} | ConvertTo-Json -Compress
$r = Try-Req POST 'http://127.0.0.1:8031/api/jobs' $h1 $newJob
$created = $r.body | ConvertFrom-Json
Write-Host "Status=$($r.status) slug=$($created.slug) title=$($created.title)"

Write-Host ''
Write-Host '=== 11. PUT /api/jobs/:id (pausar vaga) ==='
$upd = '{"status":"PAUSADA"}'
$r = Try-Req PUT "http://127.0.0.1:8031/api/jobs/$($created.id)" $h1 $upd
Write-Host "Status=$($r.status) novo status=$((($r.body | ConvertFrom-Json).status))"

Write-Host ''
Write-Host '=== 12. DELETE /api/jobs/:id ==='
$r = Try-Req DELETE "http://127.0.0.1:8031/api/jobs/$($created.id)" $h1 $null
Write-Host "Status=$($r.status)"

Write-Host ''
Write-Host '=== 13. TESTE tenta deletar vaga da DEMO (esperado 404) ==='
$demoJobId = $demoJobs[0].id
$r = Try-Req DELETE "http://127.0.0.1:8031/api/jobs/$demoJobId" $h2 $null
Write-Host "Status=$($r.status)"

Write-Host ''
Write-Host '=== 14. POST /api/companies sem auth (esperado 401) ==='
$r = Try-Req POST 'http://127.0.0.1:8031/api/companies' @{} '{"legalName":"Hack"}'
Write-Host "Status=$($r.status)"

Write-Host ''
Write-Host '=== 15. POST /api/companies com companyId da TESTE em JWT da DEMO (esperado 400) ==='
$badJob = @{ companyId = $testCo[0].id; title = 'Hack' } | ConvertTo-Json -Compress
$r = Try-Req POST 'http://127.0.0.1:8031/api/jobs' $h1 $badJob
Write-Host "Status=$($r.status) body=$($r.body)"

Stop-Job $job -ErrorAction SilentlyContinue | Out-Null
Write-Host ''
Write-Host '=== Backend encerrado ==='