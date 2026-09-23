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

$binDir = 'C:\Program Files\PostgreSQL\17\bin'
$env:PGPASSWORD = 'postgres'

function Try-Req([string]$method, [string]$url, [hashtable]$headers, [string]$body) {
  try {
    if ($method -eq 'GET') {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5 -Headers $headers
    } else {
      $r = Invoke-WebRequest -Uri $url -Method $method -ContentType 'application/json' -Body $body -UseBasicParsing -TimeoutSec 5 -Headers $headers
    }
    return @{ ok = $true; status = $r.StatusCode; body = $r.Content }
  } catch {
    $status = $_.Exception.Response.StatusCode.value__
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = if ($stream) { New-Object System.IO.StreamReader($stream) } else { $null }
    $bodyStr = if ($reader) { $reader.ReadToEnd() } else { '' }
    return @{ ok = $false; status = $status; body = $bodyStr }
  }
}

Write-Host '=== Login admin@demo.com ==='
$r = Try-Req POST 'http://127.0.0.1:8031/api/auth/login' @{} '{"email":"admin@demo.com","password":"admin123"}'
$tok1 = ($r.body | ConvertFrom-Json).token
Write-Host "Status=$($r.status) agency.slug=$((($r.body | ConvertFrom-Json).agency).slug)"

Write-Host '=== Login admin@teste.com ==='
$r = Try-Req POST 'http://127.0.0.1:8031/api/auth/login' @{} '{"email":"admin@teste.com","password":"admin123"}'
$tok2 = ($r.body | ConvertFrom-Json).token
Write-Host "Status=$($r.status) agency.slug=$((($r.body | ConvertFrom-Json).agency).slug)"

Write-Host '=== Bloqueando agency teste ==='
& "$binDir\psql.exe" -U postgres -d kairos_rh_test -c "UPDATE agencies SET status='BLOQUEADA' WHERE slug='teste';"

Write-Host '=== Login com agencia BLOQUEADA (esperado 403) ==='
$r = Try-Req POST 'http://127.0.0.1:8031/api/auth/login' @{} '{"email":"admin@teste.com","password":"admin123"}'
Write-Host "Status=$($r.status) body=$($r.body)"

Write-Host '=== /me com token da BLOQUEADA (esperado 403) ==='
$r = Try-Req GET 'http://127.0.0.1:8031/api/auth/me' @{ Authorization = "Bearer $tok2" } $null
Write-Host "Status=$($r.status) body=$($r.body)"

Write-Host '=== /me da demo (nao afetado) ==='
$r = Try-Req GET 'http://127.0.0.1:8031/api/auth/me' @{ Authorization = "Bearer $tok1" } $null
Write-Host "Status=$($r.status) body=$($r.body)"

Write-Host '=== Reverter status ==='
& "$binDir\psql.exe" -U postgres -d kairos_rh_test -c "UPDATE agencies SET status='TESTE' WHERE slug='teste';"

Write-Host '=== JWT adulterado (esperado 401) ==='
$bad = $tok1.Substring(0,$tok1.Length-5) + 'XXXXX'
$r = Try-Req GET 'http://127.0.0.1:8031/api/auth/me' @{ Authorization = "Bearer $bad" } $null
Write-Host "Status=$($r.status)"

Write-Host '=== Login invalido ==='
$r = Try-Req POST 'http://127.0.0.1:8031/api/auth/login' @{} '{"email":"admin@demo.com","password":"errada"}'
Write-Host "Status=$($r.status)"

Write-Host '=== Logout + /me (esperado 401 sem token) ==='
$r = Try-Req POST 'http://127.0.0.1:8031/api/auth/logout' @{} '{}'
Write-Host "Logout Status=$($r.status) body=$($r.body)"
$r = Try-Req GET 'http://127.0.0.1:8031/api/auth/me' @{} $null
Write-Host "/me sem token Status=$($r.status)"

Stop-Job $job -ErrorAction SilentlyContinue | Out-Null
Write-Host ''
Write-Host '=== Backend encerrado ==='