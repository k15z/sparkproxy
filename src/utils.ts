export const devSparkConfig = JSON.parse(Buffer.from(process.env.DEV_SPARK_CONFIG!, 'base64').toString())

export const executionTimes: Record<string, Array<number>> = {};

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
