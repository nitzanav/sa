import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
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

test("validateAnalystRecommendationRow accepts a valid row", () => {
  expect(() => validateAnalystRecommendationRow(validRow)).not.toThrow();
});

test("validateAnalystRecommendationRow accepts null optional fields", () => {
  expect(() =>
    validateAnalystRecommendationRow({
      ...validRow,
      price_target: null,
      projected: null,
    }),
  ).not.toThrow();
});

test("validateAnalystRecommendationRow accepts zero projected", () => {
  expect(() =>
    validateAnalystRecommendationRow({
      ...validRow,
      projected: "0%",
    }),
  ).not.toThrow();
});

test("validateAnalystRecommendationRow accepts foreign currency price targets", () => {
  expect(() =>
    validateAnalystRecommendationRow({
      ...validRow,
      price_target: "SGD 1.86",
    }),
  ).not.toThrow();
});

test("validateAnalystRecommendationRow throws for invalid recommendation", () => {
  expect(() =>
    validateAnalystRecommendationRow({
      ...validRow,
      recommendation: "Strong Buy",
    }),
  ).toThrow(/recommendation must be one of/);
});

test("validateAnalystRecommendationRow throws for invalid price_target", () => {
  expect(() =>
    validateAnalystRecommendationRow({
      ...validRow,
      price_target: "300.00",
    }),
  ).toThrow(/price_target has invalid format/);
});

test("validateAnalystRecommendationRow throws for invalid projected", () => {
  expect(() =>
    validateAnalystRecommendationRow({
      ...validRow,
      projected: "37.4%",
    }),
  ).toThrow(/projected has invalid format/);
});

test("validateAnalystRecommendationRow throws for invalid date", () => {
  expect(() =>
    validateAnalystRecommendationRow({
      ...validRow,
      date: "2026-09-10",
    }),
  ).toThrow(/date must match MM\/DD\/YYYY/);
});

test("validateAnalystRecommendations includes row index in errors", () => {
  expect(() =>
    validateAnalystRecommendations([
      validRow,
      { ...validRow, recommendation: "Maybe" },
    ]),
  ).toThrow(/index=1/);
});

test("validateAllSymbolsRecommendations includes symbol in errors", () => {
  expect(() =>
    validateAllSymbolsRecommendations({
      AAA: [validRow],
      BBB: [{ ...validRow, action: "Unknown" }],
    }),
  ).toThrow(/symbol=BBB/);
});

test("existing google analyst recommendation json files pass validation", () => {
  const dir = join(process.cwd(), "data/google_analyst_recomendation");
  for (const fileName of readdirSync(dir).filter(
    (name) => name.endsWith(".json") && name !== "all_symbols.json",
  )) {
    const listings = JSON.parse(readFileSync(join(dir, fileName), "utf8"));
    expect(() =>
      validateAnalystRecommendations(listings, { fileName }),
    ).not.toThrow();
  }
  const all = JSON.parse(readFileSync(join(dir, "all_symbols.json"), "utf8"));
  expect(() => validateAllSymbolsRecommendations(all)).not.toThrow();
});
