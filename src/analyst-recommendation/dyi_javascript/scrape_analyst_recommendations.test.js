import { jest } from "@jest/globals";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ANALYST_RECOMMENDATION_SOURCES,
  escapeAnalystName,
  flattenAllSymbols,
  flattenAllSymbolsPerDateAndSymbol,
  flattenAllSymbolsPerDateAndSymbol7dAggregationWindow,
  scrapeAnalystRecommendations,
  selectAnalystRecommendationSources,
} from "./scrape_analyst_recommendations.js";
import { yahooAnalystRecommendationSource } from "./yahoo_analyst_recommendation.js";
import { yahooOpenPrice } from "./yahoo_open_price.js";

test("selectAnalystRecommendationSources filters by name", () => {
  expect(
    selectAnalystRecommendationSources(ANALYST_RECOMMENDATION_SOURCES, ["yahoo"]).map(
      (source) => source.name,
    ),
  ).toEqual(["yahoo"]);
  expect(selectAnalystRecommendationSources(ANALYST_RECOMMENDATION_SOURCES, null)).toEqual(
    ANALYST_RECOMMENDATION_SOURCES,
  );
});

test("selectAnalystRecommendationSources rejects unknown names", () => {
  expect(() =>
    selectAnalystRecommendationSources(ANALYST_RECOMMENDATION_SOURCES, ["bing"]),
  ).toThrow('Unknown analyst recommendation source(s): bing');
});

test("iterates first analyst_recommendations.limit symbols and writes outputs", async () => {
  const html = readFileSync(
    new URL("./__fixtures__/analyst.html", import.meta.url),
    "utf8",
  );
  const yahooHtml = readFileSync(
    new URL("./__fixtures__/yahoo_analyst.html", import.meta.url),
    "utf8",
  );
  const cwd = mkdtempSync(join(tmpdir(), "plural-"));
  mkdirSync(join(cwd, "data/fortune_500"), { recursive: true });
  writeFileSync(
    join(cwd, "data/fortune_500/symbols.csv"),
    "Symbol,Name\nAAA,Alpha\nBBB,Beta\nCCC,Gamma\nDDD,Delta\n",
  );
  writeFileSync(
    join(cwd, "data/symbols_exchange.csv"),
    "ticker,exchange\nAAA,NYSE\nBBB,NASDAQ\nCCC,NYSE\nDDD,NYSE\n",
  );
  const originalCwd = process.cwd();
  process.chdir(cwd);
  const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => html,
  });
  const yahooFetchSpy = jest
    .spyOn(yahooAnalystRecommendationSource, "fetch")
    .mockResolvedValue(yahooHtml);
  const openSpy = jest.spyOn(yahooOpenPrice, "forDate").mockResolvedValue(218.92);
  try {
    await scrapeAnalystRecommendations();
    const all = JSON.parse(
      readFileSync(
        join(cwd, "data/analyst_recomendation/google/all_symbols.json"),
        "utf8",
      ),
    );
    expect(all).toEqual([
      { date: "2026-09-10", ticker: "AAA", analyst: "David O'Connor", percent: null },
      { date: "2026-09-10", ticker: "AAA", analyst: "James Schneider", percent: 37.4 },
      { date: "2026-09-10", ticker: "BBB", analyst: "David O'Connor", percent: null },
      { date: "2026-09-10", ticker: "BBB", analyst: "James Schneider", percent: 37.4 },
      { date: "2026-09-10", ticker: "CCC", analyst: "David O'Connor", percent: null },
      { date: "2026-09-10", ticker: "CCC", analyst: "James Schneider", percent: 37.4 },
    ]);
    expect(
      readFileSync(join(cwd, "data/analyst_recomendation/google/AAA.html"), "utf8"),
    ).toBe(html);
    expect(
      JSON.parse(
        readFileSync(
          join(cwd, "data/analyst_recomendation/google/AAA.json"),
          "utf8",
        ),
      ),
    ).toHaveLength(2);
    expect(
      readFileSync(join(cwd, "data/analyst_recomendation/google/all_symbols.csv"), "utf8"),
    ).toBe(
      [
        "date,ticker,analyst,percent",
        "2026-09-10,AAA,David O'Connor,",
        "2026-09-10,AAA,James Schneider,37.4",
        "2026-09-10,BBB,David O'Connor,",
        "2026-09-10,BBB,James Schneider,37.4",
        "2026-09-10,CCC,David O'Connor,",
        "2026-09-10,CCC,James Schneider,37.4",
      ].join("\n"),
    );
    const perDateAndSymbolCsv = [
      "date,symbol,average_projected,std_projected,analyst_projections_count,projections",
      "2026-09-10,AAA,37.4,,1,James Schneider:37.4",
      "2026-09-10,BBB,37.4,,1,James Schneider:37.4",
      "2026-09-10,CCC,37.4,,1,James Schneider:37.4",
    ].join("\n");
    expect(
      readFileSync(
        join(cwd, "data/analyst_recomendation/google/all_symbols_per_date_and_symbol.csv"),
        "utf8",
      ),
    ).toBe(perDateAndSymbolCsv);
    expect(
      readFileSync(
        join(
          cwd,
          "data/analyst_recomendation/google/all_symbols_per_date_and_symbol_7d_aggregation_window.csv",
        ),
        "utf8",
      ),
    ).toBe(perDateAndSymbolCsv);
    const yahooAll = JSON.parse(
      readFileSync(
        join(cwd, "data/analyst_recomendation/yahoo/all_symbols.json"),
        "utf8",
      ),
    );
    expect(yahooAll).toEqual([
      { date: "2026-09-04", ticker: "AAA", analyst: "Rosenblatt", percent: 78.1 },
      { date: "2026-09-04", ticker: "BBB", analyst: "Rosenblatt", percent: 78.1 },
      { date: "2026-09-04", ticker: "CCC", analyst: "Rosenblatt", percent: 78.1 },
      { date: "2026-09-10", ticker: "AAA", analyst: "Piper Sandler", percent: 37 },
      { date: "2026-09-10", ticker: "BBB", analyst: "Piper Sandler", percent: 37 },
      { date: "2026-09-10", ticker: "CCC", analyst: "Piper Sandler", percent: 37 },
    ]);
    expect(
      readFileSync(join(cwd, "data/analyst_recomendation/yahoo/all_symbols.csv"), "utf8"),
    ).toBe(
      [
        "date,ticker,analyst,percent",
        "2026-09-04,AAA,Rosenblatt,78.1",
        "2026-09-04,BBB,Rosenblatt,78.1",
        "2026-09-04,CCC,Rosenblatt,78.1",
        "2026-09-10,AAA,Piper Sandler,37",
        "2026-09-10,BBB,Piper Sandler,37",
        "2026-09-10,CCC,Piper Sandler,37",
      ].join("\n"),
    );
    const yahooPerDateAndSymbolCsv = [
      "date,symbol,average_projected,std_projected,analyst_projections_count,projections",
      "2026-09-04,AAA,78.1,,1,Rosenblatt:78.1",
      "2026-09-04,BBB,78.1,,1,Rosenblatt:78.1",
      "2026-09-04,CCC,78.1,,1,Rosenblatt:78.1",
      "2026-09-10,AAA,37,,1,Piper Sandler:37",
      "2026-09-10,BBB,37,,1,Piper Sandler:37",
      "2026-09-10,CCC,37,,1,Piper Sandler:37",
    ].join("\n");
    expect(
      readFileSync(
        join(cwd, "data/analyst_recomendation/yahoo/all_symbols_per_date_and_symbol.csv"),
        "utf8",
      ),
    ).toBe(yahooPerDateAndSymbolCsv);
    expect(
      readFileSync(
        join(
          cwd,
          "data/analyst_recomendation/yahoo/all_symbols_per_date_and_symbol_7d_aggregation_window.csv",
        ),
        "utf8",
      ),
    ).toBe(
      [
        "date,symbol,average_projected,std_projected,analyst_projections_count,projections",
        "2026-09-04,AAA,78.1,,1,Rosenblatt:78.1",
        "2026-09-04,BBB,78.1,,1,Rosenblatt:78.1",
        "2026-09-04,CCC,78.1,,1,Rosenblatt:78.1",
        "2026-09-10,AAA,57.55,29.0621,2,Rosenblatt:78.1|Piper Sandler:37",
        "2026-09-10,BBB,57.55,29.0621,2,Rosenblatt:78.1|Piper Sandler:37",
        "2026-09-10,CCC,57.55,29.0621,2,Rosenblatt:78.1|Piper Sandler:37",
      ].join("\n"),
    );
  } finally {
    yahooFetchSpy.mockRestore();
    openSpy.mockRestore();
    fetchSpy.mockRestore();
    process.chdir(originalCwd);
  }
});

test("flattenAllSymbols sorts by date, ticker, analyst and parses percent", () => {
  expect(
    flattenAllSymbols({
      BBB: [
        { analyst: "Zoe", projected: "+10.9%", date: "01/02/2026" },
      ],
      AAA: [
        { analyst: "Matthew Smith, CFA", projected: null, date: "01/02/2026" },
        { analyst: "Ann", projected: "-12.1%", date: "12/31/2025" },
      ],
    }),
  ).toEqual([
    { date: "2025-12-31", ticker: "AAA", analyst: "Ann", percent: -12.1 },
    { date: "2026-01-02", ticker: "AAA", analyst: "Matthew Smith, CFA", percent: null },
    { date: "2026-01-02", ticker: "BBB", analyst: "Zoe", percent: 10.9 },
  ]);
});

test("flattenAllSymbolsPerDateAndSymbol averages and std by date and symbol", () => {
  expect(
    flattenAllSymbolsPerDateAndSymbol({
      BBB: [
        { analyst: "Zoe", projected: "+10.9%", date: "01/02/2026" },
        { analyst: "Yan", projected: "+20.9%", date: "01/02/2026" },
      ],
      AAA: [
        { analyst: "Matthew Smith, CFA", projected: null, date: "01/02/2026" },
        { analyst: "Ann", projected: "-12.1%", date: "12/31/2025" },
        { analyst: "Bo", projected: "+10%", date: "01/02/2026" },
      ],
      CCC: [{ analyst: "Cam", projected: null, date: "01/02/2026" }],
    }),
  ).toEqual([
    {
      date: "2025-12-31",
      symbol: "AAA",
      average_projected: -12.1,
      std_projected: null,
      analyst_projections_count: 1,
      projections: "Ann:-12.1",
    },
    {
      date: "2026-01-02",
      symbol: "AAA",
      average_projected: 10,
      std_projected: null,
      analyst_projections_count: 1,
      projections: "Bo:10",
    },
    {
      date: "2026-01-02",
      symbol: "BBB",
      average_projected: 15.9,
      std_projected: 7.0711,
      analyst_projections_count: 2,
      projections: "Yan:20.9|Zoe:10.9",
    },
  ]);
});

test("flattenAllSymbolsPerDateAndSymbol7dAggregationWindow rolls last 7 days", () => {
  expect(
    flattenAllSymbolsPerDateAndSymbol7dAggregationWindow({
      BBB: [{ analyst: "Zoe", projected: "+40%", date: "01/02/2026" }],
      AAA: [
        { analyst: "Matthew Smith, CFA", projected: null, date: "01/01/2026" },
        { analyst: "Ann", projected: "+10%", date: "01/01/2026" },
        { analyst: "Bo", projected: "+20%", date: "01/03/2026" },
        { analyst: "Cam", projected: "+30%", date: "01/10/2026" },
      ],
    }),
  ).toEqual([
    {
      date: "2026-01-01",
      symbol: "AAA",
      average_projected: 10,
      std_projected: null,
      analyst_projections_count: 1,
      projections: "Ann:10",
    },
    {
      date: "2026-01-02",
      symbol: "AAA",
      average_projected: 10,
      std_projected: null,
      analyst_projections_count: 1,
      projections: "Ann:10",
    },
    {
      date: "2026-01-02",
      symbol: "BBB",
      average_projected: 40,
      std_projected: null,
      analyst_projections_count: 1,
      projections: "Zoe:40",
    },
    {
      date: "2026-01-03",
      symbol: "AAA",
      average_projected: 15,
      std_projected: 7.0711,
      analyst_projections_count: 2,
      projections: "Ann:10|Bo:20",
    },
    {
      date: "2026-01-03",
      symbol: "BBB",
      average_projected: 40,
      std_projected: null,
      analyst_projections_count: 1,
      projections: "Zoe:40",
    },
    {
      date: "2026-01-10",
      symbol: "AAA",
      average_projected: 30,
      std_projected: null,
      analyst_projections_count: 1,
      projections: "Cam:30",
    },
  ]);
});

test("escapeAnalystName avoids csv-quoting characters", () => {
  expect(escapeAnalystName('a|b,c"d\\e')).toBe("a\\|b;c''d\\\\e");
  expect(
    flattenAllSymbolsPerDateAndSymbol({
      AAA: [
        { analyst: "Matthew Smith, CFA", projected: "+10%", date: "01/02/2026" },
        { analyst: "Bo", projected: "+20%", date: "01/02/2026" },
      ],
    })[0].projections,
  ).toBe("Bo:20|Matthew Smith; CFA:10");
});
