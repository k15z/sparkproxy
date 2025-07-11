import { z } from 'zod';
import * as crypto from 'crypto';
import { Network, SparkWallet } from '@buildonspark/spark-sdk'
import { encodeSparkAddress } from '@buildonspark/spark-sdk/address';
import { OpenAPIHono } from '@hono/zod-openapi'
import { drizzle } from 'drizzle-orm/libsql';
import { eq, and, gt } from 'drizzle-orm';
import { invoicesTable } from '../db/models';
import { OfferSchema } from './routes/create';
import { createInvoiceRoute, checkInvoiceRoute } from './routes';
import { loadWallet } from '../utils';
import { privateKey } from '../keys';

export const app = new OpenAPIHono()
const db = drizzle(process.env.DB_FILE_NAME!);

/**
 * Transfer all the balance from the sender to the receiver.
 * 
 * @param senderMnemonic The mnemonic of the sender wallet.
 * @param receiverSparkAddress The spark address of the receiver.
 * @param network The network to use.
 */
async function transferAll(senderWallet: SparkWallet, receiverSparkAddress: string) {
    const balance = await senderWallet.getBalance()
    if (balance.balance > 0) {
        console.log(`Transferring ${balance.balance} sats to ${receiverSparkAddress}`)
        let info = await senderWallet.transfer({
            amountSats: Number(balance.balance),
            receiverSparkAddress: receiverSparkAddress,
        })
        console.log(info)
    }
    balance.tokenBalances.forEach(async (tokenBalance) => {
        console.log(`Transferring ${tokenBalance.balance} ${tokenBalance.tokenInfo.tokenName} tokens to ${receiverSparkAddress}`)
        await senderWallet.transferTokens({
            tokenPublicKey: tokenBalance.tokenInfo.tokenPublicKey,
            tokenAmount: tokenBalance.balance,
            receiverSparkAddress: receiverSparkAddress,
        })
    })
    await senderWallet.cleanupConnections()
}

/**
 * Checks if the offers are met.
 * 
 * @param mnemonic The mnemonic of the wallet to check.
 * @param network The network to use.
 * @param offers The offers to check.
 */
async function isOfferMet(wallet: SparkWallet, offers: z.infer<typeof OfferSchema>[]) {
    const balance = await wallet.getBalance()
    for (const offer of offers) {
        if (offer.asset === "BITCOIN") {
            if (balance.balance >= offer.amount) {
                const result = await wallet.getTransfers(10, 0);
                if (result.transfers.length > 0) {
                    for (const transfer of result.transfers) {
                        if (transfer.transferDirection === 'INCOMING') {
                            return {
                                paid: true,
                                sending_address: encodeSparkAddress({
                                    identityPublicKey: transfer.senderIdentityPublicKey,
                                    network: 'MAINNET',
                                }),
                            }
                        }
                    }
                }
                return {
                    paid: true,
                    sending_address: null,
                }
            }
        } else if (offer.asset === "TOKEN") {
            const tokenBalance = balance.tokenBalances.get(offer.token_pubkey)
            if (tokenBalance && tokenBalance.balance >= offer.amount) {
                return {
                    paid: true,
                    sending_address: null,
                }
            }
        }
    }
    return {
        paid: false,
        sending_address: null,
    }
}

/**
 * Send a signed webhook to the webhook URL.
 * 
 * @param webhookURL The URL to send the webhook to.
 * @param payload The payload to send.
 */
async function sendWebhook(webhookURL: string, payload: string) {
    const sign = crypto.createSign('SHA256');
    sign.update(payload);
    sign.end();

    const signature = sign.sign(privateKey, 'base64');
    await fetch(webhookURL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            payload: payload,
            signature: signature,
        }),
    })
}

app.openapi(createInvoiceRoute, async (c) => {
    const { mnemonic, wallet } = await SparkWallet.initialize({
        options: {
            network: c.req.valid('json').network as keyof typeof Network,
        },
    })
    const sparkAddress = await wallet.getSparkAddress()

    // Check that the assets are unique.
    const uniqueAssets = new Set(c.req.valid('json').offers.map(offer => offer.asset))
    if (uniqueAssets.size !== c.req.valid('json').offers.length) {
        return c.json({ error: 'Assets must be unique' }, 400)
    }

    // Generate a Lightning invoice if there is a Bitcoin offer.
    let invoice = "";
    for (const offer of c.req.valid('json').offers) {
        if (offer.asset === "BITCOIN") {
            const { invoice: lightningInvoice } = await wallet.createLightningInvoice({
                amountSats: offer.amount,
            })
            invoice = lightningInvoice.encodedInvoice
            break;
        }
    }

    const result = await db.insert(invoicesTable).values({
        network: c.req.valid('json').network,
        mnemonic: mnemonic!,
        expires_at: new Date(Date.now() + 1000 * 60 * 60),
        offers_json: JSON.stringify(c.req.valid('json').offers),
        webhook_url: c.req.valid('json').webhook_url,
        sweep_address: c.req.valid('json').spark_address,
        spark_address: sparkAddress,
        lightning_invoice: invoice,
        paid: false,
    }).returning({ id: invoicesTable.id });

    await wallet.cleanupConnections()
    return c.json({
        invoice_id: result[0].id,
        spark_address: sparkAddress,
        lightning_invoice: invoice,
    }, 200)
})

app.openapi(checkInvoiceRoute, async (c) => {
    const invoice = await db.select().from(invoicesTable).where(eq(invoicesTable.id, c.req.valid('param').invoice_id)).limit(1)
    if (invoice.length === 0) {
        return c.json({ error: 'Invoice not found' }, 404)
    }
    const result = invoice[0]
    return c.json({
        invoice_id: result.id,
        paid: result.paid,
        sending_address: result.sending_address,
    }, 200)
})

/**
 * Scan the unpaid invoices in the database to see if they have been paid.
 */
async function scanInvoices() {
    const invoices = await db.select().from(invoicesTable).where(and(eq(invoicesTable.paid, false), gt(invoicesTable.expires_at, new Date())))
    for (const invoice of invoices) {
        console.log(`Checking invoice ${invoice.id}`)

        // First, we'll check the SparkScan API to see if there are any transactions since it's much faster than initializing the wallet.
        const result = await fetch(`https://api.sparkscan.io/v1/address/${invoice.spark_address}?network=${invoice.network}`)
        const data = await result.json()
        if (data['transactionCount'] == 0) {
            await new Promise(resolve => setTimeout(resolve, 100))
            continue // No transactions yet.
        }

        // If there are transactions, we'll check if the offer condition have been met.
        const wallet = await loadWallet({ mnemonic: invoice.mnemonic, network: invoice.network as keyof typeof Network })
        const offerStatus = await isOfferMet(wallet, JSON.parse(invoice.offers_json))
        if (offerStatus.paid) {
            await db.update(invoicesTable).set({ paid: true, sending_address: offerStatus.sending_address || null }).where(eq(invoicesTable.id, invoice.id))
            await transferAll(wallet, invoice.sweep_address)
            if (invoice.webhook_url) {
                await sendWebhook(invoice.webhook_url, JSON.stringify({
                    invoice_id: invoice.id,
                    paid: true,
                }))
            }
        }
    }
    setTimeout(scanInvoices, 5000)
}

scanInvoices()
