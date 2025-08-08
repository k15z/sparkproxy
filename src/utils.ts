// Utilities and shared config

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
