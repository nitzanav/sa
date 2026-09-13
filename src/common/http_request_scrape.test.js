import { jest } from "@jest/globals";
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
