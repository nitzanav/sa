import { jest } from "@jest/globals";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { logger } from "../../common/logger.js";
import {
  fetchTipRanksAnalystRecommendation,
  matchesUrl,
  parseTipRanksAnalystRecommendation,
  quoteFromUrl,
  tipranksAnalystRecommendationUrl,
} from "./tipranks_analyst_recommendation.js";
import { yahooOpenPrice } from "./yahoo_open_price.js";

const API_KEY = "tipranks-test-key-9f3a";

const exampleRow = {
  analyst: "Example Analyst",
  firm: "Example Bank",
  recommendation: "Buy",
  action: "Reiterated",
  price_target: "$300.00",
  projected: "+37%",
  date: "09/15/2026",
};

function exampleRating(overrides = {}) {
  return {
    recommendationDate: "09/15/2026",
    analystName: "Example Analyst",
    firmName: "Example Bank",
    rating: "Buy",
    action: "reiterated",
    priceTarget: 300,
    numOfStars: 5,
    ...overrides,
  };
}

function rpcBody(ratings, text = JSON.stringify(ratings)) {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    result: { content: [{ type: "text", text }] },
  });
}

function tempCachePath() {
  return join(mkdtempSync(join(tmpdir(), "tipranks-")), "AAPL.html");
}

async function withOpenPrice(fn, value = 218.92) {
  const openSpy = jest.spyOn(yahooOpenPrice, "forDate").mockResolvedValue(value);
  try {
    return await fn(openSpy);
  } finally {
    openSpy.mockRestore();
  }
}

function jsonResponse(body, contentType = "application/json") {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: {
      get: (name) => (name.toLowerCase() === "content-type" ? contentType : null),
    },
    text: async () => body,
  };
}

async function withApiKey(fn) {
  const previous = process.env.TIP_RANKS_API_KEY;
  process.env.TIP_RANKS_API_KEY = API_KEY;
  try {
    return await fn();
  } finally {
    if (previous === undefined) delete process.env.TIP_RANKS_API_KEY;
    else process.env.TIP_RANKS_API_KEY = previous;
  }
}

test("urlFor is keyless and quoteFromUrl keeps BRK.B", () => {
  const url = tipranksAnalystRecommendationUrl("BRK.B", "NYSE");
  expect(url).toBe("https://mcp.tipranks.com/mcp/?ticker=BRK.B");
  expect(url).not.toContain("apikey");
  expect(quoteFromUrl(url)).toBe("BRK.B");
  expect(matchesUrl(url)).toBe(true);
  expect(matchesUrl("https://finance.yahoo.com/quote/BRK.B/analyst-insights/")).toBe(
    false,
  );
});

test("parseTipRanksAnalystRecommendation maps the example rating", async () => {
  await withOpenPrice(async (openSpy) => {
    const stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      await expect(
        parseTipRanksAnalystRecommendation(rpcBody([exampleRating()]), "AAPL"),
      ).resolves.toEqual([exampleRow]);
      expect(openSpy).toHaveBeenCalledTimes(1);
      expect(openSpy).toHaveBeenCalledWith("AAPL", "09/15/2026");
      expect(stderrSpy).not.toHaveBeenCalled();
    } finally {
      stderrSpy.mockRestore();
    }
  });
});

test("parseTipRanksAnalystRecommendation reads the live ratings object", async () => {
  await withOpenPrice(async (openSpy) => {
    const payload = {
      ticker: "MMM",
      ratings: [
        {
          analystName: "Joe O'Dea",
          firmName: "Wells Fargo",
          recommendation: "Hold",
          analystAction: "reiterated",
          recommendationDate: "10/22/2026",
          priceTarget: 195,
        },
        {
          analystName: "Brandon Knutson\u200f",
          firmName: "Deutsche Bank ",
          recommendation: "Hold",
          analystAction: "maintained",
          recommendationDate: "10/21/2026",
        },
      ],
    };
    const rows = await parseTipRanksAnalystRecommendation(
      rpcBody([], JSON.stringify(payload)),
      "MMM",
    );
    expect(rows).toEqual([
      {
        analyst: "Joe O'Dea",
        firm: "Wells Fargo",
        recommendation: "Hold",
        action: "Reiterated",
        price_target: "$195.00",
        projected: "-10.9%",
        date: "10/22/2026",
      },
      {
        analyst: "Brandon Knutson",
        firm: "Deutsche Bank",
        recommendation: "Hold",
        action: "Maintained",
        price_target: null,
        projected: null,
        date: "10/21/2026",
      },
    ]);
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith("MMM", "10/22/2026");
  });
});

test("parseTipRanksAnalystRecommendation reads the same payload from SSE", async () => {
  await withOpenPrice(async () => {
    const body = rpcBody([exampleRating()]);
    const sse = `event: message\ndata: ${body}\n`;
    await expect(parseTipRanksAnalystRecommendation(sse, "AAPL")).resolves.toEqual([
      exampleRow,
    ]);
  });
});

test("priceTarget 0 or missing keeps the row with null target and skips forDate", async () => {
  await withOpenPrice(async (openSpy) => {
    const rows = await parseTipRanksAnalystRecommendation(
      rpcBody([
        exampleRating({ analystName: "Zero Analyst", priceTarget: 0 }),
        exampleRating({ analystName: "Missing Analyst", priceTarget: undefined }),
      ]),
      "AAPL",
    );
    expect(rows).toEqual([
      {
        ...exampleRow,
        analyst: "Zero Analyst",
        price_target: null,
        projected: null,
      },
      {
        ...exampleRow,
        analyst: "Missing Analyst",
        price_target: null,
        projected: null,
      },
    ]);
    expect(openSpy).not.toHaveBeenCalled();
  });
});

test("negative price target is null and does not call forDate", async () => {
  await withOpenPrice(async (openSpy) => {
    const rows = await parseTipRanksAnalystRecommendation(
      rpcBody([exampleRating({ priceTarget: -5 })]),
      "AAPL",
    );
    expect(rows).toEqual([{ ...exampleRow, price_target: null, projected: null }]);
    expect(openSpy).not.toHaveBeenCalled();
  });
});

test("date before 2025-01-01 is dropped and a later sibling remains", async () => {
  await withOpenPrice(async () => {
    const stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const rows = await parseTipRanksAnalystRecommendation(
        rpcBody([
          exampleRating({
            analystName: "Old Analyst",
            recommendationDate: "12/31/2024",
          }),
          exampleRating({ analystName: "New Analyst" }),
        ]),
        "AAPL",
      );
      expect(rows.map((row) => row.analyst)).toEqual(["New Analyst"]);
    } finally {
      stderrSpy.mockRestore();
    }
  });
});

test("unknown action is dropped and a valid sibling remains", async () => {
  await withOpenPrice(async () => {
    const stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const rows = await parseTipRanksAnalystRecommendation(
        rpcBody([
          exampleRating({ analystName: "Good Analyst", action: "upgraded" }),
          exampleRating({ analystName: "Bad Analyst", action: "sideways" }),
        ]),
        "AAPL",
      );
      expect(rows).toEqual([
        { ...exampleRow, analyst: "Good Analyst", action: "Upgraded" },
      ]);
    } finally {
      stderrSpy.mockRestore();
    }
  });
});

test("empty content or text [] returns []", async () => {
  await withOpenPrice(async (openSpy) => {
    const stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
    try {
      const emptyContent = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: { content: [] },
      });
      await expect(parseTipRanksAnalystRecommendation(emptyContent, "AAPL")).resolves.toEqual(
        [],
      );
      await expect(
        parseTipRanksAnalystRecommendation(rpcBody([], "[]"), "AAPL"),
      ).resolves.toEqual([]);
      expect(openSpy).not.toHaveBeenCalled();
      expect(stderrSpy.mock.calls.map(([line]) => String(line)).join("")).toContain(
        "TipRanks analyst ratings empty",
      );
    } finally {
      stderrSpy.mockRestore();
    }
  });
});

test("unparseable ratings text throws instead of returning []", async () => {
  await withOpenPrice(async () => {
    await expect(
      parseTipRanksAnalystRecommendation(rpcBody([], "not-json"), "AAPL"),
    ).rejects.toThrow("TipRanks ratings text is not JSON");
    await expect(
      parseTipRanksAnalystRecommendation(rpcBody([], JSON.stringify({ rating: "Buy" })), "AAPL"),
    ).rejects.toThrow("TipRanks ratings text is not an array");
  });
});

test("parse throws on a JSON-RPC error body", async () => {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    error: { code: -32000, message: "boom" },
  });
  await expect(parseTipRanksAnalystRecommendation(body, "AAPL")).rejects.toThrow(
    "TipRanks JSON-RPC error: boom",
  );
});

test("pads a single-digit recommendation date and falls back to firmName", async () => {
  await withOpenPrice(async (openSpy) => {
    const rows = await parseTipRanksAnalystRecommendation(
      rpcBody([
        exampleRating({
          analystName: "  ",
          firmName: "Fallback Bank",
          recommendationDate: "9/5/2026",
        }),
      ]),
      "AAPL",
    );
    expect(rows).toEqual([
      {
        ...exampleRow,
        analyst: "Fallback Bank",
        firm: "Fallback Bank",
        date: "09/05/2026",
      },
    ]);
    expect(openSpy).toHaveBeenCalledWith("AAPL", "09/05/2026");
  });
});

test("missing open price keeps the row with null projected", async () => {
  await withOpenPrice(async () => {
    const rows = await parseTipRanksAnalystRecommendation(rpcBody([exampleRating()]), "AAPL");
    expect(rows).toEqual([{ ...exampleRow, projected: null }]);
  }, null);
});

test("concatenates text parts in order and accepts an already-parsed array", async () => {
  await withOpenPrice(async () => {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result: {
        content: [
          { type: "text", text: JSON.stringify([exampleRating({ analystName: "First" })]) },
          { type: "image", data: "skip-me" },
          { type: "text", text: [exampleRating({ analystName: "Second", action: "upgraded" })] },
        ],
      },
    });
    const rows = await parseTipRanksAnalystRecommendation(body, "AAPL");
    expect(rows.map((row) => [row.analyst, row.action])).toEqual([
      ["First", "Reiterated"],
      ["Second", "Upgraded"],
    ]);
  });
});

test("a warm response cache does not fetch or require the API key", async () => {
  const fileName = tempCachePath();
  const url = tipranksAnalystRecommendationUrl("MMM");
  const body = rpcBody([], JSON.stringify({ ticker: "MMM", ratings: [exampleRating()] }));
  writeFileSync(fileName, body);
  const previous = process.env.TIP_RANKS_API_KEY;
  delete process.env.TIP_RANKS_API_KEY;
  const fetchSpy = jest.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fetch must not run"));
  try {
    await expect(
      fetchTipRanksAnalystRecommendation(
        url,
        { initialDelay: 0, maxAttempts: 1 },
        { fileName },
      ),
    ).resolves.toBe(body);
    expect(fetchSpy).not.toHaveBeenCalled();
  } finally {
    if (previous === undefined) delete process.env.TIP_RANKS_API_KEY;
    else process.env.TIP_RANKS_API_KEY = previous;
    fetchSpy.mockRestore();
  }
});

test("MCP isError is not cached", async () => {
  const fileName = tempCachePath();
  const url = tipranksAnalystRecommendationUrl("AAPL");
  await withApiKey(async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            isError: true,
            content: [{ type: "text", text: "rate limit exceeded" }],
          },
        }),
      ),
    );
    try {
      await expect(
        fetchTipRanksAnalystRecommendation(
          url,
          { initialDelay: 0, maxAttempts: 1 },
          { fileName },
        ),
      ).rejects.toThrow("TipRanks tool error: rate limit exceeded");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(existsSync(fileName)).toBe(false);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

test("JSON-RPC error is not cached", async () => {
  const fileName = tempCachePath();
  const url = tipranksAnalystRecommendationUrl("AAPL");
  await withApiKey(async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          error: { code: -32000, message: "boom" },
        }),
      ),
    );
    try {
      await expect(
        fetchTipRanksAnalystRecommendation(
          url,
          { initialDelay: 0, maxAttempts: 1 },
          { fileName },
        ),
      ).rejects.toThrow(/^TipRanks JSON-RPC error: boom$/);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(existsSync(fileName)).toBe(false);
      expect(url).not.toContain(API_KEY);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

test("non-200 throws HTTP 500 and does not write the cache file", async () => {
  const fileName = tempCachePath();
  const url = tipranksAnalystRecommendationUrl("AAPL");
  await withApiKey(async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      headers: { get: () => "text/plain" },
      text: async () => {
        throw new Error("body should not be read");
      },
    });
    try {
      let caught;
      try {
        await fetchTipRanksAnalystRecommendation(
          url,
          { initialDelay: 0, maxAttempts: 1 },
          { fileName },
        );
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(Error);
      expect(caught.message).toBe("HTTP 500 Internal Server Error");
      expect(caught.message).not.toContain(API_KEY);
      expect(caught.message).not.toContain("apikey=");
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(existsSync(fileName)).toBe(false);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

test("missing TIP_RANKS_API_KEY throws once and does not fetch", async () => {
  const fileName = tempCachePath();
  const url = tipranksAnalystRecommendationUrl("AAPL");
  const previous = process.env.TIP_RANKS_API_KEY;
  delete process.env.TIP_RANKS_API_KEY;
  const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse("{}"));
  const stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  logger.clearContext();
  try {
    await expect(
      fetchTipRanksAnalystRecommendation(
        url,
        { initialDelay: 0, maxAttempts: 3, operationName: "tipranks_missing_key" },
        { fileName },
      ),
    ).rejects.toThrow("TIP_RANKS_API_KEY is not set");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(stderrSpy.mock.calls.map(([line]) => String(line)).join("")).not.toContain(
      '"message":"retry"',
    );
    expect(existsSync(fileName)).toBe(false);
  } finally {
    if (previous === undefined) delete process.env.TIP_RANKS_API_KEY;
    else process.env.TIP_RANKS_API_KEY = previous;
    fetchSpy.mockRestore();
    stderrSpy.mockRestore();
    logger.clearContext();
  }
});

test("successful fetch POSTs with the key only on the request URL and caches the raw body", async () => {
  const fileName = tempCachePath();
  const url = tipranksAnalystRecommendationUrl("AAPL");
  const body = rpcBody([exampleRating()]);
  await withApiKey(async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(body));
    const stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
    logger.clearContext();
    try {
      const result = await fetchTipRanksAnalystRecommendation(
        url,
        { initialDelay: 0, maxAttempts: 1, operationName: "tipranks_AAPL" },
        { fileName },
      );
      expect(result).toBe(body);
      expect(readFileSync(fileName, "utf8")).toBe(body);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [requestUrl, init] = fetchSpy.mock.calls[0];
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      });
      const parsed = JSON.parse(init.body);
      expect(parsed.params.name).toBe("get_recent_analyst_ratings");
      expect(parsed.params.arguments.ticker).toBe("AAPL");
      expect(parsed).toEqual({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "get_recent_analyst_ratings",
          arguments: { ticker: "AAPL" },
        },
      });
      expect(new URL(requestUrl).searchParams.get("apikey")).toBe(API_KEY);
      expect(url).not.toContain(API_KEY);
      expect(url).not.toContain("apikey");
      const logged = stderrSpy.mock.calls.map(([line]) => String(line)).join("");
      expect(logged).toContain(url);
      expect(logged).not.toContain(API_KEY);
      expect(logged).not.toContain("apikey=");
      expect(body).not.toContain(API_KEY);
    } finally {
      fetchSpy.mockRestore();
      stderrSpy.mockRestore();
      logger.clearContext();
    }
  });
});

test("event-stream fetch cancels the reader and caches the JSON payload", async () => {
  const fileName = tempCachePath();
  const url = tipranksAnalystRecommendationUrl("AAPL");
  const payload = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    result: { content: [{ type: "text", text: "[]" }] },
  });
  const encoded = new TextEncoder().encode(`event: message\ndata: ${payload}\n\n`);
  let cancelCalls = 0;
  let cancelled = false;
  const reader = {
    sent: false,
    async read() {
      if (cancelled) return { done: true, value: undefined };
      if (!this.sent) {
        this.sent = true;
        return { done: false, value: encoded };
      }
      await new Promise((resolve) => {
        const started = Date.now();
        const timer = setInterval(() => {
          if (cancelled || Date.now() - started > 800) {
            clearInterval(timer);
            resolve();
          }
        }, 10);
      });
      return { done: true, value: undefined };
    },
    async cancel() {
      cancelCalls += 1;
      cancelled = true;
    },
  };
  await withApiKey(async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: {
        get: (name) =>
          name.toLowerCase() === "content-type"
            ? "text/event-stream; charset=utf-8"
            : null,
      },
      text: async () => {
        throw new Error("response.text() must not be used for event-stream");
      },
      body: { getReader: () => reader },
    });
    try {
      const result = await fetchTipRanksAnalystRecommendation(
        url,
        { initialDelay: 0, maxAttempts: 1 },
        { fileName },
      );
      expect(cancelCalls).toBeGreaterThan(0);
      expect(result).toBe(payload);
      expect(readFileSync(fileName, "utf8")).toBe(payload);
      expect(result).not.toContain("event:");
    } finally {
      await reader.cancel();
      fetchSpy.mockRestore();
    }
  });
});
