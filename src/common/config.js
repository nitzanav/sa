import { readFileSync } from "node:fs";

export default JSON.parse(
  readFileSync(new URL("../../config/default.json", import.meta.url), "utf8"),
);
