$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$env:DOTNET_CLI_HOME = Join-Path $root '.dotnet-home'
$env:NUGET_PACKAGES = Join-Path $root '.nuget\packages'
$env:APPDATA = Join-Path $root '.appdata'
$env:DOTNET_NOLOGO = '1'
$env:ASPNETCORE_ENVIRONMENT = 'Production'
& dotnet run --project (Join-Path $root 'server\AttendanceInsights.Api.csproj') --configuration Release --no-build --no-launch-profile --urls 'http://127.0.0.1:5080'
