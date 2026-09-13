import { jest } from "@jest/globals";
import { logger } from "./logger.js";

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
