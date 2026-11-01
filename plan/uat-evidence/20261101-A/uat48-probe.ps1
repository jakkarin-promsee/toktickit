$ErrorActionPreference = 'Stop'
$cluster = 'C:\Users\BTCOM\AppData\Local\Temp\toktickit-uat48-20261101-a'
$pgCtl = 'C:\Program Files\PostgreSQL\18\bin\pg_ctl.exe'
$psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
$db = 'postgresql://toktickit@127.0.0.1:5544/toktickit_uat48'
$base = 'http://localhost:3001'
$ticket = '31000000-0000-4000-8000-000000000001'

function Request($url) {
  try {
    $r = Invoke-WebRequest $url -Headers @{ Cookie = "toktickit_session=$token" } -TimeoutSec 10
    return [pscustomobject]@{ status = $r.StatusCode; body = $r.Content }
  } catch {
    $r = $_.Exception.Response
    return [pscustomobject]@{ status = [int]$r.StatusCode; body = $_.ErrorDetails.Message }
  }
}

$token = [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
$hash = [Convert]::ToHexString([System.Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($token))).ToLowerInvariant()
$csrf = [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
$id = [guid]::NewGuid().ToString()
$sql = 'INSERT INTO "Session" (id,"tokenHash","csrfToken","userId","createdAt","expiresAt","lastSeenAt") VALUES (''{0}'',''{1}'',''{2}'',1,now(),now()+interval ''1 hour'',now());' -f $id,$hash,$csrf
& $psql $db -q -c $sql | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Scratch session setup failed' }

$baseline = [ordered]@{
  health = Request "$base/api/health"
  dashboard = Request "$base/api/dashboard/requester"
  actions = Request "$base/api/tickets/$ticket/actions"
}
if ($baseline.health.status -ne 200 -or $baseline.dashboard.status -ne 200 -or $baseline.actions.status -ne 200) { throw 'Scratch baseline failed' }
Write-Output "baseline health=$($baseline.health.status) dashboard=$($baseline.dashboard.status) actions=$($baseline.actions.status)"

try {
  & $pgCtl -D $cluster -m fast -w stop | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Scratch PostgreSQL stop failed' }
  $outage = [ordered]@{
    health = Request "$base/api/health"
    dashboard = Request "$base/api/dashboard/requester"
    actions = Request "$base/api/tickets/$ticket/actions"
  }
  Write-Output "outage health=$($outage.health.status) dashboard=$($outage.dashboard.status) actions=$($outage.actions.status)"
} finally {
  & $pgCtl -D $cluster -l "$cluster\server.log" -o '-p 5544 -h 127.0.0.1' -w start | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Scratch PostgreSQL restart failed' }
}
$recovered = [ordered]@{
  health = Request "$base/api/health"
  dashboard = Request "$base/api/dashboard/requester"
  actions = Request "$base/api/tickets/$ticket/actions"
}
Write-Output "recovered health=$($recovered.health.status) dashboard=$($recovered.dashboard.status) actions=$($recovered.actions.status)"

foreach ($phase in 'baseline','outage','recovered') {
  $set = Get-Variable -Name $phase -ValueOnly
  foreach ($name in 'health','dashboard','actions') {
    $r = $set[$name]
    $body = if ($name -eq 'health' -or $phase -eq 'outage') { $r.body } else { '<data omitted>' }
    Write-Output "$phase $name HTTP $($r.status) $body"
  }
}
