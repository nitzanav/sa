import { readFileSync } from "node:fs";

export function parseCsv(text) {
  const [header, ...rows] = text.trim().split("\n");
  const columns = header.split(",").map((column) => column.trim());
  return rows.map((row) =>
    Object.fromEntries(row.split(",").map((cell, index) => [columns[index], cell.trim()])),
  );
}

export const readCsv = (fileName) => parseCsv(readFileSync(fileName, "utf8"));

export function formatCsvCell(value) {
  const text = value == null ? "" : String(value);
  return /["\n\r,]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function formatCsv(columns, rows) {
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => formatCsvCell(row[column])).join(",")),
  ].join("\n");
}
