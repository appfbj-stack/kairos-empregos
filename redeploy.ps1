$ErrorActionPreference = 'Stop'
$ssh = 'C:\Users\ferna\.ssh\vps'
$vps = '187.77.229.227'

$cmds = @(
  'cd /root/kairos-rh',
  'git pull origin master',
  'docker compose -p kairos-rh build frontend',
  'docker compose -p kairos-rh up -d frontend'
)

$remote = $cmds -join ' ; '
& "C:\Windows\System32\OpenSSH\ssh.exe" -i $ssh -o StrictHostKeyChecking=no "root@$vps" $remote 2>&1 | Select-Object -Last 15