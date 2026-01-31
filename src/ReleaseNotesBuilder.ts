import * as core from '@actions/core'
import { retryOctokit } from './utils/retry'
import {
  generateMarkdownChangelog,
  generatePlaintextChangelog
} from './utils/changelogFormatter'
import { createThrottledOctokit } from './utils/throttledOctokit'
import { createRateLimiter } from './utils/rateLimiter'
import {
  loadPRCache,
  savePRCache,
  filterUncachedCommits,
  PRCacheData
} from './utils/prCache'

type BuilderInput = {
  githubToken: string
  repoOwner: string
  repoName: string
  outputFormats?: string[]
  concurrencyLimit?: number
  enableCache?: boolean
}

export async function buildReleaseNotes(input: BuilderInput): Promise<void> {
  const {
    githubToken,
    repoOwner,
    repoName,
    outputFormats = ['markdown'],
    concurrencyLimit = 10,
    enableCache = true
  } = input

  const oktokit = createThrottledOctokit(githubToken)
  const limit = createRateLimiter(concurrencyLimit)

  // Load cache if enabled
  let cacheData: PRCacheData | null = null
  if (enableCache) {
    cacheData = await loadPRCache(repoOwner, repoName)
  }
  const latestCommitHash = await retryOctokit(
    async () =>
      oktokit.rest.repos
        .getCommit({
          owner: repoOwner,
          repo: repoName,
          ref: 'heads/main'
        })
        .then(response => {
          return response.data.sha
        }),
    'Get latest commit hash'
  )
  const lastTag = await retryOctokit(
    async () =>
      oktokit.rest.repos
        .getLatestRelease({
          owner: repoOwner,
          repo: repoName
        })
        .then(response => {
          return response.data.tag_name
        })
        .catch(() => null),
    'Get latest release tag'
  )

  let commits: string[]
  if (!lastTag) {
    commits = await retryOctokit(
      async () =>
        oktokit.paginate(
          oktokit.rest.repos.listCommits,
          {
            owner: repoOwner,
            repo: repoName,
            per_page: 100
          },
          response => {
            return response.data.map(c => c.sha)
          }
        ),
      'List all commits'
    )
  } else {
    commits = await retryOctokit(
      async () =>
        oktokit.rest.repos
          .compareCommits({
            owner: repoOwner,
            repo: repoName,
            base: lastTag,
            head: latestCommitHash
          })
          .then(response => {
            return response.data.commits.map(c => c.sha)
          }),
      'Compare commits since last release'
    )
    core.info(`Found ${commits.length} commits since last release`)
  }

  // Filter out cached commits
  const { uncached, cached } = filterUncachedCommits(commits, cacheData)

  if (enableCache) {
    core.info(
      `Cache status: ${cached.size} cached, ${uncached.length} to fetch`
    )
  }

  // Fetch PRs for uncached commits with rate limiting
  const commitFetchesPromises = uncached.map(async c =>
    limit(async () => fetchPRsForCommit(oktokit, repoOwner, repoName, c))
  )
  const commitFetches = await Promise.all(commitFetchesPromises)

  // Build new cache entries from fetched data
  const newCacheEntries: Record<string, PullRequestInfo[]> = {}

  const mergedPullRequests = new Map<number, PullRequestInfo>()

  // Process fetched commits
  commitFetches.forEach(({ commit, data }) => {
    const prsForCommit: PullRequestInfo[] = []
    data.forEach(pr => {
      if (pr && !!pr.merged_at && pr.labels.map(l => l.name).includes('ios')) {
        let author: GitHubUser | undefined
        if (pr.user) {
          author = {
            username: pr.user.login,
            url: pr.user.html_url
          }
        }
        const prInfo: PullRequestInfo = {
          number: pr.number,
          title: pr.title,
          url: pr.html_url,
          author,
          mergedAt: pr.merged_at
        }
        prsForCommit.push(prInfo)
        mergedPullRequests.set(pr.number, prInfo)
      }
    })
    newCacheEntries[commit] = prsForCommit
  })

  // Process cached commits
  cached.forEach(prs => {
    prs.forEach(pr => {
      mergedPullRequests.set(pr.number, pr)
    })
  })

  // Save updated cache
  if (enableCache && uncached.length > 0) {
    const updatedCache: PRCacheData = {
      commitToPRs: {
        ...(cacheData?.commitToPRs || {}),
        ...newCacheEntries
      },
      lastUpdated: new Date().toISOString()
    }
    await savePRCache(repoOwner, repoName, updatedCache)
  }
  const pullRequests = Array.from(mergedPullRequests.values())

  if (outputFormats.includes('markdown')) {
    const markdownChangelog = generateMarkdownChangelog(pullRequests)
    core.setOutput('release-notes', markdownChangelog)
    core.info('Markdown changelog generated')
    core.info(markdownChangelog)
  }

  if (outputFormats.includes('plaintext')) {
    const plaintextChangelog = generatePlaintextChangelog(pullRequests)
    core.setOutput('release-notes-plaintext', plaintextChangelog)
    core.info('Plain text changelog generated')
    core.info(plaintextChangelog)
  }
}

export interface PullRequestInfo {
  number: number
  title: string
  url: string
  author?: GitHubUser
  mergedAt: string
}

export interface GitHubUser {
  username: string
  url: string
}

interface PRData {
  number: number
  title: string
  html_url: string
  merged_at: string | null
  labels: { name?: string }[]
  user: { login: string; html_url: string } | null
}

interface PRFetchResult {
  commit: string
  data: PRData[]
}

async function fetchPRsForCommit(
  oktokit: ReturnType<typeof createThrottledOctokit>,
  repoOwner: string,
  repoName: string,
  commit: string
): Promise<PRFetchResult> {
  core.info(`Fetching: ${commit}`)
  const result = await retryOctokit(
    async () =>
      oktokit.rest.repos.listPullRequestsAssociatedWithCommit({
        owner: repoOwner,
        repo: repoName,
        commit_sha: commit
      }),
    `Fetch PRs for commit ${commit.substring(0, 7)}`
  )
  return { commit, data: result.data }
}
