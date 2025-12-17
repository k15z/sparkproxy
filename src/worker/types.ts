import type { Bech32mTokenIdentifier, SparkAddressFormat } from "@buildonspark/spark-sdk";

export type WorkerOp =
  | "initialize"
  | "balance"
  | "transfer"
  | "transferTokens"
  | "payLightningInvoice"
  | "createLightningInvoice"
  | "createThirdPartyLightningInvoice"
  | "isOfferMet"
  | "transferAll"
  | "getStaticDepositAddress"
  | "getDepositUtxos"
  | "claimStaticDeposit"
  | "claimAllStaticDeposits"
  | "coopExit";

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

export type CreateThirdPartyLightningInvoicePayload = {
  network: NetworkName;
  environment: Environment;
  receiverIdentityPubkey: string; // 33-byte compressed pubkey of the Spark user to receive funds
  amountSats: number;
  memo?: string;
  expirySeconds?: number;
};

export type CreateThirdPartyLightningInvoiceResult = {
  invoice: string;
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

// Static Deposit Types

export type GetStaticDepositAddressPayload = {
  mnemonic: string;
  network: NetworkName;
  environment: Environment;
};

export type GetStaticDepositAddressResult = {
  depositAddress: string;
};

export type GetDepositUtxosPayload = {
  mnemonic: string;
  network: NetworkName;
  environment: Environment;
  depositAddress: string;
  includeClaimed?: boolean; // defaults to true; set to false to exclude already-claimed UTXOs
};

export type DepositUtxo = {
  txHash: string;
  vout: number;
  amountSats: number;
  confirmations: number;
  claimed: boolean;
};

export type GetDepositUtxosResult = {
  utxos: DepositUtxo[];
};

export type ClaimStaticDepositPayload = {
  mnemonic: string;
  network: NetworkName;
  environment: Environment;
  txHash: string;
  vout: number;
};

export type ClaimStaticDepositResult = {
  depositAmountSats: number;
  feeSats: number;
  claimedAmountSats: number;
};

export type ClaimAllStaticDepositsPayload = {
  mnemonic: string;
  network: NetworkName;
  environment: Environment;
};

export type ClaimedDeposit = {
  txHash: string;
  vout: number;
  depositAmountSats: number;
  feeSats: number;
  claimedAmountSats: number;
};

export type ClaimAllStaticDepositsResult = {
  claims: ClaimedDeposit[];
  totalClaimedSats: number;
};

// Coop Exit Types

export type ExitSpeed = "fast" | "medium" | "slow";

export type CoopExitPayload = {
  mnemonic: string;
  network: NetworkName;
  environment: Environment;
  onchainAddress: string;
  amountSats: number;
  exitSpeed?: ExitSpeed;
  deductFeeFromWithdrawalAmount?: boolean;
};

export type CoopExitResult = {
  id: string;
  onchainAddress: string;
  amountSats: number;
  feeSats: number;
  exitSpeed: ExitSpeed;
  status: string;
};


