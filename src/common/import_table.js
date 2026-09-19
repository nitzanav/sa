import { extname } from "node:path";
import { readCsv } from "./csv.js";
import { logger } from "./logger.js";
import { readJsonFile } from "./json_file.js";

export const ALL_SYMBOLS_SCHEMA = {
  date: "date",
  ticker: "string",
  analyst: "text",
  percent: "float",
};

export const TABLE_IMPORTS = [
  {
    table: "google_all_symbols",
    file: "data/analyst_recomendation/google/all_symbols.json",
    schema: ALL_SYMBOLS_SCHEMA,
  },
  {
    table: "yahoo_all_symbols",
    file: "data/analyst_recomendation/yahoo/all_symbols.json",
    schema: ALL_SYMBOLS_SCHEMA,
  },
];

const NUMERIC_TYPES = new Set(["float", "double", "decimal", "integer"]);

export function coerceValue(value, type) {
  if (value === "" || value === undefined || value === null) return null;
  if (NUMERIC_TYPES.has(type)) return Number(value);
  return value;
}

export function coerceRows(rows, schema) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(schema).map(([column, type]) => [column, coerceValue(row[column], type)]),
    ),
  );
}

export function readRows(file) {
  return extname(file) === ".json" ? readJsonFile(file) : readCsv(file);
}

export function archiveTableName(table, at = new Date()) {
  const stamp = at
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace("T", "_")
    .slice(0, 15);
  return `${table}_${stamp}`;
}

export async function archiveTable(db, table, at = new Date()) {
  if (!(await db.schema.hasTable(table))) return null;
  const archived = archiveTableName(table, at);
  await db.schema.renameTable(table, archived);
  logger.info({ message: "archived table", table, archived });
  return archived;
}

export async function importTable(db, { table, file, schema, batchSize = 1000, at = new Date() }) {
  const rows = coerceRows(readRows(file), schema);
  await archiveTable(db, table, at);
  await db.schema.createTable(table, (tableBuilder) => {
    for (const [column, type] of Object.entries(schema)) tableBuilder[type](column);
  });
  if (rows.length > 0) await db.batchInsert(table, rows, batchSize);
  logger.info({ message: "imported table", table, file, rows: rows.length });
  return rows.length;
}

export async function importTables(db, imports = TABLE_IMPORTS) {
  for (const spec of imports) await importTable(db, spec);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { default: db } = await import("./knex.js");
  try {
    await importTables(db);
  } finally {
    await db.destroy();
  }
}
