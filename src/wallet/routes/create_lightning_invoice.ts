import { createRoute } from "@hono/zod-openapi"
import { z } from "@hono/zod-openapi"
import { SparkHeadersSchema } from "../schema"

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
        headers: SparkHeadersSchema,
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
    },
    tags: ["Wallet"],
})