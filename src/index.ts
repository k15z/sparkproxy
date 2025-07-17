import 'dotenv/config';
import { publicKey } from './keys'
import { OpenAPIHono } from '@hono/zod-openapi'
import { app as walletRouter } from './wallet/router'
import { app as paymentRouter } from './payment/router'
import { swaggerUI } from '@hono/swagger-ui'
import { serveStatic } from '@hono/node-server/serve-static'
import { executionTimes } from './utils'

const app = new OpenAPIHono()

app.route('/wallet', walletRouter)
app.route('/payment', paymentRouter)

app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "SparkProxy API",
  },
});

app.get("/metrics", (c) => {
  return c.json(executionTimes, 200)
})

app.get("/docs", swaggerUI({ url: "/openapi.json" }));

app.get("/.well-known/webhook-public-key.pem", (c) => {
  return c.text(publicKey, 200, {
    'Content-Type': 'application/text',
  })
})

app.get("/*", serveStatic({ root: './public' }))

export default {
  fetch: app.fetch,
  idleTimeout: 60,
};