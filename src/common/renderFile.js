import ejs from "ejs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function renderFile(fromUrl, fileName, data) {
  return ejs.renderFile(join(dirname(fileURLToPath(fromUrl)), fileName), data);
}
