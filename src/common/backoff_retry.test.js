import { jest } from "@jest/globals";
import { backoffRetry, jitter } from "./backoff_retry.js";

test("jitter returns a value within delay", () => {
  for (let i = 0; i < 20; i++) {
    const v = jitter(100);
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(100);
  }
});

test("backoffRetry returns on success and forwards arguments", async () => {
  const fn = jest.fn().mockResolvedValue("ok");
  const retried = backoffRetry(fn, { operationName: "k", initialDelay: 0, maxAttempts: 3 });
  await expect(retried("arg")).resolves.toBe("ok");
  expect(fn).toHaveBeenCalledWith("arg");
  expect(fn).toHaveBeenCalledTimes(1);
});

test("backoffRetry retries then succeeds", async () => {
  const spy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  let calls = 0;
  const fn = async () => {
    calls++;
    if (calls < 3) throw new Error("fail");
    return "done";
  };
  const retried = backoffRetry(fn, {
    operationName: "k",
    initialDelay: 0,
    delayMultiple: 2,
    maxAttempts: 5,
  });
  await expect(retried()).resolves.toBe("done");
  expect(calls).toBe(3);
  expect(
    spy.mock.calls.filter((c) => c[0].includes('"message":"retry"')),
  ).toHaveLength(2);
  spy.mockRestore();
});

test("backoffRetry runs once when disabled", async () => {
  const fn = jest.fn().mockRejectedValue(new Error("nope"));
  await expect(backoffRetry(fn, { enabled: false })()).rejects.toThrow("nope");
  expect(fn).toHaveBeenCalledTimes(1);
});

test("backoffRetry throws after last attempt", async () => {
  const spy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  const fn = jest.fn().mockRejectedValue(new Error("nope"));
  const retried = backoffRetry(fn, {
    operationName: "k",
    initialDelay: 0,
    delayMultiple: 2,
    maxAttempts: 3,
  });
  await expect(retried()).rejects.toThrow("nope");
  expect(fn).toHaveBeenCalledTimes(3);
  spy.mockRestore();
});

test("backoffRetry works without operationName", async () => {
  const spy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  let calls = 0;
  const fn = async () => {
    calls++;
    if (calls < 2) throw new Error("fail");
    return "done";
  };
  const retried = backoffRetry(fn, { initialDelay: 0, maxAttempts: 3 });
  await expect(retried()).resolves.toBe("done");
  expect(spy.mock.calls[0][0]).toContain('"message":"retry"');
  spy.mockRestore();
});
