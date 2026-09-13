import config from "./config.js";
import { backoffRetry } from "./backoff_retry.js";
import { fileCache } from "./file_cache.js";
import { log } from "./logger.js";

const request = log(async function request(httpConfig = {}) {
  const { url, headers, timeout } = { ...config.http, ...httpConfig };
  if (!url) throw new Error("request requires httpConfig.url");
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  return response.text();
});

export async function httpRequestScrape(httpConfig, retryConfig, cacheConfig) {
  const requestWithRetry = backoffRetry(request, retryConfig);
  const requestWithRetryAndCache = fileCache(requestWithRetry, cacheConfig);
  return requestWithRetryAndCache(httpConfig);
}
