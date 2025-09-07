import * as core from '@actions/core'
import { RequestError } from '@octokit/request-error'

export interface RetryOptions {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  shouldRetry?: (error: Error | RequestError) => boolean
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  shouldRetry: (error: Error | RequestError) => {
    // Check if it's a RequestError from Octokit
    if (error instanceof RequestError) {
      const status = error.status
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
    } else if ('code' in error) {
      // Check for Node.js network errors (not RequestError, which also has a numeric 'code')
      const nodeError = error as NodeJS.ErrnoException
      if (typeof nodeError.code === 'string') {
        const retryableCodes = [
          'ECONNRESET',
          'ETIMEDOUT',
          'ENOTFOUND',
          'ECONNREFUSED'
        ]
        if (retryableCodes.includes(nodeError.code)) {
          return true
        }
      }
    }

    return false
  }
}

async function sleep(ms: number): Promise<void> {
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
  let lastError: Error | undefined
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
      // Ensure we have an Error object
      const errorObj = error instanceof Error ? error : new Error(String(error))
      lastError = errorObj

      if (attempt === opts.maxRetries) {
        core.error(
          `${context ? `[${context}] ` : ''}All ${opts.maxRetries} retry attempts failed`
        )
        throw errorObj
      }

      if (!opts.shouldRetry(errorObj)) {
        core.debug(
          `${context ? `[${context}] ` : ''}Error is not retryable: ${errorObj.message}`
        )
        throw errorObj
      }

      core.warning(
        `${context ? `[${context}] ` : ''}Request failed (attempt ${attempt + 1}/${
          opts.maxRetries + 1
        }): ${errorObj.message}`
      )
    }
  }

  throw lastError || new Error('Retry failed with unknown error')
}

export async function retryOctokit<T>(
  fn: () => Promise<T>,
  context: string,
  options?: RetryOptions
): Promise<T> {
  return retry(fn, options, context)
}
