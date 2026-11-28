import { buildSeries } from "./series.js";

test("bars map to close points in order", () => {
  const bars = [
    { bar_date: "2026-11-04", close: 200 },
    { bar_date: "2026-11-05", close: 205 },
  ];
  expect(buildSeries({ bars })).toEqual({
    close: [
      { x: "2026-11-04", y: 200 },
      { x: "2026-11-05", y: 205 },
    ],
  });
});

test("no bars give an empty close line", () => {
  expect(buildSeries({ bars: [] })).toEqual({ close: [] });
});
