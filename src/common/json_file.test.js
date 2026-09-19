import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readJsonFile, writeJsonFile } from "./json_file.js";

test("readJsonFile parses JSON from disk", () => {
  const dir = mkdtempSync(join(tmpdir(), "rj-"));
  const file = join(dir, "in.json");
  writeFileSync(file, '[{"date":"2026-02-03","percent":7.7}]');
  expect(readJsonFile(file)).toEqual([{ date: "2026-02-03", percent: 7.7 }]);
});

test("writeJsonFile writes pretty JSON and creates dirs", async () => {
  const dir = mkdtempSync(join(tmpdir(), "wj-"));
  const file = join(dir, "nested/out.json");
  await writeJsonFile(file, { a: 1 });
  expect(readFileSync(file, "utf8")).toBe('{\n  "a": 1\n}');
});
