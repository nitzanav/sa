import { jest } from "@jest/globals";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { archiveTableName, coerceRows, importTable, importTables } from "./import_table.js";
import { logger } from "./logger.js";

const schema = {
  date: "date",
  ticker: "string",
  analyst: "text",
  percent: "float",
};

function fakeDb({ tables = [] } = {}) {
  const existing = new Set(tables);
  const renamed = [];
  const created = [];
  const inserts = [];
  return {
    renamed,
    created,
    inserts,
    schema: {
      hasTable: async (table) => existing.has(table),
      renameTable: async (from, to) => {
        existing.delete(from);
        existing.add(to);
        renamed.push({ from, to });
      },
      createTable: async (table, cb) => {
        const columns = [];
        cb(
          new Proxy(
            {},
            {
              get:
                (_, type) =>
                (column) =>
                  columns.push({ type, column }),
            },
          ),
        );
        existing.add(table);
        created.push({ table, columns });
      },
    },
    batchInsert: async (table, rows, batchSize) => {
      inserts.push({ table, rows, batchSize });
    },
  };
}

beforeEach(() => {
  jest.spyOn(logger, "info").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("archiveTableName appends a UTC timestamp", () => {
  expect(archiveTableName("google_all_symbols", new Date("2026-09-19T11:03:00.000Z"))).toBe(
    "google_all_symbols_20260919_110300",
  );
});

test("coerceRows maps empty numeric cells to null", () => {
  expect(
    coerceRows([{ date: "2026-02-03", ticker: "AES", analyst: "Jane", percent: "" }], schema),
  ).toEqual([{ date: "2026-02-03", ticker: "AES", analyst: "Jane", percent: null }]);
});

test("importTable archives an existing table then batch inserts JSON rows", async () => {
  const dir = mkdtempSync(join(tmpdir(), "imp-"));
  const file = join(dir, "rows.json");
  writeFileSync(
    file,
    JSON.stringify([
      { date: "2026-02-03", ticker: "AES", analyst: "Keefe, Bruyette & Woods", percent: 7.7 },
    ]),
  );
  const db = fakeDb({ tables: ["google_all_symbols"] });
  const at = new Date("2026-09-19T11:03:00.000Z");
  await importTable(db, { table: "google_all_symbols", file, schema, at });
  expect(db.renamed).toEqual([
    { from: "google_all_symbols", to: "google_all_symbols_20260919_110300" },
  ]);
  expect(db.created).toEqual([
    {
      table: "google_all_symbols",
      columns: [
        { type: "date", column: "date" },
        { type: "string", column: "ticker" },
        { type: "text", column: "analyst" },
        { type: "float", column: "percent" },
      ],
    },
  ]);
  expect(db.inserts).toEqual([
    {
      table: "google_all_symbols",
      rows: [
        {
          date: "2026-02-03",
          ticker: "AES",
          analyst: "Keefe, Bruyette & Woods",
          percent: 7.7,
        },
      ],
      batchSize: 1000,
    },
  ]);
});

test("importTable skips rename when the table does not exist", async () => {
  const dir = mkdtempSync(join(tmpdir(), "imp-"));
  const file = join(dir, "rows.csv");
  writeFileSync(file, "date,ticker,analyst,percent\n");
  const db = fakeDb();
  await importTable(db, { table: "yahoo_all_symbols", file, schema });
  expect(db.renamed).toEqual([]);
  expect(db.created[0].table).toBe("yahoo_all_symbols");
  expect(db.inserts).toEqual([]);
});

test("importTables imports each spec", async () => {
  const dir = mkdtempSync(join(tmpdir(), "imp-"));
  const google = join(dir, "google.json");
  const yahoo = join(dir, "yahoo.json");
  writeFileSync(google, JSON.stringify([{ date: "2026-02-03", ticker: "AES", percent: 1 }]));
  writeFileSync(yahoo, JSON.stringify([{ date: "2025-09-19", ticker: "PNC", percent: null }]));
  const db = fakeDb({ tables: ["google_all_symbols"] });
  await importTables(db, [
    { table: "google_all_symbols", file: google, schema, at: new Date("2026-09-19T11:03:00.000Z") },
    { table: "yahoo_all_symbols", file: yahoo, schema },
  ]);
  expect(db.renamed).toEqual([
    { from: "google_all_symbols", to: "google_all_symbols_20260919_110300" },
  ]);
  expect(db.inserts.map((insert) => insert.table)).toEqual([
    "google_all_symbols",
    "yahoo_all_symbols",
  ]);
});
