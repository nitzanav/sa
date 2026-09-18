import { chromium } from "playwright";

const url =
  process.argv[2] ?? "https://finance.yahoo.com/quote/MMM/analyst-insights/";
const timeoutMs = 45_000;

async function dismissConsent(page) {
  const agree = page.locator('button[name="agree"], button.accept-all').first();
  if (await agree.isVisible().catch(() => false)) {
    await Promise.all([
      page.waitForURL((url) => !url.hostname.includes("consent."), {
        timeout: 20000,
      }),
      agree.click(),
    ]);
  }
}

async function scrollPage(page) {
  await page.evaluate(async () => {
    for (let i = 0; i < 15; i += 1) {
      window.scrollBy(0, 900);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  locale: "en-US",
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
  viewport: { width: 1440, height: 900 },
});

const ratingsUrls = [];
page.on("response", (response) => {
  if (response.url().includes("/v2/ratings")) ratingsUrls.push(response.url());
});

let error = null;
try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await dismissConsent(page);
  await page.waitForLoadState("domcontentloaded");
  await scrollPage(page);
  await page
    .getByText("Overall", { exact: false })
    .first()
    .waitFor({ timeout: timeoutMs })
    .catch(() => {});
} catch (caught) {
  error = caught instanceof Error ? caught.message : String(caught);
}

const html = await page.content();
const title = await page.title();
const hasOverall = html.includes("Overall");
const hasTopAnalyst = html.includes("top-analyst") || html.includes("Overall Score");

process.stdout.write(
  JSON.stringify(
    {
      ok: hasOverall,
      url,
      finalUrl: page.url(),
      title,
      htmlLength: html.length,
      hasOverall,
      hasTopAnalyst,
      ratingsRequestCount: ratingsUrls.length,
      ratingsUrls: [...new Set(ratingsUrls)],
      error,
    },
    null,
    2,
  ) + "\n",
);

await browser.close();
process.exit(hasOverall ? 0 : 1);
