import { createRoute } from "@hono/zod-openapi"
import { z } from "@hono/zod-openapi"
import { SparkHeadersSchema } from "../schema.js"

export const DepositUtxoSchema = z.object({
    txHash: z.string().openapi({
        description: 'Transaction hash',
        example: 'abc123...',
    }),
    vout: z.number().openapi({
        description: 'Output index',
        example: 0,
    }),
    amountSats: z.number().openapi({
        description: 'Amount in satoshis',
        example: 100000,
    }),
    confirmations: z.number().openapi({
        description: 'Number of confirmations',
        example: 6,
    }),
    claimed: z.boolean().openapi({
        description: 'Whether this UTXO has been claimed',
        example: false,
    }),
})

export const DepositUtxosOutputSchema = z.object({
    utxos: z.array(DepositUtxoSchema),
})

export const depositUtxosRoute = createRoute({
    method: 'get',
    path: '/deposit-utxos',
    request: {
        headers: SparkHeadersSchema,
        query: z.object({
            depositAddress: z.string().openapi({
                description: 'The deposit address to query UTXOs for',
                example: 'bc1q...',
            }),
            includeClaimed: z.enum(['true', 'false']).optional().openapi({
                description: 'Include already-claimed UTXOs (defaults to "true")',
                example: 'true',
            }),
        }),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: DepositUtxosOutputSchema,
                },
            },
            description: 'List of UTXOs for the deposit address',
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
