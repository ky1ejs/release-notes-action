import * as cache from '@actions/cache'
import * as core from '@actions/core'
import * as fs from 'fs'
import * as path from 'path'
import type { PullRequestInfo } from '../ReleaseNotesBuilder'

const CACHE_VERSION = 'v1'
const CACHE_DIR = '.release-notes-cache'

export interface PRCacheData {
  commitToPRs: Record<string, PullRequestInfo[]>
  lastUpdated: string
}

function getCacheKey(owner: string, repo: string): string {
  return `release-notes-${CACHE_VERSION}-${owner}-${repo}`
}

function getCachePath(): string {
  return path.join(process.cwd(), CACHE_DIR, 'pr-cache.json')
}

function ensureCacheDir(): void {
  const cacheDir = path.join(process.cwd(), CACHE_DIR)
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true })
  }
}

export async function loadPRCache(
  owner: string,
  repo: string
): Promise<PRCacheData | null> {
  const cacheKey = getCacheKey(owner, repo)
  const cachePath = getCachePath()

  try {
    ensureCacheDir()

    const cacheHit = await cache.restoreCache(
      [path.join(process.cwd(), CACHE_DIR)],
      cacheKey,
      [`release-notes-${CACHE_VERSION}-${owner}-${repo}`]
    )

    if (cacheHit) {
      core.info(`PR cache restored from key: ${cacheHit}`)

      if (fs.existsSync(cachePath)) {
        const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'))
        const commitCount = Object.keys(data.commitToPRs || {}).length
        core.info(`Loaded ${commitCount} cached commit-to-PR mappings`)
        return data as PRCacheData
      }
    }

    core.info('No PR cache found, starting fresh')
    return null
  } catch (error) {
    core.warning(`Failed to load PR cache: ${error}`)
    return null
  }
}

export async function savePRCache(
  owner: string,
  repo: string,
  data: PRCacheData
): Promise<void> {
  const cacheKey = getCacheKey(owner, repo)
  const cachePath = getCachePath()

  try {
    ensureCacheDir()

    // Write cache data to file
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2))

    const commitCount = Object.keys(data.commitToPRs).length
    core.info(`Saving ${commitCount} commit-to-PR mappings to cache`)

    // Save to GitHub Actions cache
    await cache.saveCache(
      [path.join(process.cwd(), CACHE_DIR)],
      `${cacheKey}-${Date.now()}`
    )

    core.info('PR cache saved successfully')
  } catch (error) {
    // Cache save failures are non-fatal
    if (error instanceof Error && error.message.includes('already exists')) {
      core.info('Cache already exists, skipping save')
    } else {
      core.warning(`Failed to save PR cache: ${error}`)
    }
  }
}

export function filterUncachedCommits(
  commits: string[],
  cacheData: PRCacheData | null
): { uncached: string[]; cached: Map<string, PullRequestInfo[]> } {
  const cached = new Map<string, PullRequestInfo[]>()
  const uncached: string[] = []

  if (!cacheData) {
    return { uncached: commits, cached }
  }

  for (const commit of commits) {
    if (commit in cacheData.commitToPRs) {
      cached.set(commit, cacheData.commitToPRs[commit])
    } else {
      uncached.push(commit)
    }
  }

  return { uncached, cached }
}
