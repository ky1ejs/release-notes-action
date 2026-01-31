import { Octokit } from '@octokit/rest'
import { throttling } from '@octokit/plugin-throttling'
import * as core from '@actions/core'

const ThrottledOctokit = Octokit.plugin(throttling)

export function createThrottledOctokit(token: string): Octokit {
  return new ThrottledOctokit({
    auth: token,
    throttle: {
      onRateLimit: (
        retryAfter: number,
        options: { method: string; url: string },
        _octokit: unknown,
        retryCount: number
      ) => {
        core.warning(
          `Rate limit hit for ${options.method} ${options.url}. Retrying after ${retryAfter}s (attempt ${retryCount + 1})`
        )
        // Retry up to 3 times
        if (retryCount < 3) {
          return true
        }
        core.error(
          `Rate limit retry exhausted for ${options.method} ${options.url}`
        )
        return false
      },
      onSecondaryRateLimit: (
        retryAfter: number,
        options: { method: string; url: string },
        _octokit: unknown,
        retryCount: number
      ) => {
        core.warning(
          `Secondary rate limit hit for ${options.method} ${options.url}. Retrying after ${retryAfter}s (attempt ${retryCount + 1})`
        )
        // Retry up to 2 times for secondary limits
        if (retryCount < 2) {
          return true
        }
        core.error(
          `Secondary rate limit retry exhausted for ${options.method} ${options.url}`
        )
        return false
      }
    }
  })
}
