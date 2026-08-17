#!/usr/bin/env bash

set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
project_root=$(cd -- "$script_dir/.." && pwd)
upstream_path=${1:-}
output_path=${2:-"$project_root/.build/deepseek-harness-linux"}
manifest_path="$project_root/upstream/harness.json"

plugin_sources=(
  "$project_root/harness-overrides/packages/client/ui-dsh-uo-upstream-status"
  "$project_root/harness-overrides/packages/client/ui-dsh-uo-reasoning-effort"
  "$project_root/harness-overrides/packages/client/ui-dsh-uo-model-input"
  "$project_root/harness-overrides/packages/client/ui-dsh-uo-system-prompt"
)
patch_paths=(
  "$project_root/harness-overrides/patches/0001-dsh-uo-upstream-status.patch"
  "$project_root/harness-overrides/patches/0002-dsh-uo-reasoning-effort.patch"
  "$project_root/harness-overrides/patches/0003-dsh-uo-model-input.patch"
  "$project_root/harness-overrides/patches/0004-pi-ai-developer-role.patch"
  "$project_root/harness-overrides/patches/0005-agent-preset-persona-api.patch"
  "$project_root/harness-overrides/patches/0006-dsh-uo-system-prompt-editor.patch"
)

[[ -f "$manifest_path" ]] || { echo "Harness manifest not found: $manifest_path" >&2; exit 1; }
for source in "${plugin_sources[@]}"; do
  [[ -d "$source" ]] || { echo "DSH-UO Harness plugin not found: $source" >&2; exit 1; }
done
for patch in "${patch_paths[@]}"; do
  [[ -f "$patch" ]] || { echo "DSH-UO Harness patch not found: $patch" >&2; exit 1; }
done

commit=$(node -e 'const fs = require("node:fs"); const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(String(value.commit ?? ""))' "$manifest_path")
[[ "$commit" =~ ^[0-9a-fA-F]{40}$ ]] || { echo 'upstream/harness.json must contain a full Git commit SHA.' >&2; exit 1; }

if [[ -z "$upstream_path" ]]; then
  repository=$(node -e 'const fs = require("node:fs"); const value = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(String(value.repository ?? ""))' "$manifest_path")
  [[ -n "$repository" ]] || { echo 'upstream/harness.json must contain a repository URL.' >&2; exit 1; }
  upstream_path="$project_root/.build/deepseek-harness-upstream"
  if [[ -e "$upstream_path" && ! -d "$upstream_path/.git" ]]; then
    echo "Automatic upstream path is not a Git working tree: $upstream_path" >&2
    exit 1
  fi
  if [[ ! -d "$upstream_path/.git" ]]; then
    mkdir -p -- "$(dirname -- "$upstream_path")"
    git init "$upstream_path"
    git -C "$upstream_path" remote add origin "$repository"
  else
    git -C "$upstream_path" remote set-url origin "$repository"
  fi
  git -C "$upstream_path" fetch --depth=1 origin "$commit"
fi

upstream_root=$(realpath "$upstream_path")
prepared_root=$(realpath -m "$output_path")
[[ -d "$upstream_root/.git" ]] || { echo "Upstream path is not a Git working tree: $upstream_root" >&2; exit 1; }
[[ ! -e "$prepared_root" ]] || {
  echo "Prepared Harness path already exists: $prepared_root" >&2
  echo "Remove it with: git -C '$upstream_root' worktree remove '$prepared_root'" >&2
  exit 1
}

git -c "safe.directory=$upstream_root" -C "$upstream_root" cat-file -e "$commit^{commit}"
mkdir -p -- "$(dirname -- "$prepared_root")"
git -c "safe.directory=$upstream_root" -C "$upstream_root" worktree add --detach "$prepared_root" "$commit"

for source in "${plugin_sources[@]}"; do
  cp -R -- "$source" "$prepared_root/packages/client/"
done
for patch in "${patch_paths[@]}"; do
  git -c "safe.directory=$upstream_root" -c "safe.directory=$prepared_root" -C "$prepared_root" apply --whitespace=nowarn "$patch"
done
cp -- "$manifest_path" "$prepared_root/harness.json"

echo "Prepared Harness source: $prepared_root"
echo "Pinned official commit: $commit"
