import config from "./config.js";

const lastRequestStartByDomain = {};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const randomDelay = (minDelay, maxDelay) =>
  minDelay + Math.floor(Math.random() * (maxDelay - minDelay + 1));

export function rateLimit(functionToLimit, rateLimitConfig = {}) {
  const { enabled, minDelay, maxDelay } = { ...config.rateLimit, ...rateLimitConfig };
  return async (httpConfig, ...args) => {
    if (!enabled) return functionToLimit(httpConfig, ...args);
    const domain = new URL(httpConfig.url).hostname;
    const lastRequestStart = lastRequestStartByDomain[domain];
    const earliestStart =
      lastRequestStart == null ? Date.now() : lastRequestStart + randomDelay(minDelay, maxDelay);
    const wait = Math.max(0, earliestStart - Date.now());
    lastRequestStartByDomain[domain] = Date.now() + wait;
    await sleep(wait);
    return functionToLimit(httpConfig, ...args);
  };
}
