import { SparkWallet } from '@buildonspark/spark-sdk'
import { OpenAPIHono } from '@hono/zod-openapi'
import { initializeRoute, balanceRoute, transferRoute, tokenTransferRoute, payLightningInvoiceRoute, createLightningInvoiceRoute } from './routes'
import { loadWallet, unknownErrorToJson } from '../utils'

export const app = new OpenAPIHono()

app.openapi(initializeRoute, async (c) => {
    const { 'spark-network': network } = c.req.valid('header')
    const { mnemonic: walletMnemonic, wallet } = await SparkWallet.initialize({
        options: {
            network: network,
        },
    })
    const address = await wallet.getSparkAddress();
    await wallet.cleanupConnections();
    return c.json({
        mnemonic: walletMnemonic!,
        address: address,
    }, 200)
})

app.openapi(balanceRoute, async (c) => {
    const { 'spark-mnemonic': mnemonic, 'spark-network': network } = c.req.valid('header')
    const wallet = await loadWallet({ mnemonic, network })
    try {
        const { balance, tokenBalances } = await wallet.getBalance()
        return c.json(
            {
                address: await wallet.getSparkAddress(),
                balance: Number(balance),
                tokenBalances: Object.fromEntries(
                    Array.from(tokenBalances.entries()).map(([tokenPublicKey, tokenBalance]) => [
                        tokenPublicKey,
                        {
                            balance: Number(tokenBalance.balance),
                            tokenInfo: {
                                tokenPublicKey: tokenBalance.tokenInfo.tokenPublicKey,
                                tokenName: tokenBalance.tokenInfo.tokenName,
                                tokenSymbol: tokenBalance.tokenInfo.tokenSymbol,
                                tokenDecimals: tokenBalance.tokenInfo.tokenDecimals,
                                maxSupply: Number(tokenBalance.tokenInfo.maxSupply),
                            },
                        },
                    ])
                ),
            },
            200
        )
    } catch (err: unknown) {
        return c.json({
            error: unknownErrorToJson(err),
        }, 400)
    } finally {
        await wallet.cleanupConnections();
    }
})

app.openapi(transferRoute, async (c) => {
    const { 'spark-mnemonic': mnemonic, 'spark-network': network } = c.req.valid('header')
    const wallet = await loadWallet({ mnemonic, network })
    try {
        const { id } = await wallet.transfer({
            amountSats: c.req.valid('json').amountSats,
            receiverSparkAddress: c.req.valid('json').receiverSparkAddress,
        })
        return c.json(
            {
                id: id,
            },
            200
        )
    } catch (err: unknown) {
        return c.json({
            error: unknownErrorToJson(err),
        }, 400)
    } finally {
        await wallet.cleanupConnections();
    }
})

app.openapi(tokenTransferRoute, async (c) => {
    const { 'spark-mnemonic': mnemonic, 'spark-network': network } = c.req.valid('header')
    const wallet = await loadWallet({ mnemonic, network })
    try {
        const id = await wallet.transferTokens({
            tokenPublicKey: c.req.valid('json').tokenPublicKey,
            tokenAmount: BigInt(c.req.valid('json').tokenAmount),
            receiverSparkAddress: c.req.valid('json').receiverSparkAddress,
        })
        return c.json(
            {
                id: id,
            },
            200
        )
    } catch (err: unknown) {
        return c.json({
            error: unknownErrorToJson(err),
        }, 400)
    } finally {
        await wallet.cleanupConnections();
    }
})

app.openapi(payLightningInvoiceRoute, async (c) => {
    const { 'spark-mnemonic': mnemonic, 'spark-network': network } = c.req.valid('header')
    const wallet = await loadWallet({ mnemonic, network })
    try {
        const { id } = await wallet.payLightningInvoice({
            invoice: c.req.valid('json').invoice,
            maxFeeSats: c.req.valid('json').maxFeeSats,
        })
        return c.json({
            id: id,
        }, 200)
    } catch (err: unknown) {
        return c.json({
            error: unknownErrorToJson(err),
        }, 400)
    } finally {
        await wallet.cleanupConnections();
    }
})

app.openapi(createLightningInvoiceRoute, async (c) => {
    const { 'spark-mnemonic': mnemonic, 'spark-network': network } = c.req.valid('header')
    const wallet = await loadWallet({ mnemonic, network, waitForSync: false })
    try {
        const { invoice } = await wallet.createLightningInvoice({
            amountSats: c.req.valid('json').amount,
            memo: c.req.valid('json').memo,
            expirySeconds: c.req.valid('json').expirySeconds,
        })
        return c.json({
            invoice: invoice.encodedInvoice,
        }, 200)
    } catch (err: unknown) {
        return c.json({
            error: unknownErrorToJson(err),
        }, 400)
    } finally {
        await wallet.cleanupConnections();
    }
})