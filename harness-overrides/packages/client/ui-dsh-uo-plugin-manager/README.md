# DSH-UO Plugin Manager

Desktop-only browser plugin that contributes `Settings > Plugins > Manage`.
It lists dependencies from the desktop-owned `web` profile, installs npm
packages or local `.tgz` archives, updates and removes those dependencies, and
shows captured command output when an operation fails.

The package expects these preload methods on `window.dshDesktop`:

- `listPlugins()`
- `installPlugin(target)`
- `updatePlugin(target)`
- `removePlugin(target)`
- `pickPluginArchive()`
- `restartHarness()`

Mutation results mirror `src/plugin-manager.ts`. When a validated mutation
returns `restartRequired: true`, the tab paints its persistent restarting state
before invoking `restartHarness()` and does not wait for a renderer response.

Built-in bundles are not shown. The Electron backend supplies only dependencies
installed in `DSH_HOME/profiles/web/package.json`.
