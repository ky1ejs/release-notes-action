import * as core from '@actions/core'
import * as github from '@actions/github'
import { buildReleaseNotes } from './ReleaseNotesBuilder'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  await buildReleaseNotes({
    githubToken: core.getInput('github-token'),
    repoOwner: github.context.repo.owner,
    repoName: github.context.repo.repo
  })
}

export interface PullRequestInfo {
  number: number
  title: string
}
