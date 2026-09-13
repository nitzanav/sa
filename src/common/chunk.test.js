import { chunk } from "./chunk.js";

test("chunk splits into groups of the given size", () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
});

test("chunk returns empty list for empty input", () => {
  expect(chunk([], 3)).toEqual([]);
});
