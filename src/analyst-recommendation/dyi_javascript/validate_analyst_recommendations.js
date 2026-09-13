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
const FOREIGN_PRICE_TARGET = /^[A-Z]{3} [\d,]+(?:\.\d{1,2})?$/;
const PROJECTED = /^[+-]\d+(?:\.\d+)?%$/;
const DATE = /^\d{2}\/\d{2}\/\d{4}$/;

function formatContext(context) {
  if (!context) return "";
  const parts = [];
  if (context.symbol) parts.push(`symbol=${context.symbol}`);
  if (context.index !== undefined) parts.push(`index=${context.index}`);
  if (context.fileName) parts.push(`file=${context.fileName}`);
  return parts.length ? ` (${parts.join(", ")})` : "";
}

function fail(message, context) {
  throw new Error(`${message}${formatContext(context)}`);
}

function requireNonEmptyString(value, field, context) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`${field} must be a non-empty string`, context);
  }
}

function validatePriceTarget(value, context) {
  if (value === null) return;
  if (typeof value !== "string") {
    fail("price_target must be null or a string", context);
  }
  if (!USD_PRICE_TARGET.test(value) && !FOREIGN_PRICE_TARGET.test(value)) {
    fail(`price_target has invalid format: ${JSON.stringify(value)}`, context);
  }
}

function validateProjected(value, context) {
  if (value === null) return;
  if (typeof value !== "string") {
    fail("projected must be null or a string", context);
  }
  if (!PROJECTED.test(value)) {
    fail(`projected has invalid format: ${JSON.stringify(value)}`, context);
  }
}

export function validateAnalystRecommendationRow(row, context = {}) {
  if (row === null || typeof row !== "object" || Array.isArray(row)) {
    fail("row must be an object", context);
  }
  for (const field of ROW_FIELDS) {
    if (!(field in row)) fail(`missing field ${field}`, context);
  }
  requireNonEmptyString(row.analyst, "analyst", context);
  requireNonEmptyString(row.firm, "firm", context);
  if (!RECOMMENDATIONS.has(row.recommendation)) {
    fail(
      `recommendation must be one of ${[...RECOMMENDATIONS].join(", ")}`,
      context,
    );
  }
  if (!ACTIONS.has(row.action)) {
    fail(`action must be one of ${[...ACTIONS].join(", ")}`, context);
  }
  validatePriceTarget(row.price_target, context);
  validateProjected(row.projected, context);
  if (typeof row.date !== "string" || !DATE.test(row.date)) {
    fail(`date must match MM/DD/YYYY, got ${JSON.stringify(row.date)}`, context);
  }
}

export function validateAnalystRecommendations(listings, context = {}) {
  if (!Array.isArray(listings)) {
    fail("listings must be an array", context);
  }
  listings.forEach((row, index) =>
    validateAnalystRecommendationRow(row, { ...context, index }),
  );
  return listings;
}

export function validateAllSymbolsRecommendations(all, context = {}) {
  if (all === null || typeof all !== "object" || Array.isArray(all)) {
    fail("all_symbols must be an object", context);
  }
  for (const [symbol, listings] of Object.entries(all)) {
    validateAnalystRecommendations(listings, { ...context, symbol });
  }
  return all;
}
