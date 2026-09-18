import { jest } from "@jest/globals";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logger } from "../../common/logger.js";
import {
  googleAnalystRecommendationSource,
  parseGoogleAnalystRecommendation,
  quoteFromUrl as googleQuoteFromUrl,
} from "./google_analyst_recommendation.js";
import {
  analystRecommendationDir,
  scrapeAnalystRecommendation,
  scrapeAnalystRecommendationFromUrl,
  sourceForUrl,
} from "./scrape_analyst_recommendation.js";
import { yahooAnalystRecommendationSource } from "./yahoo_analyst_recommendation.js";

const html = readFileSync(
  new URL("./__fixtures__/analyst.html", import.meta.url),
  "utf8",
);
const sources = [googleAnalystRecommendationSource, yahooAnalystRecommendationSource];

test("parseGoogleAnalystRecommendation returns rows in order", () => {
  const rows = parseGoogleAnalystRecommendation(html);
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

test("parseGoogleAnalystRecommendation returns empty array when table missing", () => {
  const stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  expect(parseGoogleAnalystRecommendation("<html></html>")).toEqual([]);
  expect(stderrSpy).toHaveBeenCalledWith(
    '{"message":"error","error":"Analyst Recommendation table not found","log_level":"error"}\n',
  );
  stderrSpy.mockRestore();
});

test("google quoteFromUrl strips the exchange from the ticker", () => {
  expect(
    googleQuoteFromUrl(
      "https://www.google.com/finance/beta/quote/NVDA:NASDAQ?tab=analysis",
    ),
  ).toBe("NVDA");
});

test("analystRecommendationDir is data/analyst_recomendation/<source>", () => {
  expect(analystRecommendationDir(googleAnalystRecommendationSource)).toBe(
    "data/analyst_recomendation/google",
  );
  expect(analystRecommendationDir(yahooAnalystRecommendationSource)).toBe(
    "data/analyst_recomendation/yahoo",
  );
});

test("sourceForUrl selects the source from the url", () => {
  expect(
    sourceForUrl(
      "https://www.google.com/finance/beta/quote/NVDA:NASDAQ?tab=analysis",
      sources,
    ),
  ).toBe(googleAnalystRecommendationSource);
  expect(
    sourceForUrl("https://finance.yahoo.com/quote/NVDA/analyst-insights/", sources),
  ).toBe(yahooAnalystRecommendationSource);
  expect(() => sourceForUrl("https://example.com/quote/NVDA", sources)).toThrow(
    "No analyst recommendation source for https://example.com/quote/NVDA",
  );
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
    googleAnalystRecommendationSource,
    "https://www.google.com/finance/beta/quote/NVDA:NASDAQ?tab=analysis",
    { operationName: "NVDA", initialDelay: 0, maxAttempts: 1 },
    { fileName: file },
  );
  expect(rows).toHaveLength(2);
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  fetchSpy.mockRestore();
  logger.clearContext();
});

test("scrapeAnalystRecommendation logs the symbol from the source", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sa-"));
  const stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => "<html></html>",
  });
  await scrapeAnalystRecommendation(
    googleAnalystRecommendationSource,
    "https://www.google.com/finance/beta/quote/NVDA:NASDAQ?tab=analysis",
    { operationName: "NVDA", initialDelay: 0, maxAttempts: 1 },
    { fileName: join(dir, "NVDA.html") },
  );
  expect(stderrSpy).toHaveBeenCalledWith(
    '{"source":"google","symbol":"NVDA","message":"error","error":"Analyst Recommendation table not found","log_level":"error"}\n',
  );
  fetchSpy.mockRestore();
  stderrSpy.mockRestore();
  logger.clearContext();
});

test("scrapeAnalystRecommendationFromUrl uses the Yahoo source for Yahoo urls", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sa-"));
  const yahooHtml = readFileSync(
    new URL("./__fixtures__/yahoo_analyst.html", import.meta.url),
    "utf8",
  );
  const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => yahooHtml,
  });
  const rows = await scrapeAnalystRecommendationFromUrl(
    "https://finance.yahoo.com/quote/NVDA/analyst-insights/",
    sources,
    { operationName: "NVDA", initialDelay: 0, maxAttempts: 1 },
    { fileName: join(dir, "NVDA.html") },
  );
  expect(rows.map(({ analyst, recommendation, action }) => ({
    analyst,
    recommendation,
    action,
  }))).toEqual([
    { analyst: "Piper Sandler", recommendation: "Buy", action: "Initiated" },
    { analyst: "Rosenblatt", recommendation: "Buy", action: "Maintained" },
  ]);
  fetchSpy.mockRestore();
  logger.clearContext();
});
