import { createRoute } from "@hono/zod-openapi"
import { z } from "@hono/zod-openapi"
import { SparkHeadersSchema, IdempotencyKeySchema } from "../schema.js"

export const ClaimedDepositSchema = z.object({
    txHash: z.string().openapi({
        description: 'Transaction hash',
        example: 'abc123...',
    }),
    vout: z.number().openapi({
        description: 'Output index',
        example: 0,
    }),
    depositAmountSats: z.number().openapi({
        description: 'Gross deposit amount in satoshis',
        example: 100000,
    }),
    feeSats: z.number().openapi({
        description: 'Fee charged in satoshis',
        example: 500,
    }),
    claimedAmountSats: z.number().openapi({
        description: 'Net amount credited in satoshis',
        example: 99500,
    }),
})

export const ClaimAllStaticDepositsOutputSchema = z.object({
    claims: z.array(ClaimedDepositSchema).openapi({
        description: 'List of successfully claimed deposits',
    }),
    totalClaimedSats: z.number().openapi({
        description: 'Total amount credited to the wallet',
        example: 199000,
    }),
})

export const claimAllStaticDepositsRoute = createRoute({
    method: 'post',
    path: '/claim-all-static-deposits',
    request: {
        headers: SparkHeadersSchema.merge(IdempotencyKeySchema),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: ClaimAllStaticDepositsOutputSchema,
                },
            },
            description: 'Claim all unclaimed static deposits',
        },
        400: {
            content: {
                'application/json': {
                    schema: z.object({ error: z.string() }),
                },
            },
            description: 'Error',
        },
    },
    tags: ["Wallet"],
})
