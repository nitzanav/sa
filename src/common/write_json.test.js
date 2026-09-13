import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeJsonFile } from "./write_json.js";

test("writeJsonFile writes pretty JSON and creates dirs", async () => {
  const dir = mkdtempSync(join(tmpdir(), "wj-"));
  const file = join(dir, "nested/out.json");
  await writeJsonFile(file, { a: 1 });
  expect(readFileSync(file, "utf8")).toBe('{\n  "a": 1\n}');
});
