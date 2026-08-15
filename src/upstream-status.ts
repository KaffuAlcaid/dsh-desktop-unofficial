import { readFile } from 'node:fs/promises'
import { net } from 'electron'
import type { HarnessUpstreamState, HarnessUpstreamStatus } from './desktop-api.js'

const GITHUB_API_ROOT = 'https://api.github.com'
const REQUEST_TIMEOUT_MS = 15_000
const API_HEADERS = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'DSH-Desktop-Unofficial',
  'X-GitHub-Api-Version': '2022-11-28',
} as const

interface HarnessManifest {
  repository: string
  commit: string
  version: string
}

interface GitHubRepository {
  defaultBranch: string
}

interface GitHubCommit {
  sha: string
  url: string
  title: string
  committedAt: string
}

interface GitHubComparison {
  status: 'identical' | 'ahead' | 'behind' | 'diverged'
  aheadBy: number
  behindBy: number
}

/**
 * Compare the bundled Harness commit with the official repository's default branch.
 * @param manifestPath - path to the bundled Harness manifest.
 * @returns status data suitable for the isolated renderer.
 */
export async function checkHarnessUpstream(manifestPath: string): Promise<HarnessUpstreamStatus> {
  const manifest = await readManifest(manifestPath)
  const repository = parseGitHubRepository(manifest.repository)
  const apiBase = `${GITHUB_API_ROOT}/repos/${repository.owner}/${repository.name}`
  const repositoryInfo = parseRepository(await requestJson(apiBase))
  const branch = encodeURIComponent(repositoryInfo.defaultBranch)
  const latest = parseCommit(await requestJson(`${apiBase}/commits/${branch}`))

  let state: HarnessUpstreamState = 'current'
  let commitsBehind = 0
  let commitsAhead = 0
  if (latest.sha !== manifest.commit) {
    const comparison = parseComparison(await requestJson(
      `${apiBase}/compare/${manifest.commit}...${latest.sha}`,
    ))
    if (comparison.status === 'ahead') {
      state = 'behind'
      commitsBehind = comparison.aheadBy
    } else if (comparison.status === 'behind') {
      state = 'ahead'
      commitsAhead = comparison.behindBy
    } else if (comparison.status === 'diverged') {
      state = 'diverged'
      commitsBehind = comparison.aheadBy
      commitsAhead = comparison.behindBy
    }
  }

  return {
    state,
    defaultBranch: repositoryInfo.defaultBranch,
    currentVersion: manifest.version,
    currentCommit: manifest.commit,
    latestCommit: latest.sha,
    latestTitle: latest.title,
    latestCommittedAt: latest.committedAt,
    latestUrl: latest.url,
    commitsBehind,
    commitsAhead,
  }
}

async function readManifest(path: string): Promise<HarnessManifest> {
  const source = await readFile(path, 'utf8')
  let value: unknown
  try {
    value = JSON.parse(source) as unknown
  } catch {
    throw new Error(`Harness manifest is not valid JSON: ${path}`)
  }
  const record = requireRecord(value, 'Harness manifest')
  const repository = requireString(record, 'repository', 'Harness manifest')
  const commit = requireString(record, 'commit', 'Harness manifest')
  const version = requireString(record, 'version', 'Harness manifest')
  if (!/^[0-9a-f]{40}$/iu.test(commit)) throw new Error('Harness manifest commit must be a full Git SHA')
  return { repository, commit, version }
}

function parseGitHubRepository(repository: string): { owner: string; name: string } {
  let url: URL
  try {
    url = new URL(repository)
  } catch {
    throw new Error('Harness repository URL is invalid')
  }
  const parts = url.pathname.replace(/\.git$/u, '').split('/').filter(Boolean)
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || parts.length !== 2) {
    throw new Error('Harness repository must be a public GitHub HTTPS URL')
  }
  return { owner: parts[0]!, name: parts[1]! }
}

async function requestJson(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => { controller.abort() }, REQUEST_TIMEOUT_MS)
  try {
    const response = await net.fetch(url, {
      headers: API_HEADERS,
      signal: controller.signal,
    })
    const body = await response.json() as unknown
    if (!response.ok) {
      const detail = optionalString(body, 'message')
      throw new Error(`GitHub API returned HTTP ${String(response.status)}${detail === undefined ? '' : `: ${detail}`}`)
    }
    return body
  } catch (error) {
    if (controller.signal.aborted) throw new Error('GitHub request timed out')
    throw error
  } finally {
    clearTimeout(timer)
  }
}

function parseRepository(value: unknown): GitHubRepository {
  const record = requireRecord(value, 'GitHub repository response')
  return { defaultBranch: requireString(record, 'default_branch', 'GitHub repository response') }
}

function parseCommit(value: unknown): GitHubCommit {
  const record = requireRecord(value, 'GitHub commit response')
  const details = requireRecord(record['commit'], 'GitHub commit details')
  const committer = requireRecord(details['committer'], 'GitHub commit committer')
  const message = requireString(details, 'message', 'GitHub commit details')
  const committedAt = requireString(committer, 'date', 'GitHub commit committer')
  if (Number.isNaN(Date.parse(committedAt))) throw new Error('GitHub commit date is invalid')
  return {
    sha: requireString(record, 'sha', 'GitHub commit response'),
    url: requireString(record, 'html_url', 'GitHub commit response'),
    title: message.split(/\r?\n/u, 1)[0] ?? message,
    committedAt,
  }
}

function parseComparison(value: unknown): GitHubComparison {
  const record = requireRecord(value, 'GitHub comparison response')
  const status = requireString(record, 'status', 'GitHub comparison response')
  if (status !== 'identical' && status !== 'ahead' && status !== 'behind' && status !== 'diverged') {
    throw new Error(`GitHub comparison returned unknown status: ${status}`)
  }
  return {
    status,
    aheadBy: requireNumber(record, 'ahead_by', 'GitHub comparison response'),
    behindBy: requireNumber(record, 'behind_by', 'GitHub comparison response'),
  }
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} is not an object`)
  }
  return value as Record<string, unknown>
}

function requireString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key]
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label}.${key} is missing`)
  return value
}

function requireNumber(record: Record<string, unknown>, key: string, label: string): number {
  const value = record[key]
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label}.${key} is invalid`)
  }
  return value
}

function optionalString(value: unknown, key: string): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  const field = (value as Record<string, unknown>)[key]
  return typeof field === 'string' && field.length > 0 ? field : undefined
}
