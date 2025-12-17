import { Worker } from 'node:worker_threads';
import { randomUUID } from 'node:crypto';
import { executionTimes } from "../utils.js";
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
  GetStaticDepositAddressPayload,
  GetStaticDepositAddressResult,
  GetDepositUtxosPayload,
  GetDepositUtxosResult,
  ClaimStaticDepositPayload,
  ClaimStaticDepositResult,
  ClaimAllStaticDepositsPayload,
  ClaimAllStaticDepositsResult,
  CoopExitPayload,
  CoopExitResult,
  WorkerRequest,
  WorkerResponse,
} from "./types.js";

function mergeTimings(timings?: Record<string, number>) {
  if (!timings) return;
  for (const [name, duration] of Object.entries(timings)) {
    if (!executionTimes[name]) executionTimes[name] = [];
    executionTimes[name].push(duration);
  }
}

function resolveWorkerUrl(): URL {
  // When running from built JS, this file URL contains /dist/
  const isDist = import.meta.url.includes('/dist/');
  const workerRelative = isDist ? './spark.worker.js' : './spark.worker.ts';
  return new URL(workerRelative, import.meta.url);
}

async function callWorker<TReqPayload, TRes>(op: WorkerRequest["op"], payload: TReqPayload, timeoutMs = 25000): Promise<TRes> {
  const id = randomUUID();
  const worker = new Worker(resolveWorkerUrl(), { name: "spark" });
  try {
    const result = await new Promise<WorkerResponse<TRes>>((resolve, reject) => {
      const onMessage = (data: WorkerResponse<TRes>) => {
        if (data.id === id) {
          resolve(data);
        }
      };
      const onError = (e: Error) => {
        reject(e);
      };
      worker.on('message', onMessage);
      worker.on('error', onError);
      worker.postMessage({ id, op, payload } as WorkerRequest);

      const timeout = setTimeout(() => {
        reject(new Error("Worker timeout"));
      }, timeoutMs);

      worker.on('exit', () => clearTimeout(timeout));
    });

    mergeTimings(result.timings);
    if (!result.ok) {
      const err = result.error || { name: "Error", message: "Unknown worker error" };
      const error = new Error(`${err.name}: ${err.message}`);
      (error as any).stack = err.stack;
      throw error;
    }
    return result.result as TRes;
  } finally {
    await worker.terminate();
  }
}

export const workerClient = {
  initialize: (payload: InitializePayload, timeoutMs?: number) => callWorker<InitializePayload, InitializeResult>("initialize", payload, timeoutMs),
  balance: (payload: BalancePayload, timeoutMs?: number) => callWorker<BalancePayload, BalanceResult>("balance", payload, timeoutMs),
  transfer: (payload: TransferPayload, timeoutMs?: number) => callWorker<TransferPayload, TransferResult>("transfer", payload, timeoutMs),
  transferTokens: (payload: TransferTokensPayload, timeoutMs?: number) => callWorker<TransferTokensPayload, TransferTokensResult>("transferTokens", payload, timeoutMs),
  payLightningInvoice: (payload: PayLightningInvoicePayload, timeoutMs?: number) => callWorker<PayLightningInvoicePayload, PayLightningInvoiceResult>("payLightningInvoice", payload, timeoutMs),
  createLightningInvoice: (payload: CreateLightningInvoicePayload, timeoutMs?: number) => callWorker<CreateLightningInvoicePayload, CreateLightningInvoiceResult>("createLightningInvoice", payload, timeoutMs),
  isOfferMet: (payload: IsOfferMetPayload, timeoutMs?: number) => callWorker<IsOfferMetPayload, IsOfferMetResult>("isOfferMet", payload, timeoutMs),
  transferAll: (payload: TransferAllPayload, timeoutMs?: number) => callWorker<TransferAllPayload, TransferAllResult>("transferAll", payload, timeoutMs),
  getStaticDepositAddress: (payload: GetStaticDepositAddressPayload, timeoutMs?: number) => callWorker<GetStaticDepositAddressPayload, GetStaticDepositAddressResult>("getStaticDepositAddress", payload, timeoutMs),
  getDepositUtxos: (payload: GetDepositUtxosPayload, timeoutMs?: number) => callWorker<GetDepositUtxosPayload, GetDepositUtxosResult>("getDepositUtxos", payload, timeoutMs),
  claimStaticDeposit: (payload: ClaimStaticDepositPayload, timeoutMs?: number) => callWorker<ClaimStaticDepositPayload, ClaimStaticDepositResult>("claimStaticDeposit", payload, timeoutMs),
  claimAllStaticDeposits: (payload: ClaimAllStaticDepositsPayload, timeoutMs?: number) => callWorker<ClaimAllStaticDepositsPayload, ClaimAllStaticDepositsResult>("claimAllStaticDeposits", payload, timeoutMs),
  coopExit: (payload: CoopExitPayload, timeoutMs?: number) => callWorker<CoopExitPayload, CoopExitResult>("coopExit", payload, timeoutMs),
};


