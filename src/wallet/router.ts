import { SparkWallet } from '@buildonspark/spark-sdk'
import { OpenAPIHono } from '@hono/zod-openapi'
import { initializeRoute, balanceRoute, transferRoute, tokenTransferRoute, payLightningInvoiceRoute, createLightningInvoiceRoute } from './routes'
import { loadWallet } from '../utils'

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
        await wallet.cleanupConnections();
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
    } catch (e) {
        return c.json({
            error: JSON.stringify(e),
        }, 400)
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
        await wallet.cleanupConnections();
        return c.json(
            {
                id: id,
            },
            200
        )
    } catch (e) {
        return c.json({
            error: JSON.stringify(e),
        }, 400)
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
        await wallet.cleanupConnections();
        return c.json(
            {
                id: id,
            },
            200
        )
    } catch (e) {
        return c.json({
            error: JSON.stringify(e),
        }, 400)
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
        await wallet.cleanupConnections();
        return c.json({
            id: id,
        }, 200)
    } catch (e) {
        return c.json({
            error: JSON.stringify(e),
        }, 400)
    }
})

app.openapi(createLightningInvoiceRoute, async (c) => {
    const { 'spark-mnemonic': mnemonic, 'spark-network': network } = c.req.valid('header')
    const wallet = await loadWallet({ mnemonic, network, waitForSync: false })
    const { invoice } = await wallet.createLightningInvoice({
        amountSats: c.req.valid('json').amount,
        memo: c.req.valid('json').memo,
        expirySeconds: c.req.valid('json').expirySeconds,
    })
    await wallet.cleanupConnections();
    return c.json({
        invoice: invoice.encodedInvoice,
    }, 200)
})