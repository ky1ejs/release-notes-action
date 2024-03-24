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
    .catch(() => null)

  let commits: string[]
  if (!lastTag) {
    commits = await oktokit.paginate(
      oktokit.rest.repos.listCommits,
      {
        owner: repoOwner,
        repo: repoName,
        per_page: 100
      },
      response => {
        return response.data.map(c => c.sha)
      }
    )
  } else {
    commits = await oktokit.rest.repos
      .compareCommits({
        owner: repoOwner,
        repo: repoName,
        base: lastTag,
        head: latestCommitHash
      })
      .then(response => {
        return response.data.commits.map(c => c.sha)
      })
    core.info(`Found ${commits.length} commits since last release`)
  }

  const commitFetchesPromises = commits.map(async c => {
    core.info(`Fetching: ${c}`)
    return oktokit.rest.repos.listPullRequestsAssociatedWithCommit({
      owner: repoOwner,
      repo: repoName,
      commit_sha: c
    })
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
  let changelog =
    '# Changes\n\nHere are the latest changes in the reverse chronological order:\n\n'
  Array.from(mergedPullRequests.values())
    .sort((a, b) => b.number - a.number)
    .forEach(pr => {
      let newItem = `* ([#${pr.number}](${pr.url})) ${pr.title}`
      if (pr.author) {
        newItem += ` by [@${pr.author.username}](${pr.author.url})`
      }
      changelog += newItem + '\n'
      core.setOutput('release-notes', changelog)
      core.info(changelog)
    })
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
