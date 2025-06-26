import { createRoute, z } from "@hono/zod-openapi"

export const OfferSchema = z.object({
    asset: z.enum(["BITCOIN", "TOKEN"]).default("BITCOIN"),
    amount: z.number().default(1000),
    token_pubkey: z.string().default('').describe('If asset is TOKEN, the public key of the token.'),
})

export const CreateInputSchema = z
    .object({
        network: z.enum(['MAINNET', 'REGTEST']).default('MAINNET'),
        webhook_url: z.string().default('').describe('The webhook to POST to when the invoice is paid.'),
        spark_address: z.string().default('sp1pgssxfl73kl4z0zdr3rp2v9dcvsuwk7h77ctylk5eds9ylqs3lpftnxy5eatep').describe('The Spark address to sweep the balance to.'),
        offers: z.array(OfferSchema).describe('The unit/amount of each asset that you are willing to accept.'),
    })

export const CreateOutputSchema = z
    .object({
        invoice_id: z.number(),
        spark_address: z.string(),
        lightning_invoice: z.string(),
    })

export const createInvoiceRoute = createRoute({
    method: 'post',
    path: '/',
    request: {
        body: {
            content: {
                'application/json': {
                    schema: CreateInputSchema,
                },
            },
        },
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: CreateOutputSchema,
                },
            },
            description: 'Initialize a new wallet',
        },
        400: {
            content: {
                'application/json': {
                    schema: z.object({
                        error: z.string(),
                    }),
                },
            },
            description: 'Bad Request',
        }
    },
    tags: ["Payment"],
})