import { z } from '@hono/zod-openapi'
import { SparkHeadersSchema, SparkNetworkSchema } from '../schema.js'
import { createRoute } from '@hono/zod-openapi'

export const WalletInfoSchema = z.object({
    mnemonic: z.string(),
    address: z.string(),
})

export const initializeRoute = createRoute({
    method: 'get',
    path: '/initialize',
    request: {
        headers: SparkNetworkSchema,
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: WalletInfoSchema,
                },
            },
            description: 'Initialize a new wallet',
        },
    },
    tags: ["Wallet"],
})

export const batchInitializeRoute = createRoute({
    method: 'get',
    path: '/batch-initialize',
    request: {
        headers: SparkNetworkSchema,
        query: z.object({
            count: z.coerce.number().min(0).max(100),
        }),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: z.array(WalletInfoSchema),
                },
            },
            description: 'Initialize a batch of wallets',
        },
    },
    tags: ["Wallet"],
})


