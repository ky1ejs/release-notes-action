import pLimit from 'p-limit'

export type RateLimiter = <T>(fn: () => Promise<T>) => Promise<T>

export function createRateLimiter(concurrency = 10): RateLimiter {
  return pLimit(concurrency)
}
