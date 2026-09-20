import { jest } from "@jest/globals";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  isAnalystDateInRange,
  parsePercent,
  parsePriceTarget,
  validateAllSymbolsRecommendations,
  validateAnalystRecommendationRow,
  validateAnalystRecommendations,
} from "./validate_analyst_recommendations.js";

const validRow = {
  analyst: "James Schneider",
  firm: "Goldman Sachs",
  recommendation: "Buy",
  action: "Maintained",
  price_target: "$300.00",
  projected: "+37.4%",
  date: "09/10/2026",
};

let stderrSpy;

beforeEach(() => {
  stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
});

afterEach(() => {
  stderrSpy.mockRestore();
});

function loggedErrors() {
  return stderrSpy.mock.calls.map(([line]) => JSON.parse(line));
}

test("validateAnalystRecommendationRow accepts a valid row", () => {
  expect(validateAnalystRecommendationRow(validRow)).toBe(true);
  expect(loggedErrors()).toEqual([]);
});

test("validateAnalystRecommendationRow accepts null optional fields", () => {
  expect(
    validateAnalystRecommendationRow({
      ...validRow,
      price_target: null,
      projected: null,
    }),
  ).toBe(true);
});

test("validateAnalystRecommendationRow accepts zero projected", () => {
  expect(
    validateAnalystRecommendationRow({ ...validRow, projected: "0%" }),
  ).toBe(true);
});

test("validateAnalystRecommendationRow rejects non-USD price targets", () => {
  expect(
    validateAnalystRecommendationRow({ ...validRow, price_target: "SGD 1.86" }),
  ).toBe(false);
  expect(loggedErrors()[0].error).toMatch(
    /price_target is not USD: "SGD 1.86"/,
  );
});

test("validateAnalystRecommendationRow accepts projected at the range bounds", () => {
  expect(
    validateAnalystRecommendationRow({ ...validRow, projected: "+1,000%" }),
  ).toBe(true);
  expect(
    validateAnalystRecommendationRow({ ...validRow, projected: "-95%" }),
  ).toBe(true);
  expect(loggedErrors()).toEqual([]);
});

test("validateAnalystRecommendationRow accepts any recommendation", () => {
  expect(
    validateAnalystRecommendationRow({
      ...validRow,
      recommendation: "Strong Buy",
    }),
  ).toBe(true);
  expect(
    validateAnalystRecommendationRow({ ...validRow, recommendation: "" }),
  ).toBe(true);
  expect(
    validateAnalystRecommendationRow({ ...validRow, recommendation: null }),
  ).toBe(true);
  expect(loggedErrors()).toEqual([]);
});

test("validateAnalystRecommendationRow rejects invalid price_target", () => {
  expect(
    validateAnalystRecommendationRow({ ...validRow, price_target: "300.00" }),
  ).toBe(false);
  expect(loggedErrors()[0].error).toMatch(/price_target has invalid format/);
});

test("validateAnalystRecommendationRow rejects invalid projected", () => {
  expect(
    validateAnalystRecommendationRow({ ...validRow, projected: "37.4%" }),
  ).toBe(false);
  expect(loggedErrors()[0].error).toMatch(/projected has invalid format/);
});

test("validateAnalystRecommendationRow rejects projected above 1000%", () => {
  expect(
    validateAnalystRecommendationRow({ ...validRow, projected: "+12,112.3%" }),
  ).toBe(false);
  expect(loggedErrors()[0].error).toMatch(
    /projected out of range \[-95, 1000\]: "\+12,112.3%"/,
  );
});

test("validateAnalystRecommendationRow rejects projected below -95%", () => {
  expect(
    validateAnalystRecommendationRow({ ...validRow, projected: "-99.5%" }),
  ).toBe(false);
  expect(loggedErrors()[0].error).toMatch(/projected out of range/);
});

test("validateAnalystRecommendationRow rejects invalid date", () => {
  expect(
    validateAnalystRecommendationRow({ ...validRow, date: "2026-09-10" }),
  ).toBe(false);
  expect(loggedErrors()[0].error).toMatch(/date must match MM\/DD\/YYYY/);
});

test("validateAnalystRecommendationRow rejects date before 2025-01-01", () => {
  expect(
    validateAnalystRecommendationRow({ ...validRow, date: "12/31/2024" }),
  ).toBe(false);
  expect(loggedErrors()[0].error).toMatch(
    /date must not be before 2025-01-01, got "12\/31\/2024" \(firm=Goldman Sachs\)/,
  );
});

test("validateAnalystRecommendationRow accepts date at 2025-01-01", () => {
  expect(
    validateAnalystRecommendationRow(
      { ...validRow, date: "01/01/2025" },
      { now: "2026-09-13" },
    ),
  ).toBe(true);
});

test("validateAnalystRecommendationRow accepts date of tomorrow", () => {
  expect(
    validateAnalystRecommendationRow(
      { ...validRow, date: "09/10/2026" },
      { now: "2026-09-09" },
    ),
  ).toBe(true);
  expect(loggedErrors()).toEqual([]);
});

test("validateAnalystRecommendationRow rejects date after tomorrow", () => {
  expect(
    validateAnalystRecommendationRow(
      { ...validRow, date: "09/11/2026" },
      { now: "2026-09-09" },
    ),
  ).toBe(false);
  expect(loggedErrors()[0].error).toMatch(
    /date must not be after tomorrow, got "09\/11\/2026"/,
  );
});

test("isAnalystDateInRange checks format and bounds", () => {
  expect(isAnalystDateInRange("01/01/2025", { now: "2026-09-13" })).toBe(true);
  expect(isAnalystDateInRange("12/31/2024", { now: "2026-09-13" })).toBe(false);
  expect(isAnalystDateInRange("11/30/2025", { now: "2026-09-13" })).toBe(true);
  expect(isAnalystDateInRange("09/10/2026", { now: "2026-09-09" })).toBe(true);
  expect(isAnalystDateInRange("09/11/2026", { now: "2026-09-09" })).toBe(
    false,
  );
  expect(isAnalystDateInRange("2026-09-10")).toBe(false);
});

test("parsePercent strips sign, separators and percent", () => {
  expect(parsePercent("+12,112.3%")).toBe(12112.3);
  expect(parsePercent("-95%")).toBe(-95);
  expect(parsePercent("0%")).toBe(0);
});

test("parsePriceTarget strips dollar sign and separators", () => {
  expect(parsePriceTarget("$300.00")).toBe(300);
  expect(parsePriceTarget("$1,234.50")).toBe(1234.5);
  expect(parsePriceTarget(null)).toBe(null);
});

test("validateAnalystRecommendations skips invalid rows and logs the index", () => {
  const listings = validateAnalystRecommendations([
    validRow,
    { ...validRow, action: "Unknown" },
    { ...validRow, projected: "+12,112.3%" },
  ]);
  expect(listings).toEqual([validRow]);
  expect(loggedErrors().map(({ error }) => error)).toEqual([
    expect.stringContaining("index=1"),
    expect.stringContaining("index=2"),
  ]);
});

test("validateAllSymbolsRecommendations skips invalid rows per symbol", () => {
  const all = validateAllSymbolsRecommendations({
    AAA: [validRow],
    BBB: [{ ...validRow, action: "Unknown" }],
  });
  expect(all).toEqual({ AAA: [validRow], BBB: [] });
  expect(loggedErrors()[0].error).toMatch(/symbol=BBB/);
});

const isExpectedRow = (row) =>
  (row.price_target === null || row.price_target.startsWith("$")) &&
  isAnalystDateInRange(row.date);

test("existing google analyst recommendation json files drop invalid rows", () => {
  const dir = [
    join(process.cwd(), "data/analyst_recomendation/google"),
    join(process.cwd(), "data/google_analyst_recomendation"),
  ].find(existsSync);
  if (!dir) return;
  for (const fileName of readdirSync(dir).filter(
    (name) => name.endsWith(".json") && name !== "all_symbols.json",
  )) {
    const listings = JSON.parse(readFileSync(join(dir, fileName), "utf8"));
    expect(validateAnalystRecommendations(listings, { fileName })).toEqual(
      listings.filter(isExpectedRow),
    );
  }
  for (const { error } of loggedErrors()) {
    expect(error).toMatch(/price_target is not USD|date must not be before/);
  }
});
