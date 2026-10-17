import {
  H1,
  H2,
  Pill,
  Row,
  Stack,
  Stat,
  Text,
  useCanvasState,
  useHostTheme,
  useMemo,
  type CSSProperties,
} from "cursor/canvas";

const SOURCE =
  "Yahoo 7-day window · 2026-01-12 → 2026-10-16 · 193 trading days · $5,000 per lot. Holds 10/15/30 from VectorBT/simulation_2026-10-17_1332_UTC+3_optimize.md. Holds 45–120d use the same rules.";

const ANALYSTS = [2, 3, 4, 5, 6];
const UPSIDES = [20, 25, 30];
const HOLDS = [10, 15, 30, 45, 60, 75, 90, 105, 120];
const TARGETS = [25, 50];
const DROPS = [7.5, 10];

type Buy = { a: number; p: number; n: number; sym: number };
type Sell = { h: number; t: number; d: number };

const BUYS: Buy[] = [
  { a: 2, p: 20, n: 239, sym: 131 },
  { a: 2, p: 25, n: 145, sym: 85 },
  { a: 2, p: 30, n: 100, sym: 58 },
  { a: 3, p: 20, n: 165, sym: 92 },
  { a: 3, p: 25, n: 99, sym: 58 },
  { a: 3, p: 30, n: 72, sym: 43 },
  { a: 4, p: 20, n: 109, sym: 66 },
  { a: 4, p: 25, n: 68, sym: 44 },
  { a: 4, p: 30, n: 44, sym: 28 },
  { a: 5, p: 20, n: 68, sym: 42 },
  { a: 5, p: 25, n: 45, sym: 28 },
  { a: 5, p: 30, n: 30, sym: 20 },
  { a: 6, p: 20, n: 47, sym: 30 },
  { a: 6, p: 25, n: 35, sym: 23 },
  { a: 6, p: 30, n: 26, sym: 18 },
];

const SELLS: Sell[] = [
  { h: 10, t: 25, d: 7.5 },
  { h: 10, t: 25, d: 10 },
  { h: 10, t: 50, d: 7.5 },
  { h: 10, t: 50, d: 10 },
  { h: 15, t: 25, d: 7.5 },
  { h: 15, t: 25, d: 10 },
  { h: 15, t: 50, d: 7.5 },
  { h: 15, t: 50, d: 10 },
  { h: 30, t: 25, d: 7.5 },
  { h: 30, t: 25, d: 10 },
  { h: 30, t: 50, d: 7.5 },
  { h: 30, t: 50, d: 10 },
  { h: 45, t: 25, d: 7.5 },
  { h: 45, t: 25, d: 10 },
  { h: 45, t: 50, d: 7.5 },
  { h: 45, t: 50, d: 10 },
  { h: 60, t: 25, d: 7.5 },
  { h: 60, t: 25, d: 10 },
  { h: 60, t: 50, d: 7.5 },
  { h: 60, t: 50, d: 10 },
  { h: 75, t: 25, d: 7.5 },
  { h: 75, t: 25, d: 10 },
  { h: 75, t: 50, d: 7.5 },
  { h: 75, t: 50, d: 10 },
  { h: 90, t: 25, d: 7.5 },
  { h: 90, t: 25, d: 10 },
  { h: 90, t: 50, d: 7.5 },
  { h: 90, t: 50, d: 10 },
  { h: 105, t: 25, d: 7.5 },
  { h: 105, t: 25, d: 10 },
  { h: 105, t: 50, d: 7.5 },
  { h: 105, t: 50, d: 10 },
  { h: 120, t: 25, d: 7.5 },
  { h: 120, t: 25, d: 10 },
  { h: 120, t: 50, d: 7.5 },
  { h: 120, t: 50, d: 10 },
];

const ROI: number[][] = [
  [63.0, 60.9, 43.2, 38.5, 55.7, 50.9, 37.4, 30.2, 42.8, 32.6, 22.9, 12.8, 41.9, 32.1, 19.3, 9.6, 41.6, 32.5, 19.1, 9.7, 41.6, 32.4, 19.1, 9.7, 41.6, 32.4, 19.1, 9.7, 41.6, 32.4, 19.1, 9.7, 41.6, 32.4, 19.1, 9.7],
  [78.7, 75.5, 55.6, 48.4, 70.7, 65.0, 52.2, 42.1, 54.8, 43.1, 34.9, 22.6, 53.8, 42.5, 30.7, 20.2, 53.3, 42.5, 30.5, 20.0, 53.3, 42.4, 30.5, 19.9, 53.3, 42.4, 30.5, 19.9, 53.3, 42.4, 30.5, 19.9, 53.3, 42.4, 30.5, 19.9],
  [97.2, 91.1, 69.8, 65.0, 88.8, 78.5, 59.0, 50.0, 71.5, 51.6, 40.9, 25.8, 67.3, 47.1, 37.5, 24.1, 67.3, 47.1, 38.7, 25.1, 67.3, 47.1, 38.7, 25.1, 67.3, 47.1, 38.7, 25.1, 67.3, 47.1, 38.7, 25.1, 67.3, 47.1, 38.7, 25.1],
  [69.7, 68.8, 53.1, 48.2, 55.7, 51.9, 40.5, 31.2, 42.8, 36.3, 26.5, 17.8, 41.9, 35.0, 25.3, 16.7, 41.9, 35.0, 25.5, 17.1, 41.9, 35.0, 25.5, 17.1, 41.9, 35.0, 25.5, 17.1, 41.9, 35.0, 25.5, 17.1, 41.9, 35.0, 25.5, 17.1],
  [86.2, 86.1, 67.7, 61.8, 71.1, 67.9, 57.0, 45.7, 57.5, 50.1, 40.9, 30.6, 55.8, 47.8, 37.9, 28.9, 55.8, 47.8, 38.0, 29.1, 55.8, 47.8, 38.0, 29.1, 55.8, 47.8, 38.0, 29.1, 55.8, 47.8, 38.0, 29.1, 55.8, 47.8, 38.0, 29.1],
  [97.8, 90.5, 70.5, 62.7, 83.3, 72.5, 53.9, 40.3, 69.6, 53.3, 37.7, 24.2, 65.1, 47.3, 34.5, 22.1, 65.1, 47.3, 35.4, 22.8, 65.1, 47.3, 35.4, 22.8, 65.1, 47.3, 35.4, 22.8, 65.1, 47.3, 35.4, 22.8, 65.1, 47.3, 35.4, 22.8],
  [58.3, 58.7, 40.3, 36.4, 48.9, 46.2, 33.2, 24.7, 39.9, 35.8, 25.5, 20.4, 40.5, 35.9, 24.9, 19.9, 40.5, 35.9, 25.1, 20.2, 40.5, 35.9, 25.1, 20.2, 40.5, 35.9, 25.1, 20.2, 40.5, 35.9, 25.1, 20.2, 40.5, 35.9, 25.1, 20.2],
  [78.7, 80.7, 50.9, 45.5, 71.9, 69.9, 51.1, 38.7, 62.4, 56.3, 41.6, 34.0, 60.4, 54.1, 37.4, 31.8, 60.4, 54.1, 37.4, 31.9, 60.4, 54.1, 37.4, 31.9, 60.4, 54.1, 37.4, 31.9, 60.4, 54.1, 37.4, 31.9, 60.4, 54.1, 37.4, 31.9],
  [89.2, 80.3, 59.8, 50.7, 84.8, 73.7, 53.6, 38.0, 78.1, 62.7, 45.1, 35.4, 73.3, 56.9, 39.1, 31.6, 73.3, 56.9, 39.8, 32.1, 73.3, 56.9, 39.8, 32.1, 73.3, 56.9, 39.8, 32.1, 73.3, 56.9, 39.8, 32.1, 73.3, 56.9, 39.8, 32.1],
  [51.1, 53.1, 32.1, 30.0, 44.2, 46.2, 36.3, 32.4, 37.0, 37.8, 33.3, 32.8, 38.5, 39.5, 34.6, 35.1, 38.5, 39.5, 34.6, 35.2, 38.5, 39.5, 34.6, 35.2, 38.5, 39.5, 34.6, 35.2, 38.5, 39.5, 34.6, 35.2, 38.5, 39.5, 34.6, 35.2],
  [73.4, 78.4, 44.9, 43.3, 69.4, 74.1, 56.1, 51.4, 59.4, 59.2, 47.4, 46.4, 58.0, 58.8, 43.3, 45.6, 58.0, 58.8, 43.2, 45.4, 58.0, 58.8, 43.2, 45.4, 58.0, 58.8, 43.2, 45.4, 58.0, 58.8, 43.2, 45.4, 58.0, 58.8, 43.2, 45.4],
  [87.5, 83.0, 51.6, 45.2, 80.2, 78.0, 55.0, 49.0, 71.8, 64.3, 47.4, 47.5, 65.0, 59.6, 43.1, 47.7, 65.0, 59.6, 44.1, 48.4, 65.0, 59.6, 44.1, 48.4, 65.0, 59.6, 44.1, 48.4, 65.0, 59.6, 44.1, 48.4, 65.0, 59.6, 44.1, 48.4],
  [80.6, 79.6, 54.7, 52.3, 60.5, 61.1, 48.6, 45.8, 51.6, 49.6, 46.5, 45.8, 51.2, 48.0, 46.6, 46.7, 51.2, 48.0, 46.4, 46.5, 51.2, 48.0, 46.4, 46.5, 51.2, 48.0, 46.4, 46.5, 51.2, 48.0, 46.4, 46.5, 51.2, 48.0, 46.4, 46.5],
  [88.5, 87.2, 56.2, 52.9, 73.3, 75.2, 54.6, 52.3, 60.0, 56.8, 48.2, 48.2, 58.3, 54.6, 46.3, 48.3, 58.3, 54.6, 46.0, 48.0, 58.3, 54.6, 46.0, 48.0, 58.3, 54.6, 46.0, 48.0, 58.3, 54.6, 46.0, 48.0, 58.3, 54.6, 46.0, 48.0],
  [113.1, 110.8, 68.9, 64.1, 88.6, 91.0, 52.6, 50.6, 78.3, 71.9, 44.5, 48.4, 70.4, 66.2, 40.0, 48.6, 70.4, 66.2, 41.1, 49.3, 70.4, 66.2, 41.1, 49.3, 70.4, 66.2, 41.1, 49.3, 70.4, 66.2, 41.1, 49.3, 70.4, 66.2, 41.1, 49.3],
];

const PNL: number[][] = [
  [30432, 30993, 23604, 22404, 33218, 33346, 26451, 23613, 30877, 28070, 21598, 14431, 31939, 29493, 19681, 12018, 31762, 30003, 19749, 12353, 31762, 29951, 19749, 12301, 31762, 29951, 19749, 12301, 31762, 29951, 19749, 12301, 31762, 29951, 19749, 12301],
  [24190, 24418, 18728, 17404, 26659, 27099, 22608, 20373, 24770, 24073, 19821, 15679, 26021, 25676, 18897, 15515, 25844, 25843, 19176, 15682, 25844, 25790, 19176, 15629, 25844, 25790, 19176, 15629, 25844, 25790, 19176, 15629, 25844, 25790, 19176, 15629],
  [21113, 20940, 16633, 16427, 22949, 22911, 18036, 17104, 20907, 19606, 15842, 12555, 19949, 18716, 15451, 12749, 19949, 18716, 16036, 13335, 19949, 18716, 16036, 13335, 19949, 18716, 16036, 13335, 19949, 18716, 16036, 13335, 19949, 18716, 16036, 13335],
  [23597, 24276, 20166, 19276, 22812, 23329, 19499, 16600, 20832, 21464, 16518, 13474, 21421, 21983, 16886, 13924, 21421, 21983, 17175, 14413, 21421, 21983, 17175, 14413, 21421, 21983, 17175, 14413, 21421, 21983, 17175, 14413, 21421, 21983, 17175, 14413],
  [18438, 19114, 15875, 15285, 18082, 19147, 16760, 15080, 16854, 18767, 15130, 14362, 17395, 19329, 15169, 15005, 17395, 19329, 15458, 15294, 17395, 19329, 15458, 15294, 17395, 19329, 15458, 15294, 17395, 19329, 15458, 15294, 17395, 19329, 15458, 15294],
  [15384, 14764, 12181, 11232, 15196, 14878, 11627, 9673, 13904, 14184, 9984, 8232, 13166, 13182, 9661, 8164, 13166, 13182, 9941, 8444, 13166, 13182, 9941, 8444, 13166, 13182, 9941, 8444, 13166, 13182, 9941, 8444, 13166, 13182, 9941, 8444],
  [13430, 14041, 10178, 9674, 13734, 14258, 10642, 8794, 13469, 14745, 10711, 10404, 14439, 15764, 11309, 11359, 14439, 15764, 11517, 11666, 14439, 15764, 11517, 11666, 14439, 15764, 11517, 11666, 14439, 15764, 11517, 11666, 14439, 15764, 11517, 11666],
  [11302, 12007, 8058, 7646, 12354, 13300, 10118, 8693, 12454, 14386, 10400, 10892, 12951, 15023, 10205, 11420, 12951, 15023, 10412, 11627, 12951, 15023, 10412, 11627, 12951, 15023, 10412, 11627, 12951, 15023, 10412, 11627, 12951, 15023, 10412, 11627],
  [8433, 7842, 6208, 5438, 9250, 9112, 6841, 5439, 9304, 10140, 6885, 7101, 8872, 9622, 6269, 6917, 8872, 9622, 6399, 7047, 8872, 9622, 6399, 7047, 8872, 9622, 6399, 7047, 8872, 9622, 6399, 7047, 8872, 9622, 6399, 7047],
  [7513, 7999, 5145, 4979, 8027, 9154, 7427, 7251, 8234, 10437, 9020, 10881, 9157, 11772, 10185, 13072, 9157, 11772, 10392, 13280, 9157, 11772, 10392, 13280, 9157, 11772, 10392, 13280, 9157, 11772, 10392, 13280, 9157, 11772, 10392, 13280],
  [7287, 7920, 4831, 4812, 8401, 9792, 7589, 7677, 8356, 10916, 8118, 10335, 8806, 11867, 8079, 11515, 8806, 11867, 8287, 11722, 8806, 11867, 8287, 11722, 8806, 11867, 8287, 11722, 8806, 11867, 8287, 11722, 8806, 11867, 8287, 11722],
  [5623, 5399, 3621, 3219, 6025, 6568, 4748, 4695, 5824, 7400, 4871, 6718, 5391, 7244, 4682, 7457, 5391, 7244, 4813, 7588, 5391, 7244, 4813, 7588, 5391, 7244, 4813, 7588, 5391, 7244, 4813, 7588, 5391, 7244, 4813, 7588],
  [8329, 8294, 6119, 5905, 7653, 8296, 6891, 6938, 8108, 9674, 8592, 10428, 8748, 10313, 9418, 11906, 8748, 10313, 9625, 12113, 8748, 10313, 9625, 12113, 8748, 10313, 9625, 12113, 8748, 10313, 9625, 12113, 8748, 10313, 9625, 12113],
  [6855, 6820, 4699, 4485, 6948, 7790, 5768, 6013, 6845, 8609, 6498, 8533, 7295, 9149, 6865, 9643, 7295, 9149, 7072, 9850, 7295, 9149, 7072, 9850, 7295, 9149, 7072, 9850, 7295, 9149, 7072, 9850, 7295, 9149, 7072, 9850],
  [6181, 6114, 4179, 3934, 5739, 6599, 3980, 4244, 5538, 7431, 4103, 6267, 5106, 7275, 3914, 7006, 5106, 7275, 4045, 7137, 5106, 7275, 4045, 7137, 5106, 7275, 4045, 7137, 5106, 7275, 4045, 7137, 5106, 7275, 4045, 7137],
];

function buyLabel(buy: Buy): string {
  return `>${buy.a},>${buy.p}%`;
}

function sellLabel(sell: Sell): string {
  return `${sell.h}d ${sell.t}% ${sell.d}dd`;
}

function money(n: number): string {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
}

function pct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function parseHex(value: string): { r: number; g: number; b: number } | null {
  const raw = value.trim().replace("#", "");
  const hex = raw.length === 8 || raw.length === 4 ? raw.slice(0, raw.length === 8 ? 6 : 3) : raw;
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  if (full.length !== 6 || Number.isNaN(parseInt(full, 16))) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function parseColor(value: string): { r: number; g: number; b: number } | null {
  const hex = parseHex(value);
  if (hex) return hex;
  const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (!match) return null;
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
}

function mix(a: string, b: string, t: number, fallback: string): string {
  const pa = parseColor(a);
  const pb = parseColor(b);
  if (!pa || !pb) return fallback;
  const clamp = Math.min(1, Math.max(0, t));
  const r = Math.round(pa.r + (pb.r - pa.r) * clamp);
  const g = Math.round(pa.g + (pb.g - pa.g) * clamp);
  const bl = Math.round(pa.b + (pb.b - pa.b) * clamp);
  return `rgb(${r}, ${g}, ${bl})`;
}

function heat(t: number, yellow: string, orange: string, red: string, fallback: string): string {
  const clamp = Math.min(1, Math.max(0, t));
  return clamp < 0.5
    ? mix(yellow, orange, clamp * 2, fallback)
    : mix(orange, red, (clamp - 0.5) * 2, fallback);
}

function channel(c: number): number {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb: { r: number; g: number; b: number }): number {
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function readable(bg: string, primary: string, editor: string): string {
  const b = parseColor(bg);
  const p = parseColor(primary);
  const e = parseColor(editor);
  if (!b || !p || !e) return primary;
  const score = (ink: { r: number; g: number; b: number }) => {
    const lighter = Math.max(luminance(b), luminance(ink));
    const darker = Math.min(luminance(b), luminance(ink));
    return (lighter + 0.05) / (darker + 0.05);
  };
  return score(p) >= score(e) ? primary : editor;
}

function span(values: number[]): { min: number; max: number } {
  let min = values[0];
  let max = values[0];
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max };
}

function unit(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

const STAT_NAMES = ["min", "avg", "max"] as const;
type StatName = (typeof STAT_NAMES)[number];
type Stats = Record<StatName, number>;
const METRICS = ["pct", "pnl"] as const;
type Metric = (typeof METRICS)[number];

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function pack(values: number[]): Stats {
  return { min: Math.min(...values), avg: mean(values), max: Math.max(...values) };
}

function cornerOf(perRow: Stats[]): Record<StatName, Stats> {
  const out = {} as Record<StatName, Stats>;
  for (const rowStat of STAT_NAMES) {
    const row = {} as Stats;
    for (const colStat of STAT_NAMES) {
      row[colStat] = pack(perRow.map((item) => item[colStat]))[rowStat];
    }
    out[rowStat] = row;
  }
  return out;
}

function statLabel(name: StatName): string {
  if (name === "min") return "Min";
  if (name === "avg") return "Avg";
  return "Max";
}

function toggleItem<T extends string | number>(current: T[], value: T, all: readonly T[]): T[] {
  const has = current.includes(value);
  if (has && current.length === 1) return current;
  const next = has ? current.filter((item) => item !== value) : [...current, value];
  return all.filter((item) => next.includes(item));
}

function FilterGroup<T extends string | number>({
  label,
  options,
  selected,
  onChange,
  format,
}: {
  label: string;
  options: readonly T[];
  selected: T[];
  onChange: (next: T[]) => void;
  format: (value: T) => string;
}) {
  return (
    <Row gap={6} align="center" wrap>
      <Text size="small" tone="secondary" weight="semibold">
        {label}
      </Text>
      {options.map((option) => (
        <Pill
          key={String(option)}
          size="sm"
          active={selected.includes(option)}
          onClick={() => onChange(toggleItem(selected, option, options))}
        >
          {format(option)}
        </Pill>
      ))}
    </Row>
  );
}

function Scale({
  label,
  range,
  format,
  yellow,
  orange,
  red,
  fallback,
}: {
  label: string;
  range: { min: number; max: number };
  format: (n: number) => string;
  yellow: string;
  orange: string;
  red: string;
  fallback: string;
}) {
  const steps = [0, 0.25, 0.5, 0.75, 1];
  return (
    <Row gap={8} align="center" wrap>
      <Text size="small" tone="secondary" weight="semibold">
        {label}
      </Text>
      <Text size="small" tone="tertiary">
        {format(range.min)}
      </Text>
      {steps.map((step) => (
        <div
          key={step}
          style={{
            width: 28,
            height: 14,
            background: heat(step, yellow, orange, red, fallback),
          }}
        />
      ))}
      <Text size="small" tone="tertiary">
        {format(range.max)}
      </Text>
    </Row>
  );
}

export default function CoarseGridCanvas() {
  const theme = useHostTheme();
  const [analysts, setAnalysts] = useCanvasState<number[]>("analysts", ANALYSTS);
  const [upsides, setUpsides] = useCanvasState<number[]>("upsides", UPSIDES);
  const [holds, setHolds] = useCanvasState<number[]>("holds-long", HOLDS);
  const [targets, setTargets] = useCanvasState<number[]>("targets", TARGETS);
  const [drops, setDrops] = useCanvasState<number[]>("drops", DROPS);
  const [metrics, setMetrics] = useCanvasState<Metric[]>("metrics", ["pct", "pnl"]);

  const view = useMemo(() => {
    const buys = BUYS.map((buy, row) => ({ buy, row })).filter(
      ({ buy }) => analysts.includes(buy.a) && upsides.includes(buy.p),
    );
    const sells = SELLS.map((sell, col) => ({ sell, col })).filter(
      ({ sell }) => holds.includes(sell.h) && targets.includes(sell.t) && drops.includes(sell.d),
    );
    const rowRoi = buys.map(({ row }) => pack(sells.map(({ col }) => ROI[row][col])));
    const rowPnl = buys.map(({ row }) => pack(sells.map(({ col }) => PNL[row][col])));
    const colRoi = sells.map(({ col }) => pack(buys.map(({ row }) => ROI[row][col])));
    const colPnl = sells.map(({ col }) => pack(buys.map(({ row }) => PNL[row][col])));
    return {
      buys,
      sells,
      rowRoi,
      rowPnl,
      colRoi,
      colPnl,
      cornerRoi: cornerOf(rowRoi),
      cornerPnl: cornerOf(rowPnl),
    };
  }, [analysts, upsides, holds, targets, drops]);

  const roiRange = span(ROI.flat());
  const pnlRange = span(PNL.flat());
  const showPct = metrics.includes("pct");
  const showPnl = metrics.includes("pnl");

  const cells = view.buys.flatMap(({ buy, row }) =>
    view.sells.map(({ sell, col }) => ({
      label: `${buyLabel(buy)} · ${sellLabel(sell)}`,
      roi: ROI[row][col],
      pnl: PNL[row][col],
      n: buy.n,
    })),
  );
  const topScore = cells.reduce((best, cell) => (cell.roi > best.roi ? cell : best));
  const topCash = cells.reduce((best, cell) => (cell.pnl > best.pnl ? cell : best));

  const yellow = theme.category.yellow;
  const orange = theme.category.orange;
  const red = theme.category.red;
  const fallback = theme.fill.tertiary;
  const paint = (
    key: string,
    value: number,
    range: { min: number; max: number },
    text: string,
    title: string,
    edge = false,
  ) => {
    const background = heat(unit(value, range.min, range.max), yellow, orange, red, fallback);
    return (
      <td
        key={key}
        title={title}
        style={{
          background,
          color: readable(background, theme.text.primary, theme.bg.editor),
          textAlign: "right",
          padding: "6px 7px",
          fontSize: 12,
          lineHeight: "16px",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          borderLeft: edge ? `1px solid ${theme.stroke.secondary}` : undefined,
        }}
      >
        {text}
      </td>
    );
  };

  const labelCell = (text: string, sticky: boolean, strong: boolean) => (
    <td
      style={{
        position: sticky ? "sticky" : undefined,
        left: sticky ? 0 : undefined,
        zIndex: sticky ? 1 : undefined,
        background: theme.bg.editor,
        padding: "6px 8px",
        whiteSpace: "nowrap",
        borderTop: strong ? `1px solid ${theme.stroke.secondary}` : undefined,
        borderLeft: strong && !sticky ? `1px solid ${theme.stroke.secondary}` : undefined,
      }}
    >
      <Text size="small" weight={strong ? "semibold" : "medium"}>
        {text}
      </Text>
    </td>
  );

  const countCell = (value: string, strong: boolean) => (
    <td
      style={{
        textAlign: "right",
        padding: "6px 8px",
        whiteSpace: "nowrap",
        borderTop: strong ? `1px solid ${theme.stroke.secondary}` : undefined,
      }}
    >
      <Text size="small" tone={strong ? "primary" : "secondary"} weight={strong ? "semibold" : "normal"}>
        {value}
      </Text>
    </td>
  );

  const head: CSSProperties = {
    textAlign: "center",
    padding: "4px 6px",
    fontSize: 12,
    lineHeight: "16px",
    fontWeight: 590,
    color: theme.text.secondary,
    whiteSpace: "nowrap",
    background: theme.bg.editor,
  };
  const both = showPct && showPnl;
  const pair = (key: string, roi: number, pnl: number, title: string, edge = false) => {
    const out = [];
    if (showPct) out.push(paint(`${key}-pct`, roi, roiRange, pct(roi), `${title} · return`, edge));
    if (showPnl) out.push(paint(`${key}-pnl`, pnl, pnlRange, money(pnl), `${title} · profit`, edge && !showPct));
    return out;
  };

  return (
    <Stack gap={20}>
      <Stack gap={6}>
        <H1>7-day coarse grid</H1>
        <Text size="small" tone="secondary">
          {SOURCE}
        </Text>
      </Stack>

      <Row gap={16} wrap>
        {showPct ? (
          <Stat value={pct(topScore.roi)} label={`Best return · ${topScore.label}`} tone="success" />
        ) : null}
        {showPnl ? <Stat value={money(topCash.pnl)} label={`Most cash · ${topCash.label}`} /> : null}
        <Stat value={String(cells.length)} label="Combinations shown" />
      </Row>

      <Stack gap={8}>
        <FilterGroup
          label="Show"
          options={METRICS}
          selected={metrics}
          onChange={setMetrics}
          format={(value) => (value === "pct" ? "%" : "$")}
        />
        <FilterGroup
          label="Analysts"
          options={ANALYSTS}
          selected={analysts}
          onChange={setAnalysts}
          format={(value) => `>${value}`}
        />
        <FilterGroup
          label="Upside"
          options={UPSIDES}
          selected={upsides}
          onChange={setUpsides}
          format={(value) => `>${value}%`}
        />
        <FilterGroup
          label="Hold"
          options={HOLDS}
          selected={holds}
          onChange={setHolds}
          format={(value) => `${value}d`}
        />
        <FilterGroup
          label="Target"
          options={TARGETS}
          selected={targets}
          onChange={setTargets}
          format={(value) => `${value}%`}
        />
        <FilterGroup
          label="Drop"
          options={DROPS}
          selected={drops}
          onChange={setDrops}
          format={(value) => `${value}dd`}
        />
      </Stack>

      <Stack gap={8}>
        <H2>Buy × sell</H2>
        <Text size="small" tone="secondary">
          Yellow is the smaller number and red is the larger one, on a scale fixed to the full
          grid. The three columns are the min, average, and max of that buy across the sells in
          view. The three rows do the same for each sell across the buys in view. Symbols are
          unique tickers in that buy. Positions are the signals, one lot each.
        </Text>
        {showPct ? (
          <Scale label="Return" range={roiRange} format={pct} yellow={yellow} orange={orange} red={red} fallback={fallback} />
        ) : null}
        {showPnl ? (
          <Scale label="Profit" range={pnlRange} format={money} yellow={yellow} orange={orange} red={red} fallback={fallback} />
        ) : null}
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "separate", borderSpacing: 2 }}>
            <thead>
              <tr>
                <th
                  rowSpan={both ? 2 : 1}
                  style={{ ...head, textAlign: "left", position: "sticky", left: 0, zIndex: 2 }}
                >
                  Buy
                </th>
                <th rowSpan={both ? 2 : 1} style={{ ...head, textAlign: "right" }}>
                  Symbols
                </th>
                <th rowSpan={both ? 2 : 1} style={{ ...head, textAlign: "right" }}>
                  Positions
                </th>
                {view.sells.map(({ sell }) => (
                  <th key={sellLabel(sell)} colSpan={both ? 2 : 1} style={head}>
                    {sellLabel(sell)}
                  </th>
                ))}
                {STAT_NAMES.map((name, index) => (
                  <th
                    key={name}
                    colSpan={both ? 2 : 1}
                    style={{
                      ...head,
                      borderLeft: index === 0 ? `1px solid ${theme.stroke.secondary}` : undefined,
                    }}
                  >
                    {statLabel(name)}
                  </th>
                ))}
              </tr>
              {both ? (
                <tr>
                  {view.sells.flatMap(({ sell }) => {
                    const name = sellLabel(sell);
                    return [
                      <th key={`${name}-pct`} style={head}>
                        %
                      </th>,
                      <th key={`${name}-pnl`} style={head}>
                        $
                      </th>,
                    ];
                  })}
                  {STAT_NAMES.flatMap((name, index) => [
                    <th
                      key={`${name}-pct`}
                      style={{
                        ...head,
                        borderLeft: index === 0 ? `1px solid ${theme.stroke.secondary}` : undefined,
                      }}
                    >
                      %
                    </th>,
                    <th key={`${name}-pnl`} style={head}>
                      $
                    </th>,
                  ])}
                </tr>
              ) : null}
            </thead>
            <tbody>
              {view.buys.map(({ buy, row }, index) => (
                <tr key={buyLabel(buy)}>
                  {labelCell(buy.n < 30 ? `${buyLabel(buy)} · thin` : buyLabel(buy), true, false)}
                  {countCell(String(buy.sym), false)}
                  {countCell(String(buy.n), false)}
                  {view.sells.flatMap(({ sell, col }) => {
                    const name = `${buyLabel(buy)} · ${sellLabel(sell)}`;
                    return pair(name, ROI[row][col], PNL[row][col], name);
                  })}
                  {STAT_NAMES.flatMap((name, statIndex) =>
                    pair(
                      `${buyLabel(buy)}-${name}`,
                      view.rowRoi[index][name],
                      view.rowPnl[index][name],
                      `${buyLabel(buy)} · ${statLabel(name)} across sells`,
                      statIndex === 0,
                    ),
                  )}
                </tr>
              ))}
              {STAT_NAMES.map((rowStat, rowIndex) => (
                <tr key={rowStat}>
                  {labelCell(statLabel(rowStat), true, rowIndex === 0)}
                  {countCell("—", rowIndex === 0)}
                  {countCell("—", rowIndex === 0)}
                  {view.sells.flatMap(({ sell }, index) => {
                    const name = sellLabel(sell);
                    return pair(
                      `${rowStat}-${name}`,
                      view.colRoi[index][rowStat],
                      view.colPnl[index][rowStat],
                      `${name} · ${statLabel(rowStat)} across buys`,
                    );
                  })}
                  {STAT_NAMES.flatMap((colStat, statIndex) =>
                    pair(
                      `${rowStat}-${colStat}`,
                      view.cornerRoi[rowStat][colStat],
                      view.cornerPnl[rowStat][colStat],
                      `${statLabel(rowStat)} of each buy's ${statLabel(colStat).toLowerCase()}`,
                      statIndex === 0,
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Stack>
    </Stack>
  );
}
