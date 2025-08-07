import { executionTimes } from "../utils";
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
} from "./types";

function mergeTimings(timings?: Record<string, number>) {
  if (!timings) return;
  for (const [name, duration] of Object.entries(timings)) {
    if (!executionTimes[name]) executionTimes[name] = [];
    executionTimes[name].push(duration);
  }
}

async function callWorker<TReqPayload, TRes>(op: WorkerRequest["op"], payload: TReqPayload, timeoutMs = 30000): Promise<TRes> {
  const id = crypto.randomUUID();
  const worker = new Worker(new URL("./spark.worker.ts", import.meta.url).href, { type: "module", name: "spark" });
  try {
    const result = await new Promise<WorkerResponse<TRes>>((resolve, reject) => {
      const onMessage = (e: MessageEvent<WorkerResponse<TRes>>) => {
        const data = e.data;
        if (data.id === id) {
          worker.removeEventListener("message", onMessage as EventListener);
          resolve(data);
        }
      };
      const onError = (e: ErrorEvent) => {
        worker.removeEventListener("message", onMessage as EventListener);
        reject(e.error || new Error(e.message));
      };
      worker.addEventListener("message", onMessage as EventListener);
      worker.addEventListener("error", onError);
      worker.postMessage({ id, op, payload } as WorkerRequest);

      setTimeout(() => {
        worker.removeEventListener("message", onMessage as EventListener);
        reject(new Error("Worker timeout"));
      }, timeoutMs);
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
    worker.terminate();
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
};


