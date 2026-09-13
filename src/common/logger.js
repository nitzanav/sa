const serialize = (_key, value) => (value instanceof Error ? value.message : value);

export const logger = {
  log: (fields) => process.stderr.write(JSON.stringify(fields, serialize) + "\n"),
};
