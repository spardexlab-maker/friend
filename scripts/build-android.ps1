$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$bundledJdk = Join-Path $projectRoot 'tmp/toolchain/java/jdk-21.0.12.1+1'
if (Test-Path -LiteralPath $bundledJdk) { $env:JAVA_HOME = $bundledJdk }
& npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Web build failed' }
& npx.cmd cap sync android
if ($LASTEXITCODE -ne 0) { throw 'Android sync failed' }
& android/gradlew.bat -p android :app:assembleDebug :wear:assembleDebug --console=plain
if ($LASTEXITCODE -ne 0) { throw 'Android build failed' }
$outputDir = Join-Path $projectRoot 'output/android'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
Copy-Item -LiteralPath 'android/app/build/outputs/apk/debug/app-debug.apk' -Destination (Join-Path $outputDir 'Rafiq-phone.apk')
Copy-Item -LiteralPath 'android/wear/build/outputs/apk/debug/wear-debug.apk' -Destination (Join-Path $outputDir 'Rafiq-watch.apk')
Write-Output "APKs saved to $outputDir"
