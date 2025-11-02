import { z } from '@hono/zod-openapi'

export const SparkNetworkSchema = z.object({
    'spark-network': z.enum(['MAINNET', 'REGTEST']).openapi({
        example: 'MAINNET',
    }),
    'spark-environment': z.enum(['dev', 'prod']).openapi({
        example: 'prod',
    }).default('prod'),
})

export const SparkMnemonicSchema = z.object({
    'spark-mnemonic': z.string().openapi({
        example: 'pledge bid coral pitch slight cabbage slice mobile sound swallow brush luxury',
    }),
})

export const IdempotencyKeySchema = z.object({
    'idempotency-key': z.string().optional().openapi({
        description: 'Idempotency key to prevent duplicate operations',
        example: undefined
    }),
})

export const SparkHeadersSchema = SparkNetworkSchema.merge(SparkMnemonicSchema)


