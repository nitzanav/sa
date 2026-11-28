const PAD = 24;
const R = 5;

const fmt = (n) => n.toFixed(1);

function linear(lo, hi, from, to) {
  return (v) => (hi === lo ? (from + to) / 2 : from + ((v - lo) / (hi - lo)) * (to - from));
}

// Returns p => [px, py] that fits every point inside the padded plot.
function scale(points, width, height) {
  const xs = points.map((p) => Date.parse(p.x));
  const ys = points.map((p) => p.y);
  const sx = linear(Math.min(...xs), Math.max(...xs), PAD, width - PAD);
  const sy = linear(Math.min(...ys), Math.max(...ys), height - PAD, PAD);
  return (p) => [sx(Date.parse(p.x)), sy(p.y)];
}

// Inner markup for <svg viewBox="0 0 width height">.
export function renderSvg({ close, buys, sells }, { width, height }) {
  if (close.length === 0) {
    return `<text class="empty" x="${width / 2}" y="${height / 2}" text-anchor="middle">No bars</text>`;
  }
  const at = scale([...close, ...buys, ...sells], width, height);
  const line = close.map((p) => at(p).map(fmt).join(",")).join(" ");
  const circles = (cls, points) =>
    points
      .map((p) => {
        const [cx, cy] = at(p).map(fmt);
        return `<circle class="${cls}" cx="${cx}" cy="${cy}" r="${R}"/>`;
      })
      .join("");
  return `<polyline class="close" points="${line}"/>${circles("buy", buys)}${circles("sell", sells)}`;
}
