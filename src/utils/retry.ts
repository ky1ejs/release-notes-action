import * as core from '@actions/core'

export interface RetryOptions {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  shouldRetry?: (error: unknown) => boolean
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  shouldRetry: (error: unknown) => {
    if (!error || typeof error !== 'object') {
      return false
    }

    const err = error as any

    // Network errors
    if (err.code && ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'].includes(err.code)) {
      return true
    }

    // HTTP status codes
    if (err.status) {
      const status = err.status
      // Retry on server errors (5xx)
      if (status >= 500 && status < 600) {
        return true
      }
      // Retry on rate limit
      if (status === 429) {
        return true
      }
      // Retry on request timeout
      if (status === 408) {
        return true
      }
    }

    // Octokit specific errors
    if (err.response?.status) {
      const status = err.response.status
      if (status >= 500 || status === 429 || status === 408) {
        return true
      }
    }

    return false
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function addJitter(delay: number): number {
  // Add up to 25% jitter
  return delay + Math.random() * delay * 0.25
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
  context?: string
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: unknown
  let delay = opts.initialDelay

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const jitteredDelay = addJitter(Math.min(delay, opts.maxDelay))
        core.info(
          `${context ? `[${context}] ` : ''}Retry attempt ${attempt}/${opts.maxRetries} after ${Math.round(
            jitteredDelay
          )}ms delay`
        )
        await sleep(jitteredDelay)
        delay *= opts.backoffMultiplier
      }

      return await fn()
    } catch (error) {
      lastError = error

      if (attempt === opts.maxRetries) {
        core.error(
          `${context ? `[${context}] ` : ''}All ${opts.maxRetries} retry attempts failed`
        )
        throw error
      }

      if (!opts.shouldRetry(error)) {
        core.debug(
          `${context ? `[${context}] ` : ''}Error is not retryable: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
        throw error
      }

      core.warning(
        `${context ? `[${context}] ` : ''}Request failed (attempt ${attempt + 1}/${
          opts.maxRetries + 1
        }): ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  throw lastError
}

export async function retryOctokit<T>(
  fn: () => Promise<T>,
  context: string,
  options?: RetryOptions
): Promise<T> {
  return retry(fn, options, context)
}