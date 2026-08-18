#!/usr/bin/env bash

set -euo pipefail
export CI=true

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
project_root=$(cd -- "$script_dir/.." && pwd)
export COREPACK_HOME="$project_root/.build/corepack"
export XDG_CACHE_HOME="$project_root/.build/xdg-cache"
export ELECTRON_BUILDER_CACHE="$project_root/.build/electron-builder-cache"
harness_root=${HARNESS_DIR:-"$project_root/.build/deepseek-harness-linux"}
runtime_root="$project_root/resources/runtime"
tarball_root="$project_root/.build/runtime-tarballs-linux-x64"
download_root="$project_root/.build/downloads"
manifest_path="$project_root/upstream/harness.json"
stage_script="$script_dir/stage-harness-runtime.mjs"
builder_config="$project_root/electron-builder.yml"
builder_cli="$project_root/node_modules/electron-builder/cli.js"
updater_package="$project_root/node_modules/electron-updater/package.json"
pnpm_package_source="$project_root/node_modules/pnpm"
pnpm_version=11.7.0

[[ $(uname -s) == Linux ]] || { echo 'The Linux portable package must be built on Linux.' >&2; exit 1; }
[[ $(uname -m) == x86_64 ]] || { echo 'The first portable release supports Linux x64 only.' >&2; exit 1; }

if command -v corepack >/dev/null 2>&1 && corepack pnpm --version >/dev/null 2>&1; then
  pnpm_cmd=(corepack pnpm)
elif command -v pnpm >/dev/null 2>&1 && pnpm --version >/dev/null 2>&1; then
  pnpm_cmd=(pnpm)
elif command -v npx >/dev/null 2>&1; then
  pnpm_cmd=(npx --yes "pnpm@$pnpm_version")
else
  echo "pnpm $pnpm_version is required. Install it with: npm install --global pnpm@$pnpm_version" >&2
  exit 1
fi

run_pnpm() {
  (cd -- "$1" && "${pnpm_cmd[@]}" --config.confirmModulesPurge=false --config.store-dir="$project_root/.build/pnpm-store" "${@:2}")
}

harness_package="$harness_root/package.json"
if [[ -f "$harness_package" ]]; then
  plugin_package="$harness_root/packages/client/ui-dsh-uo-plugin-manager/package.json"
  plugin_cli="$harness_root/apps/cli/src/plugin.ts"
  model_editor="$harness_root/packages/client/ui-settings-models/src/client/ModelListEditor.tsx"
  if [[ ! -f "$plugin_package" || ! -f "$plugin_cli" || ! -f "$model_editor" ]] \
      || ! grep -Fq 'DSH_DESKTOP_PNPM_CLI' "$plugin_cli" \
      || ! grep -Fq 'modelCapacityAutomatic' "$model_editor"; then
    echo "Prepared Harness is stale and does not contain the current DSH-UO overrides: $harness_root" >&2
    echo 'Remove this generated worktree and run packaging again.' >&2
    exit 1
  fi
fi

if [[ ! -f "$builder_cli" || ! -f "$updater_package" || ! -d "$pnpm_package_source" ]]; then
  echo 'Installing desktop dependencies...'
  run_pnpm "$project_root" install --frozen-lockfile
fi
[[ -f "$builder_cli" ]] || { echo "electron-builder was not found: $builder_cli" >&2; exit 1; }
[[ -f "$updater_package" ]] || { echo "electron-updater was not found: $updater_package" >&2; exit 1; }
[[ -d "$pnpm_package_source" ]] || { echo "pnpm was not found: $pnpm_package_source" >&2; exit 1; }

if [[ ! -f "$harness_package" ]]; then
  echo 'Preparing pinned Harness source...'
  bash "$script_dir/prepare-harness.sh" "" "$harness_root"
fi
[[ -f "$harness_package" ]] || { echo "Prepared Harness source was not found: $harness_root" >&2; exit 1; }
if [[ ! -d "$harness_root/node_modules" ]]; then
  echo 'Installing Harness dependencies...'
  run_pnpm "$harness_root" install --frozen-lockfile
fi

safe_remove() {
  case "$1" in
    "$project_root/.build/"*|"$project_root/resources/runtime") rm -rf -- "$1" ;;
    *) echo "Refusing to remove unexpected path: $1" >&2; exit 1 ;;
  esac
}

echo 'Building Harness...'
run_pnpm "$harness_root" run build:lib
run_pnpm "$harness_root" --filter @deepseek-ai/dsh-web-frontend run build
run_pnpm "$harness_root/native/landlock-run" run build:ts

safe_remove "$tarball_root"
mkdir -p -- "$tarball_root"
echo 'Packing Harness workspaces...'
run_pnpm "$harness_root" \
  --recursive \
  --filter './packages/**' \
  --filter './apps/**' \
  --filter './vendor/**' \
  --filter './native/landlock-run/packages/entry' \
  pack --pack-destination "$tarball_root"

echo 'Installing the standalone Harness runtime...'
node "$stage_script" \
  --harness "$harness_root" \
  --tarballs "$tarball_root" \
  --output "$runtime_root" \
  --manifest "$manifest_path"

node_version=$(node --version)
[[ "$node_version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo 'Unable to determine the current Node.js version.' >&2; exit 1; }
archive_name="node-$node_version-linux-x64.tar.xz"
archive_path="$download_root/$archive_name"
extract_root="$project_root/.build/node-$node_version-linux-x64"
node_url="https://nodejs.org/dist/$node_version/$archive_name"
mkdir -p -- "$download_root"
if [[ ! -f "$archive_path" ]]; then
  echo "Downloading Node.js $node_version..."
  curl --fail --location --output "$archive_path" "$node_url"
fi
safe_remove "$extract_root"
mkdir -p -- "$extract_root"
tar -xJf "$archive_path" -C "$extract_root"
node_source="$extract_root/node-$node_version-linux-x64"
mkdir -p -- "$runtime_root/node"
install -m 0755 "$node_source/bin/node" "$runtime_root/node/node"
cp -- "$node_source/LICENSE" "$runtime_root/node/LICENSE"

pnpm_shim_source="$script_dir/runtime-pnpm.sh"
[[ -d "$pnpm_package_source" ]] || { echo "Packaged pnpm dependency was not found: $pnpm_package_source" >&2; exit 1; }
[[ -f "$pnpm_shim_source" ]] || { echo "Packaged pnpm launcher was not found: $pnpm_shim_source" >&2; exit 1; }
cp -aL -- "$pnpm_package_source" "$runtime_root/pnpm"
install -m 0755 "$pnpm_shim_source" "$runtime_root/pnpm/pnpm"

echo 'Building the Electron portable ZIP and AppImage...'
run_pnpm "$project_root" run build
CSC_IDENTITY_AUTO_DISCOVERY=false node "$builder_cli" \
  --config "$builder_config" \
  --linux zip AppImage \
  --x64 \
  --publish never

package_version=$(cd -- "$project_root" && node -p "require('./package.json').version")
portable_archive="$project_root/release/DSH-UO-$package_version-linux-x64.zip"
marker_root="$project_root/.build/linux-portable-marker"
[[ -f "$portable_archive" ]] || { echo "Linux portable archive was not found: $portable_archive" >&2; exit 1; }
command -v zip >/dev/null 2>&1 || { echo 'zip is required to mark the Linux portable archive.' >&2; exit 1; }
safe_remove "$marker_root"
mkdir -p -- "$marker_root"
touch -- "$marker_root/.dsh-uo-portable"
zip -q -j "$portable_archive" "$marker_root/.dsh-uo-portable"
safe_remove "$marker_root"

echo "Linux portable packages written to $project_root/release"
