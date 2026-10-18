param([Parameter(Mandatory=$true)][string]$Version)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
if ($Version -notmatch '^\d+\.\d+\.\d+$') { throw 'Version must be x.y.z' }
$current = Get-Content -Raw src/version.json | ConvertFrom-Json
if ([version]$Version -le [version]$current.name) { throw 'Choose a version newer than src/version.json' }
$json = @{name=$Version;code=([int]$current.code + 1)} | ConvertTo-Json
[System.IO.File]::WriteAllText((Join-Path (Get-Location) "src/version.json"), $json, (New-Object System.Text.UTF8Encoding $false))
Write-Output 'Version updated. Build, test and commit this change, then publish both APKs together. See README cloud/update instructions.'
