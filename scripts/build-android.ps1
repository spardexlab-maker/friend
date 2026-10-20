param([ValidateSet('Release','Debug')][string]$Configuration='Release')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$bundledJdk = Join-Path $projectRoot 'tmp/toolchain/java/jdk-21.0.12.1+1'
if (Test-Path -LiteralPath $bundledJdk) { $env:JAVA_HOME = $bundledJdk }
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Web build failed' }
& npx.cmd cap sync android
if ($LASTEXITCODE -ne 0) { throw 'Android sync failed' }
& android/gradlew.bat -p android ":app:assemble$Configuration" ":wear:assemble$Configuration" --console=plain
if ($LASTEXITCODE -ne 0) { throw 'Android build failed' }
$outputDir = Join-Path $projectRoot 'output/android'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
$variant=$Configuration.ToLowerInvariant()
Copy-Item -LiteralPath "android/app/build/outputs/apk/$variant/app-$variant.apk" -Destination (Join-Path $outputDir 'Rafiq-phone.apk')
Copy-Item -LiteralPath "android/wear/build/outputs/apk/$variant/wear-$variant.apk" -Destination (Join-Path $outputDir 'Rafiq-watch.apk')
Write-Output "APKs saved to $outputDir"
