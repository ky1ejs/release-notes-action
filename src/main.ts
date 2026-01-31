import * as core from '@actions/core'
import * as github from '@actions/github'
import { buildReleaseNotes } from './ReleaseNotesBuilder'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  const outputFormatsInput = core.getInput('output-formats') || '["markdown"]'
  let outputFormats: string[]

  try {
    outputFormats = JSON.parse(outputFormatsInput)
    if (!Array.isArray(outputFormats)) {
      throw new Error('output-formats must be an array')
    }

    const validFormats = ['markdown', 'plaintext']
    for (const format of outputFormats) {
      if (!validFormats.includes(format)) {
        throw new Error(
          `Invalid output format: ${format}. Must be one of: ${validFormats.join(', ')}`
        )
      }
    }
  } catch (error) {
    core.warning(
      `Failed to parse output-formats: ${error}. Using default ["markdown"]`
    )
    outputFormats = ['markdown']
  }

  // Parse concurrency limit
  const concurrencyInput = core.getInput('concurrency-limit') || '10'
  let concurrencyLimit = 10
  try {
    concurrencyLimit = parseInt(concurrencyInput, 10)
    if (isNaN(concurrencyLimit) || concurrencyLimit < 1) {
      core.warning(
        `Invalid concurrency-limit: ${concurrencyInput}. Using default 10`
      )
      concurrencyLimit = 10
    }
  } catch {
    core.warning(
      `Failed to parse concurrency-limit: ${concurrencyInput}. Using default 10`
    )
    concurrencyLimit = 10
  }

  // Parse enable-cache
  const enableCacheInput = core.getInput('enable-cache') || 'true'
  const enableCache = enableCacheInput.toLowerCase() !== 'false'

  await buildReleaseNotes({
    githubToken: core.getInput('github-token'),
    repoOwner: github.context.repo.owner,
    repoName: github.context.repo.repo,
    outputFormats,
    concurrencyLimit,
    enableCache
  })
}

export interface PullRequestInfo {
  number: number
  title: string
}
