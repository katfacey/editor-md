param([switch]$TestOnly)
$ErrorActionPreference='Stop'
$projectRoot=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
if(Test-Path -LiteralPath '.tools\cargo\bin\cargo.exe'){
  $env:CARGO_HOME=Join-Path $projectRoot '.tools\cargo'
  $env:RUSTUP_HOME=Join-Path $projectRoot '.tools\rustup'
  $env:PATH=(Join-Path $env:CARGO_HOME 'bin')+';'+$env:PATH
}
& npm run build:ui
if($LASTEXITCODE -ne 0){throw 'UI build failed'}
if($TestOnly){
  & cargo test --manifest-path src-tauri/Cargo.toml --locked
}else{
  & cargo build --manifest-path src-tauri/Cargo.toml --release --locked
}
if($LASTEXITCODE -ne 0){throw 'Rust build failed'}
