import YahooFinance from "yahoo-finance2";
import { backoffRetry } from "../../common/backoff_retry.js";
import { fileCache } from "../../common/file_cache.js";
import { log } from "../../common/logger.js";

const yahooFinance = new YahooFinance();

export const OPEN_PRICES_PERIOD1 = "2026-01-01";

export const yahooFinanceClient = {
  chart: (symbol, query) => yahooFinance.chart(symbol, query),
};

export function yahooOpenPricesCacheFile(symbol) {
  return `data/yahoo_open_prices/${symbol}.json`;
}

export function isoDateFromAnalystDate(date) {
  const us = String(date ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (us) return `${us[3]}-${us[1]}-${us[2]}`;
  return String(date ?? "").trim();
}

export function openPricesFromChart(chart) {
  const prices = {};
  for (const quote of chart?.quotes ?? []) {
    if (quote?.date == null || quote.open == null || Number(quote.open) === 0) continue;
    const date = quote.date instanceof Date ? quote.date : new Date(quote.date);
    if (Number.isNaN(date.getTime())) continue;
    prices[date.toISOString().slice(0, 10)] = Number(quote.open);
  }
  return prices;
}

const requestYahooOpenPrices = log(async function requestYahooOpenPrices(symbol) {
  if (!symbol) throw new Error("requestYahooOpenPrices requires symbol");
  const chart = await yahooFinanceClient.chart(symbol, {
    period1: OPEN_PRICES_PERIOD1,
    interval: "1d",
  });
  return JSON.stringify(openPricesFromChart(chart));
});

export async function fetchYahooOpenPrices(symbol, retryConfig, cacheConfig) {
  const requestWithRetry = backoffRetry(requestYahooOpenPrices, retryConfig);
  const requestWithRetryAndCache = fileCache(requestWithRetry, {
    fileName: yahooOpenPricesCacheFile(symbol),
    ...cacheConfig,
  });
  return JSON.parse(await requestWithRetryAndCache(symbol));
}

export function openPriceOnOrBefore(prices, isoDate) {
  if (prices[isoDate] != null) return prices[isoDate];
  let latest = null;
  for (const date of Object.keys(prices)) {
    if (date <= isoDate && (latest == null || date > latest)) latest = date;
  }
  return latest == null ? null : prices[latest];
}

export async function yahooOpenPriceForDate(symbol, date, retryConfig, cacheConfig) {
  const prices = await fetchYahooOpenPrices(symbol, retryConfig, cacheConfig);
  return openPriceOnOrBefore(prices, isoDateFromAnalystDate(date));
}

export const yahooOpenPrice = {
  forDate: yahooOpenPriceForDate,
};
