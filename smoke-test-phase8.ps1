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

# Pega primeira vaga demo
$r = Try-Req GET 'http://127.0.0.1:8031/api/jobs' $hDemo $null
$jobs = $r.body | ConvertFrom-Json
$jobId = $jobs[0].id
Write-Host "Vaga: $($jobs[0].title)"

# Pega primeiro candidato demo
$r = Try-Req GET 'http://127.0.0.1:8031/api/candidates' $hDemo $null
$cands = $r.body | ConvertFrom-Json
$candId = $cands[0].id
Write-Host "Candidato: $($cands[0].fullName)"

Write-Host ''
Write-Host '=== 1. POST match candidato×vaga ==='
$r = Try-Req POST "http://127.0.0.1:8031/api/jobs/$jobId/match/$candId" $hDemo $null
$match = $r.body | ConvertFrom-Json
Write-Host "Status=$($r.status) match=$($match.match) score=$($match.score) matches.Count=$($match.matches.Count) missing.Count=$($match.missing.Count)"

Write-Host ''
Write-Host '=== 2. Schema validation ==='
if ($match.match -and $match.score -ne $null -and $match.summary -and $match.disclaimer) {
  Write-Host "  match=$($match.match) score=$($match.score) summary.length=$($match.summary.Length) disclaimer.length=$($match.disclaimer.Length)"
} else {
  Write-Host "  ERRO: campos faltando"
}

Write-Host ''
Write-Host '=== 3. Vaga inexistente (404) ==='
$r = Try-Req POST "http://127.0.0.1:8031/api/jobs/00000000-0000-0000-0000-000000000000/match/$candId" $hDemo $null
Write-Host "Status=$($r.status)"

Write-Host ''
Write-Host '=== 4. Candidato inexistente (404) ==='
$r = Try-Req POST "http://127.0.0.1:8031/api/jobs/$jobId/match/00000000-0000-0000-0000-000000000000" $hDemo $null
Write-Host "Status=$($r.status)"

Write-Host ''
Write-Host '=== 5. Cross-tenant (TESTE tenta match com vaga da DEMO, esperado 404) ==='
$r = Try-Req POST "http://127.0.0.1:8031/api/jobs/$jobId/match/$candId" $hTeste $null
Write-Host "Status=$($r.status)"

Write-Host ''
Write-Host '=== 6. Candidato da TESTE faz match com vaga da TESTE ==='
$r = Try-Req POST 'http://127.0.0.1:8031/api/public/agencies/teste/jobs/vaga-teste-itapetininga/apply' @{} '{"fullName":"Match Teste","email":"match.teste@example.com","phone":"998887777"}'
$tcId = ($r.body | ConvertFrom-Json).candidateId
$r2 = Try-Req GET 'http://127.0.0.1:8031/api/jobs' $hTeste $null
$tjId = ($r2.body | ConvertFrom-Json)[0].id
$r = Try-Req POST "http://127.0.0.1:8031/api/jobs/$tjId/match/$tcId" $hTeste $null
$tmatch = $r.body | ConvertFrom-Json
Write-Host "TESTE match: Status=$($r.status) match=$($tmatch.match) score=$($tmatch.score)"

Write-Host ''
Write-Host '=== 7. Audit log gravado ==='
$binDir = 'C:\Program Files\PostgreSQL\17\bin'
$env:PGPASSWORD = 'postgres'
$logs = & "$binDir\psql.exe" -U postgres -d kairos_rh_test -t -c "SELECT action, resource_id FROM audit_logs WHERE action='job.match';" 2>$null
Write-Host "Logs: $logs"

Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 8031 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Write-Host ''
Write-Host '=== Backend encerrado ==='