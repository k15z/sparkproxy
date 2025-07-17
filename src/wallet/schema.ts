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

export const SparkHeadersSchema = SparkNetworkSchema.merge(SparkMnemonicSchema)
