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

# Login
$tok1 = (Try-Req POST 'http://127.0.0.1:8031/api/auth/login' @{} '{"email":"admin@demo.com","password":"admin123"}').body | ConvertFrom-Json | Select-Object -ExpandProperty token
$tok2 = (Try-Req POST 'http://127.0.0.1:8031/api/auth/login' @{} '{"email":"admin@teste.com","password":"admin123"}').body | ConvertFrom-Json | Select-Object -ExpandProperty token
$h1 = @{ Authorization = "Bearer $tok1" }
$h2 = @{ Authorization = "Bearer $tok2" }

# Pegar uma vaga da demo
$r = Try-Req GET 'http://127.0.0.1:8031/api/jobs' $h1 $null
$jobs = $r.body | ConvertFrom-Json
$jobId = $jobs[0].id
Write-Host "Vaga selecionada: $($jobs[0].title) ($jobId)"

# Pegar candidaturas dessa vaga
$r = Try-Req GET "http://127.0.0.1:8031/api/candidates/by-job/$jobId" $h1 $null
$apps = $r.body | ConvertFrom-Json
Write-Host ''
Write-Host '=== 1. Candidaturas da vaga por stage ==='
$grouped = $apps | Group-Object stage
foreach ($g in $grouped) {
  Write-Host "  $($g.Name): $($g.Count)"
}

# Pega uma candidatura
$app = $apps[0]
$origStage = $app.stage
Write-Host ''
Write-Host "=== 2. Mover candidatura $($app.id) de $origStage para ENTREVISTA ==="
$r = Try-Req PUT "http://127.0.0.1:8031/api/candidates/applications/$($app.id)/stage" $h1 '{"stage":"ENTREVISTA"}'
$updated = $r.body | ConvertFrom-Json
Write-Host "Status=$($r.status) novoStage=$($updated.stage)"

Write-Host ''
Write-Host '=== 3. Adicionar notas internas ==='
$notes = 'Entrevista marcada para sexta-feira 14h. Pedir referência da empresa anterior.'
$r = Try-Req PUT "http://127.0.0.1:8031/api/candidates/applications/$($app.id)/notes" $h1 ("{""notes"":""$notes""}")
$updNotes = $r.body | ConvertFrom-Json
Write-Host "Status=$($r.status) notes.length=$($updNotes.notes.Length)"

Write-Host ''
Write-Host '=== 4. Stage invalido (esperado 400) ==='
$r = Try-Req PUT "http://127.0.0.1:8031/api/candidates/applications/$($app.id)/stage" $h1 '{"stage":"INEXISTENTE"}'
Write-Host "Status=$($r.status)"

Write-Host ''
Write-Host '=== 5. Notas muito longas (esperado 400) ==='
$long = 'x' * 3000
$r = Try-Req PUT "http://127.0.0.1:8031/api/candidates/applications/$($app.id)/notes" $h1 ("{""notes"":""$long""}")
Write-Host "Status=$($r.status)"

Write-Host ''
Write-Host '=== 6. TESTE tenta mover candidatura da DEMO (esperado 404) ==='
$r = Try-Req PUT "http://127.0.0.1:8031/api/candidates/applications/$($app.id)/stage" $h2 '{"stage":"REPROVADO"}'
Write-Host "Status=$($r.status)"

Write-Host ''
Write-Host '=== 7. Verifica que o stage NAO mudou ==='
$r = Try-Req GET "http://127.0.0.1:8031/api/candidates/by-job/$jobId" $h1 $null
$apps2 = $r.body | ConvertFrom-Json
$moved = $apps2 | Where-Object { $_.id -eq $app.id }
Write-Host "Stage atual: $($moved.stage) (esperado: ENTREVISTA)"

Write-Host ''
Write-Host '=== 8. Listar por vaga da DEMO vs TESTE ==='
$r1 = Try-Req GET "http://127.0.0.1:8031/api/candidates/by-job/$jobId" $h1 $null
Write-Host "DEMO by-job: $($((($r1.body | ConvertFrom-Json) | Measure-Object).Count)) apps"
$jobsTeste = (Try-Req GET 'http://127.0.0.1:8031/api/jobs' $h2 $null).body | ConvertFrom-Json
if ($jobsTeste.Count -gt 0) {
  $jobIdTeste = $jobsTeste[0].id
  $r2 = Try-Req GET "http://127.0.0.1:8031/api/candidates/by-job/$jobIdTeste" $h2 $null
  Write-Host "TESTE by-job: $($((($r2.body | ConvertFrom-Json) | Measure-Object).Count)) apps"
} else {
  Write-Host "TESTE sem vagas (esperado)"
}

Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 8031 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Write-Host ''
Write-Host '=== Backend encerrado ==='