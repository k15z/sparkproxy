import { createRoute } from "@hono/zod-openapi"
import { z } from "@hono/zod-openapi"
import { SparkHeadersSchema } from "../schema.js"

export const PayLightningInvoiceSchema = z.object({
    invoice: z.string(),
    maxFeeSats: z.number(),
})

export const PayLightningInvoiceOutputSchema = z.object({
    id: z.string(),
})

export const payLightningInvoiceRoute = createRoute({
    method: 'post',
    path: '/lightning/pay',
    request: {
        headers: SparkHeadersSchema,
        body: {
            content: {
                'application/json': {
                    schema: PayLightningInvoiceSchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: PayLightningInvoiceOutputSchema,
                },
            },
            description: 'Pay a lightning invoice',
        },
        400: {
            content: {
                'application/json': {
                    schema: z.object({ error: z.string() }),
                },
            },
            description: 'Failed to pay lightning invoice',
        },
    },
    tags: ["Wallet"],
})


