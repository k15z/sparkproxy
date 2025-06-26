import { z } from '@hono/zod-openapi'
import { SparkHeadersSchema, SparkNetworkSchema } from '../schema'
import { createRoute } from '@hono/zod-openapi'

export const WalletInfoSchema = z.object({
    mnemonic: z.string(),
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
