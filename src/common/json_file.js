import { readFileSync } from "node:fs";
import { writeTextFile } from "./write_file.js";

export const readJsonFile = (fileName) => JSON.parse(readFileSync(fileName, "utf8"));

export const writeJsonFile = (fileName, value) =>
  writeTextFile(fileName, JSON.stringify(value, null, 2));
