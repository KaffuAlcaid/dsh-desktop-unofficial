[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = $PSScriptRoot
$harnessRoot = Join-Path $projectRoot '.build\deepseek-harness'
$harnessPackage = Join-Path $harnessRoot 'package.json'
$harnessModules = Join-Path $harnessRoot 'node_modules'

if ($null -eq (Get-Command corepack -ErrorAction SilentlyContinue)) {
  throw 'Corepack was not found. Install a supported Node.js version before starting development.'
}
if (-not (Test-Path -LiteralPath $harnessPackage -PathType Leaf)) {
  throw "Prepared Harness source was not found: $harnessRoot`nRun 'corepack pnpm run prepare:harness' first."
}
if (-not (Test-Path -LiteralPath $harnessModules -PathType Container)) {
  throw "Harness dependencies were not found: $harnessModules`nInstall them in the prepared Harness directory first."
}

function Invoke-Pnpm {
  param(
    [Parameter(Mandatory)]
    [string]$WorkingDirectory,
    [Parameter(Mandatory)]
    [string[]]$PnpmArguments
  )

  Push-Location -LiteralPath $WorkingDirectory
  try {
    & corepack pnpm @PnpmArguments
    if ($LASTEXITCODE -ne 0) {
      throw "pnpm failed with exit code $LASTEXITCODE in $WorkingDirectory"
    }
  } finally {
    Pop-Location
  }
}

Write-Host 'Building Harness...'
Invoke-Pnpm -WorkingDirectory $harnessRoot -PnpmArguments @('run', 'build')

Write-Host 'Building and starting DSH Desktop Unofficial...'
Invoke-Pnpm -WorkingDirectory $projectRoot -PnpmArguments @('run', 'dev')
