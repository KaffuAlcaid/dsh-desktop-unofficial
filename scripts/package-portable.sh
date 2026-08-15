#!/usr/bin/env bash

set -euo pipefail
export CI=true

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
project_root=$(cd -- "$script_dir/.." && pwd)
harness_root=${HARNESS_DIR:-"$project_root/.build/deepseek-harness-linux"}
runtime_root="$project_root/resources/runtime"
tarball_root="$project_root/.build/runtime-tarballs-linux-x64"
download_root="$project_root/.build/downloads"
manifest_path="$project_root/upstream/harness.json"
stage_script="$script_dir/stage-harness-runtime.mjs"
builder_config="$project_root/electron-builder.yml"
builder_cli="$project_root/node_modules/electron-builder/cli.js"
pnpm_version=11.7.0

[[ $(uname -s) == Linux ]] || { echo 'The Linux portable package must be built on Linux.' >&2; exit 1; }
[[ $(uname -m) == x86_64 ]] || { echo 'The first portable release supports Linux x64 only.' >&2; exit 1; }
[[ -f "$harness_root/package.json" ]] || {
  echo "Prepared Harness source was not found: $harness_root" >&2
  echo "Run: bash scripts/prepare-harness.sh" >&2
  exit 1
}
[[ -d "$harness_root/node_modules" ]] || { echo "Harness dependencies were not found: $harness_root/node_modules" >&2; exit 1; }

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
  (cd -- "$1" && "${pnpm_cmd[@]}" --config.confirmModulesPurge=false "${@:2}")
}

safe_remove() {
  case "$1" in
    "$project_root/.build/"*|"$project_root/resources/runtime") rm -rf -- "$1" ;;
    *) echo "Refusing to remove unexpected path: $1" >&2; exit 1 ;;
  esac
}

echo 'Building Harness...'
run_pnpm "$harness_root" run build
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

echo 'Building the Electron portable ZIP...'
run_pnpm "$project_root" run build
CSC_IDENTITY_AUTO_DISCOVERY=false node "$builder_cli" \
  --config "$builder_config" \
  --linux zip \
  --x64 \
  --publish never

echo "Linux portable package written to $project_root/release"
