import { renderSvg } from "./svg.js";

const SIZE = { width: 400, height: 200 };
const close = [
  { x: "2026-11-04", y: 200 },
  { x: "2026-11-05", y: 205 },
  { x: "2026-11-06", y: 210 },
];

// [[x, y], ...] from every points="..." attribute on elements of this tag.
function pointsOf(svg, tag) {
  return [...svg.matchAll(new RegExp(`<${tag} [^>]*points="([^"]+)"`, "g"))]
    .flatMap((m) => m[1].split(" ").map((p) => p.split(",").map(Number)));
}

function expectInside([x, y]) {
  expect(x).toBeGreaterThanOrEqual(0);
  expect(x).toBeLessThanOrEqual(SIZE.width);
  expect(y).toBeGreaterThanOrEqual(0);
  expect(y).toBeLessThanOrEqual(SIZE.height);
}

test("the close polyline has one point per bar, inside the plot", () => {
  const xy = pointsOf(renderSvg({ close }, SIZE), "polyline");
  expect(xy).toHaveLength(3);
  xy.forEach(expectInside);
  expect(xy[0][0]).toBeLessThan(xy[2][0]);
  expect(xy[0][1]).toBeGreaterThan(xy[2][1]);
});

test("a single bar does not produce NaN", () => {
  const xy = pointsOf(renderSvg({ close: [close[0]] }, SIZE), "polyline");
  expect(xy).toEqual([[200, 100]]);
});

test("no bars give the empty-state text", () => {
  expect(renderSvg({ close: [] }, SIZE)).toBe(
    '<text class="empty" x="200" y="100" text-anchor="middle">No bars</text>',
  );
});
