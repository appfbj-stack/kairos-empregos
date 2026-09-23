$ErrorActionPreference = 'Stop'
$env:NODE_ENV = 'production'
$env:PORT = '8031'
$env:DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/kairos_rh_test'
$env:JWT_SECRET = 'test-secret-key-for-isolation-tests-only-2026'
$env:LOG_LEVEL = 'warn'
Set-Location 'C:\Users\ferna\Downloads\kairos-rh\backend'

$proc = Start-Process -FilePath cmd.exe -ArgumentList '/c','npx','tsx','src/server.ts' -WorkingDirectory 'C:\Users\ferna\Downloads\kairos-rh\backend' -NoNewWindow -PassThru -RedirectStandardOutput 'srv_out.txt' -RedirectStandardError 'srv_err.txt'
Start-Sleep -Seconds 4

function Try-Req([string]$method, [string]$url, [hashtable]$headers, [string]$body) {
  try {
    $params = @{ Uri = $url; UseBasicParsing = $true; TimeoutSec = 8; Headers = $headers }
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

try {
  $h = Invoke-WebRequest -Uri 'http://127.0.0.1:8031/health' -UseBasicParsing -TimeoutSec 5
  Write-Host "Health: OK"
} catch {
  Write-Host 'Servidor NAO subiu'
  if (Test-Path 'srv_err.txt') { Get-Content 'srv_err.txt' }
  exit 1
}

Write-Host ''
Write-Host '=== 1. Login super admin ==='
$r = Try-Req POST 'http://127.0.0.1:8031/api/super-admin/login' @{} '{"email":"super@kairosrh.com","password":"super123"}'
$superTok = ($r.body | ConvertFrom-Json).token
$hSuper = @{ Authorization = "Bearer $superTok" }
Write-Host "Status=$($r.status) email=$((($r.body | ConvertFrom-Json).user).email)"

Write-Host ''
Write-Host '=== 2. /api/super-admin/me ==='
$r = Try-Req GET 'http://127.0.0.1:8031/api/super-admin/me' $hSuper $null
Write-Host "Status=$($r.status) name=$((($r.body | ConvertFrom-Json).user).name)"

Write-Host ''
Write-Host '=== 3. Listar todas as agencias ==='
$r = Try-Req GET 'http://127.0.0.1:8031/api/super-admin/agencies' $hSuper $null
$allAgencies = $r.body | ConvertFrom-Json
Write-Host "Status=$($r.status) total=$($allAgencies.Count)"
foreach ($a in $allAgencies) {
  Write-Host "  $($a.slug) - $($a.plan) - $($a.status) - users=$($a.usersCount) jobs=$($a.jobsCount) candidates=$($a.candidatesCount)"
}

Write-Host ''
Write-Host '=== 4. Detalhe de uma agencia ==='
$demoAg = $allAgencies | Where-Object { $_.slug -eq 'demo' }
$r = Try-Req GET "http://127.0.0.1:8031/api/super-admin/agencies/$($demoAg.id)" $hSuper $null
$det = $r.body | ConvertFrom-Json
Write-Host "Status=$($r.status) users=$($det.metrics.usersCount) apps=$($det.metrics.applicationsCount)"

Write-Host ''
Write-Host '=== 5. BLOQUEAR agencia demo ==='
$r = Try-Req PATCH "http://127.0.0.1:8031/api/super-admin/agencies/$($demoAg.id)/status" $hSuper '{"status":"BLOQUEADA"}'
Write-Host "Status=$($r.status) novoStatus=$((($r.body | ConvertFrom-Json)).status)"

Write-Host ''
Write-Host '=== 6. Tentar login como admin DEMO (esperado 403) ==='
$r = Try-Req POST 'http://127.0.0.1:8031/api/auth/login' @{} '{"email":"admin@demo.com","password":"admin123"}'
Write-Host "Status=$($r.status)"

Write-Host ''
Write-Host '=== 7. DESBLOQUEAR demo + RENOVAR 365 dias ==='
$r = Try-Req PATCH "http://127.0.0.1:8031/api/super-admin/agencies/$($demoAg.id)/status" $hSuper '{"status":"ATIVA"}'
Write-Host "Status=$($r.status)"
$r = Try-Req PATCH "http://127.0.0.1:8031/api/super-admin/agencies/$($demoAg.id)/license" $hSuper '{"days":365}'
Write-Host "RENEW Status=$($r.status) novoFim=$((($r.body | ConvertFrom-Json)).licenseEnd)"

Write-Host ''
Write-Host '=== 8. Login admin demo agora funciona ==='
$r = Try-Req POST 'http://127.0.0.1:8031/api/auth/login' @{} '{"email":"admin@demo.com","password":"admin123"}'
Write-Host "Status=$($r.status)"

Write-Host ''
Write-Host '=== 9. Criar nova agencia ==='
$newAg = @{
  name = 'Agencia Beta'
  adminEmail = 'admin@beta.com'
  adminPassword = 'beta123'
  adminName = 'Admin Beta'
  plan = 'PROFISSIONAL'
  licenseDays = 90
} | ConvertTo-Json -Compress
$r = Try-Req POST 'http://127.0.0.1:8031/api/super-admin/agencies' $hSuper $newAg
$created = $r.body | ConvertFrom-Json
Write-Host "Status=$($r.status) newAgency.slug=$($created.agency.slug) status=$($created.agency.status)"

Write-Host ''
Write-Host '=== 10. Login admin da nova agencia ==='
$r = Try-Req POST 'http://127.0.0.1:8031/api/auth/login' @{} '{"email":"admin@beta.com","password":"beta123"}'
$betaTok = ($r.body | ConvertFrom-Json).token
$hBeta = @{ Authorization = "Bearer $betaTok" }
Write-Host "Status=$($r.status)"

Write-Host ''
Write-Host '=== 11. Beta cria empresa ==='
$r = Try-Req POST 'http://127.0.0.1:8031/api/companies' $hBeta '{"legalName":"Beta Teste LTDA"}'
Write-Host "Status=$($r.status)"

Write-Host ''
Write-Host '=== 12. Super admin tenta acessar /api/companies (esperado 401 - rota tenant) ==='
$r = Try-Req GET 'http://127.0.0.1:8031/api/companies' $hSuper $null
Write-Host "Status=$($r.status)"

Write-Host ''
Write-Host '=== 13. Logout super admin ==='
$r = Try-Req POST 'http://127.0.0.1:8031/api/super-admin/logout' $hSuper '{}'
Write-Host "Status=$($r.status)"

Write-Host ''
Write-Host '=== 14. Apos logout, /me deve dar 401 ==='
$r = Try-Req GET 'http://127.0.0.1:8031/api/super-admin/me' $hSuper $null
Write-Host "Status=$($r.status)"

Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 8031 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Write-Host ''
Write-Host '=== Backend encerrado ==='