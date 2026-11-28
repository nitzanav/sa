import http from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { query } from "../src/common/db.js";
import { buildSeries } from "./lib/series.js";

const BARS_SQL = "SELECT bar_date, close FROM yahoo_quotes WHERE symbol = $1 ORDER BY bar_date";

// New York dates, so markers line up with bar_date.
const POSITIONS_SQL = `
  SELECT (timezone('America/New_York', buy_date))::date AS buy_date,
         price,
         (timezone('America/New_York', sell_date))::date AS sell_date,
         sell_price
  FROM positions
  WHERE symbol = $1
  ORDER BY buy_date`;

const SYMBOLS_SQL = "SELECT DISTINCT symbol FROM positions ORDER BY symbol";

// Base sources only. The combined books (yahoo_and_tipranks, yahoo_and_google)
// repeat these rows and would draw the same target twice.
const SIGNALS_SQL = `
  SELECT date, projected_price, source, analyst
  FROM raw_signals
  WHERE ticker = $1
    AND source IN ('yahoo', 'google', 'tipranks')
    AND projected_price IS NOT NULL
  ORDER BY date, source, analyst`;

const FILES = {
  "/": ["public/index.html", "text/html; charset=utf-8"],
  "/chart.js": ["public/chart.js", "text/javascript"],
  "/svg.js": ["public/svg.js", "text/javascript"],
};

export function dbSource(query) {
  return {
    symbols: async () => (await query(SYMBOLS_SQL)).map((r) => r.symbol),
    rows: async (symbol) => ({
      bars: await query(BARS_SQL, [symbol]),
      positions: await query(POSITIONS_SQL, [symbol]),
      signals: await query(SIGNALS_SQL, [symbol]),
    }),
  };
}

export function fixtureSource(fixture) {
  return {
    symbols: async () => Object.keys(fixture).sort(),
    rows: async (symbol) => fixture[symbol] ?? { bars: [], positions: [], signals: [] },
  };
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

export function createServer(source) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    try {
      if (url.pathname === "/api/symbols") return json(res, 200, await source.symbols());
      if (url.pathname === "/api/chart") {
        const symbol = url.searchParams.get("symbol");
        if (!symbol) return json(res, 400, { error: "symbol is required" });
        return json(res, 200, buildSeries(await source.rows(symbol)));
      }
      const file = FILES[url.pathname];
      if (!file) return json(res, 404, { error: "not found" });
      res.writeHead(200, { "content-type": file[1] });
      res.end(await readFile(new URL(file[0], import.meta.url)));
    } catch (error) {
      json(res, 500, { error: error.message });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const source = process.env.FIXTURE === "1"
    ? fixtureSource(JSON.parse(await readFile(new URL("./lib/fixture.json", import.meta.url))))
    : dbSource(query);
  const port = Number(process.env.PORT ?? 3000);
  createServer(source).listen(port, () => console.error(`http://localhost:${port}`));
}
