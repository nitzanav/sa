import { jest } from "@jest/globals";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseAnalystRecommendation,
  scrapeAnalystRecommendation,
} from "./scrape_analyst_recommendation.js";

const html = readFileSync(
  new URL("./__fixtures__/analyst.html", import.meta.url),
  "utf8",
);

test("parseAnalystRecommendation returns rows in order", () => {
  const rows = parseAnalystRecommendation(html);
  expect(rows).toEqual([
    {
      analyst: "James Schneider",
      firm: "Goldman Sachs",
      recommendation: "Buy",
      action: "Maintained",
      price_target: "$300.00",
      projected: "+37.4%",
      date: "09/10/2026",
    },
    {
      analyst: "David O'Connor",
      firm: "Piper Sandler",
      recommendation: "Buy",
      action: "Initiated",
      price_target: null,
      projected: null,
      date: "09/10/2026",
    },
  ]);
});

test("parseAnalystRecommendation throws when table missing", () => {
  expect(() => parseAnalystRecommendation("<html></html>")).toThrow(/not found/);
});

test("scrapeAnalystRecommendation caches html and parses", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sa-"));
  const file = join(dir, "NVDA.html");
  const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => html,
  });
  const rows = await scrapeAnalystRecommendation(
    "https://www.google.com/finance/beta/quote/NVDA:NASDAQ?tab=analysis",
    { operationName: "NVDA", initialDelay: 0, maxAttempts: 1 },
    { fileName: file },
  );
  expect(rows).toHaveLength(2);
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  fetchSpy.mockRestore();
});
