/**
 * @file lib/security/rate-limit.ts
 * @description Server-side sliding window rate limiter utility.
 *
 * Tracks request timestamps per client identifier (IP address or authenticated user ID).
 * Automatically expires old entries and returns detailed rate-limiting metadata,
 * including standard HTTP rate-limit headers and 429 response helpers.
 */

import 'server-only'
import { NextRequest, NextResponse } from 'next/server'

export interface RateLimitOptions {
  /** Maximum number of allowed requests in the time window */
  limit: number
  /** Duration of the sliding window in milliseconds (default: 60,000 ms = 1 min) */
  windowMs: number
  /** Optional custom prefix or route identifier */
  prefix?: string
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  success: boolean
  /** Configured request limit */
  limit: number
  /** Number of remaining allowed requests in current window */
  remaining: number
  /** Timestamp (epoch ms) when the oldest request in the window expires */
  resetTime: number
  /** Number of seconds until the client can retry if rate limited (0 if allowed) */
  retryAfterSeconds: number
}

// ---------------------------------------------------------------------------
// Rate Limit Presets
// ---------------------------------------------------------------------------

export const RATE_LIMIT_PRESETS = {
  /** AI Generation endpoint: 10 requests / minute */
  generate: { limit: 10, windowMs: 60 * 1000, prefix: 'api:generate' },
  /** Embedding / vectorization endpoint: 20 requests / minute */
  embed: { limit: 20, windowMs: 60 * 1000, prefix: 'api:embed' },
  /** Document upload endpoint: 20 requests / minute */
  upload: { limit: 20, windowMs: 60 * 1000, prefix: 'api:upload' },
  /** Document export (PDF/DOCX/GDocs): 20 requests / minute */
  export: { limit: 20, windowMs: 60 * 1000, prefix: 'api:export' },
  /** Sensitive auth operations: 5 requests / minute */
  auth: { limit: 5, windowMs: 60 * 1000, prefix: 'api:auth' },
  /** Default fallback: 60 requests / minute */
  default: { limit: 60, windowMs: 60 * 1000, prefix: 'api:default' },
} as const satisfies Record<string, RateLimitOptions>

// ---------------------------------------------------------------------------
// In-Memory Sliding Window Store
// ---------------------------------------------------------------------------

interface StoreEntry {
  timestamps: number[]
  lastPruned: number
}

// Global store to persist across requests in the Node/serverless runtime
const store = new Map<string, StoreEntry>()

// Run periodic garbage collection every 5 minutes to prevent memory leaks
const GC_INTERVAL_MS = 5 * 60 * 1000
let lastGlobalGc = Date.now()

function runStoreGarbageCollection(maxWindowMs = 300_000): void {
  const now = Date.now()
  if (now - lastGlobalGc < GC_INTERVAL_MS) return
  lastGlobalGc = now

  for (const [key, entry] of store.entries()) {
    const freshTimestamps = entry.timestamps.filter((t) => t > now - maxWindowMs)
    if (freshTimestamps.length === 0) {
      store.delete(key)
    } else {
      entry.timestamps = freshTimestamps
      entry.lastPruned = now
    }
  }
}

// ---------------------------------------------------------------------------
// Client Identification Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the real client IP address from standard proxy/CDN headers.
 */
export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0].trim()
    if (firstIp) return firstIp
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()

  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) return cfConnectingIp.trim()

  const trueClientIp = request.headers.get('true-client-ip')
  if (trueClientIp) return trueClientIp.trim()

  // Fallback
  return '127.0.0.1'
}

/**
 * Generates a unique rate limit identifier combining prefix, user ID (if authenticated), or client IP.
 */
export function getRateLimitKey(
  request: NextRequest,
  prefix = 'rate-limit',
  userId?: string | null
): string {
  const clientIdentifier = userId ? `user:${userId}` : `ip:${getClientIp(request)}`
  return `${prefix}:${clientIdentifier}`
}

// ---------------------------------------------------------------------------
// Rate Limiter Engine
// ---------------------------------------------------------------------------

/**
 * Checks and records a request against the sliding window rate limit for a given key.
 */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const { limit, windowMs } = options
  const now = Date.now()
  const windowStart = now - windowMs

  // Run periodic cleanup if needed
  runStoreGarbageCollection(windowMs * 2)

  let entry = store.get(key)
  if (!entry) {
    entry = { timestamps: [], lastPruned: now }
    store.set(key, entry)
  }

  // Filter timestamps within the active sliding window
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart)
  entry.lastPruned = now

  if (entry.timestamps.length >= limit) {
    const oldestTimestampInWindow = entry.timestamps[0]
    const resetTime = oldestTimestampInWindow + windowMs
    const retryAfterSeconds = Math.max(1, Math.ceil((resetTime - now) / 1000))

    return {
      success: false,
      limit,
      remaining: 0,
      resetTime,
      retryAfterSeconds,
    }
  }

  // Record this request
  entry.timestamps.push(now)

  const oldestTimestampInWindow = entry.timestamps[0]
  const resetTime = oldestTimestampInWindow + windowMs

  return {
    success: true,
    limit,
    remaining: Math.max(0, limit - entry.timestamps.length),
    resetTime,
    retryAfterSeconds: 0,
  }
}

/**
 * Convenience function to check rate limits directly for a NextRequest.
 */
export function rateLimit(
  request: NextRequest,
  options: RateLimitOptions,
  userId?: string | null
): RateLimitResult {
  const key = getRateLimitKey(request, options.prefix || 'rate-limit', userId)
  return checkRateLimit(key, options)
}

// ---------------------------------------------------------------------------
// HTTP Response Helpers
// ---------------------------------------------------------------------------

/**
 * Adds standard rate limiting headers to any NextResponse.
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult
): NextResponse {
  response.headers.set('X-RateLimit-Limit', result.limit.toString())
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
  response.headers.set('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString())

  if (!result.success && result.retryAfterSeconds > 0) {
    response.headers.set('Retry-After', result.retryAfterSeconds.toString())
  }

  return response
}

/**
 * Creates a standard JSON 429 Too Many Requests response with appropriate headers.
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  customMessage?: string
): NextResponse {
  const message =
    customMessage ||
    `Has excedido el límite de solicitudes (${result.limit} por ventana). Por favor intenta de nuevo en ${result.retryAfterSeconds} segundos.`

  const response = NextResponse.json(
    {
      success: false,
      error: message,
      retryAfter: result.retryAfterSeconds,
    },
    { status: 429 }
  )

  return addRateLimitHeaders(response, result)
}
