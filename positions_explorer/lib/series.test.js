import { buildSeries } from "./series.js";

const bars = [
  { bar_date: "2026-11-04", close: 200 },
  { bar_date: "2026-11-05", close: 205 },
];
const empty = { bars: [], positions: [], signals: [] };

test("bars map to close points in order", () => {
  expect(buildSeries({ ...empty, bars }).close).toEqual([
    { x: "2026-11-04", y: 200 },
    { x: "2026-11-05", y: 205 },
  ]);
});

test("no rows give empty series", () => {
  expect(buildSeries(empty)).toEqual({ close: [], buys: [], sells: [], targets: [] });
});

test("every position is a buy; only closed positions are sells", () => {
  const positions = [
    { buy_date: "2026-11-02", price: 190, sell_date: "2026-11-04", sell_price: 185 },
    { buy_date: "2026-11-05", price: 205, sell_date: null, sell_price: null },
  ];
  const { buys, sells } = buildSeries({ ...empty, bars, positions });
  expect(buys).toEqual([
    { x: "2026-11-02", y: 190 },
    { x: "2026-11-05", y: 205 },
  ]);
  expect(sells).toEqual([{ x: "2026-11-04", y: 185 }]);
});

test("targets keep source and analyst", () => {
  const signals = [
    { date: "2026-11-04", projected_price: 240, source: "tipranks", analyst: "Jane Doe" },
    { date: "2026-11-05", projected_price: 230, source: "google", analyst: null },
  ];
  expect(buildSeries({ ...empty, bars, signals }).targets).toEqual([
    { x: "2026-11-04", y: 240, source: "tipranks", analyst: "Jane Doe" },
    { x: "2026-11-05", y: 230, source: "google", analyst: null },
  ]);
});
