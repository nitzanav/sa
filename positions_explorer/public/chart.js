import { renderSvg } from "./svg.js";

const svg = document.getElementById("chart");
const select = document.getElementById("symbol");
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

const symbols = await getJson("/api/symbols");
select.replaceChildren(...symbols.map((s) => new Option(s, s)));
const wanted = new URLSearchParams(location.search).get("symbol");
select.value = symbols.includes(wanted) ? wanted : (symbols[0] ?? "");
select.addEventListener("change", () => draw(select.value));
draw(select.value);
