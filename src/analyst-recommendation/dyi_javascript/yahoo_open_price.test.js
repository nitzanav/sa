import { jest } from "@jest/globals";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  OPEN_PRICES_PERIOD1,
  fetchYahooOpenPrices,
  isoDateFromAnalystDate,
  openPriceOnOrBefore,
  openPricesFromChart,
  yahooFinanceClient,
  yahooOpenPriceForDate,
  yahooOpenPricesCacheFile,
} from "./yahoo_open_price.js";

test("yahooOpenPricesCacheFile is per symbol", () => {
  expect(yahooOpenPricesCacheFile("NVDA")).toBe("data/yahoo_open_prices/NVDA.json");
});

test("isoDateFromAnalystDate converts US dates", () => {
  expect(isoDateFromAnalystDate("09/10/2026")).toBe("2026-09-10");
  expect(isoDateFromAnalystDate("2026-09-10")).toBe("2026-09-10");
});

test("openPricesFromChart maps daily opens by UTC date", () => {
  expect(
    openPricesFromChart({
      quotes: [
        { date: new Date("2026-09-10T00:00:00.000Z"), open: 218.92 },
        { date: new Date("2026-09-04T00:00:00.000Z"), open: 0 },
        { date: new Date("2026-09-03T00:00:00.000Z"), open: null },
      ],
    }),
  ).toEqual({ "2026-09-10": 218.92 });
});

test("openPriceOnOrBefore uses the prior session when that day is missing", () => {
  const prices = { "2026-09-04": 170.5, "2026-09-10": 218.92 };
  expect(openPriceOnOrBefore(prices, "2026-09-10")).toBe(218.92);
  expect(openPriceOnOrBefore(prices, "2026-09-05")).toBe(170.5);
  expect(openPriceOnOrBefore(prices, "2026-09-07")).toBe(170.5);
  expect(openPriceOnOrBefore(prices, "2026-01-01")).toBe(null);
});

test("fetchYahooOpenPrices caches chart opens without a second request", async () => {
  const dir = mkdtempSync(join(tmpdir(), "open-"));
  const file = join(dir, "NVDA.json");
  const chartSpy = jest.spyOn(yahooFinanceClient, "chart").mockResolvedValue({
    quotes: [{ date: new Date("2026-09-10T00:00:00.000Z"), open: 218.92 }],
  });
  const retry = { operationName: "NVDA", initialDelay: 0, maxAttempts: 1 };
  const cache = { fileName: file };
  await expect(fetchYahooOpenPrices("NVDA", retry, cache)).resolves.toEqual({
    "2026-09-10": 218.92,
  });
  await expect(fetchYahooOpenPrices("NVDA", retry, cache)).resolves.toEqual({
    "2026-09-10": 218.92,
  });
  expect(chartSpy).toHaveBeenCalledTimes(1);
  expect(chartSpy).toHaveBeenCalledWith("NVDA", {
    period1: OPEN_PRICES_PERIOD1,
    interval: "1d",
  });
  expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ "2026-09-10": 218.92 });
  chartSpy.mockRestore();
});

test("fetchYahooOpenPrices returns cached json when fresh", async () => {
  const dir = mkdtempSync(join(tmpdir(), "open-"));
  const file = join(dir, "NVDA.json");
  writeFileSync(file, JSON.stringify({ "2026-09-10": 100 }));
  const chartSpy = jest.spyOn(yahooFinanceClient, "chart");
  await expect(
    fetchYahooOpenPrices(
      "NVDA",
      { operationName: "NVDA" },
      { fileName: file, ttl: 60000 },
    ),
  ).resolves.toEqual({ "2026-09-10": 100 });
  expect(chartSpy).not.toHaveBeenCalled();
  chartSpy.mockRestore();
});

test("yahooOpenPriceForDate looks up the open for that day or the prior session", async () => {
  const dir = mkdtempSync(join(tmpdir(), "open-"));
  const file = join(dir, "NVDA.json");
  const chartSpy = jest.spyOn(yahooFinanceClient, "chart").mockResolvedValue({
    quotes: [
      { date: new Date("2026-09-10T00:00:00.000Z"), open: 218.92 },
      { date: new Date("2026-09-04T00:00:00.000Z"), open: 170.5 },
    ],
  });
  const retry = { operationName: "NVDA", initialDelay: 0, maxAttempts: 1 };
  const cache = { fileName: file };
  await expect(yahooOpenPriceForDate("NVDA", "09/10/2026", retry, cache)).resolves.toBe(
    218.92,
  );
  await expect(yahooOpenPriceForDate("NVDA", "09/04/2026", retry, cache)).resolves.toBe(
    170.5,
  );
  await expect(yahooOpenPriceForDate("NVDA", "09/05/2026", retry, cache)).resolves.toBe(
    170.5,
  );
  await expect(yahooOpenPriceForDate("NVDA", "01/01/2026", retry, cache)).resolves.toBe(
    null,
  );
  expect(chartSpy).toHaveBeenCalledTimes(1);
  chartSpy.mockRestore();
});
