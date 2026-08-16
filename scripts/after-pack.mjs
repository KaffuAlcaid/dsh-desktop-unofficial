import { rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const executableName = 'dsh-uo'
const binaryName = 'dsh-uo-bin'
const launcher = `#!/bin/sh

ozone_platform_set=
for argument do
  case "$argument" in
    --ozone-platform|--ozone-platform=*) ozone_platform_set=1; break ;;
  esac
done

if [ "\${XDG_SESSION_TYPE:-}" = wayland ] && [ -z "$ozone_platform_set" ]; then
  set -- --ozone-platform=x11 "$@"
fi

launcher_dir=$(CDPATH= cd "$(dirname "$0")" && pwd)
exec "$launcher_dir/${binaryName}" "$@"
`

export default async function afterPack(context) {
  if (context.electronPlatformName !== 'linux') return

  const executable = join(context.appOutDir, executableName)
  await rename(executable, join(context.appOutDir, binaryName))
  await writeFile(executable, launcher, { encoding: 'utf8', mode: 0o755 })
}
