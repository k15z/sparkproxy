import { OpenAPIHono } from '@hono/zod-openapi'
import { initializeRoute, balanceRoute, transferRoute, tokenTransferRoute, payLightningInvoiceRoute, createLightningInvoiceRoute, batchInitializeRoute } from './routes'
import { unknownErrorToJson } from '../utils'
import { workerClient } from '../worker/client'
import { Bech32mTokenIdentifier, SparkAddressFormat } from '@buildonspark/spark-sdk'

export const app = new OpenAPIHono()

app.openapi(initializeRoute, async (c) => {
    const { 'spark-network': network, 'spark-environment': environment } = c.req.valid('header')
    const { mnemonic, address } = await workerClient.initialize({ network, environment })
    return c.json({
        mnemonic: mnemonic,
        address: address,
    }, 200)
})

// Warning: This crashes on MacOS for a large number of wallets.
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
    const { 'spark-mnemonic': mnemonic, 'spark-network': network, 'spark-environment': environment } = c.req.valid('header')
    try {
        const { id } = await workerClient.transfer({
            mnemonic,
            network,
            environment,
            amountSats: c.req.valid('json').amountSats,
            receiverSparkAddress: c.req.valid('json').receiverSparkAddress as SparkAddressFormat,
        })
        return c.json({ id }, 200)
    } catch (err: unknown) {
        return c.json({ error: unknownErrorToJson(err) }, 400)
    }
})

app.openapi(tokenTransferRoute, async (c) => {
    const { 'spark-mnemonic': mnemonic, 'spark-network': network, 'spark-environment': environment } = c.req.valid('header')
    try {
        const { id } = await workerClient.transferTokens({
            mnemonic,
            network,
            environment,
            tokenIdentifier: c.req.valid('json').tokenIdentifier as Bech32mTokenIdentifier,
            tokenAmount: String(c.req.valid('json').tokenAmount),
            receiverSparkAddress: c.req.valid('json').receiverSparkAddress as SparkAddressFormat,
        })
        return c.json({ id }, 200)
    } catch (err: unknown) {
        return c.json({ error: unknownErrorToJson(err) }, 400)
    }
})

app.openapi(payLightningInvoiceRoute, async (c) => {
    const { 'spark-mnemonic': mnemonic, 'spark-network': network, 'spark-environment': environment } = c.req.valid('header')
    try {
        const { id } = await workerClient.payLightningInvoice({
            mnemonic,
            network,
            environment,
            invoice: c.req.valid('json').invoice,
            maxFeeSats: c.req.valid('json').maxFeeSats,
        })
        return c.json({ id }, 200)
    } catch (err: unknown) {
        return c.json({ error: unknownErrorToJson(err) }, 400)
    }
})

app.openapi(createLightningInvoiceRoute, async (c) => {
    const { 'spark-mnemonic': mnemonic, 'spark-network': network, 'spark-environment': environment } = c.req.valid('header')
    try {
        const { invoice } = await workerClient.createLightningInvoice({
            mnemonic,
            network,
            environment,
            amountSats: c.req.valid('json').amount,
            memo: c.req.valid('json').memo,
            expirySeconds: c.req.valid('json').expirySeconds,
        })
        return c.json({ invoice }, 200)
    } catch (err: unknown) {
        return c.json({ error: unknownErrorToJson(err) }, 400)
    }
})