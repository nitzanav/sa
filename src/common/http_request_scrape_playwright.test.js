import { jest } from "@jest/globals";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  httpRequestScrapePlaywright,
  playwrightBrowser,
} from "./http_request_scrape_playwright.js";

function fakeBrowser(html, { agreeVisible = false } = {}) {
  const page = {
    goto: jest.fn(async () => {}),
    content: jest.fn(async () => html),
    waitForLoadState: jest.fn(async () => {}),
    waitForURL: jest.fn(async () => {}),
    evaluate: jest.fn(async () => {}),
    locator: jest.fn(() => ({
      first: () => ({
        isVisible: async () => agreeVisible,
        click: jest.fn(async () => {
          page.agreeClicked = true;
        }),
      }),
    })),
    getByText: jest.fn(() => ({
      first: () => ({ waitFor: async () => {} }),
    })),
  };
  return {
    page,
    browser: {
      newPage: async () => page,
      close: jest.fn(async () => {}),
    },
  };
}

test("requires cache fileName", async () => {
  await expect(
    httpRequestScrapePlaywright({ url: "http://x" }, { operationName: "k" }),
  ).rejects.toThrow(/fileName/);
});

test("requires url", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hsp-"));
  await expect(
    httpRequestScrapePlaywright(
      {},
      { maxAttempts: 1 },
      { fileName: join(dir, "none.html") },
    ),
  ).rejects.toThrow(/url/);
});

test("returns cached html when fresh", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hsp-"));
  const file = join(dir, "a.html");
  writeFileSync(file, "<cached/>");
  const launchSpy = jest.spyOn(playwrightBrowser, "launch");
  const html = await httpRequestScrapePlaywright(
    { url: "http://x" },
    { operationName: "k" },
    { fileName: file, ttl: 60000 },
  );
  expect(html).toBe("<cached/>");
  expect(launchSpy).not.toHaveBeenCalled();
  launchSpy.mockRestore();
});

test("fetches and writes on cache miss", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hsp-"));
  const file = join(dir, "b.html");
  const { browser, page } = fakeBrowser("<live/>");
  const launchSpy = jest.spyOn(playwrightBrowser, "launch").mockResolvedValue(browser);
  const html = await httpRequestScrapePlaywright(
    { url: "http://x", waitForText: "Overall" },
    { operationName: "k", initialDelay: 0, maxAttempts: 1 },
    { fileName: file },
  );
  expect(html).toBe("<live/>");
  expect(readFileSync(file, "utf8")).toBe("<live/>");
  expect(page.goto).toHaveBeenCalledWith("http://x", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  expect(page.getByText).toHaveBeenCalledWith("Overall", { exact: false });
  expect(browser.close).toHaveBeenCalled();
  launchSpy.mockRestore();
});

test("clicks Yahoo consent agree before returning html", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hsp-"));
  const { browser, page } = fakeBrowser("<consented/>", { agreeVisible: true });
  const launchSpy = jest.spyOn(playwrightBrowser, "launch").mockResolvedValue(browser);
  const html = await httpRequestScrapePlaywright(
    { url: "https://finance.yahoo.com/quote/MMM/analyst-insights/" },
    { operationName: "k", initialDelay: 0, maxAttempts: 1 },
    { fileName: join(dir, "c.html") },
  );
  expect(html).toBe("<consented/>");
  expect(page.agreeClicked).toBe(true);
  expect(page.waitForURL).toHaveBeenCalled();
  launchSpy.mockRestore();
});
