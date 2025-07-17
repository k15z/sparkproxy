import { Network, SparkWallet } from "@buildonspark/spark-sdk";

export const devSparkConfig = JSON.parse(Buffer.from(process.env.DEV_SPARK_CONFIG!, 'base64').toString())

// TODO: Persist this to a data store.
export const executionTimes: Record<string, Array<number>> = {};

/**
 * Track the execution time of an async function.
 * 
 * @param name - The name of the function.
 * @param fn - The function to execute.
 * @returns The result of the function.
 */
export async function trackExecutionTime<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    if (!executionTimes[name]) {
        executionTimes[name] = [];
    }
    executionTimes[name].push(end - start);
    console.log(`${name} execution time: ${(end - start).toFixed(3)} ms`);
    return result;
}

/**
 * Loads a Spark wallet and waits for it to sync if `waitForSync` is true.
 * 
 * TODO: Cache the wallets to avoid the overhead of initializing a new wallet every time.
 * 
 * @param mnemonic - The mnemonic of the wallet to load.
 * @param network - The network to connect to.
 * @param waitForSync - Whether to wait for the wallet to sync.
 * @returns The wallet.
 */
export async function loadWallet({
    mnemonic,
    network,
    environment,
    waitForSync = true,
}: {
    mnemonic: string;
    network: keyof typeof Network;
    environment: 'dev' | 'prod';
    waitForSync?: boolean;
}): Promise<SparkWallet> {
    const { wallet } = await SparkWallet.initialize({
        mnemonicOrSeed: mnemonic,
        options: {
            network: network,
            ...(environment === 'dev' ? devSparkConfig : {}),
        },
    })
    if (waitForSync) {
        await new Promise(resolve => {
            wallet.on('stream:connected', resolve)

            // TODO: Figure out why this is needed.
            setTimeout(() => {
                console.warn('Timeout reached, resolving');
                resolve(true);
            }, 5000);
        })
    }
    return wallet;
}

/**
 * Converts an unknown error to a JSON string.
 * 
 * @param err - The error to convert.
 * @returns The JSON string.
 */
export function unknownErrorToJson(err: unknown): string {
    if (err instanceof Error) {
        return JSON.stringify({
            name: err.name,
            message: err.message,
            stack: err.stack
        })
    } else {
        return JSON.stringify(err)
    }
}
