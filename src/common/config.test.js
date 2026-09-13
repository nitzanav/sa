import config from "./config.js";

test("config loads defaults", () => {
  expect(config.retry).toEqual({
    enabled: true,
    initialDelay: 1000,
    delayMultiple: 2,
    maxAttempts: 5,
  });
  expect(config.cache).toEqual({ enabled: true, ttl: 86400000 });
  expect(config.http.timeout).toBe(60000);
  expect(config.analyst_recommendations.limit).toBe(3);
  expect(config.sharadar.chunkSize).toBe(30);
  expect(config.sharadar.api_key).toEqual(expect.any(String));
});
