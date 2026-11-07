import { jest } from "@jest/globals";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { httpRequestScrape } from "./http_request_scrape.js";

test("requires cache fileName", async () => {
  await expect(
    httpRequestScrape({ url: "http://x" }, { operationName: "k" }),
  ).rejects.toThrow(/fileName/);
});

test("requires url", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hs-"));
  await expect(
    httpRequestScrape(
      {},
      { maxAttempts: 1 },
      { fileName: join(dir, "none.html") },
    ),
  ).rejects.toThrow(/url/);
});

test("returns cached html when fresh", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hs-"));
  const file = join(dir, "a.html");
  writeFileSync(file, "<cached/>");
  const fetchSpy = jest.spyOn(globalThis, "fetch");
  const html = await httpRequestScrape(
    { url: "http://x" },
    { operationName: "k" },
    { fileName: file, ttl: 60000 },
  );
  expect(html).toBe("<cached/>");
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
});

test("fetches and writes on cache miss", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hs-"));
  const file = join(dir, "b.html");
  const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => "<live/>",
  });
  const html = await httpRequestScrape(
    { url: "http://x" },
    { operationName: "k", initialDelay: 0, maxAttempts: 1 },
    { fileName: file },
  );
  expect(html).toBe("<live/>");
  expect(readFileSync(file, "utf8")).toBe("<live/>");
  const [, init] = fetchSpy.mock.calls[0];
  expect(() => new Headers(init.headers)).not.toThrow();
  fetchSpy.mockRestore();
});

test("throws on non-OK", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hs-"));
  const file = join(dir, "c.html");
  const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: false,
    status: 500,
    statusText: "err",
    text: async () => "",
  });
  await expect(
    httpRequestScrape(
      { url: "http://x" },
      { operationName: "k", initialDelay: 0, maxAttempts: 1 },
      { fileName: file },
    ),
  ).rejects.toThrow(/HTTP 500/);
  fetchSpy.mockRestore();
});

test("body timeout rejects without an unhandled rejection", async () => {
  const server = createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.write("<html>partial");
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const unhandled = [];
  const onUnhandled = (error) => unhandled.push(error);
  process.on("unhandledRejection", onUnhandled);
  const dir = mkdtempSync(join(tmpdir(), "hs-"));
  try {
    await expect(
      httpRequestScrape(
        { url: `http://127.0.0.1:${server.address().port}/hang`, timeout: 200 },
        { operationName: "hang", initialDelay: 0, maxAttempts: 1 },
        { fileName: join(dir, "hang.html") },
        { enabled: false },
      ),
    ).rejects.toThrow(/aborted due to timeout/);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(unhandled).toEqual([]);
  } finally {
    process.off("unhandledRejection", onUnhandled);
    await new Promise((resolve) => server.close(resolve));
  }
});
