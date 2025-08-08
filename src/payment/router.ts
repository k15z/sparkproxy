import * as crypto from 'crypto';
import { Network, SparkAddressFormat } from '@buildonspark/spark-sdk'
import { OpenAPIHono } from '@hono/zod-openapi'
import { getInvoiceStore } from '../db/store';
import { createInvoiceRoute, checkInvoiceRoute } from './routes';
import { workerClient } from '../worker/client';
import { privateKey } from '../keys';

export const app = new OpenAPIHono()
const invoices = getInvoiceStore();

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
    const { mnemonic, address: sparkAddress } = await workerClient.initialize({
        network: c.req.valid('json').network as keyof typeof Network,
        environment: 'prod',
    })

    // Check that the asset/tokenIdentifier combinations are unique.
    const offers = c.req.valid('json').offers
    const seenKeys = new Set<string>()
    for (const offer of offers as Array<{ asset: string; amount: number; tokenIdentifier?: string }>) {
        const key = offer.asset === 'TOKEN' ? `TOKEN:${offer.tokenIdentifier ?? ''}` : 'BITCOIN'
        if (seenKeys.has(key)) {
            return c.json({ error: 'Duplicate asset/tokenIdentifier detected' }, 400)
        }
        seenKeys.add(key)
    }

    // Generate a Lightning invoice if there is a Bitcoin offer.
    let invoice = "";
    for (const offer of c.req.valid('json').offers) {
        if (offer.asset === "BITCOIN") {
            const { invoice: encoded } = await workerClient.createLightningInvoice({
                mnemonic: mnemonic!,
                network: c.req.valid('json').network as keyof typeof Network,
                environment: 'prod',
                amountSats: offer.amount,
            })
            invoice = encoded
            break;
        }
    }

    const { id } = await invoices.create({
        network: c.req.valid('json').network,
        mnemonic: mnemonic!,
        expires_at: Date.now() + 1000 * 60 * 60,
        offers_json: JSON.stringify(c.req.valid('json').offers),
        webhook_url: c.req.valid('json').webhook_url,
        sweep_address: c.req.valid('json').spark_address,
        spark_address: sparkAddress,
        lightning_invoice: invoice,
    })

    return c.json({
        invoice_id: id,
        spark_address: sparkAddress,
        lightning_invoice: invoice,
    }, 200)
})

app.openapi(checkInvoiceRoute, async (c) => {
    const invoice = await invoices.getById(c.req.valid('param').invoice_id)
    if (!invoice) {
        return c.json({ error: 'Invoice not found' }, 404)
    }
    return c.json({
        invoice_id: invoice.id,
        paid: invoice.paid,
        sending_address: invoice.sending_address,
    }, 200)
})

/**
 * Scan the unpaid invoices in the database to see if they have been paid.
 */
async function scanInvoices() {
    try {
        const pending = await invoices.listUnpaidAndUnexpired(Date.now())
        for (const invoice of pending) {
            try {
                console.log(`Checking invoice ${invoice.id}`)

                // First, check SparkScan for quick signal; handle non-OK and network errors gracefully.
                const resp = await fetch(`https://api.sparkscan.io/v1/address/${invoice.spark_address}?network=${invoice.network}`, {
                    headers: {
                        'Authorization': `Bearer ${process.env.SPARKSCAN_API_KEY}`
                    }
                })
                if (!resp.ok) {
                    console.warn(`SparkScan request failed for ${invoice.id}: ${resp.status}`)
                    await new Promise(resolve => setTimeout(resolve, 1000))
                    continue
                }
                let data: any = null
                try {
                    data = await resp.json()
                } catch (e) {
                    console.warn(`Failed to parse SparkScan response for ${invoice.id}`)
                    continue
                }
                if (!data || (typeof data['transactionCount'] === 'number' && data['transactionCount'] === 0)) {
                    await new Promise(resolve => setTimeout(resolve, 1000))
                    continue // No transactions yet.
                }

                // If there are transactions, check whether offer conditions have been met.
                const offerStatus = await workerClient.isOfferMet({
                    mnemonic: invoice.mnemonic,
                    network: invoice.network as keyof typeof Network,
                    environment: 'prod',
                    offers: JSON.parse(invoice.offers_json),
                })
                if (offerStatus.paid) {
                    await invoices.markPaid(invoice.id, offerStatus.sending_address || null)
                    await workerClient.transferAll({
                        mnemonic: invoice.mnemonic,
                        network: invoice.network as keyof typeof Network,
                        environment: 'prod',
                        receiverSparkAddress: invoice.sweep_address as SparkAddressFormat,
                    })
                    if (invoice.webhook_url) {
                        await sendWebhook(invoice.webhook_url, JSON.stringify({
                            invoice_id: invoice.id,
                            paid: true,
                        }))
                    }
                }
            } catch (err) {
                console.warn(`Error while scanning invoice ${invoice.id}:`, err)
                // continue scanning other invoices
            }
        }
    } finally {
        setTimeout(scanInvoices, 5000)
    }
}

scanInvoices()
