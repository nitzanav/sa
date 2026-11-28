import { buildSeries } from "./series.js";

const bars = [
  { bar_date: "2026-11-04", close: 200 },
  { bar_date: "2026-11-05", close: 205 },
];

test("bars map to close points in order", () => {
  expect(buildSeries({ bars, positions: [] }).close).toEqual([
    { x: "2026-11-04", y: 200 },
    { x: "2026-11-05", y: 205 },
  ]);
});

test("no rows give empty series", () => {
  expect(buildSeries({ bars: [], positions: [] })).toEqual({ close: [], buys: [], sells: [] });
});

test("every position is a buy; only closed positions are sells", () => {
  const positions = [
    { buy_date: "2026-11-02", price: 190, sell_date: "2026-11-04", sell_price: 185 },
    { buy_date: "2026-11-05", price: 205, sell_date: null, sell_price: null },
  ];
  const { buys, sells } = buildSeries({ bars, positions });
  expect(buys).toEqual([
    { x: "2026-11-02", y: 190 },
    { x: "2026-11-05", y: 205 },
  ]);
  expect(sells).toEqual([{ x: "2026-11-04", y: 185 }]);
});
