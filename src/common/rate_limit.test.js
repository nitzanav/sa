import { jest } from "@jest/globals";
import { randomDelay, rateLimit } from "./rate_limit.js";

test("randomDelay returns a value in range", () => {
  for (let i = 0; i < 20; i++) {
    const value = randomDelay(1000, 10000);
    expect(value).toBeGreaterThanOrEqual(1000);
    expect(value).toBeLessThanOrEqual(10000);
  }
});

test("rateLimit returns on success and forwards arguments", async () => {
  const functionToLimit = jest.fn().mockResolvedValue("ok");
  const limited = rateLimit(functionToLimit, { enabled: true, minDelay: 0, maxDelay: 0 });
  await expect(limited({ url: "http://forward.example/path" }, "arg")).resolves.toBe("ok");
  expect(functionToLimit).toHaveBeenCalledWith({ url: "http://forward.example/path" }, "arg");
});

test("rateLimit delays the next request to the same domain from start, not end", async () => {
  jest.useFakeTimers();
  const functionToLimit = jest.fn().mockImplementation(
    () => new Promise((resolve) => setTimeout(() => resolve("ok"), 20000)),
  );
  const limited = rateLimit(functionToLimit, { enabled: true, minDelay: 1000, maxDelay: 1000 });
  const first = limited({ url: "http://same.example/a" });
  await jest.advanceTimersByTimeAsync(0);
  expect(functionToLimit).toHaveBeenCalledTimes(1);

  const second = limited({ url: "http://same.example/b" });
  await jest.advanceTimersByTimeAsync(999);
  expect(functionToLimit).toHaveBeenCalledTimes(1);

  await jest.advanceTimersByTimeAsync(1);
  expect(functionToLimit).toHaveBeenCalledTimes(2);

  await jest.advanceTimersByTimeAsync(20000);
  await expect(first).resolves.toBe("ok");
  await expect(second).resolves.toBe("ok");
  jest.useRealTimers();
});

test("rateLimit does not delay different domains", async () => {
  jest.useFakeTimers();
  const functionToLimit = jest.fn().mockResolvedValue("ok");
  const limited = rateLimit(functionToLimit, { enabled: true, minDelay: 5000, maxDelay: 5000 });
  const first = limited({ url: "http://a.example/" });
  const second = limited({ url: "http://b.example/" });
  await jest.advanceTimersByTimeAsync(0);
  expect(functionToLimit).toHaveBeenCalledTimes(2);
  await expect(Promise.all([first, second])).resolves.toEqual(["ok", "ok"]);
  jest.useRealTimers();
});

test("rateLimit runs immediately when disabled", async () => {
  const functionToLimit = jest.fn().mockResolvedValue("ok");
  const limited = rateLimit(functionToLimit, {
    enabled: false,
    minDelay: 60000,
    maxDelay: 60000,
  });
  await expect(limited({ url: "http://disabled.example/" })).resolves.toBe("ok");
  await expect(limited({ url: "http://disabled.example/" })).resolves.toBe("ok");
  expect(functionToLimit).toHaveBeenCalledTimes(2);
});
