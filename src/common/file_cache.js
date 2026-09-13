import { readFile, stat } from "node:fs/promises";
import config from "./config.js";
import { writeTextFile } from "./write_file.js";

export function fileCache(functionToCache, cacheConfig = {}) {
  const { enabled, ttl, fileName } = { ...config.cache, ...cacheConfig };
  if (enabled && !fileName) throw new Error("fileCache requires cacheConfig.fileName");
  return async (...args) => {
    if (!enabled) return functionToCache(...args);
    try {
      const { mtimeMs } = await stat(fileName);
      const expiry = mtimeMs + ttl;
      if (Date.now() < expiry) return readFile(fileName, "utf8");
    } catch {}
    const value = await functionToCache(...args);
    await writeTextFile(fileName, value);
    return value;
  };
}
