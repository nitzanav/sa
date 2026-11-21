"""Download Yahoo daily chart responses for data/fortune_500/symbols.csv.

Writes data/yahoo_quotes/quotes.csv with the symbol and the raw JSON body,
and data/yahoo_quotes/all_symbols_per_date_and_symbol.csv with one row per
symbol per New York trading day (date, symbol, open, high, low, close).
Yahoo uses '-' where the constituents file uses '.' (BRK.B -> BRK-B). The
CSVs keep the constituents symbol so they match _raw_signals.
"""

import csv
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SYMBOLS = ROOT / "data/fortune_500/symbols.csv"
OUT = ROOT / "data/yahoo_quotes/quotes.csv"
BARS = ROOT / "data/yahoo_quotes/all_symbols_per_date_and_symbol.csv"
NY = ZoneInfo("America/New_York")

# Signals sit in 2024-2026. period2 is exclusive.
PERIOD1 = 1704067200  # 2024-01-01
PERIOD2 = int(time.time()) + 86400
WORKERS = 8
ATTEMPTS = 4


def symbols():
    with SYMBOLS.open(newline="") as handle:
        rows = csv.DictReader(handle)
        if not rows.fieldnames or "Symbol" not in rows.fieldnames:
            raise SystemExit(f"{SYMBOLS} has no Symbol column")
        names = [row["Symbol"].strip() for row in rows if row.get("Symbol", "").strip()]
    if not names:
        raise SystemExit(f"{SYMBOLS} has no symbols")
    return names


def fetch(symbol):
    yahoo = symbol.replace(".", "-")
    url = (
        "https://query1.finance.yahoo.com/v8/finance/chart/"
        f"{yahoo}?period1={PERIOD1}&period2={PERIOD2}"
        "&interval=1d&includeAdjustedClose=true"
    )
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    last_error = None
    for attempt in range(ATTEMPTS):
        try:
            with urlopen(request, timeout=30) as response:
                body = response.read().decode("utf-8")
            payload = json.loads(body)
            result = (payload.get("chart") or {}).get("result")
            if not result:
                raise RuntimeError("Yahoo returned no chart result")
            return symbol, body, None
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, RuntimeError) as error:
            last_error = error
            time.sleep(1.5 * (attempt + 1))
    return symbol, None, str(last_error)


def _price(values, index):
    if index >= len(values) or values[index] is None:
        return ""
    return values[index]


def daily_bars(symbol, body):
    """One (date, symbol, open, high, low, close) row per trading day.

    date is the America/New_York calendar day of Yahoo's bar timestamp.
    Days with no close are omitted. A missing open, high, or low stays blank.
    """
    payload = json.loads(body)
    result = (payload.get("chart") or {}).get("result") or []
    if not result:
        return []
    chart = result[0]
    timestamps = chart.get("timestamp") or []
    quote = ((chart.get("indicators") or {}).get("quote") or [{}])[0]
    opens = quote.get("open") or []
    highs = quote.get("high") or []
    lows = quote.get("low") or []
    closes = quote.get("close") or []
    rows = []
    for index, stamp in enumerate(timestamps):
        if stamp is None or index >= len(closes) or closes[index] is None:
            continue
        day = datetime.fromtimestamp(stamp, NY).date().isoformat()
        rows.append((
            day,
            symbol,
            _price(opens, index),
            _price(highs, index),
            _price(lows, index),
            closes[index],
        ))
    return rows


def write_daily_bars(quotes):
    bars = []
    for symbol, body in quotes:
        bars.extend(daily_bars(symbol, body))
    bars.sort()
    with BARS.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["date", "symbol", "open", "high", "low", "close"])
        writer.writerows(bars)
    return len(bars)


def main():
    names = symbols()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {len(names)} Yahoo charts → {OUT}", file=sys.stderr)
    rows = []
    failures = []
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = [pool.submit(fetch, symbol) for symbol in names]
        for done, future in enumerate(as_completed(futures), start=1):
            symbol, body, error = future.result()
            if error:
                failures.append((symbol, error))
                print(f"  fail {symbol}: {error}", file=sys.stderr)
            else:
                rows.append((symbol, body))
            if done % 50 == 0 or done == len(names):
                print(f"  {done}/{len(names)}", file=sys.stderr)
    rows.sort(key=lambda row: row[0])
    with OUT.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["ticker", "response"])
        writer.writerows(rows)
    bar_count = write_daily_bars(rows)
    print(
        f"Wrote {len(rows)} responses and {bar_count} daily bars, {len(failures)} failed",
        file=sys.stderr,
    )
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
