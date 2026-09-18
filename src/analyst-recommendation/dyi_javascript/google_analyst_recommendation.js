import * as cheerio from "cheerio";
import { logger } from "../../common/logger.js";
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
  return `https://www.google.com/finance/beta/quote/${symbol}:${exchange}?window=YTD&tab=analysis&hl=en`;
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

export function parseGoogleAnalystRecommendation(html) {
  const $ = cheerio.load(html);
  const $table = findAnalystTable($);
  if ($table === null) {
    logger.error({
      message: "error",
      error: new Error("Analyst Recommendation table not found"),
    });
    return [];
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
  return validateAnalystRecommendations(listings);
}

export const googleAnalystRecommendationSource = {
  name: "google",
  urlFor: googleAnalystRecommendationUrl,
  parse: parseGoogleAnalystRecommendation,
  quoteFromUrl,
  requestUrl,
  matchesUrl,
};
