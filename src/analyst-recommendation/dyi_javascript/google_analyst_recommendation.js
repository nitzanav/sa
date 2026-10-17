import * as cheerio from "cheerio";
import { httpRequestScrape } from "../../common/http_request_scrape.js";
import { logger } from "../../common/logger.js";
import { readSymbolQuoteAliases } from "../../symbols-exchange/fetch_symbols_exchange.js";
import { validateAnalystRecommendations } from "./validate_analyst_recommendations.js";

const ANALYST_TABLE_HEADERS = [
  "analyst",
  "recommendation",
  "action",
  "price target",
  "projected",
  "date",
];

const MISSING_VALUES = new Set(["-", "\u2013", "\u2014", ""]);
const USD_PRICE_TARGET = /^\$[\d,]+(?:\.\d{1,2})?$/;

function cellText($element) {
  if (!$element || $element.length === 0) return "";
  return $element.text().replace(/\s+/g, " ").trim();
}

function optional(value) {
  return MISSING_VALUES.has(value) ? null : value;
}

function getAnalyst($, rowCells) {
  const lines = [];
  rowCells
    .eq(0)
    .find("div")
    .each((_, el) => {
      const $div = $(el);
      if ($div.find("div").length === 0) {
        const line = cellText($div);
        if (line) lines.push(line);
      }
    });
  return [lines[0] || "", lines[1] || ""];
}

function findAnalystTable($) {
  const $main = $("main").first();
  const $root = $main.length ? $main : $.root();
  let found = null;
  $root.find("table").each((_, table) => {
    if (found) return;
    const $table = $(table);
    const headers = $table
      .find("th")
      .toArray()
      .map((th) => cellText($(th)).toLowerCase());
    if (
      headers.length === ANALYST_TABLE_HEADERS.length &&
      headers.every((header, i) => header === ANALYST_TABLE_HEADERS[i])
    ) {
      found = $table;
    }
  });
  return found;
}

export function googleAnalystRecommendationUrl(symbol, exchange) {
  if (!exchange) throw new Error(`missing exchange for ${symbol}`);
  const quote = readSymbolQuoteAliases()[symbol] ?? symbol;
  return `https://www.google.com/finance/beta/quote/${quote}:${exchange}?window=YTD&tab=analysis&hl=en`;
}

export function quoteFromUrl(url) {
  const match = new URL(url).pathname.match(/\/quote\/([^/:]+)/);
  return match ? match[1] : "quote";
}

export function requestUrl(url) {
  const parsed = new URL(url);
  if (!parsed.searchParams.has("hl")) parsed.searchParams.set("hl", "en");
  return parsed.toString();
}

export function matchesUrl(url) {
  return new URL(url).hostname.includes("google.");
}

export async function fetchGoogleAnalystRecommendation(url, retryConfig, cacheConfig) {
  return httpRequestScrape({ url: requestUrl(url) }, retryConfig, cacheConfig);
}

function extractCallbackData(html, key) {
  const marker = `AF_initDataCallback({key: '${key}'`;
  const start = html.lastIndexOf(marker);
  if (start < 0) return null;
  const dataIdx = html.indexOf("data:", start);
  if (dataIdx < 0 || dataIdx - start > 80) return null;
  const bracket = html.indexOf("[", dataIdx);
  if (bracket < 0 || bracket - dataIdx > 10) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = bracket; i < html.length; i++) {
    const char = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "[") depth++;
    else if (char === "]") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(bracket, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function quotePriceUsd(data) {
  const walk = (node) => {
    if (!Array.isArray(node)) return null;
    const pair = node[1];
    if (
      Array.isArray(pair) &&
      typeof pair[0] === "string" &&
      typeof pair[1] === "string" &&
      node[4] === "USD" &&
      Array.isArray(node[5]) &&
      typeof node[5][0] === "number" &&
      node[5][0] > 0
    ) {
      return node[5][0];
    }
    for (const child of node) {
      const found = walk(child);
      if (found != null) return found;
    }
    return null;
  };
  return data ? walk(data) : null;
}

function embeddedAnalystRows(data) {
  if (!Array.isArray(data) || !Array.isArray(data[1])) return [];
  return data[1].filter((row) => Array.isArray(row) && row.length > 27);
}

function usdPriceAmount(row) {
  const amount = row[19];
  const currency = row[21];
  const displayAmount = row[22];
  const displayCurrency = row[24];
  if (currency === "USD" && typeof amount === "number" && amount > 0) return amount;
  if (displayCurrency === "USD" && typeof displayAmount === "number" && displayAmount > 0) {
    return displayAmount;
  }
  return null;
}

function formatUsdPriceTarget(value) {
  if (value == null || !Number.isFinite(value) || value === 0) return null;
  return `$${value.toFixed(2)}`;
}

function formatProjectedPercent(target, quote) {
  if (target == null || quote == null || target === 0 || quote === 0) return null;
  const percent = ((target - quote) / quote) * 100;
  if (!Number.isFinite(percent)) return null;
  const rounded = Math.round(percent * 10) / 10;
  if (rounded === 0) return "0%";
  const sign = rounded > 0 ? "+" : "-";
  const abs = Math.abs(rounded);
  const body = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
  return `${sign}${body}%`;
}

function padUsDate(text) {
  const match = String(text ?? "")
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return String(text ?? "").trim();
  return `${match[1].padStart(2, "0")}/${match[2].padStart(2, "0")}/${match[3]}`;
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function listingFromEmbedded(row, quote) {
  const usd = usdPriceAmount(row);
  return {
    analyst: cleanText(row[1]),
    firm: cleanText(row[2]),
    recommendation: cleanText(row[3]),
    action: cleanText(row[27]),
    price_target: formatUsdPriceTarget(usd),
    projected: formatProjectedPercent(usd, quote),
    date: padUsDate(row[4]),
  };
}

function alignEmbeddedRows(listings, rows) {
  const used = new Set();
  return listings.map((listing) => {
    const index = rows.findIndex(
      (row, i) =>
        !used.has(i) &&
        row[1] === listing.analyst &&
        row[2] === listing.firm &&
        padUsDate(row[4]) === listing.date,
    );
    if (index < 0) return null;
    used.add(index);
    return rows[index];
  });
}

function withUsdPriceTarget(listing, row, quote) {
  if (listing.price_target == null || USD_PRICE_TARGET.test(listing.price_target)) {
    return listing;
  }
  const usd = row ? usdPriceAmount(row) : null;
  if (usd == null) return listing;
  return {
    ...listing,
    price_target: formatUsdPriceTarget(usd),
    projected: formatProjectedPercent(usd, quote),
  };
}

export function parseGoogleAnalystRecommendation(html) {
  const embedded = embeddedAnalystRows(extractCallbackData(html, "ds:6"));
  const quote = quotePriceUsd(extractCallbackData(html, "ds:2"));
  const $ = cheerio.load(html);
  const $table = findAnalystTable($);
  if ($table === null) {
    if (embedded.length === 0) {
      logger.error({
        message: "error",
        error: new Error("Analyst Recommendation table not found"),
      });
      return [];
    }
    return validateAnalystRecommendations(
      embedded.map((row) => listingFromEmbedded(row, quote)),
    );
  }
  const $body = $table.find("tbody").first();
  const $rowsRoot = $body.length ? $body : $table;
  const listings = [];
  $rowsRoot.find("tr").each((_, row) => {
    const rowCells = $(row).find("td");
    if (rowCells.length < ANALYST_TABLE_HEADERS.length) return;
    const [analyst, firm] = getAnalyst($, rowCells);
    listings.push({
      analyst,
      firm,
      recommendation: cellText(rowCells.eq(1)),
      action: cellText(rowCells.eq(2)),
      price_target: optional(cellText(rowCells.eq(3))),
      projected: optional(cellText(rowCells.eq(4))),
      date: cellText(rowCells.eq(5)),
    });
  });
  const aligned = alignEmbeddedRows(listings, embedded);
  return validateAnalystRecommendations(
    listings.map((listing, index) => withUsdPriceTarget(listing, aligned[index], quote)),
  );
}

export const googleAnalystRecommendationSource = {
  name: "google",
  urlFor: googleAnalystRecommendationUrl,
  fetch: fetchGoogleAnalystRecommendation,
  parse: parseGoogleAnalystRecommendation,
  quoteFromUrl,
  requestUrl,
  matchesUrl,
};
