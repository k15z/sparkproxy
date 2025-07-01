import { z } from "@hono/zod-openapi"
import { createRoute } from "@hono/zod-openapi"

export const CheckInvoiceSchema = z.object({
    invoice_id: z.number(),
    paid: z.boolean(),
    sending_address: z.string().nullable(),
})

export const checkInvoiceRoute = createRoute({
    method: 'get',
    path: '/{invoice_id}',
    request: {
        params: z.object({
            invoice_id: z.string(),
        }),
    },
    responses: {
        200: {
            content: {
                'application/json': {
                    schema: CheckInvoiceSchema,
                },
            },
            description: 'Initialize a new wallet',
        },
        404: {
            content: {
                'application/json': {
                    schema: z.object({ error: z.string() }),
                },
            },
            description: 'Invoice not found',
        },
    },
    tags: ["Payment"],
})