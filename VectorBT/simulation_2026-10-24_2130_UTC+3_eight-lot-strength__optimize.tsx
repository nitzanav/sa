import {
  Grid,
  H1,
  H2,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  useCanvasState,
  useHostTheme,
  useMemo,
  type CSSProperties,
} from "cursor/canvas";

const SOURCE = "yahoo-daily \u00b7 tipranks-daily \u00b7 google-daily \u00b7 all_sources-daily \u00b7 yahoo_and_google-daily \u00b7 2026-01-06 \u2192 2026-10-22 \u00b7 201 trading days \u00b7 $5,000 per lot. Days exposed are calendar days with at least one lot open. Lot-days add each lot's calendar hold, so overlapping lots count again.";
const TITLE = "Eight-lot book";

const SIGNALS = ["yahoo-daily", "tipranks-daily", "google-daily", "all_sources-daily", "yahoo_and_google-daily"];
const ANALYSTS = [2, 3, 4];
const UPSIDES = [20, 30, 40, 50];
const HOLDS = [8];
const TARGETS = [0];
const DROPS = [0];
const PROTECTS = [0];
const SELL_MODE = "slots";

type Buy = { s: string; a: number; p: number; n: number; sym: number };
type Sell = { h: number; t: number; d: number; p: number };

const BUYS: Buy[] = [{"s":"yahoo-daily","a":2,"p":20,"n":46,"sym":45},{"s":"tipranks-daily","a":2,"p":20,"n":133,"sym":110},{"s":"google-daily","a":2,"p":20,"n":192,"sym":137},{"s":"all_sources-daily","a":2,"p":20,"n":193,"sym":141},{"s":"yahoo_and_google-daily","a":2,"p":20,"n":274,"sym":171},{"s":"yahoo-daily","a":2,"p":30,"n":19,"sym":19},{"s":"tipranks-daily","a":2,"p":30,"n":57,"sym":51},{"s":"google-daily","a":2,"p":30,"n":113,"sym":80},{"s":"all_sources-daily","a":2,"p":30,"n":84,"sym":63},{"s":"yahoo_and_google-daily","a":2,"p":30,"n":138,"sym":88},{"s":"yahoo-daily","a":2,"p":40,"n":7,"sym":7},{"s":"tipranks-daily","a":2,"p":40,"n":27,"sym":25},{"s":"google-daily","a":2,"p":40,"n":70,"sym":49},{"s":"all_sources-daily","a":2,"p":40,"n":37,"sym":30},{"s":"yahoo_and_google-daily","a":2,"p":40,"n":83,"sym":52},{"s":"yahoo-daily","a":2,"p":50,"n":4,"sym":4},{"s":"tipranks-daily","a":2,"p":50,"n":9,"sym":9},{"s":"google-daily","a":2,"p":50,"n":38,"sym":27},{"s":"all_sources-daily","a":2,"p":50,"n":16,"sym":14},{"s":"yahoo_and_google-daily","a":2,"p":50,"n":46,"sym":32},{"s":"yahoo-daily","a":3,"p":20,"n":22,"sym":22},{"s":"tipranks-daily","a":3,"p":20,"n":75,"sym":69},{"s":"google-daily","a":3,"p":20,"n":98,"sym":84},{"s":"all_sources-daily","a":3,"p":20,"n":102,"sym":88},{"s":"yahoo_and_google-daily","a":3,"p":20,"n":138,"sym":109},{"s":"yahoo-daily","a":3,"p":30,"n":12,"sym":12},{"s":"tipranks-daily","a":3,"p":30,"n":29,"sym":28},{"s":"google-daily","a":3,"p":30,"n":56,"sym":47},{"s":"all_sources-daily","a":3,"p":30,"n":45,"sym":40},{"s":"yahoo_and_google-daily","a":3,"p":30,"n":68,"sym":55},{"s":"yahoo-daily","a":3,"p":40,"n":4,"sym":4},{"s":"tipranks-daily","a":3,"p":40,"n":15,"sym":15},{"s":"google-daily","a":3,"p":40,"n":37,"sym":30},{"s":"all_sources-daily","a":3,"p":40,"n":20,"sym":19},{"s":"yahoo_and_google-daily","a":3,"p":40,"n":45,"sym":36},{"s":"yahoo-daily","a":3,"p":50,"n":2,"sym":2},{"s":"tipranks-daily","a":3,"p":50,"n":3,"sym":3},{"s":"google-daily","a":3,"p":50,"n":21,"sym":18},{"s":"all_sources-daily","a":3,"p":50,"n":8,"sym":8},{"s":"yahoo_and_google-daily","a":3,"p":50,"n":25,"sym":21},{"s":"yahoo-daily","a":4,"p":20,"n":8,"sym":8},{"s":"tipranks-daily","a":4,"p":20,"n":51,"sym":50},{"s":"google-daily","a":4,"p":20,"n":63,"sym":58},{"s":"all_sources-daily","a":4,"p":20,"n":66,"sym":60},{"s":"yahoo_and_google-daily","a":4,"p":20,"n":90,"sym":76},{"s":"yahoo-daily","a":4,"p":30,"n":5,"sym":5},{"s":"tipranks-daily","a":4,"p":30,"n":21,"sym":20},{"s":"google-daily","a":4,"p":30,"n":39,"sym":36},{"s":"all_sources-daily","a":4,"p":30,"n":29,"sym":25},{"s":"yahoo_and_google-daily","a":4,"p":30,"n":48,"sym":40},{"s":"yahoo-daily","a":4,"p":40,"n":1,"sym":1},{"s":"tipranks-daily","a":4,"p":40,"n":11,"sym":11},{"s":"google-daily","a":4,"p":40,"n":26,"sym":24},{"s":"all_sources-daily","a":4,"p":40,"n":10,"sym":10},{"s":"yahoo_and_google-daily","a":4,"p":40,"n":31,"sym":27},{"s":"yahoo-daily","a":4,"p":50,"n":1,"sym":1},{"s":"tipranks-daily","a":4,"p":50,"n":1,"sym":1},{"s":"google-daily","a":4,"p":50,"n":16,"sym":15},{"s":"all_sources-daily","a":4,"p":50,"n":3,"sym":3},{"s":"yahoo_and_google-daily","a":4,"p":50,"n":18,"sym":17}];
const SELLS: Sell[] = [{"h":8,"t":0,"d":0,"p":0}];
const ROI: number[][] = [[12.7861],[-3.006],[-36.1625],[11.8103],[-38.7096],[15.0819],[17.482],[-50.4205],[19.0457],[-47.8346],[-11.9266],[-18.9383],[-45.1229],[0.3112],[-55.5076],[31.0901],[-49.0378],[-74.4514],[6.2536],[-67.6664],[-7.3521],[10.5274],[-21.7975],[7.6132],[-28.9995],[-7.6911],[-3.1017],[-55.3513],[10.832],[-48.1858],[-37.5029],[-36.0565],[-74.5498],[-28.8226],[-41.2354],[14.6707],[-14.5498],[-72.0707],[-34.2847],[-75.0429],[-18.616],[8.6591],[-62.1532],[7.1767],[-40.275],[-13.9201],[-19.8594],[-83.3836],[-9.1587],[-69.7733],[53.4376],[-39.1066],[-91.3422],[-32.0038],[-78.4279],[53.4376],[-48.5292],[-107.101],[3.7757],[-62.2467]];
const PNL: number[][] = [[2798.94],[-497.27],[-9247.52],[2940.82],[-12498.78],[2217.27],[2626.65],[-12379.37],[3529.61],[-13017.67],[-1053.22],[-2586.35],[-10147.04],[50.32],[-14263.51],[1469.43],[-5123.36],[-12982.7],[827.59],[-15199.69],[-868.72],[1385.33],[-4310.7],[1284.02],[-7733.2],[-868.6],[-405.07],[-8523.0],[1495.47],[-8965.92],[-1725.88],[-3820.92],[-11015.56],[-3434.33],[-6657.15],[302.9],[-318.5],[-9035.73],[-2720.6],[-10080.39],[-1602.27],[1044.7],[-8890.07],[964.03],[-7273.55],[-973.02],[-2371.27],[-10433.32],[-1207.49],[-11455.31],[770.99],[-3862.02],[-10883.81],[-3144.65],[-10574.11],[770.99],[-313.87],[-11402.8],[116.46],[-6967.91]];
const EXPOSED: number[][] = [[267],[176],[238],[267],[267],[169],[169],[238],[169],[245],[95],[169],[177],[169],[245],[95],[169],[169],[169],[245],[92],[142],[176],[267],[267],[92],[142],[171],[142],[171],[81],[86],[171],[91],[169],[81],[71],[155],[88],[155],[92],[88],[176],[142],[176],[92],[86],[98],[142],[171],[81],[86],[91],[86],[169],[81],[36],[85],[81],[86]];
const LOTDAYS: number[][] = [[1280],[987],[1560],[1496],[1966],[847],[883],[1476],[1101],[1644],[499],[797],[1337],[948],[1536],[267],[596],[1024],[759],[1323],[683],[775],[1185],[998],[1608],[645],[760],[908],[802],[1104],[260],[611],[868],[686],[952],[116],[123],[729],[448],[780],[488],[710],[854],[790],[1083],[396],[690],[734],[764],[967],[81],[565],[695],[560],[790],[81],[36],[616],[174],[646]];
const AVGLOT: number[][] = [[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0],[5000.0]];
const WIN: number[][] = [[41.6667],[30.4348],[16.4706],[22.0339],[14.8515],[46.6667],[36.6667],[13.3333],[26.8293],[17.3333],[28.5714],[16.0],[17.5],[25.0],[15.0943],[50.0],[11.1111],[3.7037],[28.5714],[12.1212],[30.0],[35.2941],[25.4902],[30.7692],[23.5294],[36.3636],[30.4348],[14.2857],[34.7826],[15.7895],[25.0],[13.3333],[10.0],[10.5263],[21.875],[50.0],[33.3333],[0.0],[25.0],[0.0],[50.0],[36.3636],[17.3913],[41.1765],[25.0],[60.0],[27.7778],[3.2258],[30.0],[12.1212],[100.0],[9.0909],[0.0],[10.0],[3.7037],[100.0],[0.0],[0.0],[33.3333],[5.5556]];
const CLOSED: number[][] = [[16],[38],[77],[51],[93],[7],[22],[52],[33],[67],[0],[17],[32],[20],[45],[0],[1],[19],[6],[25],[12],[26],[43],[31],[60],[3],[15],[27],[15],[30],[0],[7],[22],[11],[24],[0],[0],[12],[0],[15],[0],[25],[38],[26],[44],[0],[10],[23],[12],[25],[0],[3],[16],[2],[19],[0],[0],[8],[0],[10]];
const OPENN: number[][] = [[8],[8],[8],[8],[8],[8],[8],[8],[8],[8],[7],[8],[8],[8],[8],[4],[8],[8],[8],[8],[8],[8],[8],[8],[8],[8],[8],[8],[8],[8],[4],[8],[8],[8],[8],[2],[3],[8],[8],[8],[8],[8],[8],[8],[8],[5],[8],[8],[8],[8],[1],[8],[8],[8],[8],[1],[1],[8],[3],[8]];
const FROM: string[][] = [["2026-01-29"],["2026-04-30"],["2026-02-27"],["2026-01-29"],["2026-01-29"],["2026-05-07"],["2026-05-07"],["2026-02-27"],["2026-05-07"],["2026-02-20"],["2026-07-20"],["2026-05-07"],["2026-04-29"],["2026-05-07"],["2026-02-20"],["2026-07-20"],["2026-05-07"],["2026-05-07"],["2026-05-07"],["2026-02-20"],["2026-07-23"],["2026-06-03"],["2026-04-30"],["2026-01-29"],["2026-01-29"],["2026-07-23"],["2026-06-03"],["2026-05-05"],["2026-06-03"],["2026-05-05"],["2026-08-03"],["2026-07-29"],["2026-05-05"],["2026-07-24"],["2026-05-07"],["2026-08-03"],["2026-08-13"],["2026-05-21"],["2026-07-27"],["2026-05-21"],["2026-07-23"],["2026-07-27"],["2026-04-30"],["2026-06-03"],["2026-04-30"],["2026-07-23"],["2026-07-29"],["2026-07-17"],["2026-06-03"],["2026-05-05"],["2026-08-03"],["2026-07-29"],["2026-07-24"],["2026-07-29"],["2026-05-07"],["2026-08-03"],["2026-09-17"],["2026-07-30"],["2026-08-03"],["2026-07-29"]];
const TO: string[][] = [["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"],["2026-10-22"]];

function buyLabel(buy: Buy): string {
  const cut = `>${buy.a},>${buy.p}%`;
  return buy.s ? `${buy.s} · ${cut}` : cut;
}

function sellLabel(sell: Sell): string {
  if (SELL_MODE === "slots") return `${sell.h} lots`;
  if (SELL_MODE === "protect") return `${sell.d}dd ${sell.p}pp`;
  return `${sell.h}d ${sell.t}% ${sell.d}dd`;
}

function money(n: number): string {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
}

function pct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function lotMoney(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
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
const SHOW_MODES = ["pct", "pnl", "both"] as const;
type ShowMode = (typeof SHOW_MODES)[number];
type Metric = "pct" | "pnl";
const SYMBOL_FLOORS = [0, 2, 4, 7, 8, 9, 10, 12, 14, 16, 18, 20, 40, 80, 160, 320] as const;

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

function emptyBuckets(options: readonly (string | number)[]): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const option of options) out[String(option)] = [];
  return out;
}

type SliceStats = { roi: Stats | null; sym: Stats | null; win: Stats | null };

function packSlice(
  roiGroups: Record<string, number[]>,
  symGroups: Record<string, number[]>,
  winGroups: Record<string, number[]>,
): Record<string, SliceStats> {
  const out: Record<string, SliceStats> = {};
  for (const key of Object.keys(roiGroups)) {
    const roi = roiGroups[key];
    const sym = symGroups[key];
    const win = winGroups[key];
    out[key] = {
      roi: roi.length ? pack(roi) : null,
      sym: sym.length ? pack(sym) : null,
      win: win.length ? pack(win) : null,
    };
  }
  return out;
}

function countText(value: number | undefined): string {
  return value === undefined ? "—" : String(Math.round(value));
}

function winText(value: number | undefined): string {
  return value === undefined ? "—" : `${value.toFixed(1)}%`;
}

function FilterColumn<T extends string | number>({
  label,
  options,
  selected,
  onChange,
  format,
  stats,
  exclusive = false,
}: {
  label: string;
  options: readonly T[];
  selected: T[];
  onChange: (next: T[]) => void;
  format: (value: T) => string;
  stats: Record<string, SliceStats>;
  exclusive?: boolean;
}) {
  const figure = {
    textAlign: "right" as const,
    fontVariantNumeric: "tabular-nums" as const,
  };
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 4.5em 4.5em 4.5em 3.2em 3.2em 3.2em 4.2em 4.2em 4.2em",
        columnGap: 6,
        rowGap: 2,
        alignItems: "center",
      }}
    >
      <span />
      <Text as="span" size="small" tone="tertiary" style={{ gridColumn: "2 / span 3", textAlign: "center" }}>
        Return
      </Text>
      <Text as="span" size="small" tone="tertiary" style={{ gridColumn: "5 / span 3", textAlign: "center" }}>
        Symbols
      </Text>
      <Text as="span" size="small" tone="tertiary" style={{ gridColumn: "8 / span 3", textAlign: "center" }}>
        Win rate
      </Text>
      <Text size="small" tone="secondary" weight="semibold">
        {label}
      </Text>
      {["Min", "Avg", "Max", "Min", "Avg", "Max", "Min", "Avg", "Max"].map((name, index) => (
        <Text key={`${name}-${index}`} as="span" size="small" tone="tertiary" style={figure}>
          {name}
        </Text>
      ))}
      {options.map((option) => {
        const stat = stats[String(option)];
        const active = selected.includes(option);
        const tone = active ? "primary" : "tertiary";
        return (
          <div key={String(option)} style={{ display: "contents" }}>
            <div style={{ minWidth: 0, justifySelf: "start" }}>
              <Pill
                size="sm"
                active={active}
                onClick={() =>
                  onChange(exclusive ? [option] : toggleItem(selected, option, options))
                }
              >
                {format(option)}
              </Pill>
            </div>
            <Text as="span" size="small" tone={tone} style={figure}>
              {stat?.roi ? pct(stat.roi.min) : "—"}
            </Text>
            <Text as="span" size="small" tone={tone} style={figure}>
              {stat?.roi ? pct(stat.roi.avg) : "—"}
            </Text>
            <Text as="span" size="small" tone={tone} style={figure}>
              {stat?.roi ? pct(stat.roi.max) : "—"}
            </Text>
            <Text as="span" size="small" tone={tone} style={figure}>
              {countText(stat?.sym?.min)}
            </Text>
            <Text as="span" size="small" tone={tone} style={figure}>
              {countText(stat?.sym?.avg)}
            </Text>
            <Text as="span" size="small" tone={tone} style={figure}>
              {countText(stat?.sym?.max)}
            </Text>
            <Text as="span" size="small" tone={tone} style={figure}>
              {winText(stat?.win?.min)}
            </Text>
            <Text as="span" size="small" tone={tone} style={figure}>
              {winText(stat?.win?.avg)}
            </Text>
            <Text as="span" size="small" tone={tone} style={figure}>
              {winText(stat?.win?.max)}
            </Text>
          </div>
        );
      })}
    </div>
  );
}

function FilterGroup<T extends string | number>({
  label,
  options,
  selected,
  onChange,
  format,
  exclusive = false,
}: {
  label: string;
  options: readonly T[];
  selected: T[];
  onChange: (next: T[]) => void;
  format: (value: T) => string;
  exclusive?: boolean;
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
          onClick={() =>
            onChange(exclusive ? [option] : toggleItem(selected, option, options))
          }
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

export default function FineGridCanvas() {
  const theme = useHostTheme();
  const [books, setBooks] = useCanvasState<string[]>("grid-signals", SIGNALS);
  const [analysts, setAnalysts] = useCanvasState<number[]>("fine-analysts", ANALYSTS);
  const [upsideFloor, setUpsideFloor] = useCanvasState<number>("fine-upside-floor", UPSIDES[0]);
  const [holds, setHolds] = useCanvasState<number[]>("fine-holds", HOLDS);
  const [targets, setTargets] = useCanvasState<number[]>("fine-targets", TARGETS);
  const [drops, setDrops] = useCanvasState<number[]>("fine-drops", DROPS);
  const [protects, setProtects] = useCanvasState<number[]>("fine-protects", PROTECTS);
  const [showMode, setShowMode] = useCanvasState<ShowMode>("fine-show-mode", "both");
  const [sortKey, setSortKey] = useCanvasState<string>("grid-sort-key", "");
  const [sortDir, setSortDir] = useCanvasState<"asc" | "desc">("grid-sort-dir", "desc");
  const [symbolFloor, setSymbolFloor] = useCanvasState<number>("fine-symbol-floor", 0);

  const view = useMemo(() => {
    const buys = BUYS.map((buy, row) => ({ buy, row })).filter(
      ({ buy }) =>
        books.includes(buy.s) &&
        analysts.includes(buy.a) &&
        buy.p >= upsideFloor &&
        buy.sym > symbolFloor,
    );
    const protectMode = SELL_MODE === "protect";
    const slotsMode = SELL_MODE === "slots";
    const sells = SELLS.map((sell, col) => ({ sell, col })).filter(({ sell }) =>
      slotsMode
        ? true
        : protectMode
          ? protects.includes(sell.p) && drops.includes(sell.d)
          : holds.includes(sell.h) && targets.includes(sell.t) && drops.includes(sell.d),
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
      cornerRoi: buys.length && sells.length ? cornerOf(rowRoi) : null,
      cornerPnl: buys.length && sells.length ? cornerOf(rowPnl) : null,
    };
  }, [books, analysts, upsideFloor, holds, targets, drops, protects, symbolFloor]);

  const filterStats = useMemo(() => {
    const signalRoi = emptyBuckets(SIGNALS);
    const signalSym = emptyBuckets(SIGNALS);
    const signalWin = emptyBuckets(SIGNALS);
    const analystRoi = emptyBuckets(ANALYSTS);
    const analystSym = emptyBuckets(ANALYSTS);
    const analystWin = emptyBuckets(ANALYSTS);
    const upsideRoi = emptyBuckets(UPSIDES);
    const upsideSym = emptyBuckets(UPSIDES);
    const upsideWin = emptyBuckets(UPSIDES);
    const symbolRoi = emptyBuckets(SYMBOL_FLOORS);
    const symbolSym = emptyBuckets(SYMBOL_FLOORS);
    const symbolWin = emptyBuckets(SYMBOL_FLOORS);
    const holdRoi = emptyBuckets(HOLDS);
    const holdSym = emptyBuckets(HOLDS);
    const holdWin = emptyBuckets(HOLDS);
    const targetRoi = emptyBuckets(TARGETS);
    const targetSym = emptyBuckets(TARGETS);
    const targetWin = emptyBuckets(TARGETS);
    const dropRoi = emptyBuckets(DROPS);
    const dropSym = emptyBuckets(DROPS);
    const dropWin = emptyBuckets(DROPS);
    const protectRoi = emptyBuckets(PROTECTS);
    const protectSym = emptyBuckets(PROTECTS);
    const protectWin = emptyBuckets(PROTECTS);
    const protectMode = SELL_MODE === "protect";
    const slotsMode = SELL_MODE === "slots";
    const push = (
      roiBucket: Record<string, number[]>,
      symBucket: Record<string, number[]>,
      winBucket: Record<string, number[]>,
      key: string,
      roi: number,
      sym: number,
      win: number,
    ) => {
      roiBucket[key]?.push(roi);
      symBucket[key]?.push(sym);
      if (Number.isFinite(win)) winBucket[key]?.push(win);
    };
    BUYS.forEach((buy, row) => {
      const signalOk = books.includes(buy.s);
      const analystOk = analysts.includes(buy.a);
      const upsideOk = buy.p >= upsideFloor;
      const symbolOk = buy.sym > symbolFloor;
      SELLS.forEach((sell, col) => {
        const roi = ROI[row][col];
        const win = WIN[row][col];
        if (!Number.isFinite(roi)) return;
        const holdOk = slotsMode || protectMode || holds.includes(sell.h);
        const targetOk = slotsMode || (protectMode ? protects.includes(sell.p) : targets.includes(sell.t));
        const dropOk = slotsMode || drops.includes(sell.d);
        const sellsOk = holdOk && targetOk && dropOk;
        const buysOk = signalOk && analystOk && upsideOk && symbolOk;
        if (analystOk && upsideOk && symbolOk && sellsOk) push(signalRoi, signalSym, signalWin, buy.s, roi, buy.sym, win);
        if (signalOk && upsideOk && symbolOk && sellsOk) push(analystRoi, analystSym, analystWin, String(buy.a), roi, buy.sym, win);
        if (signalOk && analystOk && symbolOk && sellsOk) {
          for (const floor of UPSIDES) {
            if (buy.p >= floor) push(upsideRoi, upsideSym, upsideWin, String(floor), roi, buy.sym, win);
          }
        }
        if (signalOk && analystOk && upsideOk && sellsOk) {
          for (const floor of SYMBOL_FLOORS) {
            if (buy.sym > floor) push(symbolRoi, symbolSym, symbolWin, String(floor), roi, buy.sym, win);
          }
        }
        if (!protectMode && buysOk && targetOk && dropOk) push(holdRoi, holdSym, holdWin, String(sell.h), roi, buy.sym, win);
        if (!protectMode && buysOk && holdOk && dropOk) push(targetRoi, targetSym, targetWin, String(sell.t), roi, buy.sym, win);
        if (protectMode && buysOk && dropOk) push(protectRoi, protectSym, protectWin, String(sell.p), roi, buy.sym, win);
        if (buysOk && holdOk && targetOk) push(dropRoi, dropSym, dropWin, String(sell.d), roi, buy.sym, win);
      });
    });
    return {
      signal: packSlice(signalRoi, signalSym, signalWin),
      analyst: packSlice(analystRoi, analystSym, analystWin),
      upside: packSlice(upsideRoi, upsideSym, upsideWin),
      symbol: packSlice(symbolRoi, symbolSym, symbolWin),
      hold: packSlice(holdRoi, holdSym, holdWin),
      target: packSlice(targetRoi, targetSym, targetWin),
      drop: packSlice(dropRoi, dropSym, dropWin),
      protect: packSlice(protectRoi, protectSym, protectWin),
    };
  }, [books, analysts, upsideFloor, holds, targets, drops, protects, symbolFloor]);

  const roiRange = span(ROI.flat());
  const pnlRange = span(PNL.flat());
  const showPct = showMode !== "pnl";
  const showPnl = showMode !== "pct";

  const cells = view.buys.flatMap(({ buy, row }) =>
    view.sells.map(({ sell, col }) => ({
      label: `${buyLabel(buy)} · ${sellLabel(sell)}`,
      sell: sellLabel(sell),
      buy: buyLabel(buy),
      roi: ROI[row][col],
      pnl: PNL[row][col],
      n: buy.n,
      from: FROM[row][col],
      to: TO[row][col],
      exposed: EXPOSED[row][col],
      lotDays: LOTDAYS[row][col],
      avgLot: AVGLOT[row][col],
      win: WIN[row][col],
      closed: CLOSED[row][col],
      open: OPENN[row][col],
    })),
  );
  const topScore = cells.reduce((best, cell) => (cell.roi > best.roi ? cell : best), cells[0]);
  const topCash = cells.reduce((best, cell) => (cell.pnl > best.pnl ? cell : best), cells[0]);
  const ranked = [...cells].sort((a, b) => b.roi - a.roi || b.pnl - a.pnl).slice(0, 30);

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
  const activeMetric: Metric = showPct ? "pct" : "pnl";
  const chooseSort = (key: string, numeric: boolean) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir(numeric ? "desc" : "asc");
    }
  };
  const sortMark = (key: string) => (sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "");
  const sortStyle = (extra?: CSSProperties): CSSProperties => ({
    ...head,
    cursor: "pointer",
    userSelect: "none",
    ...extra,
  });
  const orderedBuys = [...view.buys.map((item, index) => ({ ...item, index }))].sort((a, b) => {
    if (!sortKey) return 0;
    const dir = sortDir === "asc" ? 1 : -1;
    const read = (item: { buy: Buy; row: number; index: number }): number | string => {
      if (sortKey === "buy") return buyLabel(item.buy);
      if (sortKey === "sym") return item.buy.sym;
      if (sortKey === "n") return item.buy.n;
      const [kind, id, metric] = sortKey.split(":");
      if (kind === "stat") {
        const stats = metric === "pnl" ? view.rowPnl[item.index] : view.rowRoi[item.index];
        return stats[id as StatName];
      }
      const col = Number(id);
      return metric === "pnl" ? PNL[item.row][col] : ROI[item.row][col];
    };
    const av = read(a);
    const bv = read(b);
    if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
    const left = Number.isFinite(av as number) ? (av as number) : dir === 1 ? Infinity : -Infinity;
    const right = Number.isFinite(bv as number) ? (bv as number) : dir === 1 ? Infinity : -Infinity;
    return (left - right) * dir;
  });
  const pair = (key: string, roi: number, pnl: number, title: string, edge = false) => {
    const out = [];
    if (showPct) out.push(paint(`${key}-pct`, roi, roiRange, pct(roi), `${title} · return`, edge));
    if (showPnl) out.push(paint(`${key}-pnl`, pnl, pnlRange, money(pnl), `${title} · profit`, edge && !showPct));
    return out;
  };
  const filled = view.buys.length > 0 && view.sells.length > 0 && topScore && topCash && view.cornerRoi && view.cornerPnl;

  return (
    <Stack gap={20}>
      <Stack gap={6}>
        <H1>{TITLE}</H1>
        <Text size="small" tone="secondary">
          {SOURCE}
        </Text>
      </Stack>

      {filled ? (
        <Row gap={16} wrap>
          {showPct ? (
            <Stat value={pct(topScore.roi)} label={`Best return · ${topScore.label}`} tone="success" />
          ) : null}
          {showPnl ? <Stat value={money(topCash.pnl)} label={`Most cash · ${topCash.label}`} /> : null}
          <Stat value={`${topScore.from} → ${topScore.to}`} label="Best return · trade window" />
          <Stat value={String(topScore.exposed)} label="Best return · days exposed" />
          <Stat value={String(topScore.lotDays)} label="Best return · lot-days" />
          <Stat value={lotMoney(topScore.avgLot)} label="Best return · average lot" />
          <Stat value={String(cells.length)} label="Combinations shown" />
        </Row>
      ) : null}

      <Stack gap={8}>
        <Text size="small" tone="secondary">
          Min, avg, and max are the return for that value with the other filters applied.
          The next three figures are that value's symbol count. The last three are its win rate.
        </Text>
        <Grid columns={2} gap={16} align="start">
          <FilterColumn
            label="Signal"
            options={SIGNALS}
            selected={books}
            onChange={setBooks}
            format={(value) => value}
            stats={filterStats.signal}
          />
          {SELL_MODE === "slots" ? (
            <Stack gap={4}>
              <Text>8 lots</Text>
              <Text size="small" tone="secondary">
                A new signal takes a free lot. On a full book, sell the biggest loss.
                If every lot is in profit, sell the least profitable one only when its
                strength is below the new signal. Strength is sqrt(analysts, capped at
                10) times the target percent floored to 10% steps.
              </Text>
            </Stack>
          ) : SELL_MODE === "protect" ? (
            <FilterColumn
              label="Loss dd"
              options={DROPS}
              selected={drops}
              onChange={setDrops}
              format={(value) => `${value}dd`}
              stats={filterStats.drop}
            />
          ) : (
            <FilterColumn
              label="Hold"
              options={HOLDS}
              selected={holds}
              onChange={setHolds}
              format={(value) => `${value}d`}
              stats={filterStats.hold}
            />
          )}
          <FilterColumn
            label="Analysts"
            options={ANALYSTS}
            selected={analysts}
            onChange={setAnalysts}
            format={(value) => `>${value}`}
            stats={filterStats.analyst}
          />
          {SELL_MODE === "slots" ? (
            <div />
          ) : SELL_MODE === "protect" ? (
            <FilterColumn
              label="Profit protect"
              options={PROTECTS}
              selected={protects}
              onChange={setProtects}
              format={(value) => `${value}pp`}
              stats={filterStats.protect}
            />
          ) : (
            <FilterColumn
              label="Target"
              options={TARGETS}
              selected={targets}
              onChange={setTargets}
              format={(value) => `${value}%`}
              stats={filterStats.target}
            />
          )}
          <FilterColumn
            label="Upside"
            options={UPSIDES}
            selected={[upsideFloor]}
            onChange={(next) => setUpsideFloor(next[0])}
            format={(value) => `>${value}%`}
            stats={filterStats.upside}
            exclusive
          />
          {SELL_MODE === "slots" || SELL_MODE === "protect" ? (
            <div />
          ) : (
            <FilterColumn
              label="Drop"
              options={DROPS}
              selected={drops}
              onChange={setDrops}
              format={(value) => `${value}dd`}
              stats={filterStats.drop}
            />
          )}
          <FilterColumn
            label="Symbols"
            options={SYMBOL_FLOORS}
            selected={[symbolFloor]}
            onChange={(next) => setSymbolFloor(next[0])}
            format={(value) => `>${value}`}
            stats={filterStats.symbol}
            exclusive
          />
        </Grid>
        <FilterGroup
          label="Show"
          options={SHOW_MODES}
          selected={[showMode]}
          onChange={(next) => setShowMode(next[0])}
          format={(value) => (value === "pct" ? "%" : value === "pnl" ? "$" : "Both")}
          exclusive
        />
      </Stack>

      {filled ? (
        <Stack gap={8}>
          <H2>Buy × sell</H2>
          <Text size="small" tone="secondary">
            Yellow is the smaller number and red is the larger one, on a scale fixed to the full
            grid. The min, average, and max columns sit on the left and summarize that buy across
            the sells in view. The min, average, and max rows sit at the top and do the same for
            each sell across the buys in view. Symbols are
            unique tickers in that buy, and the Symbols pill keeps buys above that floor. Signals
            are the lots opened. Click a heading to sort the buys. Click it again to reverse the
            order. The total rows stay at the top.
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
                    onClick={() => chooseSort("buy", false)}
                    style={sortStyle({ textAlign: "left", position: "sticky", left: 0, zIndex: 2 })}
                  >
                    Buy{sortMark("buy")}
                  </th>
                  <th
                    rowSpan={both ? 2 : 1}
                    onClick={() => chooseSort("sym", true)}
                    style={sortStyle({ textAlign: "right" })}
                  >
                    Symbols{sortMark("sym")}
                  </th>
                  <th
                    rowSpan={both ? 2 : 1}
                    onClick={() => chooseSort("n", true)}
                    style={sortStyle({ textAlign: "right" })}
                  >
                    Signals{sortMark("n")}
                  </th>
                  {STAT_NAMES.map((name) =>
                    both ? (
                      <th key={name} colSpan={2} style={head}>
                        {statLabel(name)}
                      </th>
                    ) : (
                      <th
                        key={name}
                        onClick={() => chooseSort(`stat:${name}:${activeMetric}`, true)}
                        style={sortStyle()}
                      >
                        {statLabel(name)}
                        {sortMark(`stat:${name}:${activeMetric}`)}
                      </th>
                    ),
                  )}
                  {view.sells.map(({ sell, col }, index) =>
                    both ? (
                      <th
                        key={sellLabel(sell)}
                        colSpan={2}
                        style={{
                          ...head,
                          borderLeft: index === 0 ? `1px solid ${theme.stroke.secondary}` : undefined,
                        }}
                      >
                        {sellLabel(sell)}
                      </th>
                    ) : (
                      <th
                        key={sellLabel(sell)}
                        onClick={() => chooseSort(`sell:${col}:${activeMetric}`, true)}
                        style={sortStyle({
                          borderLeft: index === 0 ? `1px solid ${theme.stroke.secondary}` : undefined,
                        })}
                      >
                        {sellLabel(sell)}
                        {sortMark(`sell:${col}:${activeMetric}`)}
                      </th>
                    ),
                  )}
                </tr>
                {both ? (
                  <tr>
                    {STAT_NAMES.flatMap((name) => [
                      <th
                        key={`${name}-pct`}
                        onClick={() => chooseSort(`stat:${name}:pct`, true)}
                        style={sortStyle()}
                      >
                        %{sortMark(`stat:${name}:pct`)}
                      </th>,
                      <th
                        key={`${name}-pnl`}
                        onClick={() => chooseSort(`stat:${name}:pnl`, true)}
                        style={sortStyle()}
                      >
                        ${sortMark(`stat:${name}:pnl`)}
                      </th>,
                    ])}
                    {view.sells.flatMap(({ sell, col }, index) => {
                      const name = sellLabel(sell);
                      const edge =
                        index === 0
                          ? { borderLeft: `1px solid ${theme.stroke.secondary}` }
                          : undefined;
                      return [
                        <th
                          key={`${name}-pct`}
                          onClick={() => chooseSort(`sell:${col}:pct`, true)}
                          style={sortStyle(edge)}
                        >
                          %{sortMark(`sell:${col}:pct`)}
                        </th>,
                        <th
                          key={`${name}-pnl`}
                          onClick={() => chooseSort(`sell:${col}:pnl`, true)}
                          style={sortStyle()}
                        >
                          ${sortMark(`sell:${col}:pnl`)}
                        </th>,
                      ];
                    })}
                  </tr>
                ) : null}
              </thead>
              <tbody>
                {STAT_NAMES.map((rowStat) => (
                  <tr key={rowStat}>
                    {labelCell(statLabel(rowStat), true, false)}
                    {countCell("—", false)}
                    {countCell("—", false)}
                    {STAT_NAMES.flatMap((colStat) =>
                      pair(
                        `${rowStat}-${colStat}`,
                        view.cornerRoi![rowStat][colStat],
                        view.cornerPnl![rowStat][colStat],
                        `${statLabel(rowStat)} of each buy's ${statLabel(colStat).toLowerCase()}`,
                      ),
                    )}
                    {view.sells.flatMap(({ sell }, index) => {
                      const name = sellLabel(sell);
                      return pair(
                        `${rowStat}-${name}`,
                        view.colRoi[index][rowStat],
                        view.colPnl[index][rowStat],
                        `${name} · ${statLabel(rowStat)} across buys`,
                        index === 0,
                      );
                    })}
                  </tr>
                ))}
                {orderedBuys.map(({ buy, row, index }, position) => (
                  <tr key={buyLabel(buy)}>
                    {labelCell(buy.n < 30 ? `${buyLabel(buy)} · thin` : buyLabel(buy), true, position === 0)}
                    {countCell(String(buy.sym), position === 0)}
                    {countCell(String(buy.n), position === 0)}
                    {STAT_NAMES.flatMap((name) =>
                      pair(
                        `${buyLabel(buy)}-${name}`,
                        view.rowRoi[index][name],
                        view.rowPnl[index][name],
                        `${buyLabel(buy)} · ${statLabel(name)} across sells`,
                      ),
                    )}
                    {view.sells.flatMap(({ sell, col }, sellIndex) => {
                      const name = `${buyLabel(buy)} · ${sellLabel(sell)}`;
                      const title = `${name} · ${FROM[row][col]} → ${TO[row][col]} · ${EXPOSED[row][col]} days exposed · ${LOTDAYS[row][col]} lot-days · avg lot ${lotMoney(AVGLOT[row][col])}`;
                      return pair(name, ROI[row][col], PNL[row][col], title, sellIndex === 0);
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Stack>
      ) : (
        <Text size="small" tone="secondary">
          These pills leave out every buy in this grid.
        </Text>
      )}

      {filled ? (
        <Stack gap={8}>
          <H2>Lot exposure on the best returns</H2>
          <Text size="small" tone="secondary">
            Top 30 visible cells by return on invested. Days exposed are distinct calendar days
            with a lot open. Lot-days are the sum of each lot's calendar hold. A 3-day lot, a
            1-day lot, and another 3-day lot are 6 lot-days.
          </Text>
          <Table
            headers={["Sell", "Buy", "On invested", "Stock P&L", "Trade window", "Days exposed", "Lot-days", "Avg lot", "Win", "Lots"]}
            columnAlign={["left", "left", "right", "right", "left", "right", "right", "right", "right", "right"]}
            rows={ranked.map((cell) => [
              cell.sell,
              cell.buy,
              pct(cell.roi),
              money(cell.pnl),
              `${cell.from} → ${cell.to}`,
              String(cell.exposed),
              String(cell.lotDays),
              lotMoney(cell.avgLot),
              pct(cell.win),
              `${cell.closed}c/${cell.open}o`,
            ])}
            striped
            stickyHeader
          />
        </Stack>
      ) : null}
    </Stack>
  );
}
