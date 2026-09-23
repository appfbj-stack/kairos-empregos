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

try {
  $h = Invoke-WebRequest -Uri 'http://127.0.0.1:8031/health' -UseBasicParsing -TimeoutSec 5
  Write-Host "Health: OK"
} catch {
  Write-Host 'Servidor NAO subiu'
  if (Test-Path 'srv_err.txt') { Get-Content 'srv_err.txt' }
  exit 1
}

# Login
$tokDemo = (Try-Req POST 'http://127.0.0.1:8031/api/auth/login' @{} '{"email":"admin@demo.com","password":"admin123"}').body | ConvertFrom-Json | Select-Object -ExpandProperty token
$tokTeste = (Try-Req POST 'http://127.0.0.1:8031/api/auth/login' @{} '{"email":"admin@teste.com","password":"admin123"}').body | ConvertFrom-Json | Select-Object -ExpandProperty token
$hDemo = @{ Authorization = "Bearer $tokDemo" }
$hTeste = @{ Authorization = "Bearer $tokTeste" }

# ===== 1. Aplicar com PDF real =====
Write-Host ''
Write-Host '=== 1. POST candidatura com PDF válido ==='
$pdfBase64 = [Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes('%PDF-1.4 fake content here'))
$apply = @{
  fullName = 'Maria IA Test'
  email = "maria.ia.$(Get-Random)@example.com"
  phone = "(15) 99$(Get-Random -Maximum 999 -Minimum 100)-$(Get-Random -Maximum 9999)"
  city = 'Sorocaba'
  state = 'SP'
  resumeBase64 = $pdfBase64
  resumeFilename = 'maria.pdf'
} | ConvertTo-Json -Compress
$r = Try-Req POST 'http://127.0.0.1:8031/api/public/agencies/demo/jobs/auxiliar-de-producao-abc-industrial-sorocaba/apply' @{} $apply
$ap = $r.body | ConvertFrom-Json
$candId = $ap.candidateId
Write-Host "Status=$($r.status) candidateId=$candId"

# ===== 2. POST /extract-resume (esperado 422 — PDF sem texto) =====
Write-Host ''
Write-Host '=== 2. Extract resume (PDF sem texto real — esperado 422) ==='
$r = Try-Req POST "http://127.0.0.1:8031/api/candidates/$candId/extract-resume" $hDemo $null
Write-Host "Status=$($r.status) body=$($r.body)"

# ===== 3. Substituir PDF (admin) =====
Write-Host ''
Write-Host '=== 3. PUT /resume (substituir PDF válido) ==='
$newPdf = [Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes('%PDF-1.4 novo curriculo'))
$body = "{""resumeBase64"":""$newPdf"",""resumeFilename"":""maria-novo.pdf""}"
$r = Try-Req PUT "http://127.0.0.1:8031/api/candidates/$candId/resume" $hDemo $body
Write-Host "Status=$($r.status)"

# ===== 4. Extract novamente com PDF fake (vai dar 422) =====
Write-Host ''
Write-Host '=== 4. Extrai novamente (mesmo PDF fake, 422 esperado) ==='
$r = Try-Req POST "http://127.0.0.1:8031/api/candidates/$candId/extract-resume" $hDemo $null
Write-Host "Status=$($r.status)"

# ===== 5. Verifica que aiExtractedAt NAO foi setado =====
Write-Host ''
Write-Host '=== 5. GET candidato (aiExtractedAt deve ser null) ==='
$r = Try-Req GET "http://127.0.0.1:8031/api/candidates/$candId" $hDemo $null
$det = $r.body | ConvertFrom-Json
Write-Host "Status=$($r.status) aiExtractedAt=$($det.candidate.aiExtractedAt)"

# ===== 6. Substituir PDF por arquivo que NAO e PDF (esperado 415) =====
Write-Host ''
Write-Host '=== 6. Substituir por JPG (esperado 415) ==='
$jpg = [Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes('JPG fake'))
$body = "{""resumeBase64"":""$jpg"",""resumeFilename"":""foto.jpg""}"
$r = Try-Req PUT "http://127.0.0.1:8031/api/candidates/$candId/resume" $hDemo $body
Write-Host "Status=$($r.status)"

# ===== 7. Extract de candidato sem PDF (esperado 400) =====
Write-Host ''
Write-Host '=== 7. Create candidato sem PDF ==='
$semPdf = @{
  fullName = 'Joao Sem PDF'
  email = 'joao.sempdf@example.com'
  phone = '(15) 98888-7777'
} | ConvertTo-Json -Compress
$r = Try-Req POST 'http://127.0.0.1:8031/api/public/agencies/demo/jobs/auxiliar-de-producao-abc-industrial-sorocaba/apply' @{} $semPdf
$sem = $r.body | ConvertFrom-Json
Write-Host "candidateId sem PDF = $($sem.candidateId)"

Write-Host ''
Write-Host '=== 8. DELETE resume ==='
$r = Try-Req DELETE "http://127.0.0.1:8031/api/candidates/$candId/resume" $hDemo $null
Write-Host "Status=$($r.status)"

Write-Host ''
Write-Host '=== 9. Extract de candidato sem PDF (esperado 400) ==='
$r = Try-Req POST "http://127.0.0.1:8031/api/candidates/$candId/extract-resume" $hDemo $null
Write-Host "Status=$($r.status)"

# ===== 10. TESTE tenta extrair candidato da DEMO (esperado 404) =====
Write-Host ''
Write-Host '=== 10. TESTE tenta extrair candidato da DEMO (esperado 404) ==='
# Cria candidato da TESTE (Com PDF)
$testePdf = [Convert]::ToBase64String([System.Text.Encoding]::ASCII.GetBytes('%PDF-1.4 teste'))
$tapply = @{
  fullName = 'Carlos Teste IA'
  email = 'carlos.teste.ia@example.com'
  phone = '(15) 97777-6666'
  resumeBase64 = $testePdf
  resumeFilename = 'carlos.pdf'
} | ConvertTo-Json -Compress
$r2 = Try-Req POST 'http://127.0.0.1:8031/api/public/agencies/teste/jobs/vaga-teste-itapetininga/apply' @{} $tapply
$tap = $r2.body | ConvertFrom-Json
$cTesteId = $tap.candidateId
Write-Host "candidateId TESTE = $cTesteId"

$r = Try-Req POST "http://127.0.0.1:8031/api/candidates/$cTesteId/extract-resume" $hDemo $null
Write-Host "DEMO tenta extract de TESTE: Status=$($r.status)"

# Limpar arquivo criado
Remove-Item "C:\Users\ferna\Downloads\kairos-rh\backend\storage\agencies\*\candidates\*.pdf" -ErrorAction SilentlyContinue

Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 8031 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Write-Host ''
Write-Host '=== Backend encerrado ==='