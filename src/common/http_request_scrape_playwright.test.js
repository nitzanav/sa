import { jest } from "@jest/globals";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  httpRequestScrapePlaywright,
  playwrightBrowser,
  scrollPage,
} from "./http_request_scrape_playwright.js";

function fakeBrowser(html, { agreeVisible = false, topAnalystVisible = true } = {}) {
  const page = {
    goto: jest.fn(async () => {}),
    content: jest.fn(async () => html),
    waitForLoadState: jest.fn(async () => {}),
    waitForURL: jest.fn(async () => {}),
    evaluate: jest.fn(async () => {}),
    scrollEvaluateCalls: 0,
    locator: jest.fn((selector) => {
      if (selector === "#top-analyst") {
        return {
          first: () => ({
            isVisible: async () => topAnalystVisible,
          }),
        };
      }
      return {
        first: () => ({
          isVisible: async () => agreeVisible,
          click: jest.fn(async () => {
            page.agreeClicked = true;
          }),
        }),
      };
    }),
    getByText: jest.fn(() => ({
      first: () => ({ waitFor: async () => {} }),
    })),
  };
  page.evaluate.mockImplementation(async () => {
    page.scrollEvaluateCalls += 1;
  });
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

test("runs afterLoad before returning html", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hsp-"));
  const { browser, page } = fakeBrowser("<live/>");
  const afterLoad = jest.fn(async (loaded) => {
    expect(loaded).toBe(page);
  });
  const launchSpy = jest.spyOn(playwrightBrowser, "launch").mockResolvedValue(browser);
  await httpRequestScrapePlaywright(
    { url: "http://x", afterLoad },
    { operationName: "k", initialDelay: 0, maxAttempts: 1 },
    { fileName: join(dir, "d.html") },
  );
  expect(afterLoad).toHaveBeenCalledTimes(1);
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

test("scrollPage stops without scrolling when #top-analyst is visible", async () => {
  const { page } = fakeBrowser("<x/>", { topAnalystVisible: true });
  await expect(scrollPage(page, { pauseMs: 0 })).resolves.toBe(0);
  expect(page.scrollEvaluateCalls).toBe(0);
});

test("scrollPage scrolls until #top-analyst becomes visible", async () => {
  let visibleAfter = 2;
  const page = {
    evaluate: jest.fn(async () => {}),
    locator: jest.fn(() => ({
      first: () => ({
        isVisible: async () => {
          visibleAfter -= 1;
          return visibleAfter < 0;
        },
      }),
    })),
  };
  await expect(scrollPage(page, { maxScrolls: 5, pauseMs: 0 })).resolves.toBe(2);
  expect(page.evaluate).toHaveBeenCalledTimes(2);
});

test("scrollPage hits maxScrolls when #top-analyst never appears", async () => {
  const { page } = fakeBrowser("<x/>", { topAnalystVisible: false });
  await expect(scrollPage(page, { maxScrolls: 3, pauseMs: 0 })).resolves.toBe(3);
  expect(page.scrollEvaluateCalls).toBe(3);
});

test("skips scroll loops when #top-analyst is already visible", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hsp-"));
  const { browser, page } = fakeBrowser("<live/>", { topAnalystVisible: true });
  const launchSpy = jest.spyOn(playwrightBrowser, "launch").mockResolvedValue(browser);
  await httpRequestScrapePlaywright(
    { url: "http://x" },
    { operationName: "k", initialDelay: 0, maxAttempts: 1 },
    { fileName: join(dir, "e.html") },
  );
  expect(page.scrollEvaluateCalls).toBe(0);
  launchSpy.mockRestore();
});
