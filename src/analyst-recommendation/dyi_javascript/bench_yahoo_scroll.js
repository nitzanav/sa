#!/usr/bin/env node
/**
 * Compare fixed 15×250ms scroll vs scroll-until-#top-analyst on a few Yahoo symbols.
 * Usage: node src/analyst-recommendation/dyi_javascript/bench_yahoo_scroll.js [SYM ...]
 */
import { chromium } from "playwright";

const symbols = process.argv.slice(2);
const tickers = symbols.length > 0 ? symbols : ["MMM", "AAPL", "NVDA"];
const timeoutMs = 45_000;

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

async function scrollFixed(page) {
  await page.evaluate(async () => {
    for (let i = 0; i < 15; i += 1) {
      window.scrollBy(0, 900);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  });
  return { scrolls: 15, pauseMs: 250 };
}

async function scrollUntilTopAnalyst(page, { maxScrolls = 15, pauseMs = 100 } = {}) {
  const target = page.locator("#top-analyst").first();
  let scrolls = 0;
  for (; scrolls < maxScrolls; scrolls += 1) {
    if (await target.isVisible().catch(() => false)) {
      return { scrolls, pauseMs, found: true };
    }
    await page.evaluate(() => window.scrollBy(0, 900));
    await new Promise((resolve) => setTimeout(resolve, pauseMs));
  }
  const found = await target.isVisible().catch(() => false);
  return { scrolls, pauseMs, found };
}

async function runMode(browser, symbol, mode) {
  const url = `https://finance.yahoo.com/quote/${symbol}/analyst-insights/`;
  const page = await browser.newPage({
    locale: "en-US",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });
  const t0 = Date.now();
  let scrollMeta = null;
  let error = null;
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await dismissConsent(page);
    await page.waitForLoadState("domcontentloaded");
    const scrollStarted = Date.now();
    scrollMeta =
      mode === "fixed" ? await scrollFixed(page) : await scrollUntilTopAnalyst(page);
    scrollMeta.scrollMs = Date.now() - scrollStarted;
    await page
      .getByText("Overall", { exact: false })
      .first()
      .waitFor({ timeout: timeoutMs })
      .catch(() => {});
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }
  const html = await page.content();
  const topCount = await page.locator("#top-analyst").count();
  const rowCount = await page.locator("#top-analyst tbody tr").count().catch(() => 0);
  const totalMs = Date.now() - t0;
  await page.close();
  return {
    symbol,
    mode,
    totalMs,
    scrollMs: scrollMeta?.scrollMs ?? null,
    scrolls: scrollMeta?.scrolls ?? null,
    found: scrollMeta?.found ?? null,
    hasOverall: html.includes("Overall"),
    topAnalystCount: topCount,
    rowCount,
    error,
  };
}

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const symbol of tickers) {
    results.push(await runMode(browser, symbol, "fixed"));
    results.push(await runMode(browser, symbol, "until"));
  }
} finally {
  await browser.close();
}

const bySymbol = Object.groupBy
  ? Object.groupBy(results, (r) => r.symbol)
  : tickers.reduce((acc, s) => {
      acc[s] = results.filter((r) => r.symbol === s);
      return acc;
    }, {});

process.stdout.write(JSON.stringify({ results, bySymbol }, null, 2) + "\n");
for (const symbol of tickers) {
  const fixed = results.find((r) => r.symbol === symbol && r.mode === "fixed");
  const until = results.find((r) => r.symbol === symbol && r.mode === "until");
  const saved = fixed && until ? fixed.scrollMs - until.scrollMs : null;
  console.error(
    `${symbol}: fixed scroll=${fixed?.scrollMs}ms rows=${fixed?.rowCount} | until scrolls=${until?.scrolls} scroll=${until?.scrollMs}ms rows=${until?.rowCount} | saved≈${saved}ms`,
  );
}
