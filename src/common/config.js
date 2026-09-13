import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
process.env.NODE_CONFIG_DIR ??= join(dirname(fileURLToPath(import.meta.url)), "../../config");
const config = require("config");

export default config.util.toObject(config);
