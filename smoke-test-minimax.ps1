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
    $params = @{ Uri = $url; UseBasicParsing = $true; TimeoutSec = 30; Headers = $headers }
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
$hDemo = @{ Authorization = "Bearer $tokDemo" }

# Pega vaga de Auxiliar de Produção (que tem requisitos industriais)
$r = Try-Req GET 'http://127.0.0.1:8031/api/jobs' $hDemo $null
$jobs = $r.body | ConvertFrom-Json
$job = $jobs | Where-Object { $_.title -match 'Produção' } | Select-Object -First 1
if (-not $job) { $job = $jobs[0] }
$jobId = $job.id
Write-Host "Vaga: $($job.title) requisitos=$($job.requirements)"

Write-Host ''
Write-Host '=== Criar candidato COM dados ricos pra teste real ==='
$rand = Get-Random
$payload = @{
  fullName = "Carlos Pereira Industrial $rand"
  email = "carlos.industrial.$rand@example.com"
  phone = "(15) 99$($rand % 1000)-$($rand * 13 % 10000)"
  cpf = "12345678901"
  city = "Sorocaba"
  state = "SP"
  desiredRole = "Auxiliar de Produção"
  salaryExpectation = 2100
  availability = "Imediata"
  education = "Ensino médio completo. Curso técnico em eletrotécnica."
  experience = "5 anos de experiência como auxiliar de produção na indústria ABC. Trabalhei com montagem de peças, controle de qualidade e operação de máquinas."
  cnh = "B"
} | ConvertTo-Json -Compress

$r = Try-Req POST 'http://127.0.0.1:8031/api/public/agencies/demo/jobs/auxiliar-de-producao-abc-industrial-sorocaba/apply' @{} $payload
$created = $r.body | ConvertFrom-Json
$candId = $created.candidateId
Write-Host "candidateId=$candId"

Write-Host ''
Write-Host '=== POST match candidato×vaga com MiniMax-M3 REAL ==='
Write-Host '   Vaga: Auxiliar de Produção com req "Ensino médio, experiência industrial"'
$r = Try-Req POST "http://127.0.0.1:8031/api/jobs/$jobId/match/$candId" $hDemo $null
$match = $r.body | ConvertFrom-Json
Write-Host "Status=$($r.status)"
Write-Host ""
Write-Host "match=$($match.match)  score=$($match.score)/100"
Write-Host "summary=$($match.summary)"
Write-Host ""
Write-Host "Compatibilidades ($($match.matches.Count)):"
foreach ($m in $match.matches) { Write-Host "  ✅ $($m.requirement): $($m.found)" }
Write-Host "Não confirmadas ($($match.missing.Count)):"
foreach ($m in $match.missing) { Write-Host "  ⚠️  $($m.requirement): $($m.reason)" }
Write-Host ""
Write-Host "Disclaimer: $($match.disclaimer)"

Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 8031 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Write-Host ''
Write-Host '=== Backend encerrado ==='