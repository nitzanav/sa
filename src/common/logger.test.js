import { jest } from "@jest/globals";
import config from "./config.js";
import { log, logger } from "./logger.js";

test("logger writes one json line to stderr", () => {
  const spy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  logger.log({ message: "retry", operationName: "NVDA", attempt: 2, wait: 1234 });
  expect(spy).toHaveBeenCalledWith(
    '{"message":"retry","operationName":"NVDA","attempt":2,"wait":1234}\n',
  );
  spy.mockRestore();
});

test("logger serializes errors by message", () => {
  const spy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  logger.log({ message: "retry", error: new Error("boom") });
  expect(spy).toHaveBeenCalledWith('{"message":"retry","error":"boom"}\n');
  spy.mockRestore();
});

test("logger serializes class instances by constructor name", () => {
  const spy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  class LoadedCheerio {}
  logger.log({ message: "start", args: [new LoadedCheerio()] });
  expect(spy).toHaveBeenCalledWith('{"message":"start","args":["LoadedCheerio"]}\n');
  spy.mockRestore();
});

test("log writes start and finish around a function", () => {
  const spy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  const now = jest.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(1042);
  const add = log(function add(a, b) {
    return a + b;
  });
  expect(add(1, 2)).toBe(3);
  expect(spy).toHaveBeenNthCalledWith(
    1,
    '{"message":"start","function":"add","args":[1,2]}\n',
  );
  expect(spy).toHaveBeenNthCalledWith(2, '{"message":"finish","function":"add","duration":42}\n');
  spy.mockRestore();
  now.mockRestore();
});

test("log writes finish after an async function resolves", async () => {
  const spy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  const now = jest.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(1250);
  const add = log(async function add(a, b) {
    return a + b;
  });
  expect(await add(1, 2)).toBe(3);
  expect(spy).toHaveBeenNthCalledWith(
    1,
    '{"message":"start","function":"add","args":[1,2]}\n',
  );
  expect(spy).toHaveBeenNthCalledWith(2, '{"message":"finish","function":"add","duration":250}\n');
  spy.mockRestore();
  now.mockRestore();
});

test("log writes result on finish when level is debug", () => {
  const spy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  const now = jest.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(1042);
  const previous = config.logger.level;
  config.logger.level = "debug";
  try {
    const add = log(function add(a, b) {
      return a + b;
    });
    expect(add(1, 2)).toBe(3);
    expect(spy).toHaveBeenNthCalledWith(
      2,
      '{"message":"finish","function":"add","result":3,"duration":42}\n',
    );
  } finally {
    config.logger.level = previous;
    spy.mockRestore();
    now.mockRestore();
  }
});
