import { parentPort } from 'node:worker_threads';
import { performance } from 'node:perf_hooks'
import { type Bech32mTokenIdentifier, Network, SparkWallet, encodeSparkAddress, SparkSdkLogger } from "@buildonspark/spark-sdk";
import { LoggingLevel } from "@lightsparkdev/core";
import type {
  BalancePayload,
  BalanceResult,
  CreateLightningInvoicePayload,
  CreateLightningInvoiceResult,
  InitializePayload,
  InitializeResult,
  IsOfferMetPayload,
  IsOfferMetResult,
  PayLightningInvoicePayload,
  PayLightningInvoiceResult,
  TransferAllPayload,
  TransferAllResult,
  TransferPayload,
  TransferResult,
  TransferTokensPayload,
  TransferTokensResult,
  WorkerRequest,
  WorkerResponse,
} from "./types.js";

import { devSparkConfig } from "../utils.js";

type Timings = Record<string, number>;

async function measure<T>(name: string, fn: () => Promise<T>, timings: Timings): Promise<T> {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  timings[name] = (timings[name] || 0) + (end - start);
  return result;
}

async function loadWalletWithOptions(mnemonic: string, network: keyof typeof Network, environment: "dev" | "prod", timings: Timings) {
  SparkSdkLogger.setAllEnabled(true);
  SparkSdkLogger.setAllLevels(LoggingLevel.Trace);

  const { wallet } = await measure("loadWallet", async () =>
    SparkWallet.initialize({
      mnemonicOrSeed: mnemonic,
      options: { ...(environment === "dev" ? devSparkConfig : {}), network, optimizationOptions: { multiplicity: 1 } },
    })
  , timings);

  await new Promise((resolve) => {
    wallet.on("stream:connected", () => resolve(true));
    setTimeout(() => resolve(true), 5000);
  });
  return wallet;
}

function ok<T>(id: string, result: T, timings: Timings): WorkerResponse<T> {
  return { id, ok: true, result, timings };
}

function err(id: string, e: unknown, timings: Timings): WorkerResponse<never> {
  if (e instanceof Error) {
    return { id, ok: false, error: { name: e.name, message: e.message, stack: e.stack }, timings };
  }
  return { id, ok: false, error: { name: "Error", message: String(e) }, timings };
}

async function handleInitialize(id: string, payload: InitializePayload): Promise<WorkerResponse<InitializeResult>> {
  const timings: Timings = {};
  try {
    const { mnemonic, wallet } = await measure("initialize", () =>
      SparkWallet.initialize({
        options: { ...(payload.environment === "dev" ? devSparkConfig : {}), network: payload.network as keyof typeof Network },
      }),
      timings
    );
    const address = await measure("getSparkAddress", () => wallet.getSparkAddress(), timings);
    await measure("cleanupConnections", () => wallet.cleanupConnections(), timings);
    return ok(id, { mnemonic: mnemonic!, address }, timings);
  } catch (e) {
    console.error(e);
    return err(id, e, timings);
  }
}

async function handleBalance(id: string, payload: BalancePayload): Promise<WorkerResponse<BalanceResult>> {
  const timings: Timings = {};
  let wallet: SparkWallet | null = null;
  try {
    wallet = await loadWalletWithOptions(payload.mnemonic, payload.network as keyof typeof Network, payload.environment, timings);
    const { balance, tokenBalances } = await measure("getBalance", () => wallet!.getBalance(), timings);
    const address = await measure("getSparkAddress", () => wallet!.getSparkAddress(), timings);
    const result: BalanceResult = {
      address,
      balance: Number(balance),
      tokenBalances: Array.from(tokenBalances.entries()).map(([tokenIdentifier, tokenBalance]) => ({
        balance: Number(tokenBalance.balance),
        tokenInfo: {
          tokenIdentifier,
          tokenPublicKey: tokenBalance.tokenMetadata.tokenPublicKey,
          tokenName: tokenBalance.tokenMetadata.tokenName,
          tokenSymbol: tokenBalance.tokenMetadata.tokenTicker,
          tokenDecimals: tokenBalance.tokenMetadata.decimals,
          maxSupply: Number(tokenBalance.tokenMetadata.maxSupply),
        },
      })),
    };
    return ok(id, result, timings);
  } catch (e) {
    console.error(e);
    return err(id, e, timings);
  } finally {
    if (wallet) await measure("cleanupConnections", () => wallet!.cleanupConnections(), timings).catch(() => {});
  }
}

async function handleTransfer(id: string, payload: TransferPayload): Promise<WorkerResponse<TransferResult>> {
  const timings: Timings = {};
  let wallet: SparkWallet | null = null;
  try {
    wallet = await loadWalletWithOptions(payload.mnemonic, payload.network as keyof typeof Network, payload.environment, timings);
    const { id: txid } = await measure("transfer", () => wallet!.transfer({
      amountSats: payload.amountSats,
      receiverSparkAddress: payload.receiverSparkAddress,
    }), timings);
    return ok(id, { id: txid }, timings);
  } catch (e) {
    console.error(e);
    return err(id, e, timings);
  } finally {
    if (wallet) await measure("cleanupConnections", () => wallet!.cleanupConnections(), timings).catch(() => {});
  }
}

async function handleTransferTokens(id: string, payload: TransferTokensPayload): Promise<WorkerResponse<TransferTokensResult>> {
  const timings: Timings = {};
  let wallet: SparkWallet | null = null;
  try {
    wallet = await loadWalletWithOptions(payload.mnemonic, payload.network as keyof typeof Network, payload.environment, timings);
    const txid = await measure(
      "transferTokens",
      () => wallet!.transferTokens({
        tokenIdentifier: payload.tokenIdentifier,
        tokenAmount: BigInt(payload.tokenAmount),
        receiverSparkAddress: payload.receiverSparkAddress,
      }),
      timings
    );
    return ok(id, { id: String(txid) }, timings);
  } catch (e) {
    console.error(e);
    return err(id, e, timings);
  } finally {
    if (wallet) await measure("cleanupConnections", () => wallet!.cleanupConnections(), timings).catch(() => {});
  }
}

async function handlePayLightningInvoice(id: string, payload: PayLightningInvoicePayload): Promise<WorkerResponse<PayLightningInvoiceResult>> {
  const timings: Timings = {};
  let wallet: SparkWallet | null = null;
  try {
    wallet = await loadWalletWithOptions(payload.mnemonic, payload.network as keyof typeof Network, payload.environment, timings);
    const { id: txid } = await measure("payLightningInvoice", () => wallet!.payLightningInvoice({
      invoice: payload.invoice,
      maxFeeSats: payload.maxFeeSats,
    }), timings);
    return ok(id, { id: txid }, timings);
  } catch (e) {
    console.error(e);
    return err(id, e, timings);
  } finally {
    if (wallet) await measure("cleanupConnections", () => wallet!.cleanupConnections(), timings).catch(() => {});
  }
}

async function handleCreateLightningInvoice(id: string, payload: CreateLightningInvoicePayload): Promise<WorkerResponse<CreateLightningInvoiceResult>> {
  const timings: Timings = {};
  let wallet: SparkWallet | null = null;
  try {
    wallet = await loadWalletWithOptions(payload.mnemonic, payload.network as keyof typeof Network, payload.environment, timings);
    const { invoice } = await measure("createLightningInvoice", () => wallet!.createLightningInvoice({
      amountSats: payload.amountSats,
      memo: payload.memo,
      expirySeconds: payload.expirySeconds,
    }), timings);
    return ok(id, { invoice: invoice.encodedInvoice }, timings);
  } catch (e) {
    console.error(e);
    return err(id, e, timings);
  } finally {
    if (wallet) await measure("cleanupConnections", () => wallet!.cleanupConnections(), timings).catch(() => {});
  }
}

async function handleIsOfferMet(id: string, payload: IsOfferMetPayload): Promise<WorkerResponse<IsOfferMetResult>> {
  const timings: Timings = {};
  let wallet: SparkWallet | null = null;
  try {
    wallet = await loadWalletWithOptions(payload.mnemonic, payload.network as keyof typeof Network, payload.environment, timings);
    const balance = await measure("getBalance", () => wallet!.getBalance(), timings);
    for (const offer of payload.offers) {
      if (offer.asset === "BITCOIN") {
        if (balance.balance >= offer.amount) {
          const result = await measure("getTransfers", () => wallet!.getTransfers(10, 0), timings);
          if (result.transfers.length > 0) {
            for (const transfer of result.transfers) {
              if (transfer.transferDirection === "INCOMING") {
                return ok(id, {
                  paid: true,
                  sending_address: encodeSparkAddress({
                    identityPublicKey: transfer.senderIdentityPublicKey,
                    network: payload.network as keyof typeof Network,
                  }),
                }, timings);
              }
            }
          }
          return ok(id, { paid: true, sending_address: null }, timings);
        }
      } else if (offer.asset === "TOKEN") {
        const tokenBalance = balance.tokenBalances.get(offer.tokenIdentifier);
        if (tokenBalance && tokenBalance.balance >= offer.amount) {
          const address = await measure("getSparkAddress", () => wallet!.getSparkAddress(), timings);
          const resp = await measure("sparkscan", () => fetch(`https://api.sparkscan.io/v1/address/${address}/transactions?network=${payload.network}&limit=25&offset=0`, { headers: { accept: "application/json" } }), timings);
          const transactions = (await resp.json()).data;
          if (transactions && transactions.length > 0) {
            for (const tx of transactions) {
              if (tx.type === "token_transfer" && tx.direction === "incoming" && tx.tokenMetadata?.tokenIdentifier === offer.tokenIdentifier) {
                return ok(id, { paid: true, sending_address: tx.counterparty?.identifier ?? null }, timings);
              }
            }
          }
          return ok(id, { paid: true, sending_address: null }, timings);
        }
      }
    }
    return ok(id, { paid: false, sending_address: null }, timings);
  } catch (e) {
    console.error(e);
    return err(id, e, timings);
  } finally {
    if (wallet) await measure("cleanupConnections", () => wallet!.cleanupConnections(), timings).catch(() => {});
  }
}

async function handleTransferAll(id: string, payload: TransferAllPayload): Promise<WorkerResponse<TransferAllResult>> {
  const timings: Timings = {};
  let wallet: SparkWallet | null = null;
  try {
    wallet = await loadWalletWithOptions(payload.mnemonic, payload.network as keyof typeof Network, payload.environment, timings);
    const balance = await measure("getBalance", () => wallet!.getBalance(), timings);
    if (balance.balance > 0) {
      await measure("transfer", () => wallet!.transfer({
        amountSats: Number(balance.balance),
        receiverSparkAddress: payload.receiverSparkAddress,
      }), timings);
    }
    const tokenEntries = Array.from(balance.tokenBalances.entries());
    for (const [tokenIdentifier, tokenBalance] of tokenEntries) {
      await measure(
        "transferTokens",
        () => wallet!.transferTokens({
          tokenIdentifier: tokenIdentifier as Bech32mTokenIdentifier,
          tokenAmount: tokenBalance.balance,
          receiverSparkAddress: payload.receiverSparkAddress,
        }),
        timings
      );
    }
    return ok(id, { ok: true }, timings);
  } catch (e) {
    console.error(e);
    return err(id, e, timings);
  } finally {
    if (wallet) await measure("cleanupConnections", () => wallet!.cleanupConnections(), timings).catch(() => {});
  }
}

if (!parentPort) {
  throw new Error('Worker must be run as a worker thread');
}

parentPort.on('message', async (msg: WorkerRequest) => {
  const { id, op, payload } = msg;
  switch (op) {
    case "initialize":
      parentPort!.postMessage(await handleInitialize(id, payload as InitializePayload));
      break;
    case "balance":
      parentPort!.postMessage(await handleBalance(id, payload as BalancePayload));
      break;
    case "transfer":
      parentPort!.postMessage(await handleTransfer(id, payload as TransferPayload));
      break;
    case "transferTokens":
      parentPort!.postMessage(await handleTransferTokens(id, payload as TransferTokensPayload));
      break;
    case "payLightningInvoice":
      parentPort!.postMessage(await handlePayLightningInvoice(id, payload as PayLightningInvoicePayload));
      break;
    case "createLightningInvoice":
      parentPort!.postMessage(await handleCreateLightningInvoice(id, payload as CreateLightningInvoicePayload));
      break;
    case "isOfferMet":
      parentPort!.postMessage(await handleIsOfferMet(id, payload as IsOfferMetPayload));
      break;
    case "transferAll":
      parentPort!.postMessage(await handleTransferAll(id, payload as TransferAllPayload));
      break;
    default:
      parentPort!.postMessage({ id, ok: false, error: { name: "BadRequest", message: `Unknown op: ${String(op)}` } as WorkerResponse["error"] });
  }
});


