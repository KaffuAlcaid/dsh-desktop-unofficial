[CmdletBinding()]
param(
  [string]$UpstreamPath,
  [string]$OutputPath
)

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$automaticUpstream = [string]::IsNullOrWhiteSpace($UpstreamPath)
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path $projectRoot '.build\deepseek-harness'
}

$manifestPath = Join-Path $projectRoot 'upstream\harness.json'
$pluginSources = @(
  (Join-Path $projectRoot 'harness-overrides\packages\client\ui-dsh-uo-upstream-status'),
  (Join-Path $projectRoot 'harness-overrides\packages\client\ui-dsh-uo-reasoning-effort'),
  (Join-Path $projectRoot 'harness-overrides\packages\client\ui-dsh-uo-model-input'),
  (Join-Path $projectRoot 'harness-overrides\packages\client\ui-dsh-uo-system-prompt')
)
$patchPaths = @(
  (Join-Path $projectRoot 'harness-overrides\patches\0001-dsh-uo-upstream-status.patch'),
  (Join-Path $projectRoot 'harness-overrides\patches\0002-dsh-uo-reasoning-effort.patch'),
  (Join-Path $projectRoot 'harness-overrides\patches\0003-dsh-uo-model-input.patch'),
  (Join-Path $projectRoot 'harness-overrides\patches\0004-pi-ai-developer-role.patch'),
  (Join-Path $projectRoot 'harness-overrides\patches\0005-agent-preset-persona-api.patch'),
  (Join-Path $projectRoot 'harness-overrides\patches\0006-dsh-uo-system-prompt-editor.patch')
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

function Invoke-Git {
  param([string[]]$GitArguments)
  & git @GitArguments
  if ($LASTEXITCODE -ne 0) {
    throw "git failed with exit code $LASTEXITCODE"
  }
}

if ($automaticUpstream) {
  $repository = [string]$manifest.repository
  if ([string]::IsNullOrWhiteSpace($repository)) {
    throw 'upstream/harness.json must contain a repository URL.'
  }
  $UpstreamPath = Join-Path $projectRoot '.build\deepseek-harness-upstream'
  if (Test-Path -LiteralPath $UpstreamPath) {
    if (-not (Test-Path -LiteralPath (Join-Path $UpstreamPath '.git') -PathType Container)) {
      throw "Automatic upstream path is not a Git working tree: $UpstreamPath"
    }
    Invoke-Git -GitArguments @('-C', $UpstreamPath, 'remote', 'set-url', 'origin', $repository)
  } else {
    $upstreamParent = Split-Path -Parent $UpstreamPath
    New-Item -ItemType Directory -Path $upstreamParent -Force | Out-Null
    Invoke-Git -GitArguments @('init', $UpstreamPath)
    Invoke-Git -GitArguments @('-C', $UpstreamPath, 'remote', 'add', 'origin', $repository)
  }
  Invoke-Git -GitArguments @('-C', $UpstreamPath, 'fetch', '--depth=1', 'origin', $commit)
}

$upstreamRoot = (Resolve-Path -LiteralPath $UpstreamPath).Path
if (-not (Test-Path -LiteralPath (Join-Path $upstreamRoot '.git'))) {
  throw "Upstream path is not a Git working tree: $upstreamRoot"
}

$preparedRoot = [IO.Path]::GetFullPath($OutputPath)
if (Test-Path -LiteralPath $preparedRoot) {
  throw "Prepared Harness path already exists: $preparedRoot`nRemove it with 'git -C `"$upstreamRoot`" worktree remove `"$preparedRoot`"' before preparing again."
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
