import * as core from '@actions/core'
import { Octokit } from '@octokit/rest'
import { retryOctokit } from './utils/retry'
import {
  generateMarkdownChangelog,
  generatePlaintextChangelog
} from './utils/changelogFormatter'

type BuilderInput = {
  githubToken: string
  repoOwner: string
  repoName: string
  outputFormats?: string[]
}

export async function buildReleaseNotes(input: BuilderInput): Promise<void> {
  const {
    githubToken,
    repoOwner,
    repoName,
    outputFormats = ['markdown']
  } = input

  const oktokit = new Octokit({
    auth: githubToken
  })
  const latestCommitHash = await retryOctokit(
    () =>
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
    () =>
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
      () =>
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
      () =>
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

  const commitFetchesPromises = commits.map(async c => {
    core.info(`Fetching: ${c}`)
    return retryOctokit(
      () =>
        oktokit.rest.repos.listPullRequestsAssociatedWithCommit({
          owner: repoOwner,
          repo: repoName,
          commit_sha: c
        }),
      `Fetch PRs for commit ${c.substring(0, 7)}`
    )
  })
  const commitFetches = await Promise.all(commitFetchesPromises)
  const mergedPullRequests = new Map<number, PullRequestInfo>()
  commitFetches.forEach(prs => {
    prs.data.forEach(pr => {
      if (pr && !!pr.merged_at && pr.labels.map(l => l.name).includes('ios')) {
        let author: GitHubUser | undefined
        if (pr.user) {
          author = {
            username: pr.user.login,
            url: pr.user.html_url
          }
        }
        mergedPullRequests.set(pr.number, {
          number: pr.number,
          title: pr.title,
          url: pr.html_url,
          author
        })
      }
    })
  })
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
}

export interface GitHubUser {
  username: string
  url: string
}
