[CmdletBinding()]
param(
  [string]$UpstreamPath,
  [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($UpstreamPath)) {
  $UpstreamPath = Join-Path $projectRoot '..\deepseek-harness'
}
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path $projectRoot '.build\deepseek-harness'
}

$manifestPath = Join-Path $projectRoot 'upstream\harness.json'
$pluginSources = @(
  (Join-Path $projectRoot 'harness-overrides\packages\client\ui-dsh-uo-upstream-status'),
  (Join-Path $projectRoot 'harness-overrides\packages\client\ui-dsh-uo-reasoning-effort')
)
$patchPaths = @(
  (Join-Path $projectRoot 'harness-overrides\patches\0001-dsh-uo-upstream-status.patch'),
  (Join-Path $projectRoot 'harness-overrides\patches\0002-dsh-uo-reasoning-effort.patch')
)

if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
  throw "Harness manifest not found: $manifestPath"
}
foreach ($pluginSource in $pluginSources) {
  if (-not (Test-Path -LiteralPath $pluginSource -PathType Container)) {
    throw "DSH-UO Harness plugin not found: $pluginSource"
  }
}
foreach ($patchPath in $patchPaths) {
  if (-not (Test-Path -LiteralPath $patchPath -PathType Leaf)) {
    throw "DSH-UO Harness patch not found: $patchPath"
  }
}

$manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath $manifestPath | ConvertFrom-Json
$commit = [string]$manifest.commit
if ($commit -notmatch '^[0-9a-fA-F]{40}$') {
  throw 'upstream/harness.json must contain a full Git commit SHA.'
}

$upstreamRoot = (Resolve-Path -LiteralPath $UpstreamPath).Path
if (-not (Test-Path -LiteralPath (Join-Path $upstreamRoot '.git'))) {
  throw "Upstream path is not a Git working tree: $upstreamRoot"
}

$preparedRoot = [IO.Path]::GetFullPath($OutputPath)
if (Test-Path -LiteralPath $preparedRoot) {
  throw "Prepared Harness path already exists: $preparedRoot`nRemove it with 'git -C `"$upstreamRoot`" worktree remove `"$preparedRoot`"' before preparing again."
}

function Invoke-Git {
  param([string[]]$GitArguments)
  & git @GitArguments
  if ($LASTEXITCODE -ne 0) {
    throw "git failed with exit code $LASTEXITCODE"
  }
}

Invoke-Git -GitArguments @('-c', "safe.directory=$upstreamRoot", '-C', $upstreamRoot, 'cat-file', '-e', "$commit^{commit}")
$outputParent = Split-Path -Parent $preparedRoot
New-Item -ItemType Directory -Path $outputParent -Force | Out-Null
Invoke-Git -GitArguments @('-c', "safe.directory=$upstreamRoot", '-C', $upstreamRoot, 'worktree', 'add', '--detach', $preparedRoot, $commit)

foreach ($pluginSource in $pluginSources) {
  $pluginDestination = Join-Path $preparedRoot "packages\client\$($pluginSource | Split-Path -Leaf)"
  Copy-Item -LiteralPath $pluginSource -Destination $pluginDestination -Recurse
}
foreach ($patchPath in $patchPaths) {
  Invoke-Git -GitArguments @(
    '-c', "safe.directory=$upstreamRoot",
    '-c', "safe.directory=$preparedRoot",
    '-C', $preparedRoot,
    'apply', '--whitespace=nowarn', $patchPath
  )
}
Copy-Item -LiteralPath $manifestPath -Destination (Join-Path $preparedRoot 'harness.json')

Write-Host "Prepared Harness source: $preparedRoot"
Write-Host "Pinned official commit: $commit"
Write-Host 'The source is ready for dependency installation and the Harness build.'
