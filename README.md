# sparkproxy

[![Synthetic Tests](https://github.com/k15z/sparkproxy/actions/workflows/synthetic.yml/badge.svg)](https://github.com/k15z/sparkproxy/actions/workflows/synthetic.yml)

This service provides an OpenAPI-compatible API for interacting with Spark. It supports multiple 
wallets and multiple assets, with the goal of exposing all the functionality of the Javascript 
Spark SDK over a REST API so you can use Spark without JS.

In addition, this also provides a lightweight invoicing layer which helps you manage the payment
lifecycle, from issuing multi-asset invoices to receiving updates via webhooks, to help you build
merchant-type application such as [Inference Grid](https://inferencegrid.ai/).

> 🚨 **WARNING:** The public endpoint at https://sparkproxy.kevz.dev is meant for testing. For actual 
> applications, you should run your own instance. 🚨

Built with Hono. Invoices are stored in Redis when `REDIS_URL` is set, otherwise an in-memory store is used (non-persistent; for local/dev only).

## Development

Generate a private key and add it to your `.env` file:

```sh
openssl genrsa -out rsa_private.key 2048
base64 -i rsa_private.key
```

To install dependencies:

```sh
npm install
```

Optional: set up Redis by providing `REDIS_URL` (e.g. `redis://localhost:6379`). Without it, the service uses an in-memory store.

To run:

```sh
npm run dev
```

open http://localhost:3000 and check out the docs at http://localhost:3000/docs
