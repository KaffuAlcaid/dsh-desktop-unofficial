[CmdletBinding()]
param(
  [string]$HarnessPath,
  [ValidateSet('zip', 'nsis', 'all')]
  [string]$Target = 'zip'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$env:CI = 'true'

$projectRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($HarnessPath)) {
  $HarnessPath = Join-Path $projectRoot '.build\deepseek-harness'
}
$harnessRoot = [IO.Path]::GetFullPath($HarnessPath)
$runtimeRoot = Join-Path $projectRoot 'resources\runtime'
$tarballRoot = Join-Path $projectRoot '.build\runtime-tarballs-win-x64'
$downloadRoot = Join-Path $projectRoot '.build\downloads'
$manifestPath = Join-Path $projectRoot 'upstream\harness.json'
$stageScript = Join-Path $PSScriptRoot 'stage-harness-runtime.mjs'
$builderConfig = Join-Path $projectRoot 'electron-builder.yml'
$builderCli = Join-Path $projectRoot 'node_modules\electron-builder\cli.js'
$env:ELECTRON_BUILDER_CACHE = Join-Path $projectRoot '.build\electron-builder-cache'

if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) {
  throw 'The Windows portable package must be built on Windows.'
}
if ([Runtime.InteropServices.RuntimeInformation]::OSArchitecture -ne [Runtime.InteropServices.Architecture]::X64) {
  throw 'The first portable release supports Windows x64 only.'
}
if ($null -eq (Get-Command corepack -ErrorAction SilentlyContinue)) {
  throw 'Corepack was not found. Install a supported Node.js version before packaging.'
}
if (-not (Test-Path -LiteralPath (Join-Path $harnessRoot 'package.json') -PathType Leaf)) {
  throw "Prepared Harness source was not found: $harnessRoot`nRun 'corepack pnpm run prepare:harness' first."
}
if (-not (Test-Path -LiteralPath (Join-Path $harnessRoot 'node_modules') -PathType Container)) {
  throw "Harness dependencies were not found: $harnessRoot\node_modules"
}

function Invoke-Pnpm {
  param(
    [Parameter(Mandatory)] [string]$WorkingDirectory,
    [Parameter(Mandatory)] [string[]]$Arguments
  )
  Push-Location -LiteralPath $WorkingDirectory
  try {
    & corepack pnpm --config.confirmModulesPurge=false @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "pnpm failed with exit code $LASTEXITCODE in $WorkingDirectory"
    }
  } finally {
    Pop-Location
  }
}

function Invoke-Node {
  param([Parameter(Mandatory)] [string[]]$Arguments)
  & node @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "node failed with exit code $LASTEXITCODE"
  }
}

Write-Host 'Building Harness...'
Invoke-Pnpm -WorkingDirectory $harnessRoot -Arguments @('run', 'build')
Invoke-Pnpm -WorkingDirectory (Join-Path $harnessRoot 'native\landlock-run') -Arguments @('run', 'build:ts')

if (Test-Path -LiteralPath $tarballRoot) {
  Remove-Item -LiteralPath $tarballRoot -Recurse -Force
}
New-Item -ItemType Directory -Path $tarballRoot -Force | Out-Null

Write-Host 'Packing Harness workspaces...'
Invoke-Pnpm -WorkingDirectory $harnessRoot -Arguments @(
  '--recursive',
  '--filter', './packages/**',
  '--filter', './apps/**',
  '--filter', './vendor/**',
  '--filter', './native/landlock-run/packages/entry',
  'pack',
  '--pack-destination', $tarballRoot
)

Write-Host 'Installing the standalone Harness runtime...'
Invoke-Node -Arguments @(
  $stageScript,
  '--harness', $harnessRoot,
  '--tarballs', $tarballRoot,
  '--output', $runtimeRoot,
  '--manifest', $manifestPath
)

$nodeVersion = (& node --version).Trim()
if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v\d+\.\d+\.\d+$') {
  throw 'Unable to determine the current Node.js version.'
}
$archiveName = "node-$nodeVersion-win-x64.zip"
$archivePath = Join-Path $downloadRoot $archiveName
$extractRoot = Join-Path $projectRoot ".build\node-$nodeVersion-win-x64"
$nodeUrl = "https://nodejs.org/dist/$nodeVersion/$archiveName"
New-Item -ItemType Directory -Path $downloadRoot -Force | Out-Null
if (-not (Test-Path -LiteralPath $archivePath -PathType Leaf)) {
  Write-Host "Downloading Node.js $nodeVersion..."
  Invoke-WebRequest -Uri $nodeUrl -OutFile $archivePath
}
if (Test-Path -LiteralPath $extractRoot) {
  Remove-Item -LiteralPath $extractRoot -Recurse -Force
}
Expand-Archive -LiteralPath $archivePath -DestinationPath $extractRoot
$nodeSource = Join-Path $extractRoot "node-$nodeVersion-win-x64"
$nodeDestination = Join-Path $runtimeRoot 'node'
New-Item -ItemType Directory -Path $nodeDestination -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $nodeSource 'node.exe') -Destination (Join-Path $nodeDestination 'node.exe')
Copy-Item -LiteralPath (Join-Path $nodeSource 'LICENSE') -Destination (Join-Path $nodeDestination 'LICENSE')

Write-Host "Building the Electron Windows $Target package..."
Invoke-Pnpm -WorkingDirectory $projectRoot -Arguments @('run', 'build')
$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
$builderArguments = @(
  $builderCli,
  '--config', $builderConfig,
  '--win'
)
if ($Target -ne 'all') {
  $builderArguments += $Target
}
$builderArguments += @('--x64', '--publish', 'never')
Invoke-Node -Arguments $builderArguments

Write-Host "Windows $Target package written to $(Join-Path $projectRoot 'release')"
