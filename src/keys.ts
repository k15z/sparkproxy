import * as crypto from 'crypto'

export const privateKey = Buffer.from(process.env.WEBHOOK_SIGNING_KEY!, 'base64').toString()
export const publicKey = crypto.createPublicKey({
    key: privateKey,
    format: 'pem'
}).export({
    type: 'spki',
    format: 'pem'
}).toString()


