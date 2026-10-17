import { jest } from "@jest/globals";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logger } from "../../common/logger.js";
import {
  googleAnalystRecommendationSource,
  googleAnalystRecommendationUrl,
  parseGoogleAnalystRecommendation,
  quoteFromUrl as googleQuoteFromUrl,
} from "./google_analyst_recommendation.js";
import {
  analystRecommendationDir,
  scrapeAnalystRecommendation,
  scrapeAnalystRecommendationFromUrl,
  sourceForUrl,
} from "./scrape_analyst_recommendation.js";
import { tipranksAnalystRecommendationSource } from "./tipranks_analyst_recommendation.js";
import { yahooAnalystRecommendationSource } from "./yahoo_analyst_recommendation.js";
import { yahooOpenPrice } from "./yahoo_open_price.js";

const html = readFileSync(
  new URL("./__fixtures__/analyst.html", import.meta.url),
  "utf8",
);
const sources = [
  googleAnalystRecommendationSource,
  yahooAnalystRecommendationSource,
  tipranksAnalystRecommendationSource,
];

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

function analystPayload(rows) {
  return `AF_initDataCallback({key: 'ds:6', hash: '1', data:${JSON.stringify([
    ["Name", "USD"],
    rows,
  ])}, sideChannel: {}});`;
}

function quotePayload(symbol, price) {
  return `AF_initDataCallback({key: 'ds:2', hash: '1', data:${JSON.stringify([
    [[["id", [symbol, "NYSE"], "Name", 0, "USD", [price]]]],
  ])}, sideChannel: {}});`;
}

function embeddedRow({
  analyst,
  firm,
  recommendation = "Hold",
  action = "Maintained",
  date,
  amount,
  currency,
  displayAmount,
  displayCurrency,
}) {
  const row = Array(30).fill(null);
  row[1] = analyst;
  row[2] = firm;
  row[3] = recommendation;
  row[4] = date;
  row[19] = amount;
  row[21] = currency;
  row[22] = displayAmount;
  row[24] = displayCurrency;
  row[27] = action;
  return row;
}

test("parseGoogleAnalystRecommendation converts non-USD targets using embedded USD", () => {
  const html = `<html><body><main><table><thead><tr>
    <th>Analyst</th><th>Recommendation</th><th>Action</th>
    <th>Price target</th><th>Projected</th><th>Date</th>
    </tr></thead><tbody>
    <tr><td><div><div>Ada</div><div>Citi</div></div></td>
      <td>Buy</td><td>Maintained</td><td>$28.70</td><td>+8.5%</td><td>10/13/2026</td></tr>
    <tr><td><div><div>Jia Hui NG</div><div>DBS</div></div></td>
      <td>Buy</td><td>Initiated</td><td>SGD 1.86</td><td>-93%</td><td>06/10/2026</td></tr>
    <tr><td><div><div>Kyle McPhee</div><div>ATB</div></div></td>
      <td>Hold</td><td>Maintained</td><td>CA$11.50</td><td>-98.2%</td><td>05/11/2026</td></tr>
    </tbody></table></main></body></html>
    <script>${quotePayload("DE", 26.46)}</script>
    <script>${analystPayload([
      embeddedRow({
        analyst: "Ada",
        firm: "Citi",
        recommendation: "Buy",
        date: "10/13/2026",
        amount: 28.7,
        currency: "USD",
        displayAmount: 28.7,
        displayCurrency: "USD",
      }),
      embeddedRow({
        analyst: "Jia Hui NG",
        firm: "DBS",
        recommendation: "Buy",
        action: "Initiated",
        date: "06/10/2026",
        amount: 1.86,
        currency: "SGD",
        displayAmount: 1.47074478,
        displayCurrency: "USD",
      }),
      embeddedRow({
        analyst: "Kyle McPhee",
        firm: "ATB",
        date: "05/11/2026",
        amount: 11.5,
        currency: "CAD",
        displayAmount: 8.33,
        displayCurrency: "USD",
      }),
    ])}</script>`;
  expect(parseGoogleAnalystRecommendation(html)).toEqual([
    {
      analyst: "Ada",
      firm: "Citi",
      recommendation: "Buy",
      action: "Maintained",
      price_target: "$28.70",
      projected: "+8.5%",
      date: "10/13/2026",
    },
    {
      analyst: "Jia Hui NG",
      firm: "DBS",
      recommendation: "Buy",
      action: "Initiated",
      price_target: "$1.47",
      projected: "-94.4%",
      date: "06/10/2026",
    },
    {
      analyst: "Kyle McPhee",
      firm: "ATB",
      recommendation: "Hold",
      action: "Maintained",
      price_target: "$8.33",
      projected: "-68.5%",
      date: "05/11/2026",
    },
  ]);
});

test("parseGoogleAnalystRecommendation reads embedded rows when the table is missing", () => {
  const html = `<html></html><script>${quotePayload("CBOE", 308.09)}</script><script>${analystPayload([
    embeddedRow({
      analyst: "Eli Abboud",
      firm: "Bank of America Securities",
      date: "10/14/2026",
      action: "Reiterated",
      amount: 329,
      currency: "USD",
      displayAmount: 6067.42,
      displayCurrency: "MXN",
    }),
  ])}</script>`;
  expect(parseGoogleAnalystRecommendation(html)).toEqual([
    {
      analyst: "Eli Abboud",
      firm: "Bank of America Securities",
      recommendation: "Hold",
      action: "Reiterated",
      price_target: "$329.00",
      projected: "+6.8%",
      date: "10/14/2026",
    },
  ]);
});

test("googleAnalystRecommendationUrl uses the quote alias", () => {
  expect(googleAnalystRecommendationUrl("NVDA", "NASDAQ")).toBe(
    "https://www.google.com/finance/beta/quote/NVDA:NASDAQ?window=YTD&tab=analysis&hl=en",
  );
  expect(googleAnalystRecommendationUrl("PSKY", "NYSE")).toBe(
    "https://www.google.com/finance/beta/quote/SKYD:NYSE?window=YTD&tab=analysis&hl=en",
  );
  expect(() => googleAnalystRecommendationUrl("ZZZ")).toThrow(
    "missing exchange for ZZZ",
  );
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
  expect(analystRecommendationDir(tipranksAnalystRecommendationSource)).toBe(
    "data/analyst_recomendation/tipranks",
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
  expect(
    sourceForUrl("https://mcp.tipranks.com/mcp/?ticker=BRK.B", sources),
  ).toBe(tipranksAnalystRecommendationSource);
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
  const fetchSpy = jest
    .spyOn(yahooAnalystRecommendationSource, "fetch")
    .mockResolvedValue(yahooHtml);
  const openSpy = jest.spyOn(yahooOpenPrice, "forDate").mockResolvedValue(218.92);
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
    { analyst: "Piper Sandler", recommendation: "Buy", action: "Maintained" },
    { analyst: "Rosenblatt", recommendation: "Buy", action: "Maintained" },
  ]);
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  expect(openSpy).toHaveBeenCalledWith("NVDA", "09/10/2026");
  fetchSpy.mockRestore();
  openSpy.mockRestore();
  logger.clearContext();
});
