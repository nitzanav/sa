import * as cheerio from "cheerio";
import { logger } from "../../common/logger.js";
import {
  isAnalystDateInRange,
  validateAnalystRecommendations,
} from "./validate_analyst_recommendations.js";

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
const ACTIONS = {
  init: "Initiated",
  main: "Maintained",
  reit: "Reiterated",
  up: "Upgraded",
  down: "Downgraded",
};
const HTML_ACTIONS = {
  initiated: "Initiated",
  maintains: "Maintained",
  maintained: "Maintained",
  reiterates: "Reiterated",
  reiterated: "Reiterated",
  upgrades: "Upgraded",
  upgraded: "Upgraded",
  downgrades: "Downgraded",
  downgraded: "Downgraded",
};

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function quoteSummaryFromValue(value) {
  if (!value || typeof value !== "object") return null;
  const body =
    typeof value.body === "string" ? parseJson(value.body) : (value.body ?? value);
  return body?.quoteSummary?.result?.[0] ?? null;
}

function extractQuoteSummary(html) {
  const $ = cheerio.load(html);
  let found = null;
  $("script").each((_, el) => {
    if (found) return;
    found = quoteSummaryFromValue(parseJson($(el).text()));
  });
  return found;
}

export function mapYahooRecommendation(grade) {
  if (BUY_GRADES.has(grade)) return "Buy";
  if (HOLD_GRADES.has(grade)) return "Hold";
  if (SELL_GRADES.has(grade)) return "Sell";
  return grade;
}

export function mapYahooAction(action) {
  return ACTIONS[action] ?? action;
}

export function formatUsdPriceTarget(value) {
  if (value == null || value === "" || Number(value) === 0) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return `$${number.toFixed(2)}`;
}

export function formatProjectedPercent(target, current) {
  if (target == null || current == null || Number(target) === 0 || Number(current) === 0) {
    return null;
  }
  const percent = ((Number(target) - Number(current)) / Number(current)) * 100;
  if (!Number.isFinite(percent)) return null;
  const rounded = Math.round(percent * 10) / 10;
  if (rounded === 0) return "0%";
  const sign = rounded > 0 ? "+" : "-";
  const abs = Math.abs(rounded);
  const body = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
  return `${sign}${body}%`;
}

export function formatYahooDate(epochSeconds) {
  const date = new Date(Number(epochSeconds) * 1000);
  if (Number.isNaN(date.getTime())) return "";
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${month}/${day}/${date.getUTCFullYear()}`;
}

export function padUsDate(text) {
  const match = String(text ?? "")
    .trim()
    .match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return String(text ?? "").trim();
  return `${match[1].padStart(2, "0")}/${match[2].padStart(2, "0")}/${match[3]}`;
}

function currentPriceFromQuoteSummary(quoteSummary) {
  return (
    quoteSummary?.financialData?.currentPrice?.raw ??
    quoteSummary?.price?.regularMarketPrice?.raw ??
    null
  );
}

function listingFromHistory(item, currentPrice) {
  const firm = String(item.firm ?? "").trim();
  return {
    analyst: firm,
    firm,
    recommendation: mapYahooRecommendation(item.toGrade),
    action: mapYahooAction(item.action),
    price_target: formatUsdPriceTarget(item.currentPriceTarget),
    projected: formatProjectedPercent(item.currentPriceTarget, currentPrice),
    date: formatYahooDate(item.epochGradeDate),
  };
}

function parseFirmGrade(text) {
  const [firm, grades = ""] = text.split(/:\s*/, 2);
  const toGrade = grades.includes(" to ") ? grades.split(" to ").at(-1) : grades;
  return { firm: firm.trim(), toGrade: toGrade.trim() };
}

function parseYahooHtmlTable(html) {
  const $ = cheerio.load(html);
  const listings = [];
  $("table tr").each((_, row) => {
    const cells = $(row)
      .find("td")
      .toArray()
      .map((td) =>
        $(td)
          .text()
          .replace(/\s+/g, " ")
          .trim(),
      );
    if (cells.length < 3) return;
    const action = HTML_ACTIONS[cells[0].toLowerCase()];
    if (!action) return;
    const { firm, toGrade } = parseFirmGrade(cells[1]);
    if (!firm) return;
    listings.push({
      analyst: firm,
      firm,
      recommendation: mapYahooRecommendation(toGrade),
      action,
      price_target: null,
      projected: null,
      date: padUsDate(cells[2]),
    });
  });
  return listings;
}

function inRangeListings(listings) {
  return listings.filter((row) => isAnalystDateInRange(row.date));
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

export function parseYahooAnalystRecommendation(html) {
  const quoteSummary = extractQuoteSummary(html);
  const history = quoteSummary?.upgradeDowngradeHistory?.history;
  const listings =
    Array.isArray(history) && history.length > 0
      ? history.map((item) =>
          listingFromHistory(item, currentPriceFromQuoteSummary(quoteSummary)),
        )
      : parseYahooHtmlTable(html);
  if (listings.length === 0) {
    logger.error({
      message: "error",
      error: new Error("Yahoo analyst recommendation history not found"),
    });
    return [];
  }
  return validateAnalystRecommendations(inRangeListings(listings));
}

export const yahooAnalystRecommendationSource = {
  name: "yahoo",
  urlFor: yahooAnalystRecommendationUrl,
  parse: parseYahooAnalystRecommendation,
  quoteFromUrl,
  matchesUrl,
};
