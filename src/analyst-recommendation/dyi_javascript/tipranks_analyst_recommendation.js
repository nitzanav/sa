import config from "../../common/config.js";
import { backoffRetry } from "../../common/backoff_retry.js";
import { fileCache } from "../../common/file_cache.js";
import { log, logger } from "../../common/logger.js";
import { rateLimit } from "../../common/rate_limit.js";
import { validateAnalystRecommendations } from "./validate_analyst_recommendations.js";
import {
  formatProjectedPercent,
  formatUsdPriceTarget,
  padUsDate,
} from "./yahoo_analyst_recommendation.js";
import { yahooOpenPrice } from "./yahoo_open_price.js";

const TIPRANKS_MCP_URL = "https://mcp.tipranks.com/mcp/";
// TipRanks allows ~60 tool calls per minute; ~1s between request starts stays under that.
export const TIPRANKS_RATE_LIMIT = { enabled: true, minDelay: 1000, maxDelay: 1000 };
const TIPRANKS_ACTIONS = {
  downgraded: "Downgraded",
  initiated: "Initiated",
  maintained: "Maintained",
  reiterated: "Reiterated",
  upgraded: "Upgraded",
};

export function tipranksAnalystRecommendationUrl(symbol) {
  const url = new URL(TIPRANKS_MCP_URL);
  url.searchParams.set("ticker", symbol);
  return url.toString();
}

export function quoteFromUrl(url) {
  return new URL(url).searchParams.get("ticker") || "quote";
}

export function matchesUrl(url) {
  return new URL(url).hostname === "mcp.tipranks.com";
}

function logEmptyRatings() {
  logger.error({
    message: "error",
    error: new Error("TipRanks analyst ratings empty"),
  });
}

function mapTipRanksAction(action) {
  if (typeof action !== "string") return action;
  return TIPRANKS_ACTIONS[action.trim().toLowerCase()] ?? action;
}

function positivePriceTarget(value) {
  if (value == null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return number;
}

function jsonRpcError(error) {
  const message =
    error && typeof error.message === "string" && error.message ? error.message : "unknown";
  return new Error(`TipRanks JSON-RPC error: ${message}`);
}

function toolErrorText(result) {
  const parts = Array.isArray(result?.content) ? result.content : [];
  const text = parts
    .filter((part) => part && part.type === "text" && typeof part.text === "string")
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join(" ");
  const message = text || "unknown";
  return message.length > 300 ? `${message.slice(0, 300)}…` : message;
}

export function isTipRanksQuotaError(error) {
  return error instanceof Error && error.message.includes("tool-call limit");
}

function throwIfTipRanksFailure(message) {
  if (message?.error) throw jsonRpcError(message.error);
  if (message?.result?.isError === true) {
    const error = new Error(`TipRanks tool error: ${toolErrorText(message.result)}`);
    if (isTipRanksQuotaError(error)) error.retry = false;
    throw error;
  }
}

function scrubError(error, apiKey) {
  if (!(error instanceof Error)) return new Error("TipRanks request failed");
  if (apiKey && error.message.includes(apiKey)) {
    return new Error(error.message.replaceAll(apiKey, "[redacted]"));
  }
  return error;
}

function jsonRpcFromDataLines(dataLines) {
  if (dataLines.length === 0) return null;
  const payload = dataLines.join("\n").trim();
  if (!payload) return null;
  try {
    const value = JSON.parse(payload);
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      ("result" in value || "error" in value)
    ) {
      return value;
    }
  } catch {}
  return null;
}

function drainSse(state) {
  const lines = state.buffer.split(/\r?\n/);
  state.buffer = lines.pop() ?? "";
  for (const line of lines) {
    if (line === "") {
      const message = jsonRpcFromDataLines(state.dataLines);
      state.dataLines = [];
      if (message) return message;
      continue;
    }
    if (line.startsWith(":") || line.startsWith("event:") || line.startsWith("id:")) continue;
    if (!line.startsWith("data:")) continue;
    let value = line.slice("data:".length);
    if (value.startsWith(" ")) value = value.slice(1);
    state.dataLines.push(value);
    const message = jsonRpcFromDataLines(state.dataLines);
    if (message) return message;
  }
  return null;
}

function jsonRpcMessageFromSse(text) {
  const state = { buffer: String(text), dataLines: [] };
  if (!state.buffer.endsWith("\n")) state.buffer += "\n";
  return drainSse(state);
}

function isMissingText(text) {
  return text == null || (typeof text === "string" && text.trim() === "");
}

function ratingsFromText(text) {
  if (Array.isArray(text)) return text;
  if (typeof text !== "string") throw new Error("TipRanks ratings text is not JSON");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("TipRanks ratings text is not JSON");
  }
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object" && Array.isArray(parsed.ratings)) {
    return parsed.ratings;
  }
  throw new Error("TipRanks ratings text is not an array");
}

function cleanLabel(value) {
  return String(value ?? "")
    .replace(/\p{Cf}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function ratingsFromResult(result) {
  const content = result?.content;
  if (!Array.isArray(content) || content.length === 0) {
    logEmptyRatings();
    return [];
  }
  const ratings = [];
  let sawText = false;
  for (const part of content) {
    if (!part || part.type !== "text" || isMissingText(part.text)) continue;
    sawText = true;
    ratings.push(...ratingsFromText(part.text));
  }
  if (!sawText || ratings.length === 0) {
    logEmptyRatings();
    return [];
  }
  return ratings;
}

export function parseTipRanksResponseBody(text) {
  const raw = String(text ?? "")
    .replace(/^\uFEFF/, "")
    .trim();
  if (!raw) throw new Error("TipRanks response is empty");
  const message = raw.startsWith("{") ? parseJsonRpcObject(raw) : jsonRpcMessageFromSse(raw);
  if (!message) throw new Error("TipRanks response is not JSON-RPC");
  if (message.error) throw jsonRpcError(message.error);
  return ratingsFromResult(message.result);
}

function parseJsonRpcObject(raw) {
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("TipRanks response is not JSON-RPC");
    }
    return value;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("TipRanks ")) throw error;
    throw new Error("TipRanks response is not JSON");
  }
}

async function listingFromTipRanksRating(rating, symbol) {
  const analystName = cleanLabel(rating?.analystName);
  const firm = cleanLabel(rating?.firmName);
  const priceTarget = positivePriceTarget(rating?.priceTarget);
  const date = padUsDate(rating?.recommendationDate);
  const recommendation = rating?.recommendation ?? rating?.rating;
  const projected =
    priceTarget == null
      ? null
      : formatProjectedPercent(priceTarget, await yahooOpenPrice.forDate(symbol, date));
  return {
    analyst: analystName || firm,
    firm,
    recommendation: recommendation == null ? null : cleanLabel(recommendation),
    action: mapTipRanksAction(rating?.analystAction ?? rating?.action),
    price_target: priceTarget == null ? null : formatUsdPriceTarget(priceTarget),
    projected,
    date,
  };
}

export async function parseTipRanksAnalystRecommendation(body, symbol) {
  const ratings = parseTipRanksResponseBody(body);
  const listings = [];
  for (const rating of ratings) {
    listings.push(await listingFromTipRanksRating(rating, symbol));
  }
  return validateAnalystRecommendations(listings, { symbol });
}

function responseHeader(response, name) {
  const headers = response?.headers;
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) ?? "";
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return value ?? "";
  }
  return "";
}

function isEventStream(contentType) {
  return String(contentType).toLowerCase().includes("text/event-stream");
}

async function readEventStreamJsonRpc(response) {
  if (!response.body || typeof response.body.getReader !== "function") {
    throw new Error("TipRanks event stream has no body");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const state = { buffer: "", dataLines: [] };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (value) state.buffer += decoder.decode(value, { stream: true });
      if (done) {
        state.buffer += decoder.decode();
        if (state.buffer && !state.buffer.endsWith("\n")) state.buffer += "\n";
      }
      const message = drainSse(state);
      if (message) {
        await reader.cancel();
        throwIfTipRanksFailure(message);
        return JSON.stringify(message);
      }
      if (done) break;
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }
  throw new Error("TipRanks event stream ended without a JSON-RPC message");
}

async function performTipRanksRequest(httpConfig, apiKey) {
  const ticker = new URL(httpConfig.url).searchParams.get("ticker");
  const endpoint = new URL(TIPRANKS_MCP_URL);
  endpoint.searchParams.set("apikey", apiKey);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "get_recent_analyst_ratings",
        arguments: { ticker },
      },
    }),
    signal: AbortSignal.timeout(config.http.timeout),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  if (isEventStream(responseHeader(response, "content-type"))) {
    return readEventStreamJsonRpc(response);
  }
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return text;
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    throwIfTipRanksFailure(parsed);
  }
  return text;
}

function tipRanksApiKey() {
  return process.env.TIP_RANKS_API_KEY || "";
}

const requestTipRanksAnalystRecommendation = log(
  async function requestTipRanksAnalystRecommendation(httpConfig) {
    const apiKey = tipRanksApiKey();
    try {
      return await performTipRanksRequest(httpConfig, apiKey);
    } catch (error) {
      throw scrubError(error, apiKey);
    }
  },
);

export async function fetchTipRanksAnalystRecommendation(url, retryConfig, cacheConfig) {
  // A cache hit returns before this runs. Missing key stays outside backoffRetry.
  const cached = fileCache(async (httpConfig) => {
    if (!tipRanksApiKey()) throw new Error("TIP_RANKS_API_KEY is not set");
    return backoffRetry(
      rateLimit(requestTipRanksAnalystRecommendation, TIPRANKS_RATE_LIMIT),
      retryConfig,
    )(httpConfig);
  }, cacheConfig);
  return cached({ url });
}

export const tipranksAnalystRecommendationSource = {
  name: "tipranks",
  urlFor: tipranksAnalystRecommendationUrl,
  fetch: fetchTipRanksAnalystRecommendation,
  parse: parseTipRanksAnalystRecommendation,
  quoteFromUrl,
  matchesUrl,
};
