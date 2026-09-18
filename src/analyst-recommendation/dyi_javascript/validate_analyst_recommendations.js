import { logger } from "../../common/logger.js";

const RECOMMENDATIONS = new Set(["Buy", "Hold", "Sell"]);
const ACTIONS = new Set([
  "Downgraded",
  "Initiated",
  "Maintained",
  "Reiterated",
  "Upgraded",
]);
const ROW_FIELDS = [
  "analyst",
  "firm",
  "recommendation",
  "action",
  "price_target",
  "projected",
  "date",
];
const USD_PRICE_TARGET = /^\$[\d,]+(?:\.\d{1,2})?$/;
const NON_USD_PRICE_TARGET = /^[A-Z]{3} [\d,]+(?:\.\d{1,2})?$/;
const PROJECTED = /^(?:0(?:\.\d+)?%|[+-][\d,]+(?:\.\d+)?%)$/;
const PROJECTED_MAX = 1000;
const PROJECTED_MIN = -95;
const DATE = /^\d{2}\/\d{2}\/\d{4}$/;
const DATE_MIN_LABEL = "2025-01-01";
const DATE_MIN = new Date(2025, 0, 1);

function formatContext(context) {
  if (!context) return "";
  const parts = [];
  if (context.symbol) parts.push(`symbol=${context.symbol}`);
  if (context.index !== undefined) parts.push(`index=${context.index}`);
  if (context.firm) parts.push(`firm=${context.firm}`);
  if (context.fileName) parts.push(`file=${context.fileName}`);
  return parts.length ? ` (${parts.join(", ")})` : "";
}

function reject(message, context) {
  logger.error({
    message: "error",
    error: new Error(`${message}${formatContext(context)}`),
  });
  return false;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

export function parsePercent(value) {
  const number = Number(value.replace(/[+,%]/g, ""));
  return Number.isFinite(number) ? number : null;
}

export function parseAnalystDate(date) {
  const [month, day, year] = date.split("/").map(Number);
  return new Date(year, month - 1, day);
}

function startOfDay(value) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function today(context = {}) {
  return startOfDay(context.now ?? new Date());
}

export function isAnalystDateInRange(date, context = {}) {
  if (typeof date !== "string" || !DATE.test(date)) return false;
  const parsed = parseAnalystDate(date);
  return parsed >= DATE_MIN && parsed <= today(context);
}

function isValidPriceTarget(value, context) {
  if (value === null) return true;
  if (typeof value !== "string") {
    return reject("price_target must be null or a string", context);
  }
  if (NON_USD_PRICE_TARGET.test(value)) {
    return reject(`price_target is not USD: ${JSON.stringify(value)}`, context);
  }
  if (!USD_PRICE_TARGET.test(value)) {
    return reject(
      `price_target has invalid format: ${JSON.stringify(value)}`,
      context,
    );
  }
  return true;
}

function isValidProjected(value, context) {
  if (value === null) return true;
  if (typeof value !== "string") {
    return reject("projected must be null or a string", context);
  }
  if (!PROJECTED.test(value)) {
    return reject(
      `projected has invalid format: ${JSON.stringify(value)}`,
      context,
    );
  }
  const percent = parsePercent(value);
  if (percent === null) {
    return reject(
      `projected is not a number: ${JSON.stringify(value)}`,
      context,
    );
  }
  if (percent > PROJECTED_MAX || percent < PROJECTED_MIN) {
    return reject(
      `projected out of range [${PROJECTED_MIN}, ${PROJECTED_MAX}]: ${JSON.stringify(value)}`,
      context,
    );
  }
  return true;
}

export function validateAnalystRecommendationRow(row, context = {}) {
  if (row === null || typeof row !== "object" || Array.isArray(row)) {
    return reject("row must be an object", context);
  }
  context = { ...context, firm: row.firm };
  for (const field of ROW_FIELDS) {
    if (!(field in row)) return reject(`missing field ${field}`, context);
  }
  if (!isNonEmptyString(row.analyst)) {
    return reject("analyst must be a non-empty string", context);
  }
  if (!isNonEmptyString(row.firm)) {
    return reject("firm must be a non-empty string", context);
  }
  if (!RECOMMENDATIONS.has(row.recommendation)) {
    return reject(
      `recommendation must be one of ${[...RECOMMENDATIONS].join(", ")}`,
      context,
    );
  }
  if (!ACTIONS.has(row.action)) {
    return reject(`action must be one of ${[...ACTIONS].join(", ")}`, context);
  }
  if (!isValidPriceTarget(row.price_target, context)) return false;
  if (!isValidProjected(row.projected, context)) return false;
  if (typeof row.date !== "string" || !DATE.test(row.date)) {
    return reject(
      `date must match MM/DD/YYYY, got ${JSON.stringify(row.date)}`,
      context,
    );
  }
  const parsedDate = parseAnalystDate(row.date);
  if (parsedDate < DATE_MIN) {
    return reject(
      `date must not be before ${DATE_MIN_LABEL}, got ${JSON.stringify(row.date)}`,
      context,
    );
  }
  if (parsedDate > today(context)) {
    return reject(
      `date must not be after today, got ${JSON.stringify(row.date)}`,
      context,
    );
  }
  return true;
}

export function validateAnalystRecommendations(listings, context = {}) {
  if (!Array.isArray(listings)) {
    reject("listings must be an array", context);
    return [];
  }
  return listings.filter((row, index) =>
    validateAnalystRecommendationRow(row, { ...context, index }),
  );
}

export function validateAllSymbolsRecommendations(all, context = {}) {
  if (all === null || typeof all !== "object" || Array.isArray(all)) {
    reject("all_symbols must be an object", context);
    return {};
  }
  return Object.fromEntries(
    Object.entries(all).map(([symbol, listings]) => [
      symbol,
      validateAnalystRecommendations(listings, { ...context, symbol }),
    ]),
  );
}
