import * as core from '@actions/core'
import { Octokit } from '@octokit/rest'

type BuilderInput = {
  githubToken: string
  repoOwner: string
  repoName: string
}

export async function buildReleaseNotes(input: BuilderInput): Promise<void> {
  const { githubToken, repoOwner, repoName } = input

  const oktokit = new Octokit({
    auth: githubToken
  })
  const latestCommitHash = await oktokit.rest.repos
    .getCommit({
      owner: repoOwner,
      repo: repoName,
      ref: 'heads/main'
    })
    .then(response => {
      return response.data.sha
    })
  const lastTag = await oktokit.rest.repos
    .getLatestRelease({
      owner: repoOwner,
      repo: repoName
    })
    .then(response => {
      return response.data.tag_name
    })
  const commits = await oktokit.rest.repos
    .compareCommits({
      owner: repoOwner,
      repo: repoName,
      base: lastTag,
      head: latestCommitHash
    })
    .then(response => {
      return response.data.commits
    })
  core.info(`Found ${commits.length} commits since last release`)

  const commitFetchesPromises = commits.map(async c => {
    core.info(`Fetching: ${c.sha}`)
    return oktokit.rest.repos.listPullRequestsAssociatedWithCommit({
      owner: repoOwner,
      repo: repoName,
      commit_sha: c.sha
    })
  })
  const commitFetches = await Promise.all(commitFetchesPromises)
  const mergedPullRequests = new Map<number, PullRequestInfo>()
  commitFetches.forEach(prs => {
    prs.data.forEach(pr => {
      if (pr && !!pr.merged_at && pr.labels.map(l => l.name).includes('ios')) {
        mergedPullRequests.set(pr.number, {
          number: pr.number,
          title: pr.title
        })
      }
    })
  })
  let changelog = ''
  for (const [number, pr] of mergedPullRequests) {
    changelog += `* ${pr.title} (#${number})\n`

    core.setOutput('release-notes', changelog)
    core.info(changelog)
  }
}

export interface PullRequestInfo {
  number: number
  title: string
}
