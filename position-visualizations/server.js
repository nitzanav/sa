import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const POSITIONS_CSV = fileURLToPath(
  new URL(
    "../VectorBT/simulation_2026-10-24_1603_UTC+3_daily-winner-params__optimize.csv",
    import.meta.url,
  ),
);
const SIGNALS_CSV = fileURLToPath(
  new URL("../data/analyst_recomendation/all_symbols.csv", import.meta.url),
);
const BOOK_CSV = fileURLToPath(new URL("../data/signals.csv", import.meta.url));
const CLOSE_PKL = fileURLToPath(new URL("../VectorBT/.cache/close.pkl", import.meta.url));
const PUBLIC_DIR = fileURLToPath(new URL("./public/", import.meta.url));

const DEFAULT_SELL = "15d 50% 7.5dd";
const DEFAULT_BUY = "yahoo-daily · >2,>20%";
const SOURCE_ORDER = ["google", "yahoo", "tipranks"];
const HEADER = "date,ticker,analyst,percent,projected_price";

const fileCache = new Map();
let closesPromise = null;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else if (ch !== "\r") {
      cur += ch;
    }
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.length));
}

async function readCached(path) {
  const info = await stat(path);
  const hit = fileCache.get(path);
  if (hit && hit.mtimeMs === info.mtimeMs) return hit.text;
  const text = await readFile(path, "utf8");
  fileCache.set(path, { mtimeMs: info.mtimeMs, text });
  return text;
}

function rowsToObjects(text) {
  const rows = parseCsv(text);
  const header = rows[0];
  return rows.slice(1).map((cells) => {
    const obj = {};
    header.forEach((name, i) => {
      obj[name] = cells[i] ?? "";
    });
    return obj;
  });
}

function canonicalBuy(buy) {
  const short = buy.match(/^(.*?) · >(\d+),>(\d+)%$/);
  if (short) {
    return `${short[1]} · analyst>${short[2]} · proj>${short[3]}%`;
  }
  return buy;
}

function filterOptions(text) {
  const sells = new Set();
  const buys = new Set();
  for (const row of rowsToObjects(text)) {
    if (row.sell) sells.add(row.sell);
    if (row.buy) buys.add(row.buy);
  }
  return {
    sells: [...sells].sort(),
    buys: [...buys].sort(),
  };
}

function loadPositions(text, sell, buy) {
  const wantedBuy = canonicalBuy(buy);
  return rowsToObjects(text)
    .filter((row) => row.sell === sell && row.buy === wantedBuy)
    .map((row) => ({
      sell: row.sell,
      buy: row.buy,
      ticker: row.ticker,
      dateBuy: row.date_buy,
      dateSell: row.date_sell,
      priceBuy: Number(row.price_buy),
      priceSell: Number(row.price_sell),
      pnl: Number(row.pnl),
      returnPct: Number(row.return_pct),
      holdDays: Number(row.hold_days),
      status: row.status,
    }));
}

function summarize(lots) {
  const wins = lots.filter((lot) => lot.pnl > 0).length;
  const closed = lots.filter((lot) => lot.status === "Closed").length;
  const pnl = lots.reduce((sum, lot) => sum + lot.pnl, 0);
  const avgReturn = lots.length
    ? lots.reduce((sum, lot) => sum + lot.returnPct, 0) / lots.length
    : 0;
  return {
    n: lots.length,
    wins,
    winRate: lots.length ? (100 * wins) / lots.length : 0,
    closed,
    open: lots.length - closed,
    pnl,
    avgReturn,
  };
}

function splitSignalFile(text) {
  const parts = [];
  let rest = text;
  let index = 0;
  while (rest.length) {
    if (rest.startsWith(HEADER)) rest = rest.slice(HEADER.length);
    const next = rest.indexOf(HEADER);
    const chunk = next === -1 ? rest : rest.slice(0, next);
    parts.push({
      source: SOURCE_ORDER[index] || `source-${index + 1}`,
      rows: parseCsv(chunk),
    });
    rest = next === -1 ? "" : rest.slice(next);
    index += 1;
  }
  return parts;
}

function loadSignals(text) {
  const byTicker = new Map();
  for (const part of splitSignalFile(text)) {
    for (const cells of part.rows) {
      if (cells.length < 5 || cells[0] === "date") continue;
      const [date, ticker, analyst, percentRaw, priceRaw] = cells;
      const projectedPrice = Number(priceRaw);
      if (!ticker || !date || !Number.isFinite(projectedPrice)) continue;
      const percent = percentRaw === "" ? null : Number(percentRaw);
      const key = `${part.source}|${date}|${projectedPrice}`;
      if (!byTicker.has(ticker)) byTicker.set(ticker, new Map());
      const days = byTicker.get(ticker);
      if (!days.has(key)) {
        days.set(key, {
          date,
          source: part.source,
          analyst,
          percent: Number.isFinite(percent) ? percent : null,
          projectedPrice,
          analysts: [analyst],
        });
      } else {
        days.get(key).analysts.push(analyst);
      }
    }
  }
  return byTicker;
}

function loadCloses() {
  if (closesPromise) return closesPromise;
  const code = `
import json, sys
import pandas as pd
close = pd.read_pickle(sys.argv[1])
idx = close.index
if getattr(idx, "tz", None) is not None:
    idx = idx.tz_localize(None)
dates = pd.to_datetime(idx).strftime("%Y-%m-%d").tolist()
out = {}
for ticker in close.columns:
    series = []
    for date, value in zip(dates, close[ticker].tolist()):
        if value == value:
            series.append([date, round(float(value), 4)])
    out[ticker] = series
json.dump(out, sys.stdout)
`;
  closesPromise = new Promise((resolve, reject) => {
    const child = spawn("./penv", ["python", "-c", code, CLOSE_PKL], { cwd: ROOT });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        closesPromise = null;
        reject(new Error(stderr || `price load exited ${code}`));
        return;
      }
      resolve(JSON.parse(stdout));
    });
  });
  return closesPromise;
}

function priceOn(series, date) {
  let found = null;
  for (const point of series) {
    if (point[0] > date) break;
    found = point;
  }
  if (!found) return null;
  const gap = (Date.parse(date) - Date.parse(found[0])) / 86400000;
  return gap <= 7 ? found[1] : null;
}

function parseSell(sell) {
  const hold = sell.match(/(\d+)d/);
  const target = sell.match(/(\d+(?:\.\d+)?)%/);
  const drop = sell.match(/(\d+(?:\.\d+)?)dd/);
  return {
    holdDays: hold ? Number(hold[1]) : null,
    holdLabel: hold ? `${hold[1]}d` : null,
    targetFrac: target ? Number(target[1]) / 100 : null,
    targetLabel: target ? `${target[1]}%` : null,
    drawdown: drop ? Number(drop[1]) / 100 : null,
    drawdownLabel: drop ? `${drop[1]}dd` : null,
  };
}

function projectionIndex(text) {
  const index = new Map();
  for (const row of rowsToObjects(text)) {
    index.set(
      `${row.signal_name}|${row.date}|${row.ticker}`,
      Number(row.average_projected),
    );
  }
  return index;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function buildRules(lot, lots, prices, projections) {
  const spec = parseSell(lot.sell);
  const dates = prices.map((point) => point.date);
  const closes = prices.map((point) => point.close);
  const entry = dates.indexOf(lot.dateBuy);
  if (entry < 0) return null;
  const book = lot.buy.split(" · ")[0];
  const projected = (date) => projections.get(`${book}|${date}|${lot.ticker}`);
  let proj = projected(lot.dateBuy);
  const entryPx = closes[entry];
  let deadline = spec.holdDays == null ? dates.length + 1 : entry + spec.holdDays;
  let target = spec.targetFrac != null && Number.isFinite(proj)
    ? entryPx * (1 + spec.targetFrac * proj / 100)
    : null;
  let peak = entryPx;
  const resets = new Set(
    lots
      .filter((other) => other.ticker === lot.ticker && other.dateBuy !== lot.dateBuy)
      .map((other) => other.dateBuy),
  );
  const trail = spec.drawdown == null ? [] : [{ date: dates[entry], y: round2(entryPx * (1 - spec.drawdown)) }];
  const targets = [];
  let segmentStart = dates[entry];
  let segmentY = target;
  let holdDate = deadline >= 0 && deadline < dates.length ? dates[deadline] : null;
  let last = entry;
  let exitReason = lot.status === "Closed" ? "" : "open";
  for (let t = entry + 1; t < dates.length; t++) {
    if (resets.has(dates[t])) {
      if (spec.holdDays != null) deadline = t + spec.holdDays;
      const nextProj = projected(dates[t]);
      if (spec.targetFrac != null && Number.isFinite(nextProj)) {
        if (segmentY != null) targets.push({ x0: segmentStart, x1: dates[t], y: round2(segmentY) });
        proj = nextProj;
        segmentY = closes[t] * (1 + spec.targetFrac * proj / 100);
        target = segmentY;
        segmentStart = dates[t];
      }
      holdDate = deadline < dates.length ? dates[deadline] : dates.at(-1);
    }
    const px = closes[t];
    if (px > peak) peak = px;
    if (spec.drawdown != null) trail.push({ date: dates[t], y: round2(peak * (1 - spec.drawdown)) });
    last = t;
    const timeHit = spec.holdDays != null && t >= deadline;
    const targetHit = target != null && px >= target;
    const dropHit = spec.drawdown != null && px <= peak * (1 - spec.drawdown);
    if (timeHit || targetHit || dropHit) {
      exitReason = [
        timeHit ? spec.holdLabel : "",
        targetHit ? spec.targetLabel : "",
        dropHit ? spec.drawdownLabel : "",
      ].filter(Boolean).join(" + ");
      break;
    }
  }
  if (segmentY != null) targets.push({ x0: segmentStart, x1: dates[last], y: round2(segmentY) });
  return {
    hold: holdDate ? { date: holdDate, label: spec.holdLabel } : null,
    target: targets.map((segment) => ({ ...segment, label: spec.targetLabel })),
    drawdown: trail,
    drawdownLabel: spec.drawdownLabel,
    exitReason,
  };
}

const MACD_FAST = 12;
const MACD_SLOW = 26;
const MACD_SIGNAL = 9;
const MACD_WARMUP_START = "2025-06-01";

const warmupCache = new Map();

function ema(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let prev = sum / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function macdCrosses(points) {
  const closes = points.map((point) => point[1]);
  const fast = ema(closes, MACD_FAST);
  const slow = ema(closes, MACD_SLOW);
  const macd = closes.map((_, i) =>
    fast[i] == null || slow[i] == null ? null : fast[i] - slow[i],
  );
  const first = macd.findIndex((value) => value != null);
  const signal = new Array(macd.length).fill(null);
  if (first >= 0) {
    const tail = ema(macd.slice(first), MACD_SIGNAL);
    for (let i = 0; i < tail.length; i++) signal[first + i] = tail[i];
  }
  const crosses = [];
  for (let i = 1; i < macd.length; i++) {
    if (
      !Number.isFinite(macd[i]) ||
      !Number.isFinite(signal[i]) ||
      !Number.isFinite(macd[i - 1]) ||
      !Number.isFinite(signal[i - 1])
    ) {
      continue;
    }
    if (macd[i - 1] >= signal[i - 1] && macd[i] < signal[i]) {
      crosses.push({ date: points[i][0], aboveZero: macd[i] > 0 });
    }
  }
  return crosses;
}

function loadWarmupCloses(ticker, end) {
  const yahoo = String(ticker).replaceAll(".", "-");
  const key = `${yahoo}|${end}`;
  const hit = warmupCache.get(key);
  if (hit) return hit;
  const code = `
import json, sys
import pandas as pd
import yfinance as yf

ticker, start, end = sys.argv[1], sys.argv[2], sys.argv[3]
data = yf.download(
    tickers=ticker,
    start=start,
    end=end,
    auto_adjust=True,
    threads=False,
    group_by="column",
    progress=False,
)
if data is None or len(data) == 0:
    json.dump([], sys.stdout)
    raise SystemExit(0)
if isinstance(data.columns, pd.MultiIndex):
    close = data["Close"]
    if isinstance(close, pd.DataFrame):
        close = close.iloc[:, 0]
else:
    close = data["Close"] if "Close" in data.columns else data.iloc[:, 0]
idx = close.index
if getattr(idx, "tz", None) is not None:
    idx = idx.tz_localize(None)
dates = pd.to_datetime(idx).strftime("%Y-%m-%d")
out = []
seen = set()
for date, value in zip(dates, close.tolist()):
    if value == value and date not in seen and date < end:
        seen.add(date)
        out.append([str(date), round(float(value), 4)])
json.dump(out, sys.stdout)
`;
  const promise = new Promise((resolve, reject) => {
    const child = spawn(
      "./penv",
      ["python", "-c", code, yahoo, MACD_WARMUP_START, end],
      { cwd: ROOT },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (status) => {
      if (status !== 0) {
        reject(new Error(stderr || stdout || `warmup exited ${status}`));
        return;
      }
      const line = stdout
        .trim()
        .split("\n")
        .filter((row) => row.startsWith("["))
        .at(-1);
      if (!line) {
        reject(new Error(stderr || stdout || "warmup returned no JSON"));
        return;
      }
      resolve(JSON.parse(line));
    });
  }).catch((error) => {
    warmupCache.delete(key);
    throw error;
  });
  warmupCache.set(key, promise);
  return promise;
}

async function macdSellMarkers(ticker, series) {
  if (!series.length) return [];
  const end = series[0][0];
  const warmup = await loadWarmupCloses(ticker, end);
  const seen = new Set();
  const head = [];
  for (const point of warmup) {
    if (point[0] >= end || seen.has(point[0])) continue;
    seen.add(point[0]);
    head.push(point);
  }
  head.sort((a, b) => a[0].localeCompare(b[0]));
  const byDate = new Map(series.map((point) => [point[0], point[1]]));
  return macdCrosses(head.concat(series))
    .filter((cross) => byDate.has(cross.date))
    .map((cross) => ({
      date: cross.date,
      y: byDate.get(cross.date),
      aboveZero: cross.aboveZero,
    }));
}

function signalsFor(byTicker, ticker, _series) {
  const days = byTicker.get(ticker);
  if (!days) return [];
  const dots = [];
  for (const signal of days.values()) {
    dots.push({
      date: signal.date,
      y: signal.projectedPrice,
      source: signal.source,
      percent: signal.percent,
      projectedPrice: signal.projectedPrice,
      analysts: signal.analysts,
    });
  }
  dots.sort((a, b) => a.date.localeCompare(b.date) || a.source.localeCompare(b.source));
  return dots;
}

async function pagePayload(query) {
  const sell = query.get("sell") || DEFAULT_SELL;
  const buy = query.get("buy") || DEFAULT_BUY;
  const [positionText, signalText, bookText, closes] = await Promise.all([
    readCached(POSITIONS_CSV),
    readCached(SIGNALS_CSV),
    readCached(BOOK_CSV),
    loadCloses(),
  ]);
  const lots = loadPositions(positionText, sell, buy);
  const count = lots.length;
  let index = Number(query.get("i") || "0");
  if (!Number.isFinite(index)) index = 0;
  index = Math.min(Math.max(Math.trunc(index), 0), Math.max(count - 1, 0));
  const position = lots[index] || null;
  const series = position ? closes[position.ticker] || [] : [];
  const prices = series.map(([date, close]) => ({ date, close }));
  const signals = position ? signalsFor(loadSignals(signalText), position.ticker, series) : [];
  const rules = position ? buildRules(position, lots, prices, projectionIndex(bookText)) : null;
  const macdSells = position ? await macdSellMarkers(position.ticker, series) : [];
  return {
    sell,
    buy,
    buyLabel: canonicalBuy(buy),
    index,
    count,
    summary: summarize(lots),
    position,
    prices,
    signals,
    rules,
    macdSells,
    options: filterOptions(positionText),
  };
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://127.0.0.1");
    if (url.pathname === "/api/page") {
      const body = JSON.stringify(await pagePayload(url.searchParams));
      res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      res.end(body);
      return;
    }
    const rel = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const path = fileURLToPath(new URL(rel, `file://${PUBLIC_DIR}`));
    if (!path.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    const body = await readFile(path);
    res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream" });
    res.end(body);
  } catch (error) {
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end(error.stack || String(error));
  }
});

server.listen(4173, "127.0.0.1", () => {
  const q = new URLSearchParams({ sell: DEFAULT_SELL, buy: DEFAULT_BUY, i: "0" });
  console.log(`http://127.0.0.1:4173/?${q}`);
});
