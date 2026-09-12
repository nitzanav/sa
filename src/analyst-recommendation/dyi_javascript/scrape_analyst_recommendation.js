/**
 * Scrape the Analyst Recommendation table from a Google Finance quote Analysis tab.
 *
 * Usage:
 *     node src/analyst-recommendation/dyi_javascript/scrape_analyst_recommendation.js '<url>'
 *
 * Prints a JSON array of rows to stdout, one object per table row, in page order.
 *
 * Fetching follows the Oxylabs Web Scraper API recipe
 * (https://github.com/oxylabs/how-to-scrape-google-finance): set OXYLABS_USERNAME
 * and OXYLABS_PASSWORD to route the request through the API. Without credentials
 * the page is requested directly, which works because the Analysis tab ships the
 * table in the server-rendered HTML.
 */

import * as cheerio from "cheerio";

const OXYLABS_ENDPOINT = "https://realtime.oxylabs.io/v1/queries";

// The Analyst Recommendation table is the only one on the page carrying exactly
// these headers; Google's CSS class names are obfuscated and rotate, so the
// headers are what we match on.
const ANALYST_TABLE_HEADERS = [
  "analyst",
  "recommendation",
  "action",
  "price target",
  "projected",
  "date",
];

// Google renders a missing price target or projection as an en dash or hyphen.
const MISSING_VALUES = new Set(["-", "\u2013", "\u2014", ""]);

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

function withEnglishLocale(url) {
  const parsed = new URL(url);
  if (!parsed.searchParams.has("hl")) {
    parsed.searchParams.set("hl", "en");
  }
  return parsed.toString();
}

async function getFinanceHtml(url) {
  url = withEnglishLocale(url);

  const username = process.env.OXYLABS_USERNAME;
  const password = process.env.OXYLABS_PASSWORD;

  if (!username || !password) {
    console.error(
      "OXYLABS_USERNAME/OXYLABS_PASSWORD not set; requesting the page directly.",
    );
    const response = await fetch(url, {
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    return response.text();
  }

  const auth = Buffer.from(`${username}:${password}`).toString("base64");
  const response = await fetch(OXYLABS_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: "google",
      render: "html",
      url,
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const responseJson = await response.json();
  return responseJson.results[0].content;
}

function cellText($element) {
  if (!$element || $element.length === 0) {
    return "";
  }
  return $element.text().replace(/\s+/g, " ").trim();
}

function getAnalyst($, rowCells) {
  // Analyst cell is two lines: name, then firm.
  const lines = [];
  rowCells
    .eq(0)
    .find("div")
    .each((_, el) => {
      const $div = $(el);
      if ($div.find("div").length === 0) {
        const line = cellText($div);
        if (line) {
          lines.push(line);
        }
      }
    });

  const name = lines[0] || "";
  const firm = lines.length > 1 ? lines[1] : "";
  return [name, firm];
}

function getRecommendation(rowCells) {
  return cellText(rowCells.eq(1));
}

function getAction(rowCells) {
  return cellText(rowCells.eq(2));
}

function getPriceTarget(rowCells) {
  return optional(cellText(rowCells.eq(3)));
}

function getProjected(rowCells) {
  return optional(cellText(rowCells.eq(4)));
}

function getDate(rowCells) {
  return cellText(rowCells.eq(5));
}

function optional(value) {
  return MISSING_VALUES.has(value) ? null : value;
}

function findAnalystTable($) {
  const $main = $("main").first();
  const $root = $main.length ? $main : $.root();

  let found = null;
  $root.find("table").each((_, table) => {
    if (found) {
      return;
    }
    const $table = $(table);
    const headers = $table
      .find("th")
      .toArray()
      .map((th) => cellText($(th)).toLowerCase());
    if (
      headers.length === ANALYST_TABLE_HEADERS.length &&
      headers.every((header, i) => header === ANALYST_TABLE_HEADERS[i])
    ) {
      found = $table;
    }
  });

  return found;
}

function extractFinanceInformationFromSoup($) {
  const $table = findAnalystTable($);

  if ($table === null) {
    throw new Error(
      "Analyst Recommendation table not found. Is this an Analysis tab URL " +
        "(tab=analysis)?",
    );
  }

  const $body = $table.find("tbody").first();
  const $rowsRoot = $body.length ? $body : $table;

  const listings = [];

  $rowsRoot.find("tr").each((_, row) => {
    const rowCells = $(row).find("td");
    if (rowCells.length < ANALYST_TABLE_HEADERS.length) {
      return;
    }

    const [analyst, firm] = getAnalyst($, rowCells);

    listings.push({
      analyst,
      firm,
      recommendation: getRecommendation(rowCells),
      action: getAction(rowCells),
      price_target: getPriceTarget(rowCells),
      projected: getProjected(rowCells),
      date: getDate(rowCells),
    });
  });

  return listings;
}

async function extractFinanceDataFromUrl(url) {
  const html = await getFinanceHtml(url);
  const $ = cheerio.load(html);
  return extractFinanceInformationFromSoup($);
}

async function main() {
  if (process.argv.length !== 3) {
    console.error(
      "usage: scrape_analyst_recommendation.js '<google-finance-analysis-url>'",
    );
    return 2;
  }

  try {
    const listings = await extractFinanceDataFromUrl(process.argv[2]);
    console.error(`Scraped ${listings.length} analyst recommendation rows.`);
    console.log(JSON.stringify(listings, null, 2));
    return 0;
  } catch (error) {
    console.error(`error: ${error.message}`);
    return 1;
  }
}

process.exit(await main());
