import { writeTextFile } from "./write_file.js";

export const writeJsonFile = (fileName, value) =>
  writeTextFile(fileName, JSON.stringify(value, null, 2));
