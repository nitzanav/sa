import { jest } from "@jest/globals";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  parsePercent,
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

test("validateAnalystRecommendationRow accepts foreign currency price targets", () => {
  expect(
    validateAnalystRecommendationRow({ ...validRow, price_target: "SGD 1.86" }),
  ).toBe(true);
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

test("validateAnalystRecommendationRow rejects invalid recommendation", () => {
  expect(
    validateAnalystRecommendationRow({
      ...validRow,
      recommendation: "Strong Buy",
    }),
  ).toBe(false);
  expect(loggedErrors()).toEqual([
    {
      message: "error",
      error: expect.stringMatching(/recommendation must be one of/),
      log_level: "error",
    },
  ]);
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

test("parsePercent strips sign, separators and percent", () => {
  expect(parsePercent("+12,112.3%")).toBe(12112.3);
  expect(parsePercent("-95%")).toBe(-95);
  expect(parsePercent("0%")).toBe(0);
});

test("validateAnalystRecommendations skips invalid rows and logs the index", () => {
  const listings = validateAnalystRecommendations([
    validRow,
    { ...validRow, recommendation: "Maybe" },
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

test("existing google analyst recommendation json files pass validation", () => {
  const dir = join(process.cwd(), "data/google_analyst_recomendation");
  for (const fileName of readdirSync(dir).filter(
    (name) => name.endsWith(".json") && name !== "all_symbols.json",
  )) {
    const listings = JSON.parse(readFileSync(join(dir, fileName), "utf8"));
    expect(validateAnalystRecommendations(listings, { fileName })).toHaveLength(
      listings.length,
    );
  }
  const all = JSON.parse(readFileSync(join(dir, "all_symbols.json"), "utf8"));
  expect(validateAllSymbolsRecommendations(all)).toEqual(all);
  expect(loggedErrors()).toEqual([]);
});
