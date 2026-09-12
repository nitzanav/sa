"""Scrape the Analyst Recommendation table from a Google Finance quote Analysis tab.

Usage:
    ./penv python src/analyst-recommendation/dyi_python/scrape_analyst_recommendation.py '<url>'

Prints a JSON array of rows to stdout, one object per table row, in page order.

Fetching follows the Oxylabs Web Scraper API recipe
(https://github.com/oxylabs/how-to-scrape-google-finance): set OXYLABS_USERNAME
and OXYLABS_PASSWORD to route the request through the API. Without credentials
the page is requested directly, which works because the Analysis tab ships the
table in the server-rendered HTML.
"""

from bs4 import BeautifulSoup
import json
import os
import sys
import requests
from urllib.parse import urlencode, urlparse, urlunparse, parse_qsl

OXYLABS_ENDPOINT = "https://realtime.oxylabs.io/v1/queries"

# The Analyst Recommendation table is the only one on the page carrying exactly
# these headers; Google's CSS class names are obfuscated and rotate, so the
# headers are what we match on.
ANALYST_TABLE_HEADERS = (
    "analyst",
    "recommendation",
    "action",
    "price target",
    "projected",
    "date",
)

# Google renders a missing price target or projection as an en dash or hyphen.
MISSING_VALUES = {"-", "\u2013", "\u2014", ""}

BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


def with_english_locale(url):
    """Force hl=en so labels and dates come back in the expected format."""
    parts = urlparse(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    query.setdefault("hl", "en")

    return urlunparse(parts._replace(query=urlencode(query)))


def get_finance_html(url):
    url = with_english_locale(url)

    username = os.environ.get("OXYLABS_USERNAME")
    password = os.environ.get("OXYLABS_PASSWORD")

    if not username or not password:
        print(
            "OXYLABS_USERNAME/OXYLABS_PASSWORD not set; requesting the page directly.",
            file=sys.stderr,
        )
        response = requests.get(url, headers=BROWSER_HEADERS, timeout=60)
        response.raise_for_status()

        return response.text

    payload = {
        "source": "google",
        "render": "html",
        "url": url,
    }

    response = requests.request(
        "POST",
        OXYLABS_ENDPOINT,
        auth=(username, password),
        json=payload,
        timeout=180,
    )
    response.raise_for_status()

    response_json = response.json()

    html = response_json["results"][0]["content"]

    return html


def cell_text(soup_element):
    return soup_element.get_text(" ", strip=True) if soup_element else ""


def get_analyst(row_cells):
    """Analyst cell is two lines: name, then firm."""
    lines = [cell_text(div) for div in row_cells[0].find_all("div") if not div.find("div")]
    lines = [line for line in lines if line]

    name = lines[0] if lines else ""
    firm = lines[1] if len(lines) > 1 else ""

    return name, firm


def get_recommendation(row_cells):
    return cell_text(row_cells[1])


def get_action(row_cells):
    return cell_text(row_cells[2])


def get_price_target(row_cells):
    return optional(cell_text(row_cells[3]))


def get_projected(row_cells):
    return optional(cell_text(row_cells[4]))


def get_date(row_cells):
    return cell_text(row_cells[5])


def optional(value):
    return None if value in MISSING_VALUES else value


def find_analyst_table(soup_of_the_whole_page):
    main = soup_of_the_whole_page.find("main") or soup_of_the_whole_page

    for table in main.find_all("table"):
        headers = tuple(cell_text(th).lower() for th in table.find_all("th"))
        if headers == ANALYST_TABLE_HEADERS:
            return table

    return None


def extract_finance_information_from_soup(soup_of_the_whole_page):
    table = find_analyst_table(soup_of_the_whole_page)

    if table is None:
        raise LookupError(
            "Analyst Recommendation table not found. Is this an Analysis tab URL "
            "(tab=analysis)?"
        )

    body = table.find("tbody") or table

    listings = []

    for row in body.find_all("tr"):
        row_cells = row.find_all("td")

        if len(row_cells) < len(ANALYST_TABLE_HEADERS):
            continue

        analyst, firm = get_analyst(row_cells)

        listings.append(
            {
                "analyst": analyst,
                "firm": firm,
                "recommendation": get_recommendation(row_cells),
                "action": get_action(row_cells),
                "price_target": get_price_target(row_cells),
                "projected": get_projected(row_cells),
                "date": get_date(row_cells),
            }
        )

    return listings


def extract_finance_data_from_url(url):
    html = get_finance_html(url)

    soup = BeautifulSoup(html, "html.parser")

    return extract_finance_information_from_soup(soup)


def main():
    if len(sys.argv) != 2:
        print(
            "usage: scrape_analyst_recommendation.py '<google-finance-analysis-url>'",
            file=sys.stderr,
        )
        return 2

    try:
        listings = extract_finance_data_from_url(sys.argv[1])
    except (LookupError, requests.RequestException) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1

    print(f"Scraped {len(listings)} analyst recommendation rows.", file=sys.stderr)
    print(json.dumps(listings, indent=2, ensure_ascii=False))

    return 0


if __name__ == "__main__":
    sys.exit(main())
