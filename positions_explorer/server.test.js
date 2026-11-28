import { createServer, dbSource, fixtureSource } from "./server.js";

const fixture = {
  AAPL: {
    bars: [
      { bar_date: "2026-11-04", close: 200 },
      { bar_date: "2026-11-05", close: 205 },
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

test("/api/chart returns the closes for a symbol", async () => {
  const res = await get(fixtureSource(fixture), "/api/chart?symbol=AAPL");
  expect(res.status).toBe(200);
  expect(JSON.parse(res.body)).toEqual({
    close: [
      { x: "2026-11-04", y: 200 },
      { x: "2026-11-05", y: 205 },
    ],
  });
});

test("/api/chart for a symbol missing from the fixture returns an empty line", async () => {
  const res = await get(fixtureSource(fixture), "/api/chart?symbol=ZZZZ");
  expect(JSON.parse(res.body)).toEqual({ close: [] });
});

test("/api/chart without a symbol is a 400", async () => {
  const res = await get(fixtureSource(fixture), "/api/chart");
  expect(res.status).toBe(400);
  expect(JSON.parse(res.body)).toEqual({ error: "symbol is required" });
});

test("unknown paths are a 404", async () => {
  expect((await get(fixtureSource(fixture), "/nope")).status).toBe(404);
  expect((await get(fixtureSource(fixture), "/api/symbols")).status).toBe(404);
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

test("dbSource reads yahoo_quotes for the symbol", async () => {
  const { query, calls } = stubQuery(() => fixture.AAPL.bars);
  expect(await dbSource(query).rows("AAPL")).toEqual({ bars: fixture.AAPL.bars });
  expect(calls).toEqual([
    { sql: expect.stringContaining("FROM yahoo_quotes WHERE symbol = $1"), params: ["AAPL"] },
  ]);
});
