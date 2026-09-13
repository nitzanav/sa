import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeTextFile } from "./write_file.js";

test("writeTextFile writes text and creates dirs", async () => {
  const dir = mkdtempSync(join(tmpdir(), "wf-"));
  const file = join(dir, "nested/out.txt");
  await writeTextFile(file, "hello");
  expect(readFileSync(file, "utf8")).toBe("hello");
});
