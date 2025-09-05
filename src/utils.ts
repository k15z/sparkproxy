import { performance } from 'node:perf_hooks'

export const devSparkConfig = JSON.parse(Buffer.from(process.env.DEV_SPARK_CONFIG!, 'base64').toString())

export const executionTimes: Record<string, Array<number>> = {};

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


