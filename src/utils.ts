import { Network, SparkWallet } from "@buildonspark/spark-sdk";

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
    waitForSync = true,
}: {
    mnemonic: string;
    network: keyof typeof Network;
    waitForSync?: boolean;
}): Promise<SparkWallet> {
    const { wallet } = await SparkWallet.initialize({
        mnemonicOrSeed: mnemonic,
        options: {
            network: network,
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