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
  Write-Host "Health: $($h.Content)"
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

Write-Host ''
Write-Host '=== 1. /api/candidates da DEMO (esperado 30 + 2 novos = 32) ==='
$r = Try-Req GET 'http://127.0.0.1:8031/api/candidates' $h1 $null
$candsDemo = $r.body | ConvertFrom-Json
Write-Host "Status=$($r.status) count=$($candsDemo.Count)"

Write-Host ''
Write-Host '=== 2. Candidatos por busca (q=Ana) ==='
$r = Try-Req GET 'http://127.0.0.1:8031/api/candidates?q=Ana' $h1 $null
$candsAna = $r.body | ConvertFrom-Json
Write-Host "Status=$($r.status) count=$($candsAna.Count)"

Write-Host ''
Write-Host '=== 3. POST candidatura publica (NOVO candidato) ==='
$novoCand = @{
  fullName = 'Patricia Souza Nova'
  email = 'patricia.nova@example.com'
  phone = '(15) 98765-4321'
  cpf = '12345678901'
  city = 'Sorocaba'
  state = 'SP'
  desiredRole = 'Atendente'
  availability = 'Imediata'
} | ConvertTo-Json -Compress
$r = Try-Req POST 'http://127.0.0.1:8031/api/public/agencies/demo/jobs/auxiliar-de-producao-abc-industrial-sorocaba/apply' @{} $novoCand
$apply1 = $r.body | ConvertFrom-Json
Write-Host "Status=$($r.status) newCandidate=$($apply1.newCandidate) jobTitle=$($apply1.jobTitle)"

Write-Host ''
Write-Host '=== 4. POST candidatura DUPLICADA (mesmo telefone, esperado newCandidate=false) ==='
$dupCand = @{
  fullName = 'Patricia Souza Atualizada'
  email = 'patricia.atualizada@example.com'
  phone = '(15) 98765-4321'
  city = 'Sorocaba'
  state = 'SP'
  desiredRole = 'Operadora'
} | ConvertTo-Json -Compress
$r = Try-Req POST 'http://127.0.0.1:8031/api/public/agencies/demo/jobs/auxiliar-de-producao-abc-industrial-sorocaba/apply' @{} $dupCand
$apply2 = $r.body | ConvertFrom-Json
Write-Host "Status=$($r.status) newCandidate=$($apply2.newCandidate)"

Write-Host ''
Write-Host '=== 5. POST candidatura com PDF ==='
$pdfBase64 = [Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes('%PDF-1.4 mock content'))
$pdfApply = @{
  fullName = 'Roberto PDF'
  email = 'roberto.pdf@example.com'
  phone = '(15) 91234-5678'
  city = 'Itu'
  state = 'SP'
  resumeBase64 = $pdfBase64
  resumeFilename = 'roberto.pdf'
} | ConvertTo-Json -Compress
$r = Try-Req POST 'http://127.0.0.1:8031/api/public/agencies/demo/jobs/atendente-de-loja-xyz-atacado-sorocaba/apply' @{} $pdfApply
$applyPdf = $r.body | ConvertFrom-Json
Write-Host "Status=$($r.status) candidateId=$($applyPdf.candidateId)"

Write-Host ''
Write-Host '=== 6. Candidatura com arquivo que NAO e PDF (esperado 415) ==='
$badPdf = @{
  fullName = 'Joao JPG'
  email = 'joao.jpg@example.com'
  phone = '(15) 91111-2222'
  resumeBase64 = [Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes('JPG fake'))
  resumeFilename = 'foto.jpg'
} | ConvertTo-Json -Compress
$r = Try-Req POST 'http://127.0.0.1:8031/api/public/agencies/demo/jobs/atendente-de-loja-xyz-atacado-sorocaba/apply' @{} $badPdf
Write-Host "Status=$($r.status)"

Write-Host ''
Write-Host '=== 7. Candidatura em vaga RASCUNHO (esperado 404) ==='
$r = Try-Req POST 'http://127.0.0.1:8031/api/public/agencies/teste/jobs/outra-vaga-teste/apply' @{} $novoCand
Write-Host "Status=$($r.status)"

Write-Host ''
Write-Host '=== 8. GET /api/candidates da TESTE (esperado 0 — Patricia e do demo) ==='
$r = Try-Req GET 'http://127.0.0.1:8031/api/candidates' $h2 $null
$testCands = $r.body | ConvertFrom-Json
Write-Host "Status=$($r.status) count=$($testCands.Count)"

Write-Host ''
Write-Host '=== 9. DEMO tenta ler candidato da TESTE (esperado 0 resultados) ==='
$binDir = 'C:\Program Files\PostgreSQL\17\bin'
$env:PGPASSWORD = 'postgres'
& "$binDir\psql.exe" -U postgres -d kairos_rh_test -c "INSERT INTO candidates (agency_id, full_name, phone, email) SELECT id, 'Candidato Teste Tenant', '99000000000', 'ct@teste.com' FROM agencies WHERE slug='teste';" 2>$null | Out-Null
$r = Try-Req GET 'http://127.0.0.1:8031/api/candidates?q=Candidato+Teste+Tenant' $h1 $null
Write-Host "DEMO busca candidato de teste: Status=$($r.status) count=$((($r.body | ConvertFrom-Json) | Measure-Object).Count)"

Write-Host ''
Write-Host '=== 10. TESTE ve seu proprio candidato ==='
$r = Try-Req GET 'http://127.0.0.1:8031/api/candidates?q=Candidato+Teste+Tenant' $h2 $null
Write-Host "TESTE busca: Status=$($r.status) count=$((($r.body | ConvertFrom-Json) | Measure-Object).Count)"

Write-Host ''
Write-Host '=== 11. GET /api/candidates/:id/resume (autorizado) ==='
$r = Try-Req GET "http://127.0.0.1:8031/api/candidates/$($applyPdf.candidateId)/resume" $h1 $null
$ct = if ($r.ok) { $r.Headers.'Content-Type' } else { 'N/A' }
$len = if ($r.ok) { $r.RawContentLength } else { 0 }
Write-Host "Status=$($r.status) Content-Type=$ct length=$len"

Write-Host ''
Write-Host '=== 12. Atualizar stage de uma candidatura ==='
$rCand = Try-Req GET "http://127.0.0.1:8031/api/candidates/$($apply1.candidateId)" $h1 $null
$firstApp = ($rCand.body | ConvertFrom-Json).applications[0]
Write-Host "AppId=$($firstApp.id) stage=$($firstApp.stage)"
$r = Try-Req PUT "http://127.0.0.1:8031/api/candidates/applications/$($firstApp.id)/stage" $h1 '{"stage":"EM_ANALISE"}'
Write-Host "PUT stage: Status=$($r.status) novoStage=$((($r.body | ConvertFrom-Json).stage))"

Write-Host ''
Write-Host '=== 13. 2a candidatura de Patricia (mesma vaga) NAO duplica application ==='
$rCand2 = Try-Req GET "http://127.0.0.1:8031/api/candidates/$($apply1.candidateId)" $h1 $null
$appsPatricia = ($rCand2.body | ConvertFrom-Json).applications
Write-Host "Total candidaturas da Patricia: $($appsPatricia.Count) (esperado 1)"

Write-Host ''
Write-Host '=== 14. Listar candidaturas por vaga ==='
$jobId = $appsPatricia[0].job.id
$r = Try-Req GET "http://127.0.0.1:8031/api/candidates/by-job/$jobId" $h1 $null
$byJob = $r.body | ConvertFrom-Json
Write-Host "Status=$($r.status) candidaturas da vaga: $($byJob.Count)"

Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 8031 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Write-Host ''
Write-Host '=== Backend encerrado ==='