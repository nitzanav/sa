import { jest } from "@jest/globals";
import { readFileSync } from "node:fs";
import {
  collectAllTopAnalystTableRows,
  formatProjectedPercent,
  formatUsdPriceTarget,
  formatYahooTableDate,
  mapYahooRecommendation,
  padUsDate,
  parseYahooAnalystRecommendation,
  quoteFromUrl,
} from "./yahoo_analyst_recommendation.js";
import { yahooOpenPrice } from "./yahoo_open_price.js";

const html = readFileSync(
  new URL("./__fixtures__/yahoo_analyst.html", import.meta.url),
  "utf8",
);

function mockOpenPrice(value = 218.92) {
  return jest.spyOn(yahooOpenPrice, "forDate").mockResolvedValue(value);
}

test("quoteFromUrl reads the Yahoo ticker", () => {
  expect(quoteFromUrl("https://finance.yahoo.com/quote/NVDA/analyst-insights/")).toBe(
    "NVDA",
  );
});

test("maps Yahoo grades onto the shared schema", () => {
  expect(mapYahooRecommendation("Overweight")).toBe("Buy");
  expect(mapYahooRecommendation("Outperform")).toBe("Buy");
  expect(mapYahooRecommendation("Equal-Weight")).toBe("Hold");
  expect(mapYahooRecommendation("Market Perform")).toBe("Hold");
  expect(mapYahooRecommendation("Underperform")).toBe("Sell");
});

test("formats Yahoo price target, projected percent, and date", () => {
  expect(formatUsdPriceTarget(300)).toBe("$300.00");
  expect(formatUsdPriceTarget(0)).toBe(null);
  expect(formatProjectedPercent(300, 218.92)).toBe("+37%");
  expect(formatProjectedPercent(390, 218.92)).toBe("+78.1%");
  expect(formatProjectedPercent(0, 218.92)).toBe(null);
  expect(formatYahooTableDate("2026-09-10")).toBe("09/10/2026");
  expect(formatYahooTableDate("9/4/2026")).toBe("09/04/2026");
  expect(padUsDate("9/4/2026")).toBe("09/04/2026");
});

test("parseYahooAnalystRecommendation reads the Top Analysts table", async () => {
  const openSpy = mockOpenPrice();
  await expect(parseYahooAnalystRecommendation(html, "NVDA")).resolves.toEqual([
    {
      analyst: "Piper Sandler",
      firm: "Piper Sandler",
      recommendation: "Buy",
      action: "Maintained",
      price_target: "$300.00",
      projected: "+37%",
      date: "09/10/2026",
    },
    {
      analyst: "Rosenblatt",
      firm: "Rosenblatt",
      recommendation: "Buy",
      action: "Maintained",
      price_target: "$390.00",
      projected: "+78.1%",
      date: "09/04/2026",
    },
  ]);
  expect(openSpy).toHaveBeenCalledWith("NVDA", "09/10/2026");
  expect(openSpy).toHaveBeenCalledWith("NVDA", "09/04/2026");
  openSpy.mockRestore();
});

test("parseYahooAnalystRecommendation reads a header-matched Top Analysts table", async () => {
  const openSpy = mockOpenPrice();
  const tableOnly = `
    <table>
      <thead>
        <tr>
          <th>Analyst</th>
          <th>Overall Score</th>
          <th>Direction Score</th>
          <th>Price Score</th>
          <th>Latest Rating</th>
          <th>Price Target</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Raymond James</td>
          <td>80</td>
          <td>75</td>
          <td>94</td>
          <td>Market Perform</td>
          <td>-</td>
          <td>2026-01-03</td>
        </tr>
      </tbody>
    </table>
  `;
  await expect(parseYahooAnalystRecommendation(tableOnly, "NVDA")).resolves.toEqual([
    {
      analyst: "Raymond James",
      firm: "Raymond James",
      recommendation: "Hold",
      action: "Maintained",
      price_target: null,
      projected: null,
      date: "01/03/2026",
    },
  ]);
  expect(openSpy).not.toHaveBeenCalled();
  openSpy.mockRestore();
});

test("parseYahooAnalystRecommendation ignores the upgrades table", async () => {
  const upgradesOnly = `
    <table>
      <tr><td>Initiated</td><td>Piper Sandler: Overweight</td><td>9/10/2026</td></tr>
      <tr><td>Maintains</td><td>Rosenblatt: Buy to Buy</td><td>9/4/2026</td></tr>
    </table>
  `;
  const stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  await expect(parseYahooAnalystRecommendation(upgradesOnly, "NVDA")).resolves.toEqual([]);
  expect(stderrSpy).toHaveBeenCalledWith(
    '{"message":"error","error":"Yahoo Top Analysts table not found","log_level":"error"}\n',
  );
  stderrSpy.mockRestore();
});

test("parseYahooAnalystRecommendation returns empty array when table missing", async () => {
  const stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  await expect(parseYahooAnalystRecommendation("<html></html>", "NVDA")).resolves.toEqual(
    [],
  );
  expect(stderrSpy).toHaveBeenCalledWith(
    '{"message":"error","error":"Yahoo Top Analysts table not found","log_level":"error"}\n',
  );
  stderrSpy.mockRestore();
});

test("collectAllTopAnalystTableRows merges paginated tbody rows", async () => {
  const pages = [["<tr data-i=\"1\"></tr>"], ["<tr data-i=\"2\"></tr>"]];
  let pageIndex = 0;
  let written = null;
  const table = {
    count: async () => 1,
    locator: (selector) => {
      if (selector === "tbody tr") {
        return {
          evaluateAll: async (fn) => fn(pages[pageIndex].map((html) => ({ outerHTML: html }))),
        };
      }
      if (selector === "tbody tr td") {
        return {
          first: () => ({
            textContent: async () => String(pageIndex + 1),
          }),
        };
      }
      if (selector === "tbody") {
        return {
          evaluate: async (_fn, rows) => {
            written = rows;
          },
        };
      }
      throw new Error(selector);
    },
  };
  const page = {
    locator: () => ({ first: () => table }),
    getByTestId: () => ({
      count: async () => 1,
      isDisabled: async () => pageIndex >= pages.length - 1,
      click: async () => {
        pageIndex += 1;
      },
    }),
    waitForFunction: async () => {},
  };
  await collectAllTopAnalystTableRows(page);
  expect(written).toEqual(["<tr data-i=\"1\"></tr>", "<tr data-i=\"2\"></tr>"]);
});
