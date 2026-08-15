#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, parse, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function packageDirectories(harnessRoot) {
  const directories = []
  for (const category of readdirSync(join(harnessRoot, 'packages'), { withFileTypes: true })) {
    if (!category.isDirectory()) continue
    const categoryPath = join(harnessRoot, 'packages', category.name)
    for (const entry of readdirSync(categoryPath, { withFileTypes: true })) {
      if (entry.isDirectory() && existsSync(join(categoryPath, entry.name, 'package.json'))) {
        directories.push(join(categoryPath, entry.name))
      }
    }
  }
  for (const group of ['apps', 'vendor']) {
    const groupPath = join(harnessRoot, group)
    for (const entry of readdirSync(groupPath, { withFileTypes: true })) {
      if (entry.isDirectory() && existsSync(join(groupPath, entry.name, 'package.json'))) {
        directories.push(join(groupPath, entry.name))
      }
    }
  }
  directories.push(join(harnessRoot, 'native', 'landlock-run', 'packages', 'entry'))
  return directories
}

function tarballName(name, version) {
  const stem = name.startsWith('@') ? name.slice(1).replace('/', '-') : name
  return `${stem}-${version}.tgz`
}

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env })
  if (result.error !== undefined) throw result.error
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${String(result.status)}`)
}

const developmentDirectoryNames = new Set([
  '.github',
  '__tests__',
  'benchmark',
  'benchmarks',
  'doc',
  'docs',
  'example',
  'examples',
  'test',
  'tests',
])

function packageRoots(nodeModulesRoot, result = []) {
  if (!existsSync(nodeModulesRoot)) return result
  const roots = []
  for (const entry of readdirSync(nodeModulesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === '.bin') continue
    const entryPath = join(nodeModulesRoot, entry.name)
    if (entry.name.startsWith('@')) {
      for (const scopedEntry of readdirSync(entryPath, { withFileTypes: true })) {
        if (scopedEntry.isDirectory()) roots.push(join(entryPath, scopedEntry.name))
      }
    } else {
      roots.push(entryPath)
    }
  }
  for (const root of roots) {
    result.push(root)
    packageRoots(join(root, 'node_modules'), result)
  }
  return result
}

function treeStats(directory) {
  let files = 0
  let bytes = 0
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      const nested = treeStats(entryPath)
      files += nested.files
      bytes += nested.bytes
    } else if (entry.isFile()) {
      files += 1
      bytes += statSync(entryPath).size
    }
  }
  return { files, bytes }
}

function isDevelopmentFile(filename) {
  const lower = filename.toLowerCase()
  return lower.endsWith('.d.ts')
    || lower.endsWith('.d.mts')
    || lower.endsWith('.d.cts')
    || lower.endsWith('.map')
    || lower.endsWith('.pdb')
}

function pruneDevelopmentFiles(directory, summary) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      pruneDevelopmentFiles(entryPath, summary)
    } else if (entry.isFile() && isDevelopmentFile(entry.name)) {
      summary.files += 1
      summary.bytes += statSync(entryPath).size
      rmSync(entryPath, { force: true })
    }
  }
}

function pruneRuntime(nodeModulesRoot) {
  const summary = { files: 0, bytes: 0 }
  for (const root of packageRoots(nodeModulesRoot)) {
    for (const name of developmentDirectoryNames) {
      const directory = join(root, name)
      if (!existsSync(directory)) continue
      const removed = treeStats(directory)
      summary.files += removed.files
      summary.bytes += removed.bytes
      rmSync(directory, { recursive: true, force: true })
    }
  }
  pruneDevelopmentFiles(nodeModulesRoot, summary)
  console.log(
    `Pruned ${String(summary.files)} development files from the runtime (${(summary.bytes / 1024 / 1024).toFixed(2)} MiB)`,
  )
}

const { values } = parseArgs({
  options: {
    harness: { type: 'string' },
    tarballs: { type: 'string' },
    output: { type: 'string' },
    manifest: { type: 'string' },
  },
  allowPositionals: false,
})

if (values.harness === undefined || values.tarballs === undefined
  || values.output === undefined || values.manifest === undefined) {
  throw new Error('usage: stage-harness-runtime.mjs --harness <path> --tarballs <path> --output <path> --manifest <path>')
}

const harnessRoot = resolve(values.harness)
const tarballRoot = resolve(values.tarballs)
const outputRoot = resolve(values.output)
const manifestPath = resolve(values.manifest)
if (outputRoot === parse(outputRoot).root
  || basename(outputRoot) !== 'runtime'
  || basename(dirname(outputRoot)) !== 'resources') {
  throw new Error(`refusing to replace unexpected runtime path: ${outputRoot}`)
}
const allMembers = packageDirectories(harnessRoot).map((directory) => {
  const manifest = readJson(join(directory, 'package.json'))
  if (typeof manifest.name !== 'string' || typeof manifest.version !== 'string') {
    throw new Error(`${directory} has no package name or version`)
  }
  const tarball = join(tarballRoot, tarballName(manifest.name, manifest.version))
  if (!existsSync(tarball)) throw new Error(`packed Harness package was not found: ${tarball}`)
  return { name: manifest.name, version: manifest.version, tarball, manifest }
})

const membersByName = new Map()
for (const member of allMembers) {
  if (membersByName.has(member.name)) throw new Error(`duplicate Harness package: ${member.name}`)
  membersByName.set(member.name, member)
}

const reachableNames = new Set()
const pendingNames = ['@deepseek-ai/dsh']
while (pendingNames.length > 0) {
  const name = pendingNames.pop()
  if (reachableNames.has(name)) continue
  const member = membersByName.get(name)
  if (member === undefined) throw new Error(`Harness runtime package was not found: ${name}`)
  reachableNames.add(name)
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    for (const dependency of Object.keys(member.manifest[field] ?? {})) {
      if (membersByName.has(dependency) && !reachableNames.has(dependency)) pendingNames.push(dependency)
    }
  }
}
const members = allMembers.filter(member => reachableNames.has(member.name))

rmSync(outputRoot, { recursive: true, force: true })
mkdirSync(outputRoot, { recursive: true })
const localDependencies = Object.fromEntries(
  members.map(member => [member.name, pathToFileURL(member.tarball).href]),
)
writeFileSync(join(outputRoot, 'package.json'), `${JSON.stringify({
  name: 'dsh-uo-harness-runtime',
  version: '0.0.0',
  private: true,
  dependencies: localDependencies,
}, null, 2)}\n`)

const npmArgs = [
  'install',
  '--no-audit',
  '--no-fund',
  '--package-lock=false',
  '--foreground-scripts',
  '--omit=dev',
]
const npmEnv = { ...process.env, npm_config_cache: join(dirname(tarballRoot), 'npm-cache') }
if (process.platform === 'win32') {
  const npmCli = join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  if (!existsSync(npmCli)) throw new Error(`npm CLI was not found beside Node.js: ${npmCli}`)
  run(process.execPath, [npmCli, ...npmArgs], outputRoot, npmEnv)
} else {
  run('npm', npmArgs, outputRoot, npmEnv)
}

pruneRuntime(join(outputRoot, 'node_modules'))

writeFileSync(join(outputRoot, 'package.json'), `${JSON.stringify({
  name: 'dsh-uo-harness-runtime',
  version: '0.0.0',
  private: true,
  dependencies: Object.fromEntries(members.map(member => [member.name, member.version])),
}, null, 2)}\n`)
copyFileSync(manifestPath, join(outputRoot, 'harness.json'))
for (const filename of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) {
  const source = join(harnessRoot, filename)
  if (existsSync(source)) copyFileSync(source, join(outputRoot, `HARNESS_${basename(filename)}`))
}

const entry = join(outputRoot, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
if (!existsSync(entry)) throw new Error(`installed Harness entry was not found: ${entry}`)
run(process.execPath, [entry, '--version'], outputRoot)
console.log(`Harness runtime staged at ${outputRoot}`)
