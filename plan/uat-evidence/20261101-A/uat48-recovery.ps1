$ErrorActionPreference='Stop'
$token=[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
$hash=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($token))).ToLowerInvariant()
$csrf=[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLowerInvariant()
$id=[guid]::NewGuid().ToString()
$sql='INSERT INTO "Session" (id,"tokenHash","csrfToken","userId","createdAt","expiresAt","lastSeenAt") VALUES (''{0}'',''{1}'',''{2}'',1,now(),now()+interval ''1 hour'',now());' -f $id,$hash,$csrf
& 'C:\Program Files\PostgreSQL\18\bin\psql.exe' 'postgresql://toktickit@127.0.0.1:5544/toktickit_uat48' -q -c $sql | Out-Null
if($LASTEXITCODE -ne 0){throw 'session setup failed'}
$headers=@{Cookie="toktickit_session=$token"}
$health=Invoke-WebRequest 'http://localhost:3001/api/health' -TimeoutSec 10
$dashboard=Invoke-WebRequest 'http://localhost:3001/api/dashboard/requester' -Headers $headers -TimeoutSec 10
$actions=Invoke-WebRequest 'http://localhost:3001/api/tickets/31000000-0000-4000-8000-000000000001/actions' -Headers $headers -TimeoutSec 10
"recovered health=$($health.StatusCode) dashboard=$($dashboard.StatusCode) actions=$($actions.StatusCode)"
