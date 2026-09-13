import { jest } from "@jest/globals";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  flattenAllSymbols,
  flattenAllSymbolsPerDateAndSymbol,
  scrapeAnalystRecommendations,
} from "./scrape_analyst_recommendations.js";

test("iterates first analyst_recommendations.limit symbols and writes outputs", async () => {
  const html = readFileSync(
    new URL("./__fixtures__/analyst.html", import.meta.url),
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
  try {
    await scrapeAnalystRecommendations();
    const all = JSON.parse(
      readFileSync(
        join(cwd, "data/google_analyst_recomendation/all_symbols.json"),
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
      readFileSync(join(cwd, "data/google_analyst_recomendation/AAA.html"), "utf8"),
    ).toBe(html);
    expect(
      JSON.parse(
        readFileSync(
          join(cwd, "data/google_analyst_recomendation/AAA.json"),
          "utf8",
        ),
      ),
    ).toHaveLength(2);
    expect(
      readFileSync(join(cwd, "data/google_analyst_recomendation/all_symbols.csv"), "utf8"),
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
    expect(
      readFileSync(
        join(cwd, "data/google_analyst_recomendation/all_symbols_per_date_and_symbol.csv"),
        "utf8",
      ),
    ).toBe(
      [
        "date,symbol,average_projected,std_projected,analyst_projections_count",
        "2026-09-10,AAA,37.4,,1",
        "2026-09-10,BBB,37.4,,1",
        "2026-09-10,CCC,37.4,,1",
      ].join("\n"),
    );
  } finally {
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
    },
    {
      date: "2026-01-02",
      symbol: "AAA",
      average_projected: 10,
      std_projected: null,
      analyst_projections_count: 1,
    },
    {
      date: "2026-01-02",
      symbol: "BBB",
      average_projected: 15.9,
      std_projected: 7.0711,
      analyst_projections_count: 2,
    },
  ]);
});
