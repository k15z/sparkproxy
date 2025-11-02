import type { Context } from 'hono'
import { getIdempotencyStore } from './db/store.js'

export const devSparkConfig = JSON.parse(Buffer.from(process.env.DEV_SPARK_CONFIG!, 'base64').toString())

export const executionTimes: Record<string, Array<number>> = {};

export function unknownErrorToJson(err: unknown): string {
  if (err instanceof Error) {
    return JSON.stringify({
      name: err.name,
      message: err.message,
      stack: err.stack
    })
  } else {
    return JSON.stringify(err)
  }
}

/**
 * Handles idempotency key checks and response caching.
 * Returns the cached response if the idempotency key exists, otherwise returns null.
 */
export async function checkIdempotency(
  c: Context,
  idempotencyKey: string | undefined,
  operation: string
): Promise<any> {
  if (!idempotencyKey) {
    return null
  }

  const store = getIdempotencyStore()
  const record = await store.get(`${operation}:${idempotencyKey}`)
  
  if (record) {
    // Return the cached response
    return c.json(JSON.parse(record.response_body), record.status_code as any)
  }

  return null
}

/**
 * Stores the response for an idempotency key.
 */
export async function storeIdempotencyResponse(
  idempotencyKey: string | undefined,
  operation: string,
  statusCode: number,
  responseBody: unknown
): Promise<void> {
  if (!idempotencyKey) {
    return
  }

  const store = getIdempotencyStore()
  await store.set(
    `${operation}:${idempotencyKey}`,
    statusCode,
    JSON.stringify(responseBody),
    24 * 60 * 60 * 1000 // 24 hours TTL
  )
}
