import { createRoute } from "@hono/zod-openapi"
import { z } from "@hono/zod-openapi"
import { SparkHeadersSchema, IdempotencyKeySchema } from "../schema.js"

export const ClaimStaticDepositInputSchema = z.object({
    txHash: z.string().openapi({
        description: 'Transaction hash of the deposit to claim',
        example: 'abc123...',
    }),
    vout: z.number().openapi({
        description: 'Output index of the deposit to claim',
        example: 0,
    }),
})

export const ClaimStaticDepositOutputSchema = z.object({
    depositAmountSats: z.number().openapi({
        description: 'Gross deposit amount in satoshis',
        example: 100000,
    }),
    feeSats: z.number().openapi({
        description: 'Fee charged in satoshis',
        example: 500,
    }),
    claimedAmountSats: z.number().openapi({
        description: 'Net amount credited to the wallet in satoshis',
        example: 99500,
    }),
})

export const claimStaticDepositRoute = createRoute({
    method: 'post',
    path: '/claim-static-deposit',
    request: {
        headers: SparkHeadersSchema.merge(IdempotencyKeySchema),
        body: {
            content: {
                'application/json': {
                    schema: ClaimStaticDepositInputSchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: ClaimStaticDepositOutputSchema,
                },
            },
            description: 'Claim a specific static deposit',
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
