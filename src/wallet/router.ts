import { OpenAPIHono } from '@hono/zod-openapi'
import { initializeRoute, balanceRoute, transferRoute, tokenTransferRoute, payLightningInvoiceRoute, createLightningInvoiceRoute, batchInitializeRoute } from './routes/index.js'
import { unknownErrorToJson, checkIdempotency, storeIdempotencyResponse } from '../utils.js'
import { workerClient } from '../worker/client.js'
import type { Bech32mTokenIdentifier, SparkAddressFormat } from '@buildonspark/spark-sdk'

export const app = new OpenAPIHono()

app.openapi(initializeRoute, async (c) => {
    const { 'spark-network': network, 'spark-environment': environment } = c.req.valid('header')
    const { mnemonic, address } = await workerClient.initialize({ network, environment })
    return c.json({
        mnemonic: mnemonic,
        address: address,
    }, 200)
})

app.openapi(batchInitializeRoute, async (c) => {
    const { 'spark-network': network, 'spark-environment': environment } = c.req.valid('header')
    const count = c.req.valid('query').count
    const wallets = await Promise.all(Array.from({ length: count ?? 1 }, async () => {
        const { mnemonic, address } = await workerClient.initialize({ network, environment })
        return {
            mnemonic: mnemonic,
            address: address,
        }
    }))
    return c.json(wallets, 200)
})

app.openapi(balanceRoute, async (c) => {
    const { 'spark-mnemonic': mnemonic, 'spark-network': network, 'spark-environment': environment } = c.req.valid('header')
    try {
        const result = await workerClient.balance({ mnemonic, network, environment })
        return c.json(result, 200)
    } catch (err: unknown) {
        return c.json({ error: unknownErrorToJson(err) }, 400)
    }
})

app.openapi(transferRoute, async (c) => {
    const { 'spark-mnemonic': mnemonic, 'spark-network': network, 'spark-environment': environment, 'idempotency-key': idempotencyKey } = c.req.valid('header')
    
    // Check for existing idempotency key
    const cachedResponse = await checkIdempotency(c, idempotencyKey, 'transfer')
    if (cachedResponse) {
        return cachedResponse
    }
    
    try {
        const { id } = await workerClient.transfer({
            mnemonic,
            network,
            environment,
            amountSats: c.req.valid('json').amountSats,
            receiverSparkAddress: c.req.valid('json').receiverSparkAddress as SparkAddressFormat,
        })
        const response = { id }
        await storeIdempotencyResponse(idempotencyKey, 'transfer', 200, response)
        return c.json(response, 200)
    } catch (err: unknown) {
        const errorResponse = { error: unknownErrorToJson(err) }
        await storeIdempotencyResponse(idempotencyKey, 'transfer', 400, errorResponse)
        return c.json(errorResponse, 400)
    }
})

app.openapi(tokenTransferRoute, async (c) => {
    const { 'spark-mnemonic': mnemonic, 'spark-network': network, 'spark-environment': environment, 'idempotency-key': idempotencyKey } = c.req.valid('header')
    
    // Check for existing idempotency key
    const cachedResponse = await checkIdempotency(c, idempotencyKey, 'tokenTransfer')
    if (cachedResponse) {
        return cachedResponse
    }
    
    try {
        const { id } = await workerClient.transferTokens({
            mnemonic,
            network,
            environment,
            tokenIdentifier: c.req.valid('json').tokenIdentifier as Bech32mTokenIdentifier,
            tokenAmount: String(c.req.valid('json').tokenAmount),
            receiverSparkAddress: c.req.valid('json').receiverSparkAddress as SparkAddressFormat,
        })
        const response = { id }
        await storeIdempotencyResponse(idempotencyKey, 'tokenTransfer', 200, response)
        return c.json(response, 200)
    } catch (err: unknown) {
        const errorResponse = { error: unknownErrorToJson(err) }
        await storeIdempotencyResponse(idempotencyKey, 'tokenTransfer', 400, errorResponse)
        return c.json(errorResponse, 400)
    }
})

app.openapi(payLightningInvoiceRoute, async (c) => {
    const { 'spark-mnemonic': mnemonic, 'spark-network': network, 'spark-environment': environment, 'idempotency-key': idempotencyKey } = c.req.valid('header')
    
    // Check for existing idempotency key
    const cachedResponse = await checkIdempotency(c, idempotencyKey, 'payLightningInvoice')
    if (cachedResponse) {
        return cachedResponse
    }
    
    try {
        const { id } = await workerClient.payLightningInvoice({
            mnemonic,
            network,
            environment,
            invoice: c.req.valid('json').invoice,
            maxFeeSats: c.req.valid('json').maxFeeSats,
        })
        const response = { id }
        await storeIdempotencyResponse(idempotencyKey, 'payLightningInvoice', 200, response)
        return c.json(response, 200)
    } catch (err: unknown) {
        const errorResponse = { error: unknownErrorToJson(err) }
        await storeIdempotencyResponse(idempotencyKey, 'payLightningInvoice', 400, errorResponse)
        return c.json(errorResponse, 400)
    }
})

app.openapi(createLightningInvoiceRoute, async (c) => {
    const { 'spark-mnemonic': mnemonic, 'spark-network': network, 'spark-environment': environment, 'idempotency-key': idempotencyKey } = c.req.valid('header')
    
    // Check for existing idempotency key
    const cachedResponse = await checkIdempotency(c, idempotencyKey, 'createLightningInvoice')
    if (cachedResponse) {
        return cachedResponse
    }
    
    try {
        const { invoice } = await workerClient.createLightningInvoice({
            mnemonic,
            network,
            environment,
            amountSats: c.req.valid('json').amount,
            memo: c.req.valid('json').memo,
            expirySeconds: c.req.valid('json').expirySeconds,
        })
        const response = { invoice }
        await storeIdempotencyResponse(idempotencyKey, 'createLightningInvoice', 200, response)
        return c.json(response, 200)
    } catch (err: unknown) {
        const errorResponse = { error: unknownErrorToJson(err) }
        await storeIdempotencyResponse(idempotencyKey, 'createLightningInvoice', 400, errorResponse)
        return c.json(errorResponse, 400)
    }
})


