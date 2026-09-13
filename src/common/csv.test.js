import { mkdtempSync, writeFileSync } from "node:fs";

import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatCsv, readCsv } from "./csv.js";

test("readCsv maps header columns to row values", () => {
  const dir = mkdtempSync(join(tmpdir(), "csv-"));
  const file = join(dir, "s.csv");
  writeFileSync(file, "Symbol,Name\nAAA,Alpha\nBBB,Beta\n");
  expect(readCsv(file)).toEqual([
    { Symbol: "AAA", Name: "Alpha" },
    { Symbol: "BBB", Name: "Beta" },
  ]);
});

test("formatCsv quotes cells that contain commas", () => {
  expect(
    formatCsv(["date", "ticker", "analyst", "percent"], [
      { date: "09/10/2026", ticker: "NVDA", analyst: "Matthew Smith, CFA", percent: 37.4 },
      { date: "09/10/2026", ticker: "NVDA", analyst: "James Schneider", percent: "" },
    ]),
  ).toBe(
    [
      "date,ticker,analyst,percent",
      '09/10/2026,NVDA,"Matthew Smith, CFA",37.4',
      "09/10/2026,NVDA,James Schneider,",
    ].join("\n"),
  );
});
