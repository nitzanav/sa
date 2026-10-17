import { Agent } from "undici";
import config from "./config.js";
import { backoffRetry } from "./backoff_retry.js";
import { fileCache } from "./file_cache.js";
import { log } from "./logger.js";
import { rateLimit } from "./rate_limit.js";

const request = log(async function request(httpConfig = {}) {
  const { url, headers, timeout } = { ...config.http, ...httpConfig };
  if (!url) throw new Error("request requires httpConfig.url");
  const dispatcher = new Agent({
    connectTimeout: timeout,
    headersTimeout: timeout,
    bodyTimeout: timeout,
  });
  try {
    const response = await fetch(url, {
      headers,
      dispatcher,
      signal: AbortSignal.timeout(timeout),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return response.text();
  } finally {
    await dispatcher.close();
  }
});

export async function httpRequestScrape(httpConfig, retryConfig, cacheConfig, rateLimitConfig) {
  const requestWithRateLimit = rateLimit(request, rateLimitConfig);
  const requestWithRetry = backoffRetry(requestWithRateLimit, retryConfig);
  const requestWithRetryAndCache = fileCache(requestWithRetry, cacheConfig);
  return requestWithRetryAndCache(httpConfig);
}
