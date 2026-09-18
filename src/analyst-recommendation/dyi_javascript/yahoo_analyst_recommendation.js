import * as cheerio from "cheerio";
import { httpRequestScrapePlaywright } from "../../common/http_request_scrape_playwright.js";
import { logger } from "../../common/logger.js";
import { validateAnalystRecommendations } from "./validate_analyst_recommendations.js";
import { yahooOpenPrice } from "./yahoo_open_price.js";

const BUY_GRADES = new Set([
  "Accumulate",
  "Buy",
  "Conviction Buy",
  "Market Outperform",
  "Outperform",
  "Overweight",
  "Positive",
  "Sector Outperform",
  "Strong Buy",
]);
const HOLD_GRADES = new Set([
  "Equal Weight",
  "Equal-Weight",
  "Hold",
  "In-Line",
  "Market Perform",
  "Mixed",
  "Neutral",
  "Peer Perform",
  "Perform",
  "Sector Perform",
  "Sector Weight",
]);
const SELL_GRADES = new Set([
  "Market Underperform",
  "Negative",
  "Reduce",
  "Sector Underperform",
  "Sell",
  "Strong Sell",
  "Underperform",
  "Underweight",
]);
const TOP_ANALYST_HEADERS = [
  "analyst",
  "overall score",
  "direction score",
  "price score",
  "latest rating",
  "price target",
  "date",
];
const MISSING_VALUES = new Set(["-", "\u2013", "\u2014", ""]);
const DEFAULT_ACTION = "Maintained";

function cellText($element) {
  if (!$element || $element.length === 0) return "";
  return $element.text().replace(/\s+/g, " ").trim();
}

export function mapYahooRecommendation(grade) {
  if (BUY_GRADES.has(grade)) return "Buy";
  if (HOLD_GRADES.has(grade)) return "Hold";
  if (SELL_GRADES.has(grade)) return "Sell";
  return grade;
}

export function formatUsdPriceTarget(value) {
  if (value == null || value === "" || Number(value) === 0) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return `$${number.toFixed(2)}`;
}

export function formatProjectedPercent(target, open) {
  if (target == null || open == null || Number(target) === 0 || Number(open) === 0) {
    return null;
  }
  const percent = ((Number(target) - Number(open)) / Number(open)) * 100;
  if (!Number.isFinite(percent)) return null;
  const rounded = Math.round(percent * 10) / 10;
  if (rounded === 0) return "0%";
  const sign = rounded > 0 ? "+" : "-";
  const abs = Math.abs(rounded);
  const body = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
  return `${sign}${body}%`;
}

export function padUsDate(text) {
  const match = String(text ?? "")
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return String(text ?? "").trim();
  return `${match[1].padStart(2, "0")}/${match[2].padStart(2, "0")}/${match[3]}`;
}

export function formatYahooTableDate(text) {
  const iso = String(text ?? "")
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[2]}/${iso[3]}/${iso[1]}`;
  return padUsDate(text);
}

function parsePriceTargetNumber(text) {
  if (MISSING_VALUES.has(text)) return null;
  const number = Number(String(text).replace(/,/g, ""));
  return Number.isFinite(number) && number !== 0 ? number : null;
}

function findTopAnalystsTable($) {
  const $sectionTable = $("#top-analyst table").first();
  if ($sectionTable.length) return $sectionTable;
  let found = null;
  $("table").each((_, table) => {
    if (found) return;
    const $table = $(table);
    const headers = $table
      .find("th")
      .toArray()
      .map((th) => cellText($(th)).toLowerCase());
    if (
      headers.length === TOP_ANALYST_HEADERS.length &&
      headers.every((header, i) => header === TOP_ANALYST_HEADERS[i])
    ) {
      found = $table;
    }
  });
  return found;
}

async function parseTopAnalystsTable($, $table, symbol) {
  const listings = [];
  const $body = $table.find("tbody").first();
  const $rowsRoot = $body.length ? $body : $table;
  for (const row of $rowsRoot.find("tr").toArray()) {
    const cells = $(row)
      .find("td")
      .toArray()
      .map((td) => cellText($(td)));
    if (cells.length < TOP_ANALYST_HEADERS.length) continue;
    const firm = cells[0];
    if (!firm) continue;
    const priceTarget = parsePriceTargetNumber(cells[5]);
    const date = formatYahooTableDate(cells[6]);
    const openPrice =
      priceTarget == null || !symbol ? null : await yahooOpenPrice.forDate(symbol, date);
    listings.push({
      analyst: firm,
      firm,
      recommendation: mapYahooRecommendation(cells[4]),
      action: DEFAULT_ACTION,
      price_target: formatUsdPriceTarget(priceTarget),
      projected: formatProjectedPercent(priceTarget, openPrice),
      date,
    });
  }
  return listings;
}

export function yahooAnalystRecommendationUrl(symbol) {
  return `https://finance.yahoo.com/quote/${symbol}/analyst-insights/`;
}

export function quoteFromUrl(url) {
  const match = new URL(url).pathname.match(/\/quote\/([^/]+)/);
  return match ? match[1] : "quote";
}

export function matchesUrl(url) {
  return new URL(url).hostname.includes("yahoo.");
}

export async function collectAllTopAnalystTableRows(page) {
  const table = page.locator("#top-analyst table").first();
  if ((await table.count()) === 0) return;
  const next = page.getByTestId("next-page-button");
  const seen = new Set();
  const rowsHtml = [];
  for (let pageIndex = 0; pageIndex < 20; pageIndex += 1) {
    const before = seen.size;
    const htmls = await table.locator("tbody tr").evaluateAll((rows) =>
      rows.map((row) => row.outerHTML),
    );
    for (const html of htmls) {
      if (seen.has(html)) continue;
      seen.add(html);
      rowsHtml.push(html);
    }
    const disabled =
      (await next.count()) === 0 || (await next.isDisabled().catch(() => true));
    if (seen.size === before || disabled) break;
    const previous = ((await table.locator("tbody tr td").first().textContent()) ?? "").trim();
    await next.click();
    try {
      await page.waitForFunction(
        (prior) => {
          const td = document.querySelector("#top-analyst tbody tr td");
          return Boolean(td && td.textContent.trim() !== prior);
        },
        previous,
        { timeout: 10000 },
      );
    } catch {
      break;
    }
  }
  if (rowsHtml.length === 0) return;
  await table.locator("tbody").evaluate((tbody, rows) => {
    tbody.innerHTML = rows.join("");
  }, rowsHtml);
}

export async function fetchYahooAnalystRecommendation(url, retryConfig, cacheConfig) {
  return httpRequestScrapePlaywright(
    {
      url,
      waitForText: "Overall",
      afterLoad: (page) => collectAllTopAnalystTableRows(page).catch(() => {}),
    },
    retryConfig,
    cacheConfig,
  );
}

export async function parseYahooAnalystRecommendation(html, symbol) {
  const $ = cheerio.load(html);
  const $table = findTopAnalystsTable($);
  if ($table == null || $table.length === 0) {
    logger.error({
      message: "error",
      error: new Error("Yahoo Top Analysts table not found"),
    });
    return [];
  }
  const listings = await parseTopAnalystsTable($, $table, symbol);
  if (listings.length === 0) {
    logger.error({
      message: "error",
      error: new Error("Yahoo Top Analysts table not found"),
    });
    return [];
  }
  return validateAnalystRecommendations(listings);
}

export const yahooAnalystRecommendationSource = {
  name: "yahoo",
  urlFor: yahooAnalystRecommendationUrl,
  fetch: fetchYahooAnalystRecommendation,
  parse: parseYahooAnalystRecommendation,
  quoteFromUrl,
  matchesUrl,
};
