import { createRoute } from "@hono/zod-openapi"
import { z } from "@hono/zod-openapi"
import { SparkHeadersSchema } from "../schema.js"

export const StaticDepositAddressOutputSchema = z.object({
    depositAddress: z.string().openapi({
        description: 'Bitcoin address for static deposits',
        example: 'bc1q...',
    }),
})

export const staticDepositAddressRoute = createRoute({
    method: 'get',
    path: '/static-deposit-address',
    request: {
        headers: SparkHeadersSchema,
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: StaticDepositAddressOutputSchema,
                },
            },
            description: 'Get static Bitcoin deposit address for the wallet',
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
