import { renderSvg } from "./svg.js";

const SIZE = { width: 400, height: 200 };
const close = [
  { x: "2026-11-04", y: 200 },
  { x: "2026-11-05", y: 205 },
  { x: "2026-11-06", y: 210 },
];
const none = { buys: [], sells: [], targets: [] };

// [[x, y], ...] from every points="..." attribute on elements matching tagAndClass.
function pointsOf(svg, tagAndClass) {
  return [...svg.matchAll(new RegExp(`<${tagAndClass}[^>]* points="([^"]+)"`, "g"))]
    .flatMap((m) => m[1].split(" ").map((p) => p.split(",").map(Number)));
}

// [[cx, cy], ...] for every circle of this class.
function circlesOf(svg, cls) {
  return [...svg.matchAll(new RegExp(`<circle class="${cls}" cx="([^"]+)" cy="([^"]+)"`, "g"))]
    .map((m) => [Number(m[1]), Number(m[2])]);
}

function expectInside([x, y]) {
  expect(x).toBeGreaterThanOrEqual(0);
  expect(x).toBeLessThanOrEqual(SIZE.width);
  expect(y).toBeGreaterThanOrEqual(0);
  expect(y).toBeLessThanOrEqual(SIZE.height);
}

test("the close polyline has one point per bar, inside the plot", () => {
  const xy = pointsOf(renderSvg({ ...none, close }, SIZE), "polyline");
  expect(xy).toHaveLength(3);
  xy.forEach(expectInside);
  expect(xy[0][0]).toBeLessThan(xy[2][0]);
  expect(xy[0][1]).toBeGreaterThan(xy[2][1]);
});

test("a single bar does not produce NaN", () => {
  const xy = pointsOf(renderSvg({ ...none, close: [close[0]] }, SIZE), "polyline");
  expect(xy).toEqual([[200, 100]]);
});

test("no bars give the empty-state text", () => {
  expect(renderSvg({ ...none, close: [] }, SIZE)).toBe(
    '<text class="empty" x="200" y="100" text-anchor="middle">No bars</text>',
  );
});

test("one circle per buy and per sell, inside the plot", () => {
  const svg = renderSvg({
    ...none,
    close,
    buys: [{ x: "2026-11-04", y: 200 }, { x: "2026-11-06", y: 210 }],
    sells: [{ x: "2026-11-07", y: 190 }],
  }, SIZE);
  const buys = circlesOf(svg, "buy");
  const sells = circlesOf(svg, "sell");
  expect(buys).toHaveLength(2);
  expect(sells).toHaveLength(1);
  [...buys, ...sells, ...pointsOf(svg, "polyline")].forEach(expectInside);
});

test("markers are ignored when there are no bars", () => {
  const svg = renderSvg({ ...none, close: [], buys: [{ x: "2026-11-04", y: 200 }] }, SIZE);
  expect(svg).not.toContain("<circle");
});

test("one triangle per target, classed by source", () => {
  const targets = [
    { x: "2026-11-04", y: 220, source: "yahoo", analyst: "A" },
    { x: "2026-11-05", y: 230, source: "google", analyst: "B" },
    { x: "2026-11-05", y: 240, source: "tipranks", analyst: "C" },
  ];
  const svg = renderSvg({ ...none, close, targets }, SIZE);
  for (const source of ["yahoo", "google", "tipranks"]) {
    expect(pointsOf(svg, `polygon class="target source-${source}"`)).toHaveLength(3);
  }
  expect(svg.match(/<polygon /g)).toHaveLength(3);
});

test("a target above every close still lands inside the plot", () => {
  const targets = [{ x: "2026-11-05", y: 400, source: "yahoo", analyst: "A" }];
  const svg = renderSvg({ ...none, close, targets }, SIZE);
  const triangle = pointsOf(svg, "polygon");
  expect(triangle).toHaveLength(3);
  [...triangle, ...pointsOf(svg, "polyline")].forEach(expectInside);
});
