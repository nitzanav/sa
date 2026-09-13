import config from "./config.js";

const levels = { error: 0, info: 1, debug: 2 };

const serialize = (seen) => (_key, value) => {
  if (value instanceof Error) return value.message;
  if (typeof value === "function") return value.name || "[Function]";
  if (value !== null && typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) {
      return value.constructor?.name ?? String(value);
    }
  }
  return value;
};

export const logger = {
  log: ({ log_level = "info", ...fields }) => {
    if (levels[log_level] > levels[config.logger.level]) return;
    process.stderr.write(JSON.stringify(fields, serialize(new WeakSet())) + "\n");
  },
  error: (fields) => logger.log({ ...fields, log_level: "error" }),
  info: (fields) => logger.log({ ...fields, log_level: "info" }),
  debug: (fields) => logger.log({ ...fields, log_level: "debug" }),
};

export function log(target, context = { name: target.name }) {
  const name = context.name;
  return function (...args) {
    logger.log({ message: "start", function: name, args });
    const started = Date.now();
    const finish = (result) => {
      logger.log({
        message: "finish",
        function: name,
        result,
        duration: Date.now() - started,
        log_level: "debug",
      });
      return result;
    };
    const result = target.apply(this, args);
    return result instanceof Promise ? result.then(finish) : finish(result);
  };
}
