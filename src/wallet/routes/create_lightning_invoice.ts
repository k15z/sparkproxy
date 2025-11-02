import { createRoute } from "@hono/zod-openapi"
import { z } from "@hono/zod-openapi"
import { SparkHeadersSchema, IdempotencyKeySchema } from "../schema.js"

export const CreateLightningInvoiceSchema = z.object({
    amount: z.number(),
    memo: z.string().optional().default(''),
    expirySeconds: z.number().optional().default(60 * 60 * 24),
})

export const CreateLightningInvoiceOutputSchema = z.object({
    invoice: z.string(),
})

export const createLightningInvoiceRoute = createRoute({
    method: 'post',
    path: '/lightning/create',
    request: {
        headers: SparkHeadersSchema.merge(IdempotencyKeySchema),
        body: {
            content: {
                'application/json': {
                    schema: CreateLightningInvoiceSchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: CreateLightningInvoiceOutputSchema,
                },
            },
            description: 'Create a lightning invoice',
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


