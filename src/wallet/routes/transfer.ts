import { createRoute } from "@hono/zod-openapi"
import { z } from "@hono/zod-openapi"
import { SparkHeadersSchema, IdempotencyKeySchema } from "../schema.js"

export const TransferSchema = z.object({
    amountSats: z.number(),
    receiverSparkAddress: z.string(),
})

export const TransferOutputSchema = z.object({
    id: z.string(),
})

export const transferRoute = createRoute({
    method: 'post',
    path: '/transfer',
    request: {
        headers: SparkHeadersSchema.merge(IdempotencyKeySchema),
        body: {
            content: {
                'application/json': {
                    schema: TransferSchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: TransferOutputSchema,
                },
            },
            description: 'Transfer sats',
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


