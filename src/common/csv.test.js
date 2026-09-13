import { mkdtempSync, writeFileSync } from "node:fs";

import { tmpdir } from "node:os";
import { join } from "node:path";
import { readCsv } from "./csv.js";

test("readCsv maps header columns to row values", () => {
  const dir = mkdtempSync(join(tmpdir(), "csv-"));
  const file = join(dir, "s.csv");
  writeFileSync(file, "Symbol,Name\nAAA,Alpha\nBBB,Beta\n");
  expect(readCsv(file)).toEqual([
    { Symbol: "AAA", Name: "Alpha" },
    { Symbol: "BBB", Name: "Beta" },
  ]);
});
