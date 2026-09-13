import { jest } from "@jest/globals";
import { mkdtempSync, readFileSync, writeFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileCache } from "./file_cache.js";

test("fileCache returns cached content when fresh", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fc-"));
  const file = join(dir, "x.txt");
  writeFileSync(file, "cached");
  const functionToCache = jest.fn();
  const cached = fileCache(functionToCache, { fileName: file, ttl: 60000 });
  await expect(cached()).resolves.toBe("cached");
  expect(functionToCache).not.toHaveBeenCalled();
});

test("fileCache produces and writes when stale", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fc-"));
  const file = join(dir, "x.txt");
  writeFileSync(file, "old");
  const past = new Date(Date.now() - 10000);
  utimesSync(file, past, past);
  const functionToCache = jest.fn().mockResolvedValue("fresh");
  const cached = fileCache(functionToCache, { fileName: file, ttl: 1000 });
  await expect(cached()).resolves.toBe("fresh");
  expect(readFileSync(file, "utf8")).toBe("fresh");
});

test("fileCache produces when file is missing and forwards arguments", async () => {
  const dir = mkdtempSync(join(tmpdir(), "fc-"));
  const file = join(dir, "nested/y.txt");
  const functionToCache = jest.fn().mockResolvedValue("new");
  const cached = fileCache(functionToCache, { fileName: file });
  await expect(cached("arg")).resolves.toBe("new");
  expect(functionToCache).toHaveBeenCalledWith("arg");
  expect(readFileSync(file, "utf8")).toBe("new");
});

test("fileCache requires fileName when enabled", () => {
  expect(() => fileCache(jest.fn())).toThrow(/fileName/);
});

test("fileCache skips cache when disabled", async () => {
  const functionToCache = jest.fn().mockResolvedValue("direct");
  const cached = fileCache(functionToCache, { enabled: false });
  await expect(cached()).resolves.toBe("direct");
  expect(functionToCache).toHaveBeenCalledTimes(1);
});
