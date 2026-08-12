$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$nodePath = 'C:\Program Files\nodejs'
if (Test-Path -LiteralPath $nodePath) {
    $env:Path = "$nodePath;$env:Path"
}

function Invoke-Checked([string]$Command, [string[]]$Arguments) {
    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Command exited with code $LASTEXITCODE."
    }
}

Push-Location (Join-Path $root 'client')
try {
    Invoke-Checked 'npm.cmd' @('ci')
    Invoke-Checked 'npm.cmd' @('test')
    Invoke-Checked 'npm.cmd' @('run', 'build')
}
finally {
    Pop-Location
}

$wwwroot = Join-Path $root 'server\wwwroot'
if (Test-Path -LiteralPath $wwwroot) {
    Get-ChildItem -LiteralPath $wwwroot -Force | Remove-Item -Recurse -Force
}
else {
    New-Item -ItemType Directory -Path $wwwroot | Out-Null
}
Copy-Item -Path (Join-Path $root 'client\dist\*') -Destination $wwwroot -Recurse -Force

$env:DOTNET_CLI_HOME = Join-Path $root '.dotnet-home'
$env:NUGET_PACKAGES = Join-Path $root '.nuget\packages'
$env:APPDATA = Join-Path $root '.appdata'
$env:DOTNET_NOLOGO = '1'
Invoke-Checked 'dotnet' @('restore', (Join-Path $root 'server\AttendanceInsights.Api.csproj'), '--configfile', (Join-Path $root 'NuGet.Config'))
Invoke-Checked 'dotnet' @('build', (Join-Path $root 'server\AttendanceInsights.Api.csproj'), '--configuration', 'Release', '--no-restore')
