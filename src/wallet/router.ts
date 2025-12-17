import { OpenAPIHono } from '@hono/zod-openapi'
import {
    initializeRoute,
    balanceRoute,
    transferRoute,
    tokenTransferRoute,
    payLightningInvoiceRoute,
    createLightningInvoiceRoute,
    createThirdPartyLightningInvoiceRoute,
    batchInitializeRoute,
    staticDepositAddressRoute,
    depositUtxosRoute,
    claimStaticDepositRoute,
    claimAllStaticDepositsRoute,
    coopExitRoute,
} from './routes/index.js'
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

app.openapi(createThirdPartyLightningInvoiceRoute, async (c) => {
    const { 'spark-network': network, 'spark-environment': environment } = c.req.valid('header')
    const { receiverIdentityPubkey, amount, memo, expirySeconds } = c.req.valid('json')
    
    try {
        const { invoice } = await workerClient.createThirdPartyLightningInvoice({
            network,
            environment,
            receiverIdentityPubkey,
            amountSats: amount,
            memo,
            expirySeconds,
        })
        return c.json({ invoice }, 200)
    } catch (err: unknown) {
        return c.json({ error: unknownErrorToJson(err) }, 400)
    }
})

app.openapi(staticDepositAddressRoute, async (c) => {
    const { 'spark-mnemonic': mnemonic, 'spark-network': network, 'spark-environment': environment } = c.req.valid('header')
    try {
        const { depositAddress } = await workerClient.getStaticDepositAddress({
            mnemonic,
            network,
            environment,
        })
        return c.json({ depositAddress }, 200)
    } catch (err: unknown) {
        return c.json({ error: unknownErrorToJson(err) }, 400)
    }
})

app.openapi(depositUtxosRoute, async (c) => {
    const { 'spark-mnemonic': mnemonic, 'spark-network': network, 'spark-environment': environment } = c.req.valid('header')
    const { depositAddress, includeClaimed } = c.req.valid('query')
    try {
        const { utxos } = await workerClient.getDepositUtxos({
            mnemonic,
            network,
            environment,
            depositAddress,
            includeClaimed: includeClaimed !== 'false', // defaults to true
        })
        return c.json({ utxos }, 200)
    } catch (err: unknown) {
        return c.json({ error: unknownErrorToJson(err) }, 400)
    }
})

app.openapi(claimStaticDepositRoute, async (c) => {
    const { 'spark-mnemonic': mnemonic, 'spark-network': network, 'spark-environment': environment, 'idempotency-key': idempotencyKey } = c.req.valid('header')
    const { txHash, vout } = c.req.valid('json')
    
    // Check for existing idempotency key
    const cachedResponse = await checkIdempotency(c, idempotencyKey, 'claimStaticDeposit')
    if (cachedResponse) {
        return cachedResponse
    }
    
    try {
        const { depositAmountSats, feeSats, claimedAmountSats } = await workerClient.claimStaticDeposit({
            mnemonic,
            network,
            environment,
            txHash,
            vout,
        })
        const response = { depositAmountSats, feeSats, claimedAmountSats }
        await storeIdempotencyResponse(idempotencyKey, 'claimStaticDeposit', 200, response)
        return c.json(response, 200)
    } catch (err: unknown) {
        const errorResponse = { error: unknownErrorToJson(err) }
        await storeIdempotencyResponse(idempotencyKey, 'claimStaticDeposit', 400, errorResponse)
        return c.json(errorResponse, 400)
    }
})

app.openapi(claimAllStaticDepositsRoute, async (c) => {
    const { 'spark-mnemonic': mnemonic, 'spark-network': network, 'spark-environment': environment, 'idempotency-key': idempotencyKey } = c.req.valid('header')
    
    // Check for existing idempotency key
    const cachedResponse = await checkIdempotency(c, idempotencyKey, 'claimAllStaticDeposits')
    if (cachedResponse) {
        return cachedResponse
    }
    
    try {
        const { claims, totalClaimedSats } = await workerClient.claimAllStaticDeposits({
            mnemonic,
            network,
            environment,
        })
        const response = { claims, totalClaimedSats }
        await storeIdempotencyResponse(idempotencyKey, 'claimAllStaticDeposits', 200, response)
        return c.json(response, 200)
    } catch (err: unknown) {
        const errorResponse = { error: unknownErrorToJson(err) }
        await storeIdempotencyResponse(idempotencyKey, 'claimAllStaticDeposits', 400, errorResponse)
        return c.json(errorResponse, 400)
    }
})

app.openapi(coopExitRoute, async (c) => {
    const { 'spark-mnemonic': mnemonic, 'spark-network': network, 'spark-environment': environment, 'idempotency-key': idempotencyKey } = c.req.valid('header')
    const { onchainAddress, amountSats, exitSpeed, deductFeeFromWithdrawalAmount } = c.req.valid('json')
    
    // Check for existing idempotency key
    const cachedResponse = await checkIdempotency(c, idempotencyKey, 'coopExit')
    if (cachedResponse) {
        return cachedResponse
    }
    
    try {
        const result = await workerClient.coopExit({
            mnemonic,
            network,
            environment,
            onchainAddress,
            amountSats,
            exitSpeed,
            deductFeeFromWithdrawalAmount,
        })
        const response = {
            id: result.id,
            onchainAddress: result.onchainAddress,
            amountSats: result.amountSats,
            feeSats: result.feeSats,
            exitSpeed: result.exitSpeed,
            status: result.status,
        }
        await storeIdempotencyResponse(idempotencyKey, 'coopExit', 200, response)
        return c.json(response, 200)
    } catch (err: unknown) {
        const errorResponse = { error: unknownErrorToJson(err) }
        await storeIdempotencyResponse(idempotencyKey, 'coopExit', 400, errorResponse)
        return c.json(errorResponse, 400)
    }
})


