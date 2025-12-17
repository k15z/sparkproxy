import { createRoute } from "@hono/zod-openapi"
import { z } from "@hono/zod-openapi"
import { SparkNetworkSchema } from "../schema.js"

export const CreateThirdPartyLightningInvoiceSchema = z.object({
    receiverIdentityPubkey: z.string().openapi({
        description: '33-byte compressed identity pubkey of the Spark user to receive funds',
        example: '02423ce5e55a0b6d244e77b0cc275e40b1cae911ee0c3134919d2761fbf969d365',
    }),
    amount: z.number().openapi({
        description: 'Amount in satoshis',
        example: 1000,
    }),
    memo: z.string().optional().default('').openapi({
        description: 'Invoice memo/description',
        example: 'Payment for services',
    }),
    expirySeconds: z.number().optional().default(60 * 60 * 24).openapi({
        description: 'Invoice expiry in seconds (default 24 hours)',
        example: 3600,
    }),
})

export const CreateThirdPartyLightningInvoiceOutputSchema = z.object({
    invoice: z.string().openapi({
        description: 'Encoded lightning invoice',
    }),
})

export const createThirdPartyLightningInvoiceRoute = createRoute({
    method: 'post',
    path: '/lightning/create-for-user',
    request: {
        headers: SparkNetworkSchema,
        body: {
            content: {
                'application/json': {
                    schema: CreateThirdPartyLightningInvoiceSchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: CreateThirdPartyLightningInvoiceOutputSchema,
                },
            },
            description: 'Create a lightning invoice for another Spark user (no wallet required)',
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
