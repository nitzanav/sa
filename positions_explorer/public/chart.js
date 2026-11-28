import { renderSvg } from "./svg.js";

const svg = document.getElementById("chart");
const { width, height } = svg.viewBox.baseVal;

async function getJson(url) {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error);
  return body;
}

async function draw(symbol) {
  const series = symbol
    ? await getJson(`/api/chart?symbol=${encodeURIComponent(symbol)}`)
    : { close: [] };
  svg.innerHTML = renderSvg(series, { width, height });
}

draw(new URLSearchParams(location.search).get("symbol"));
