import { chromium } from "playwright";
import { backoffRetry } from "./backoff_retry.js";
import config from "./config.js";
import { fileCache } from "./file_cache.js";
import { log } from "./logger.js";
import { rateLimit } from "./rate_limit.js";

export const playwrightBrowser = {
  launch: (options) => chromium.launch(options),
};

async function dismissConsent(page) {
  const agree = page.locator('button[name="agree"], button.accept-all').first();
  if (!(await agree.isVisible().catch(() => false))) return;
  await agree.click();
  await page
    .waitForURL((url) => !url.hostname.includes("consent."), {
      timeout: 20000,
      waitUntil: "domcontentloaded",
    })
    .catch(() => {});
}

async function scrollPage(page) {
  await page.evaluate(async () => {
    for (let i = 0; i < 15; i += 1) {
      window.scrollBy(0, 900);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  });
}

const requestPlaywright = log(async function requestPlaywright(httpConfig = {}) {
  const { url, headers, timeout, headless, locale, viewport, waitForText } = {
    ...config.http,
    ...config.playwright,
    ...httpConfig,
  };
  if (!url) throw new Error("request requires httpConfig.url");
  const browser = await playwrightBrowser.launch({ headless });
  try {
    const page = await browser.newPage({
      locale,
      userAgent: headers?.["User-Agent"],
      viewport,
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout });
    await dismissConsent(page);
    await page.waitForLoadState("domcontentloaded");
    await scrollPage(page);
    if (waitForText) {
      await page
        .getByText(waitForText, { exact: false })
        .first()
        .waitFor({ timeout })
        .catch(() => {});
    }
    return await page.content();
  } finally {
    await browser.close();
  }
});

export async function httpRequestScrapePlaywright(
  httpConfig,
  retryConfig,
  cacheConfig,
  rateLimitConfig,
) {
  const requestWithRateLimit = rateLimit(requestPlaywright, rateLimitConfig);
  const requestWithRetry = backoffRetry(requestWithRateLimit, retryConfig);
  const requestWithRetryAndCache = fileCache(requestWithRetry, cacheConfig);
  return requestWithRetryAndCache(httpConfig);
}
