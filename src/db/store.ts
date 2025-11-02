import IORedis from 'ioredis'
import type { Redis as RedisClient } from 'ioredis'
import * as crypto from 'crypto'

export type InvoiceRecord = {
  id: string
  created_at: number
  updated_at: number
  expires_at: number
  network: string
  mnemonic: string
  offers_json: string
  webhook_url: string
  sweep_address: string
  spark_address: string
  sending_address: string | null
  lightning_invoice: string
  paid: boolean
}

export type CreateInvoiceInput = Omit<
  InvoiceRecord,
  'id' | 'created_at' | 'updated_at' | 'paid' | 'sending_address'
> & { id?: string }

export interface InvoiceStore {
  create(input: CreateInvoiceInput): Promise<{ id: string }>
  getById(id: string): Promise<InvoiceRecord | null>
  markPaid(id: string, sendingAddress: string | null): Promise<void>
  listUnpaidAndUnexpired(nowMs: number): Promise<InvoiceRecord[]>
}

class InMemoryInvoiceStore implements InvoiceStore {
  private invoices = new Map<string, InvoiceRecord>()

  async create(input: CreateInvoiceInput): Promise<{ id: string }> {
    const id = input.id ?? crypto.randomUUID()
    const now = Date.now()
    const rec: InvoiceRecord = {
      id,
      created_at: now,
      updated_at: now,
      expires_at: input.expires_at,
      network: input.network,
      mnemonic: input.mnemonic,
      offers_json: input.offers_json,
      webhook_url: input.webhook_url,
      sweep_address: input.sweep_address,
      spark_address: input.spark_address,
      sending_address: null,
      lightning_invoice: input.lightning_invoice,
      paid: false,
    }
    this.invoices.set(id, rec)
    return { id }
  }

  async getById(id: string): Promise<InvoiceRecord | null> {
    return this.invoices.get(id) ?? null
  }

  async markPaid(id: string, sendingAddress: string | null): Promise<void> {
    const existing = this.invoices.get(id)
    if (!existing) return
    existing.paid = true
    existing.sending_address = sendingAddress
    existing.updated_at = Date.now()
    this.invoices.set(id, existing)
  }

  async listUnpaidAndUnexpired(nowMs: number): Promise<InvoiceRecord[]> {
    const all = Array.from(this.invoices.values())
    return all.filter((i) => !i.paid && i.expires_at > nowMs)
  }
}

class RedisInvoiceStore implements InvoiceStore {
  private redis: RedisClient
  private unpaidSetKey = 'invoices:unpaid'

  constructor(url: string) {
    const useTLS = url.startsWith('rediss://') || process.env.REDIS_TLS === '1' || process.env.REDIS_TLS === 'true'
    const rejectUnauthorized = !(process.env.REDIS_TLS_REJECT_UNAUTHORIZED === 'false' || process.env.REDIS_TLS_REJECT_UNAUTHORIZED === '0')
    const options = useTLS ? { tls: { rejectUnauthorized } } : undefined
    const RedisCtor = IORedis as unknown as { new (url: string, options?: any): RedisClient }
    this.redis = options ? new RedisCtor(url, options as any) : new RedisCtor(url)
  }

  private key(id: string) {
    return `invoice:${id}`
  }

  async create(input: CreateInvoiceInput): Promise<{ id: string }> {
    const id = input.id ?? crypto.randomUUID()
    const now = Date.now()
    const rec: InvoiceRecord = {
      id,
      created_at: now,
      updated_at: now,
      expires_at: input.expires_at,
      network: input.network,
      mnemonic: input.mnemonic,
      offers_json: input.offers_json,
      webhook_url: input.webhook_url,
      sweep_address: input.sweep_address,
      spark_address: input.spark_address,
      sending_address: null,
      lightning_invoice: input.lightning_invoice,
      paid: false,
    }
    const key = this.key(id)
    await this.redis.set(key, JSON.stringify(rec))
    await this.redis.sadd(this.unpaidSetKey, id)
    return { id }
  }

  async getById(id: string): Promise<InvoiceRecord | null> {
    const json = await this.redis.get(this.key(id))
    if (!json) return null
    try {
      return JSON.parse(json) as InvoiceRecord
    } catch {
      return null
    }
  }

  async markPaid(id: string, sendingAddress: string | null): Promise<void> {
    const key = this.key(id)
    const json = await this.redis.get(key)
    if (!json) return
    const rec = JSON.parse(json) as InvoiceRecord
    rec.paid = true
    rec.sending_address = sendingAddress
    rec.updated_at = Date.now()
    await this.redis.set(key, JSON.stringify(rec))
    await this.redis.srem(this.unpaidSetKey, id)
  }

  async listUnpaidAndUnexpired(nowMs: number): Promise<InvoiceRecord[]> {
    const ids = await this.redis.smembers(this.unpaidSetKey)
    if (ids.length === 0) return []
    const keys = ids.map((id: string) => this.key(id))
    const jsons = await this.redis.mget(...keys)
    const recs: InvoiceRecord[] = []
    for (const json of jsons) {
      if (!json) continue
      try {
        const rec = JSON.parse(json) as InvoiceRecord
        if (!rec.paid && rec.expires_at > nowMs) {
          recs.push(rec)
        } else if (rec.paid || rec.expires_at <= nowMs) {
          await this.redis.srem(this.unpaidSetKey, rec.id)
        }
      } catch {
      }
    }
    return recs
  }
}

let storeSingleton: InvoiceStore | null = null

export function getInvoiceStore(): InvoiceStore {
  if (storeSingleton) return storeSingleton
  const redisUrl = process.env.REDIS_URL
  if (redisUrl && redisUrl.length > 0) {
    storeSingleton = new RedisInvoiceStore(redisUrl)
  } else {
    storeSingleton = new InMemoryInvoiceStore()
  }
  return storeSingleton
}

export type IdempotencyRecord = {
  key: string
  created_at: number
  status_code: number
  response_body: string
  expires_at: number
}

export interface IdempotencyStore {
  get(key: string): Promise<IdempotencyRecord | null>
  set(key: string, statusCode: number, responseBody: string, ttlMs?: number): Promise<void>
}

class InMemoryIdempotencyStore implements IdempotencyStore {
  private records = new Map<string, IdempotencyRecord>()

  async get(key: string): Promise<IdempotencyRecord | null> {
    const record = this.records.get(key)
    if (!record) return null
    if (record.expires_at < Date.now()) {
      this.records.delete(key)
      return null
    }
    return record
  }

  async set(key: string, statusCode: number, responseBody: string, ttlMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    const now = Date.now()
    const record: IdempotencyRecord = {
      key,
      created_at: now,
      status_code: statusCode,
      response_body: responseBody,
      expires_at: now + ttlMs,
    }
    this.records.set(key, record)
    // Clean up expired records periodically (simple approach)
    if (this.records.size > 10000) {
      const cleanupNow = Date.now()
      for (const [k, v] of this.records.entries()) {
        if (v.expires_at < cleanupNow) {
          this.records.delete(k)
        }
      }
    }
  }
}

class RedisIdempotencyStore implements IdempotencyStore {
  private redis: RedisClient

  constructor(url: string) {
    const useTLS = url.startsWith('rediss://') || process.env.REDIS_TLS === '1' || process.env.REDIS_TLS === 'true'
    const rejectUnauthorized = !(process.env.REDIS_TLS_REJECT_UNAUTHORIZED === 'false' || process.env.REDIS_TLS_REJECT_UNAUTHORIZED === '0')
    const options = useTLS ? { tls: { rejectUnauthorized } } : undefined
    const RedisCtor = IORedis as unknown as { new (url: string, options?: any): RedisClient }
    this.redis = options ? new RedisCtor(url, options as any) : new RedisCtor(url)
  }

  private key(idempotencyKey: string) {
    return `idempotency:${idempotencyKey}`
  }

  async get(key: string): Promise<IdempotencyRecord | null> {
    const json = await this.redis.get(this.key(key))
    if (!json) return null
    try {
      return JSON.parse(json) as IdempotencyRecord
    } catch {
      return null
    }
  }

  async set(key: string, statusCode: number, responseBody: string, ttlMs: number = 24 * 60 * 60 * 1000): Promise<void> {
    const now = Date.now()
    const record: IdempotencyRecord = {
      key,
      created_at: now,
      status_code: statusCode,
      response_body: responseBody,
      expires_at: now + ttlMs,
    }
    const redisKey = this.key(key)
    const ttlSeconds = Math.ceil(ttlMs / 1000)
    await this.redis.setex(redisKey, ttlSeconds, JSON.stringify(record))
  }
}

let idempotencyStoreSingleton: IdempotencyStore | null = null

export function getIdempotencyStore(): IdempotencyStore {
  if (idempotencyStoreSingleton) return idempotencyStoreSingleton
  const redisUrl = process.env.REDIS_URL
  if (redisUrl && redisUrl.length > 0) {
    idempotencyStoreSingleton = new RedisIdempotencyStore(redisUrl)
  } else {
    idempotencyStoreSingleton = new InMemoryIdempotencyStore()
  }
  return idempotencyStoreSingleton
}


