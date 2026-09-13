import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import config from "./config.js";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

test("config loads defaults", () => {
  expect(config.logger).toEqual({ level: "info" });
  expect(config.retry).toEqual({
    enabled: true,
    initialDelay: 1000,
    delayMultiple: 2,
    maxAttempts: 5,
  });
  expect(config.cache).toEqual({ enabled: true, ttl: 86400000 });
  expect(config.rateLimit.minDelay).toBe(1000);
  expect(config.rateLimit.maxDelay).toBe(10000);
  expect(config.http.timeout).toBe(60000);
  expect(() => new Headers(config.http.headers)).not.toThrow();
  expect(config.analyst_recommendations.limit).toBe(3);
  expect(config.sharadar.chunkSize).toBe(30);
  expect(config.sharadar.api_key).toEqual(expect.any(String));
});

test("NODE_CONFIG overrides nested values", () => {
  const output = execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "import config from './src/common/config.js'; process.stdout.write(String(config.analyst_recommendations.limit))",
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_CONFIG: JSON.stringify({ analyst_recommendations: { limit: 10 } }),
      },
    },
  );
  expect(output).toBe("10");
});
