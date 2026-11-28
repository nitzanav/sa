// Chart points from the rows a source returns. x is a YYYY-MM-DD string.
export function buildSeries({ bars, positions, signals }) {
  return {
    close: bars.map((b) => ({ x: b.bar_date, y: b.close })),
    buys: positions.map((p) => ({ x: p.buy_date, y: p.price })),
    sells: positions
      .filter((p) => p.sell_date != null)
      .map((p) => ({ x: p.sell_date, y: p.sell_price })),
    targets: signals.map((s) => ({
      x: s.date, y: s.projected_price, source: s.source, analyst: s.analyst,
    })),
  };
}
