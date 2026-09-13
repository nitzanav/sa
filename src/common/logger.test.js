import { jest } from "@jest/globals";
import config from "./config.js";
import { log, logger } from "./logger.js";

test("logger writes one json line to stderr", () => {
  const spy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  logger.log({ message: "retry", operationName: "NVDA", attempt: 2, wait: 1234 });
  expect(spy).toHaveBeenCalledWith(
    '{"message":"retry","operationName":"NVDA","attempt":2,"wait":1234,"log_level":"info"}\n',
  );
  spy.mockRestore();
});

test("logger serializes errors by message", () => {
  const spy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  logger.log({ message: "retry", error: new Error("boom") });
  expect(spy).toHaveBeenCalledWith('{"message":"retry","error":"boom","log_level":"info"}\n');
  spy.mockRestore();
});

test("logger serializes class instances by constructor name", () => {
  const spy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  class LoadedCheerio {}
  logger.log({ message: "start", args: [new LoadedCheerio()] });
  expect(spy).toHaveBeenCalledWith('{"message":"start","args":["LoadedCheerio"],"log_level":"info"}\n');
  spy.mockRestore();
});

test("log writes start around a function and skips debug finish", () => {
  const spy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  const now = jest.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(1042);
  const add = log(function add(a, b) {
    return a + b;
  });
  expect(add(1, 2)).toBe(3);
  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy).toHaveBeenCalledWith(
    '{"message":"start","function":"add","args":[1,2],"log_level":"info"}\n',
  );
  spy.mockRestore();
  now.mockRestore();
});

test("log writes start after an async function resolves and skips debug finish", async () => {
  const spy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  const now = jest.spyOn(Date, "now").mockReturnValueOnce(1000).mockReturnValueOnce(1250);
  const add = log(async function add(a, b) {
    return a + b;
  });
  expect(await add(1, 2)).toBe(3);
  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy).toHaveBeenCalledWith(
    '{"message":"start","function":"add","args":[1,2],"log_level":"info"}\n',
  );
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
      '{"message":"finish","function":"add","result":3,"duration":42,"log_level":"debug"}\n',
    );
  } finally {
    config.logger.level = previous;
    spy.mockRestore();
    now.mockRestore();
  }
});

test("logger.error writes when level is info", () => {
  const spy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  logger.error({ message: "error" });
  expect(spy).toHaveBeenCalledWith('{"message":"error","log_level":"error"}\n');
  spy.mockRestore();
});

test("logger.info writes when level is info", () => {
  const spy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  logger.info({ message: "start" });
  expect(spy).toHaveBeenCalledWith('{"message":"start","log_level":"info"}\n');
  spy.mockRestore();
});

test("logger.debug is skipped when level is info", () => {
  const spy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  logger.debug({ message: "start" });
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});

test("logger.log skips debug when level is info", () => {
  const spy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  logger.log({ message: "start", log_level: "debug" });
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});

test("logger.error writes and logger.info is skipped when level is error", () => {
  const spy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  const previous = config.logger.level;
  config.logger.level = "error";
  try {
    logger.info({ message: "start" });
    logger.error({ message: "error" });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('{"message":"error","log_level":"error"}\n');
  } finally {
    config.logger.level = previous;
    spy.mockRestore();
  }
});

test("addContext adds fields to every following log line", () => {
  const spy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  try {
    logger.addContext({ symbol: "NVDA" });
    logger.info({ message: "start" });
    logger.error({ message: "error" });
    expect(spy).toHaveBeenNthCalledWith(
      1,
      '{"symbol":"NVDA","message":"start","log_level":"info"}\n',
    );
    expect(spy).toHaveBeenNthCalledWith(
      2,
      '{"symbol":"NVDA","message":"error","log_level":"error"}\n',
    );
  } finally {
    logger.clearContext();
    spy.mockRestore();
  }
});

test("clearContext drops the added fields", () => {
  const spy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  logger.addContext({ symbol: "NVDA" });
  logger.clearContext();
  logger.info({ message: "start" });
  expect(spy).toHaveBeenCalledWith('{"message":"start","log_level":"info"}\n');
  spy.mockRestore();
});

test("logger.debug writes when level is debug", () => {
  const spy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  const previous = config.logger.level;
  config.logger.level = "debug";
  try {
    logger.debug({ message: "start" });
    expect(spy).toHaveBeenCalledWith('{"message":"start","log_level":"debug"}\n');
  } finally {
    config.logger.level = previous;
    spy.mockRestore();
  }
});
