import { z } from "@hono/zod-openapi";

import { SparkHeadersSchema } from "../schema.js";
import { createRoute } from "@hono/zod-openapi";

export const BalanceSchema = z
    .object({
        address: z.string(),
        balance: z.number(),
        tokenBalances: z.array(z.object({
            balance: z.number(),
            tokenInfo: z.object({
                tokenIdentifier: z.string(),
                tokenPublicKey: z.string(),
                tokenName: z.string(),
                tokenSymbol: z.string(),
                tokenDecimals: z.number(),
                maxSupply: z.number(),
            }),
        })),
    })

export const balanceRoute = createRoute({
    method: 'get',
    path: '/balance',
    request: {
        headers: SparkHeadersSchema,
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: BalanceSchema,
                },
            },
            description: 'Retrieve the balance',
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


