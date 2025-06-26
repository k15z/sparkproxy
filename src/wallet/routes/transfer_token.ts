import { createRoute } from "@hono/zod-openapi"
import { z } from "@hono/zod-openapi"
import { SparkHeadersSchema } from "../schema"

export const TokenTransferSchema = z.object({
    tokenPublicKey: z.string(),
    tokenAmount: z.number(),
    receiverSparkAddress: z.string(),
})

export const TokenTransferOutputSchema = z.object({
    id: z.string(),
})
export const tokenTransferRoute = createRoute({
    method: 'post',
    path: '/token-transfer',
    request: {
        headers: SparkHeadersSchema,
        body: {
            content: {
                'application/json': {
                    schema: TokenTransferSchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: TokenTransferOutputSchema,
                },
            },
            description: 'Transfer tokens',
        },
        400: {
            content: {
                'application/json': {
                    schema: z.object({
                        error: z.string(),
                    }),
                },
            },
            description: 'Error',
        },
    },
    tags: ["Wallet"],
})