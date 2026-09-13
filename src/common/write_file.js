import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function writeTextFile(fileName, text) {
  await mkdir(dirname(fileName), { recursive: true });
  await writeFile(fileName, text);
}
