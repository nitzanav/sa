import { chunk } from "../common/chunk.js";
import config from "../common/config.js";
import { parseCsv, readCsv } from "../common/csv.js";
import { httpRequestScrape } from "../common/http_request_scrape.js";
import { writeTextFile } from "../common/write_file.js";

const SYMBOLS_EXCHANGE_FILE = "data/symbols_exchange.csv";

function tickersUrl(symbols) {
  const { url, api_key, fields, limit } = config.sharadar;
  const params = new URLSearchParams({
    api_key,
    ticker: symbols.join(","),
    fields,
    format: "csv",
    limit,
  });
  return `${url}?${params}`;
}

async function fetchTickers(symbols, index) {
  const csv = await httpRequestScrape(
    { url: tickersUrl(symbols) },
    { operationName: `sharadar_tickers_${index}` },
    { fileName: `data/sharadar_tickers/${index}.csv` },
  );
  return parseCsv(csv);
}

export async function fetchSymbolsExchange(symbols) {
  const rows = [];
  for (const [index, symbolsChunk] of chunk(symbols, config.sharadar.chunkSize).entries()) {
    rows.push(...(await fetchTickers(symbolsChunk, index)));
  }
  const exchangeBySymbol = Object.fromEntries(rows.map((row) => [row.ticker, row.exchange]));
  const lines = Object.entries(exchangeBySymbol).map((entry) => entry.join(","));
  await writeTextFile(SYMBOLS_EXCHANGE_FILE, [config.sharadar.fields, ...lines].join("\n"));
  return exchangeBySymbol;
}

export const readSymbolsExchange = () =>
  Object.fromEntries(readCsv(SYMBOLS_EXCHANGE_FILE).map((row) => [row.ticker, row.exchange]));

if (import.meta.url === `file://${process.argv[1]}`) {
  await fetchSymbolsExchange(readCsv("data/fortune_500/symbols.csv").map((row) => row.Symbol));
}
