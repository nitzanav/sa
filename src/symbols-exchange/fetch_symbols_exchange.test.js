import { jest } from "@jest/globals";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import config from "../common/config.js";
import { fetchSymbolsExchange, readSymbolsExchange } from "./fetch_symbols_exchange.js";

test("readSymbolsExchange lets overrides replace Sharadar and add a quote alias", () => {
  const cwd = mkdtempSync(join(tmpdir(), "sx-override-"));
  mkdirSync(join(cwd, "data"));
  writeFileSync(join(cwd, "data/symbols_exchange.csv"), "ticker,exchange\nAAA,NYSE\n");
  writeFileSync(
    join(cwd, "data/symbols_exchange_overrides.csv"),
    "ticker,exchange,quote\nAAA,NASDAQ,\nPSKY,NYSE,SKYD\n",
  );
  const originalCwd = process.cwd();
  process.chdir(cwd);
  try {
    expect(readSymbolsExchange()).toEqual({ AAA: "NASDAQ", PSKY: "NYSE" });
  } finally {
    process.chdir(originalCwd);
  }
});

test("fetchSymbolsExchange chunks requests, dedupes rows and writes csv", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "sx-"));
  const originalCwd = process.cwd();
  const symbols = Array.from(
    { length: config.sharadar.chunkSize + 1 },
    (_, index) => `S${index}`,
  );
  const fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    const tickers = new URL(url).searchParams.get("ticker").split(",");
    const rows = tickers.flatMap((ticker) => [`${ticker},NYSE`, `${ticker},NYSE`]);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => [config.sharadar.fields, ...rows].join("\n"),
    };
  });
  process.chdir(cwd);
  try {
    const exchanges = await fetchSymbolsExchange(symbols);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(Object.keys(exchanges)).toHaveLength(symbols.length);
    expect(readSymbolsExchange()).toEqual(exchanges);
  } finally {
    fetchSpy.mockRestore();
    process.chdir(originalCwd);
  }
});
