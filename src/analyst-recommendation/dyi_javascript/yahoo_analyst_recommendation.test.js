import { jest } from "@jest/globals";
import { readFileSync } from "node:fs";
import {
  formatProjectedPercent,
  formatUsdPriceTarget,
  formatYahooDate,
  mapYahooAction,
  mapYahooRecommendation,
  padUsDate,
  parseYahooAnalystRecommendation,
  quoteFromUrl,
} from "./yahoo_analyst_recommendation.js";

const html = readFileSync(
  new URL("./__fixtures__/yahoo_analyst.html", import.meta.url),
  "utf8",
);

test("quoteFromUrl reads the Yahoo ticker", () => {
  expect(quoteFromUrl("https://finance.yahoo.com/quote/NVDA/analyst-insights/")).toBe(
    "NVDA",
  );
});

test("maps Yahoo grades and actions onto the shared schema", () => {
  expect(mapYahooRecommendation("Overweight")).toBe("Buy");
  expect(mapYahooRecommendation("Outperform")).toBe("Buy");
  expect(mapYahooRecommendation("Equal-Weight")).toBe("Hold");
  expect(mapYahooRecommendation("Underperform")).toBe("Sell");
  expect(mapYahooAction("init")).toBe("Initiated");
  expect(mapYahooAction("main")).toBe("Maintained");
  expect(mapYahooAction("reit")).toBe("Reiterated");
  expect(mapYahooAction("up")).toBe("Upgraded");
  expect(mapYahooAction("down")).toBe("Downgraded");
});

test("formats Yahoo price target, projected percent, and date", () => {
  expect(formatUsdPriceTarget(300)).toBe("$300.00");
  expect(formatUsdPriceTarget(0)).toBe(null);
  expect(formatProjectedPercent(300, 218.92)).toBe("+37%");
  expect(formatProjectedPercent(390, 218.92)).toBe("+78.1%");
  expect(formatProjectedPercent(0, 218.92)).toBe(null);
  expect(formatYahooDate(1789048960)).toBe("09/10/2026");
  expect(padUsDate("9/4/2026")).toBe("09/04/2026");
});

test("parseYahooAnalystRecommendation reads quoteSummary history", () => {
  expect(parseYahooAnalystRecommendation(html)).toEqual([
    {
      analyst: "Piper Sandler",
      firm: "Piper Sandler",
      recommendation: "Buy",
      action: "Initiated",
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
});

test("parseYahooAnalystRecommendation falls back to the upgrades table", () => {
  const tableOnly = `
    <table>
      <tr><td>Initiated</td><td>Piper Sandler: Overweight</td><td>9/10/2026</td></tr>
      <tr><td>Maintains</td><td>Rosenblatt: Buy to Buy</td><td>9/4/2026</td></tr>
    </table>
  `;
  expect(parseYahooAnalystRecommendation(tableOnly)).toEqual([
    {
      analyst: "Piper Sandler",
      firm: "Piper Sandler",
      recommendation: "Buy",
      action: "Initiated",
      price_target: null,
      projected: null,
      date: "09/10/2026",
    },
    {
      analyst: "Rosenblatt",
      firm: "Rosenblatt",
      recommendation: "Buy",
      action: "Maintained",
      price_target: null,
      projected: null,
      date: "09/04/2026",
    },
  ]);
});

test("parseYahooAnalystRecommendation returns empty array when history missing", () => {
  const stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  expect(parseYahooAnalystRecommendation("<html></html>")).toEqual([]);
  expect(stderrSpy).toHaveBeenCalledWith(
    '{"message":"error","error":"Yahoo analyst recommendation history not found","log_level":"error"}\n',
  );
  stderrSpy.mockRestore();
});
