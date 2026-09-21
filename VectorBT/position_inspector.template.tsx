import {
  Button,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Grid,
  H1,
  H2,
  Row,
  Select,
  Stack,
  Stat,
  Table,
  Text,
  useCanvasState,
  useHostTheme,
} from "cursor/canvas";

const DATES = @@DATES@@;
const PRICES: Record<string, Array<number | null>> = @@PRICES@@;
const LOTS = @@LOTS@@;
const OPTIONS = @@OPTIONS@@;
const TABLE_ROWS = @@TABLE_ROWS@@;
const TABLE_TONE = @@TABLE_TONE@@ as Array<"success" | "danger" | undefined>;
const SUBTITLE = @@SUBTITLE@@;
const RANGE = @@RANGE@@;
const REASON_LINE = @@REASON_LINE@@;
const STAT_N = @@STAT_N@@;
const STAT_WIN = @@STAT_WIN@@;
const STAT_PNL = @@STAT_PNL@@;
const STAT_EXIT = @@STAT_EXIT@@;

function fmtPct(v: number | null | undefined) {
  if (v == null) return "";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function afterMinVsPeakPct(lot: {
  afterMin?: number | null;
  sellPx: number;
  peakPx: number;
}) {
  if (lot.afterMin == null) return null;
  return ((lot.sellPx * (1 + lot.afterMin / 100)) / lot.peakPx - 1) * 100;
}

function xOf(i: number, w: number, pad: number) {
  return pad + (i / Math.max(DATES.length - 1, 1)) * (w - pad * 2);
}

function PriceChart({ lotId }: { lotId: string }) {
  const theme = useHostTheme();
  const lot = LOTS.find((item) => item.id === lotId) ?? LOTS[0];
  const series = PRICES[lot.ticker] ?? [];
  const w = 880;
  const h = 320;
  const pad = 44;
  const vals = series.filter((v): v is number => v != null);
  const extraPx = lot.signals
    .map((s) => s.price)
    .filter((v): v is number => v != null);
  const lo = Math.min(
    ...vals,
    lot.dd ?? lot.sellPx,
    lot.target ?? lot.buyPx,
    ...extraPx,
  );
  const hi = Math.max(
    ...vals,
    lot.peakPx,
    lot.target ?? lot.peakPx,
    lot.projPx,
    lot.lastPx ?? lot.sellPx,
    ...extraPx,
  );
  const span = hi - lo || 1;
  const yOf = (v: number) => pad + (1 - (v - lo) / span) * (h - pad * 2);
  const iOf = (day: string) => {
    const found = DATES.indexOf(day);
    return found < 0 ? 0 : found;
  };
  const pts = series
    .map((v, i) => (v == null ? null : `${xOf(i, w, pad)},${yOf(v)}`))
    .filter((p): p is string => p != null)
    .join(" ");
  const buyI = iOf(lot.buy);
  const peakI = iOf(lot.peak);
  const sellI = iOf(lot.sell);
  const lastI = lot.last ? iOf(lot.last) : sellI;
  const buyC = theme.category.green;
  const peakC = theme.category.yellow;
  const sellC = lot.open ? theme.category.gray : theme.category.red;
  const lastC = theme.category.blue;
  const projC = theme.category.purple;
  const ticks = [0, Math.floor(DATES.length / 2), DATES.length - 1];

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={h}
      role="img"
      aria-label={`${lot.ticker} close from ${DATES[0]} to ${DATES[DATES.length - 1]}`}
    >
      <rect x="0" y="0" width={w} height={h} fill={theme.bg.editor} />
      <rect
        x={xOf(buyI, w, pad)}
        y={pad}
        width={Math.max(xOf(sellI, w, pad) - xOf(buyI, w, pad), 1)}
        height={h - pad * 2}
        fill={theme.fill.tertiary}
      />
      {lot.target != null ? (
        <line
          x1={pad}
          x2={w - pad}
          y1={yOf(lot.target)}
          y2={yOf(lot.target)}
          stroke={buyC}
          strokeDasharray="5 4"
          strokeWidth="1"
        />
      ) : null}
      <line
        x1={pad}
        x2={w - pad}
        y1={yOf(lot.projPx)}
        y2={yOf(lot.projPx)}
        stroke={projC}
        strokeDasharray="6 3"
        strokeWidth="1"
      />
      {lot.dd != null ? (
        <line
          x1={pad}
          x2={w - pad}
          y1={yOf(lot.dd)}
          y2={yOf(lot.dd)}
          stroke={sellC}
          strokeDasharray="2 3"
          strokeWidth="1"
        />
      ) : null}
      <polyline fill="none" stroke={theme.accent.primary} strokeWidth="1.5" points={pts} />
      {lot.signals
        .filter((s) => s.price != null)
        .map((s) => (
          <circle
            key={`${s.date}-${s.proj}`}
            cx={xOf(iOf(s.date), w, pad)}
            cy={yOf(s.price as number)}
            r="4"
            fill="none"
            stroke={buyC}
            strokeWidth="1.5"
          />
        ))}
      <circle cx={xOf(buyI, w, pad)} cy={yOf(lot.buyPx)} r="5" fill={buyC} />
      <circle cx={xOf(peakI, w, pad)} cy={yOf(lot.peakPx)} r="5" fill={peakC} />
      <circle cx={xOf(sellI, w, pad)} cy={yOf(lot.sellPx)} r="5" fill={sellC} />
      {lot.lastPx != null ? (
        <rect
          x={xOf(lastI, w, pad) - 4}
          y={yOf(lot.lastPx) - 4}
          width="8"
          height="8"
          fill={lastC}
        />
      ) : null}
      {ticks.map((i) => (
        <text
          key={DATES[i]}
          x={xOf(i, w, pad)}
          y={h - 14}
          textAnchor="middle"
          fill={theme.text.tertiary}
          fontSize="11"
        >
          {DATES[i]}
        </text>
      ))}
      <text x={pad} y="16" fill={theme.text.secondary} fontSize="11">
        Close ($)
      </text>
      <text x={w - pad} y="16" textAnchor="end" fill={theme.text.secondary} fontSize="11">
        Date
      </text>
    </svg>
  );
}

export default function PositionInspector() {
  const [lotId, setLotId] = useCanvasState("lotId", LOTS[0].id);
  const idx = Math.max(0, LOTS.findIndex((item) => item.id === lotId));
  const lot = LOTS[idx] ?? LOTS[0];
  const minVsPeak = afterMinVsPeakPct(lot);
  const go = (delta: number) => {
    const next = (idx + delta + LOTS.length) % LOTS.length;
    setLotId(LOTS[next].id);
  };

  return (
    <Stack gap={24}>
      <Stack gap={8}>
        <Text tone="secondary" size="small">
          {SUBTITLE}
        </Text>
        <H1>Position inspector</H1>
        <H2>analyst&gt;2 · proj&gt;20% · 30d or 50% target or 7.5% dd</H2>
      </Stack>

      <Grid columns={4} gap={16}>
        <Stat value={STAT_N} label="Lots" />
        <Stat value={STAT_WIN} label="Win rate" tone="success" />
        <Stat value={STAT_PNL} label="Stock P&L" />
        <Stat value={STAT_EXIT} label="Most common exit" />
      </Grid>

      <Callout tone="info" title="How to read a chart">
        Shaded band is the hold. Filled green is this lot&apos;s buy; hollow
        green is another buy signal on the same ticker. Yellow is peak while
        held, red is sell, blue square is the last known close. Purple dashed is
        100% of the analyst projection from this buy; green dashed is the 50%
        sell target; dotted red is 7.5% below the hold peak.
      </Callout>

      <Card>
        <CardHeader trailing={`${idx + 1} / ${LOTS.length}`}>
          {lot.ticker} · {lot.analysts ?? "—"} analysts · proj {lot.proj > 0 ? "+" : ""}
          {lot.proj}% · {lot.reason}
        </CardHeader>
        <CardBody>
          <Stack gap={12}>
            <Row gap={8} align="center" wrap>
              <Button variant="secondary" onClick={() => go(-1)}>
                Previous
              </Button>
              <Select value={lot.id} onChange={setLotId} options={OPTIONS} />
              <Button variant="secondary" onClick={() => go(1)}>
                Next
              </Button>
            </Row>
            <Grid columns={4} gap={16}>
              <Stat
                value={`${lot.ret > 0 ? "+" : ""}${lot.ret.toFixed(1)}%`}
                label="Lot return"
                tone={lot.ret >= 0 ? "success" : "danger"}
              />
              <Stat
                value={`${lot.analysts ?? "—"} · ${lot.proj > 0 ? "+" : ""}${lot.proj}%`}
                label="Analysts · projection"
              />
              <Stat value={lot.buy} label="Buy" />
              <Stat
                value={
                  lot.lastPx != null
                    ? `$${lot.lastPx.toFixed(2)}`
                    : lot.open
                      ? `${lot.sell} open`
                      : lot.sell
                }
                label={
                  lot.lastVsSell != null
                    ? `Last close (${lot.lastVsSell > 0 ? "+" : ""}${lot.lastVsSell}% vs sell)`
                    : "Sell"
                }
              />
            </Grid>
            <Text tone="secondary" size="small">
              {lot.afterMax != null
                ? `After sell, close ran to ${fmtPct(lot.afterMax)} max and ${fmtPct(lot.afterMin)} min vs sell${
                    minVsPeak != null
                      ? ` (${fmtPct(minVsPeak)} min vs peak)`
                      : ""
                  }. `
                : ""}
              {lot.lastPx != null
                ? `Last known close ${lot.last} is $${lot.lastPx.toFixed(2)}${lot.lastVsSell != null ? ` (${lot.lastVsSell > 0 ? "+" : ""}${lot.lastVsSell}% vs sell)` : ""}. `
                : ""}
              {lot.signals.length > 0
                ? `Other signals on ${lot.ticker}: ${lot.signals
                    .map(
                      (s) =>
                        `${s.date} (${s.analysts}a, ${s.proj > 0 ? "+" : ""}${s.proj}%)`,
                    )
                    .join("; ")}.`
                : ""}
            </Text>
            <PriceChart lotId={lot.id} />
            <Text tone="secondary" size="small">
              Daily close, {RANGE}. Buy / peak / sell marked. Source:
              data/signals.csv · Yahoo daily close.
            </Text>
          </Stack>
        </CardBody>
      </Card>

      <Stack gap={8}>
        <H2>All lots</H2>
        <Text tone="secondary" size="small">
          Exit reason is whichever of 30d / 50% target / 7.5% dd fired on the
          sell bar (can be more than one). After max and After min are % vs the
          sell close; Min vs peak is that after-sell low vs the hold peak.{" "}
          {REASON_LINE}. Source: VectorBT position inspector · {RANGE}.
        </Text>
        <Table
          headers={[
            "Ticker",
            "Analysts",
            "Proj",
            "Buy",
            "Peak",
            "Sell",
            "Exit",
            "Return",
            "P&L",
            "After max",
            "After min",
            "Min vs peak",
            "Last",
          ]}
          columnAlign={[
            "left",
            "right",
            "right",
            "left",
            "left",
            "left",
            "left",
            "right",
            "right",
            "right",
            "right",
            "right",
            "right",
          ]}
          rows={TABLE_ROWS.map((row, i) => {
            const r = LOTS[i];
            return [
              ...row.slice(0, -1),
              fmtPct(r.afterMax),
              fmtPct(r.afterMin),
              fmtPct(afterMinVsPeakPct(r)),
              row[row.length - 1],
            ];
          })}
          rowTone={TABLE_TONE}
          striped
        />
      </Stack>
    </Stack>
  );
}
