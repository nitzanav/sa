import config from "./config.js";
import { logger } from "./logger.js";

export const jitter = (delayMs) => Math.floor(Math.random() * delayMs);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function backoffRetry(functionToRetry, retryConfig = {}) {
  const { enabled, initialDelay, delayMultiple, maxAttempts, operationName } = {
    ...config.retry,
    ...retryConfig,
  };
  return async (...args) => {
    if (!enabled) return functionToRetry(...args);
    let delayMs = initialDelay;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await functionToRetry(...args);
      } catch (error) {
        if (attempt === maxAttempts) throw error;
        const wait = jitter(delayMs);
        logger.log({ message: "retry", operationName, attempt, wait, error });
        await sleep(wait);
        delayMs *= delayMultiple;
      }
    }
  };
}
