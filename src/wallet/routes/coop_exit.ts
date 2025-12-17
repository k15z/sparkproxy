import { createRoute } from "@hono/zod-openapi"
import { z } from "@hono/zod-openapi"
import { SparkHeadersSchema, IdempotencyKeySchema } from "../schema.js"

export const ExitSpeedSchema = z.enum(["fast", "medium", "slow"]).openapi({
    description: 'Exit speed - fast (~1-2h, higher fees), medium (~4-6h), slow (~12-24h, lower fees)',
    example: 'fast',
})

export const CoopExitInputSchema = z.object({
    onchainAddress: z.string().openapi({
        description: 'Bitcoin address to withdraw to',
        example: 'bc1q...',
    }),
    amountSats: z.number().openapi({
        description: 'Amount to withdraw in satoshis',
        example: 100000,
    }),
    exitSpeed: ExitSpeedSchema.optional().openapi({
        description: 'Exit speed (defaults to "fast")',
    }),
    deductFeeFromWithdrawalAmount: z.boolean().optional().openapi({
        description: 'If true, fee is deducted from withdrawal amount. If false (default), fee is deducted from wallet balance.',
        example: false,
    }),
})

export const CoopExitOutputSchema = z.object({
    id: z.string().openapi({
        description: 'Withdrawal request ID for tracking',
        example: 'abc123...',
    }),
    onchainAddress: z.string().openapi({
        description: 'Bitcoin address receiving the funds',
        example: 'bc1q...',
    }),
    amountSats: z.number().openapi({
        description: 'Withdrawal amount in satoshis',
        example: 100000,
    }),
    feeSats: z.number().openapi({
        description: 'Fee charged in satoshis',
        example: 3000,
    }),
    exitSpeed: ExitSpeedSchema.openapi({
        description: 'Exit speed used',
    }),
    status: z.string().openapi({
        description: 'Current status of the withdrawal',
        example: 'pending',
    }),
})

export const coopExitRoute = createRoute({
    method: 'post',
    path: '/coop-exit',
    request: {
        headers: SparkHeadersSchema.merge(IdempotencyKeySchema),
        body: {
            content: {
                'application/json': {
                    schema: CoopExitInputSchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: CoopExitOutputSchema,
                },
            },
            description: 'Cooperative exit to Bitcoin L1',
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
