import type { Bech32mTokenIdentifier, SparkAddressFormat } from "@buildonspark/spark-sdk";

export type WorkerOp =
  | "initialize"
  | "balance"
  | "transfer"
  | "transferTokens"
  | "payLightningInvoice"
  | "createLightningInvoice"
  | "isOfferMet"
  | "transferAll";

export type Environment = "dev" | "prod";
export type NetworkName = "MAINNET" | "REGTEST" | "TESTNET" | "SIGNET" | "LOCAL";

export type Offer =
  | { asset: "BITCOIN"; amount: number }
  | { asset: "TOKEN"; amount: number; tokenIdentifier: Bech32mTokenIdentifier };

export type WorkerRequest = {
  id: string;
  op: WorkerOp;
  payload: unknown;
};

export type WorkerError = { name: string; message: string; stack?: string };

export type WorkerResponse<T = unknown> = {
  id: string;
  ok: boolean;
  result?: T;
  error?: WorkerError;
  timings?: Record<string, number>;
};

export type InitializePayload = {
  network: NetworkName;
  environment: Environment;
};

export type InitializeResult = { mnemonic: string; address: string };

export type BalancePayload = {
  mnemonic: string;
  network: NetworkName;
  environment: Environment;
};

export type TokenInfo = {
  tokenIdentifier: string;
  tokenPublicKey: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  maxSupply: number;
};

export type TokenBalanceView = {
  balance: number;
  tokenInfo: TokenInfo;
};

export type BalanceResult = {
  address: SparkAddressFormat;
  balance: number;
  tokenBalances: Array<TokenBalanceView>;
};

export type TransferPayload = {
  mnemonic: string;
  network: NetworkName;
  environment: Environment;
  amountSats: number;
  receiverSparkAddress: SparkAddressFormat;
};

export type TransferResult = { id: string };

export type TransferTokensPayload = {
  mnemonic: string;
  network: NetworkName;
  environment: Environment;
  tokenIdentifier: Bech32mTokenIdentifier;
  tokenAmount: string; // string to avoid boundary issues; convert to BigInt in worker
  receiverSparkAddress: SparkAddressFormat;
};

export type TransferTokensResult = { id: string };

export type PayLightningInvoicePayload = {
  mnemonic: string;
  network: NetworkName;
  environment: Environment;
  invoice: string;
  maxFeeSats: number;
};

export type PayLightningInvoiceResult = { id: string };

export type CreateLightningInvoicePayload = {
  mnemonic: string;
  network: NetworkName;
  environment: Environment;
  amountSats: number;
  memo?: string;
  expirySeconds?: number;
};

export type CreateLightningInvoiceResult = { invoice: string };

export type IsOfferMetPayload = {
  mnemonic: string;
  network: NetworkName;
  environment: Environment;
  offers: Offer[];
};

export type IsOfferMetResult = {
  paid: boolean;
  sending_address: string | null;
};

export type TransferAllPayload = {
  mnemonic: string;
  network: NetworkName;
  environment: Environment;
  receiverSparkAddress: SparkAddressFormat;
};

export type TransferAllResult = { ok: true };


