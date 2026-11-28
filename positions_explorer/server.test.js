import { createServer, dbSource, fixtureSource } from "./server.js";

const fixture = {
  MSFT: { bars: [], positions: [], signals: [] },
  AAPL: {
    bars: [
      { bar_date: "2026-11-04", close: 200 },
      { bar_date: "2026-11-05", close: 205 },
    ],
    positions: [
      { buy_date: "2026-11-04", price: 200, sell_date: "2026-11-05", sell_price: 205 },
      { buy_date: "2026-11-05", price: 205, sell_date: null, sell_price: null },
    ],
    signals: [
      { date: "2026-11-04", projected_price: 240, source: "tipranks", analyst: "Jane Doe" },
    ],
  },
};

// Listens on a free port and always closes, so npm test can exit.
async function withServer(source, fn) {
  const server = createServer(source);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    return await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

function get(source, path) {
  return withServer(source, async (base) => {
    const res = await fetch(base + path);
    return { status: res.status, type: res.headers.get("content-type"), body: await res.text() };
  });
}

// A query stub that records each call and answers from rowsFor(sql).
function stubQuery(rowsFor) {
  const calls = [];
  const query = async (sql, params = []) => {
    calls.push({ sql, params });
    return rowsFor(sql);
  };
  return { query, calls };
}

test("/api/chart returns the closes, buys, sells, and targets for a symbol", async () => {
  const res = await get(fixtureSource(fixture), "/api/chart?symbol=AAPL");
  expect(res.status).toBe(200);
  expect(JSON.parse(res.body)).toEqual({
    close: [
      { x: "2026-11-04", y: 200 },
      { x: "2026-11-05", y: 205 },
    ],
    buys: [
      { x: "2026-11-04", y: 200 },
      { x: "2026-11-05", y: 205 },
    ],
    sells: [{ x: "2026-11-05", y: 205 }],
    targets: [{ x: "2026-11-04", y: 240, source: "tipranks", analyst: "Jane Doe" }],
  });
});

test("/api/chart for a symbol missing from the fixture returns empty series", async () => {
  const res = await get(fixtureSource(fixture), "/api/chart?symbol=ZZZZ");
  expect(JSON.parse(res.body)).toEqual({ close: [], buys: [], sells: [], targets: [] });
});

test("/api/chart without a symbol is a 400", async () => {
  const res = await get(fixtureSource(fixture), "/api/chart");
  expect(res.status).toBe(400);
  expect(JSON.parse(res.body)).toEqual({ error: "symbol is required" });
});

test("unknown paths are a 404", async () => {
  expect((await get(fixtureSource(fixture), "/nope")).status).toBe(404);
  expect((await get(fixtureSource(fixture), "/../server.js")).status).toBe(404);
});

test("a failing source is a 500 with its message", async () => {
  const broken = { rows: async () => { throw new Error("db down"); } };
  const res = await get(broken, "/api/chart?symbol=AAPL");
  expect(res.status).toBe(500);
  expect(JSON.parse(res.body)).toEqual({ error: "db down" });
});

test("/ serves the page", async () => {
  const res = await get(fixtureSource(fixture), "/");
  expect(res.status).toBe(200);
  expect(res.type).toMatch(/^text\/html/);
  expect(res.body).toContain('<svg id="chart"');
});

test("/api/symbols returns the sorted fixture keys", async () => {
  const res = await get(fixtureSource(fixture), "/api/symbols");
  expect(res.status).toBe(200);
  expect(JSON.parse(res.body)).toEqual(["AAPL", "MSFT"]);
});

test("dbSource.symbols maps symbol from positions", async () => {
  const { query, calls } = stubQuery(() => [{ symbol: "AAPL" }, { symbol: "MSFT" }]);
  expect(await dbSource(query).symbols()).toEqual(["AAPL", "MSFT"]);
  expect(calls).toEqual([{ sql: expect.stringContaining("FROM positions"), params: [] }]);
});

test("dbSource reads quotes, positions, and base-source signals for the symbol", async () => {
  const { query, calls } = stubQuery((sql) => {
    if (sql.includes("FROM positions")) return fixture.AAPL.positions;
    if (sql.includes("FROM raw_signals")) return fixture.AAPL.signals;
    return fixture.AAPL.bars;
  });
  expect(await dbSource(query).rows("AAPL")).toEqual(fixture.AAPL);
  expect(calls.map((c) => c.params)).toEqual([["AAPL"], ["AAPL"], ["AAPL"]]);

  const [bars, positions, signals] = calls.map((c) => c.sql);
  expect(bars).toContain("FROM yahoo_quotes WHERE symbol = $1");
  expect(positions).toContain("(timezone('America/New_York', buy_date))::date");
  expect(positions).toContain("(timezone('America/New_York', sell_date))::date");
  expect(signals).toContain("FROM raw_signals");
  expect(signals).toContain("ticker = $1");
  expect(signals).toContain("source IN ('yahoo', 'google', 'tipranks')");
  expect(signals).not.toContain("yahoo_and_tipranks");
  expect(signals).not.toContain("yahoo_and_google");
});
