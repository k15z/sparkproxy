import 'dotenv/config';
import { serve } from '@hono/node-server'
import { OpenAPIHono } from '@hono/zod-openapi'
import { app as walletRouter } from './wallet/router.js'
import { app as paymentRouter } from './payment/router.js'
import { swaggerUI } from '@hono/swagger-ui'
import { serveStatic } from '@hono/node-server/serve-static'
import { executionTimes } from './utils.js'
import { publicKey } from './keys.js'

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

// Serve static assets from this project's public/ directory
app.get("/*", serveStatic({ root: './public' }))

const port = Number(process.env.PORT) || 3000
serve({
  fetch: app.fetch,
  port
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
