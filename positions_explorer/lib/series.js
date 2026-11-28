// Chart points from the rows a source returns. x is a YYYY-MM-DD string.
export function buildSeries({ bars }) {
  return { close: bars.map((b) => ({ x: b.bar_date, y: b.close })) };
}
