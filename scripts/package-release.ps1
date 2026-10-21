param([string]$Version='0.1.3-beta.3')
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$binary=Join-Path $projectRoot 'src-tauri\target\release\editor-md.exe'
if(!(Test-Path -LiteralPath $binary)){throw 'Build the Rust release executable first.'}
if(!(Test-Path -LiteralPath 'THIRD_PARTY_NOTICES.txt')){throw 'Generate third-party notices first.'}
$releaseFolder=Join-Path $projectRoot 'release'
$packageFolder=Join-Path $releaseFolder "Editor-MD-$Version-windows-x64"
New-Item -ItemType Directory -Force -Path $packageFolder | Out-Null
$filename="Editor-MD-$Version-windows-x64.exe"
Copy-Item -LiteralPath $binary -Destination (Join-Path $releaseFolder $filename)
Copy-Item -LiteralPath $binary -Destination (Join-Path $packageFolder 'Editor-MD.exe')
foreach($document in @('README.md','RELEASE-NOTES.md','THIRD_PARTY_NOTICES.txt','design/PROJECTS.md')){
  $destination=Join-Path $packageFolder $document
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
  Copy-Item -LiteralPath (Join-Path $projectRoot $document) -Destination $destination
}
$innerChecksums=Get-ChildItem -LiteralPath $packageFolder -Recurse -File | Where-Object {$_.Name -ne 'CHECKSUMS.txt'} | ForEach-Object {
  $hash=Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256
  $hash.Hash.ToLower()+'  '+$_.FullName.Substring($packageFolder.Length+1).Replace('\','/')
}
Set-Content -LiteralPath (Join-Path $packageFolder 'CHECKSUMS.txt') -Value $innerChecksums -Encoding ascii
$zipFile=Join-Path $releaseFolder "Editor-MD-$Version-windows-x64-portable.zip"
Compress-Archive -LiteralPath $packageFolder -DestinationPath $zipFile -Force
Copy-Item -LiteralPath 'THIRD_PARTY_NOTICES.txt' -Destination (Join-Path $releaseFolder 'THIRD_PARTY_NOTICES.txt')
$outerChecksums=Get-ChildItem -LiteralPath $releaseFolder -File | Where-Object {$_.Name -in $filename,"Editor-MD-$Version-windows-x64-portable.zip"} | ForEach-Object {
  $hash=Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256
  $hash.Hash.ToLower()+'  '+$_.Name
}
Set-Content -LiteralPath (Join-Path $releaseFolder 'SHA256SUMS.txt') -Value $outerChecksums -Encoding ascii
Get-ChildItem -LiteralPath $releaseFolder -File | Select-Object Name,Length
