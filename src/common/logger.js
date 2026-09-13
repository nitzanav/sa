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
  log: (fields) => process.stderr.write(JSON.stringify(fields, serialize(new WeakSet())) + "\n"),
};

export function log(target, context = { name: target.name }) {
  const name = context.name;
  return function (...args) {
    logger.log({ message: "start", function: name, args });
    const result = target.apply(this, args);
    if (result instanceof Promise) {
      return result.then((resolved) => {
        logger.log({ message: "finish", function: name, result: resolved });
        return resolved;
      });
    }
    logger.log({ message: "finish", function: name, result });
    return result;
  };
}
