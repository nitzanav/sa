import config from "../../common/config.js";
import { formatCsv, readCsv } from "../../common/csv.js";
import { logger } from "../../common/logger.js";
import { writeTextFile } from "../../common/write_file.js";
import { writeJsonFile } from "../../common/write_json.js";
import { readSymbolsExchange } from "../../symbols-exchange/fetch_symbols_exchange.js";
import { scrapeAnalystRecommendation } from "./scrape_analyst_recommendation.js";
import { parsePercent } from "./validate_analyst_recommendations.js";

const dir = "data/google_analyst_recomendation";
const ALL_SYMBOLS_CSV_COLUMNS = ["date", "ticker", "analyst", "percent"];
const PER_DATE_AND_SYMBOL_CSV_COLUMNS = [
  "date",
  "symbol",
  "average_projected",
  "std_projected",
  "analyst_projections_count",
  "projections",
];
const AGGREGATION_WINDOW_DAYS = 7;

function isoDate(date) {
  const [month, day, year] = date.split("/");
  return `${year}-${month}-${day}`;
}

function addUtcDays(iso, days) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStd(values) {
  const avg = mean(values);
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function roundStat(value) {
  return Number(value.toFixed(4));
}

export function escapeAnalystName(name) {
  return String(name ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replaceAll('"', "''")
    .replaceAll(",", ";");
}

export function formatProjections(listings) {
  return listings
    .map(({ analyst, percent }) => `${escapeAnalystName(analyst)}:${percent}`)
    .join("|");
}

export function flattenAllSymbols(all) {
  const rows = [];
  for (const [ticker, listings] of Object.entries(all)) {
    for (const { date, analyst, projected } of listings) {
      rows.push({
        date: isoDate(date),
        ticker,
        analyst,
        percent: projected === null ? null : parsePercent(projected),
      });
    }
  }
  return rows.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.ticker.localeCompare(b.ticker) ||
      a.analyst.localeCompare(b.analyst),
  );
}

function numericRows(all) {
  const rows = Array.isArray(all) ? all : flattenAllSymbols(all);
  return rows.filter(({ percent }) => percent != null && percent !== "");
}

function aggregateListings(date, symbol, listings) {
  const percents = listings.map(({ percent }) => percent);
  return {
    date,
    symbol,
    average_projected: roundStat(mean(percents)),
    std_projected: percents.length >= 2 ? roundStat(sampleStd(percents)) : null,
    analyst_projections_count: percents.length,
    projections: formatProjections(listings),
  };
}

export function flattenAllSymbolsPerDateAndSymbol(all) {
  const groups = new Map();
  for (const { date, ticker, analyst, percent } of numericRows(all)) {
    const key = `${date}\0${ticker}`;
    if (!groups.has(key)) groups.set(key, { date, symbol: ticker, listings: [] });
    groups.get(key).listings.push({ analyst, percent });
  }
  return [...groups.values()].map(({ date, symbol, listings }) =>
    aggregateListings(date, symbol, listings),
  );
}

export function flattenAllSymbolsPerDateAndSymbol7dAggregationWindow(all) {
  const bySymbol = new Map();
  const dates = new Set();
  for (const { date, ticker, analyst, percent } of numericRows(all)) {
    dates.add(date);
    if (!bySymbol.has(ticker)) bySymbol.set(ticker, []);
    bySymbol.get(ticker).push({ date, analyst, percent });
  }
  const sortedDates = [...dates].sort();
  const symbols = [...bySymbol.keys()].sort();
  for (const listings of bySymbol.values()) {
    listings.sort(
      (a, b) => a.date.localeCompare(b.date) || a.analyst.localeCompare(b.analyst),
    );
  }
  const rows = [];
  for (const date of sortedDates) {
    const windowStart = addUtcDays(date, 1 - AGGREGATION_WINDOW_DAYS);
    for (const symbol of symbols) {
      const listings = bySymbol
        .get(symbol)
        .filter((listing) => listing.date >= windowStart && listing.date <= date)
        .map(({ analyst, percent }) => ({ analyst, percent }));
      if (listings.length === 0) continue;
      rows.push(aggregateListings(date, symbol, listings));
    }
  }
  return rows;
}

const csvRow = (row) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v ?? ""]));

export const allSymbolsCsv = (all) =>
  formatCsv(ALL_SYMBOLS_CSV_COLUMNS, flattenAllSymbols(all).map(csvRow));

export const allSymbolsPerDateAndSymbolCsv = (all) =>
  formatCsv(
    PER_DATE_AND_SYMBOL_CSV_COLUMNS,
    flattenAllSymbolsPerDateAndSymbol(all).map(csvRow),
  );

export const allSymbolsPerDateAndSymbol7dAggregationWindowCsv = (all) =>
  formatCsv(
    PER_DATE_AND_SYMBOL_CSV_COLUMNS,
    flattenAllSymbolsPerDateAndSymbol7dAggregationWindow(all).map(csvRow),
  );

export async function scrapeAnalystRecommendations() {
  const symbols = readCsv("data/fortune_500/symbols.csv").map((row) => row.Symbol);
  const exchanges = readSymbolsExchange();
  const all = {};
  for (const symbol of symbols.slice(0, config.analyst_recommendations.limit)) {
    logger.addContext({ symbol });
    const listings = await scrapeAnalystRecommendation(
      `https://www.google.com/finance/beta/quote/${symbol}:${exchanges[symbol]}?window=YTD&tab=analysis&hl=en`,
      { operationName: symbol },
      { fileName: `${dir}/${symbol}.html` },
    );
    await writeJsonFile(`${dir}/${symbol}.json`, listings);
    all[symbol] = listings;
  }
  await writeJsonFile(`${dir}/all_symbols.json`, flattenAllSymbols(all));
  await writeTextFile(`${dir}/all_symbols.csv`, allSymbolsCsv(all));
  await writeTextFile(
    `${dir}/all_symbols_per_date_and_symbol.csv`,
    allSymbolsPerDateAndSymbolCsv(all),
  );
  await writeTextFile(
    `${dir}/all_symbols_per_date_and_symbol_7d_aggregation_window.csv`,
    allSymbolsPerDateAndSymbol7dAggregationWindowCsv(all),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await scrapeAnalystRecommendations();
}
