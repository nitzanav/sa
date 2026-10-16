import {
  BarChart,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Grid,
  H1,
  H2,
  H3,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  useCanvasState,
} from "cursor/canvas";

const PERIOD =
  "Quotes 2026-01-29 → 2026-09-21 · 162 trading days · signals cutoff 2026-08-23 (drop last 29d) · 204 combos · $5k lots";

type Metric = "roi" | "pnl";

const TOP = [
  { sell: "10d 25% 7.5dd", buy: "analyst>3 · proj>30%", n: 18, roi: 126.7, pnl: 5435, win: "83.3%", trades: "18c/0o", winCombo: true },
  { sell: "10d 25% 8.5dd", buy: "analyst>3 · proj>30%", n: 18, roi: 124.0, pnl: 5359, win: "83.3%", trades: "18c/0o" },
  { sell: "15d 25% 7.5dd", buy: "analyst>3 · proj>30%", n: 18, roi: 121.1, pnl: 6427, win: "77.8%", trades: "18c/0o" },
  { sell: "15d 25% 8.5dd", buy: "analyst>3 · proj>30%", n: 18, roi: 117.2, pnl: 6369, win: "77.8%", trades: "18c/0o" },
  { sell: "10d 25% 7.5dd", buy: "analyst>2 · proj>30%", n: 35, roi: 115.3, pnl: 9214, win: "77.1%", trades: "35c/0o", scale: true },
  { sell: "20d 25% 7.5dd", buy: "analyst>3 · proj>30%", n: 18, roi: 103.1, pnl: 5948, win: "77.8%", trades: "18c/0o" },
  { sell: "15d 25% 7.5dd", buy: "analyst>2 · proj>30%", n: 35, roi: 98.6, pnl: 9797, win: "71.4%", trades: "35c/0o" },
  { sell: "20d 25% 10dd", buy: "analyst>3 · proj>30%", n: 18, roi: 97.7, pnl: 6301, win: "83.3%", trades: "18c/0o" },
  { sell: "10d 25% 7.5dd", buy: "signal_percentile > 0.80", n: 32, roi: 97.4, pnl: 7876, win: "75.0%", trades: "32c/0o" },
  { sell: "21d 25% 7.5dd", buy: "analyst>3 · proj>30%", n: 18, roi: 97.2, pnl: 5697, win: "72.2%", trades: "18c/0o" },
  { sell: "30d 50% 7.5dd", buy: "analyst>3 · proj>30%", n: 18, roi: 66.0, pnl: 5905, win: "72.2%", trades: "17c/1o", known: true },
  { sell: "30d 50% 7.5dd", buy: "analyst>2 · proj>20%", n: 72, roi: 29.7, pnl: 10690, win: "55.6%", trades: "67c/5o", known: true },
];

const KNOWN_THEN_NOW = [
  { buy: "analyst>2 · proj>20%", nWas: 84, nNow: 72, roiWas: 37.2, roiNow: 29.7, pnlWas: 14446, pnlNow: 10690, openWas: 10, openNow: 5 },
  { buy: "analyst>3 · proj>30%", nWas: 22, nNow: 18, roiWas: 63.1, roiNow: 66.0, pnlWas: 6346, pnlNow: 5905, openWas: 1, openNow: 1 },
];

const HOLD_CATS = ["10d", "15d", "20d", "21d", "25d+", "none"];
const HOLD_ROI = [126.7, 121.1, 103.1, 97.2, 96.6, 96.6];
const HOLD_PNL = [5435, 6427, 5948, 5697, 5697, 5697];

const BUY_10D = [
  { buy: "a>3 · >30%", n: 18, roi: 126.7, pnl: 5435 },
  { buy: "a>2 · >30%", n: 35, roi: 115.3, pnl: 9214 },
  { buy: "p>0.80", n: 32, roi: 97.4, pnl: 7876 },
  { buy: "a>3 · >25%", n: 25, roi: 88.9, pnl: 5541 },
  { buy: "a>3 · >35%", n: 12, roi: 86.9, pnl: 2951 },
  { buy: "a>2 · >35%", n: 23, roi: 81.0, pnl: 5050 },
  { buy: "a>2 · >25%", n: 54, roi: 79.9, pnl: 9812 },
  { buy: "a>3 · >20%", n: 34, roi: 62.8, pnl: 5214 },
  { buy: "p>0.60", n: 64, roi: 62.1, pnl: 9062 },
  { buy: "a>2 · >20%", n: 72, roi: 59.1, pnl: 9856 },
];

const ITERS = [
  { i: "I1", n: 72, lock: "2 freeze buys × 20/25/30/40d × 40/50/60% × 5/7.5/10dd" },
  { i: "I2", n: 46, lock: "hold=20d · expand target 25–75% × dd 6–12.5%" },
  { i: "I3", n: 40, lock: "25% × 7.5/8.5dd · sweep hold none–60d" },
  { i: "I4", n: 27, lock: "top 3 sells · buy neighborhood" },
  { i: "I5", n: 19, lock: "percentile + staged trail with 30d" },
];

function money(n: number) {
  const abs = Math.abs(Math.round(n)).toLocaleString("en-US");
  return n >= 0 ? `+$${abs}` : `−$${abs}`;
}

function pct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export default function ClosedWindowSweep() {
  const [metric, setMetric] = useCanvasState<Metric>("metric", "roi");
  const isRoi = metric === "roi";

  return (
    <Stack gap={24}>
      <Stack gap={8}>
        <Text tone="secondary" size="small">
          Closed-window re-opt · {PERIOD}. Source: data/signals.csv ·
          VectorBT/optimize.py closed · run 2026-09-21 23:54 UTC+3.
        </Text>
        <H1>WINNING COMBINATION</H1>
        <H2>SELL: 10D OR 25% TARGET OR 7.5% DD</H2>
        <H2>BUY: ANALYST&gt;3 · PROJ&gt;30%</H2>
        <Row gap={8} wrap>
          <Pill tone="success" active>
            n≥10 winner
          </Pill>
          <Pill tone="info">204 unique combos</Pill>
          <Pill>ignore last 29d of signals</Pill>
        </Row>
      </Stack>

      <Card size="lg">
        <CardHeader trailing="18 SIGNALS · 83.3% WIN RATE · 18c/0o">
          WINNING COMBINATION — CLOSED WINDOW
        </CardHeader>
        <CardBody>
          <Grid columns={4} gap={16}>
            <Stat value="+126.7%" label="ON INVESTED" tone="success" />
            <Stat value="+$5,435" label="STOCK P&L" tone="success" />
            <Stat value="18" label="SIGNALS AFTER CUTOFF" />
            <Stat value="0" label="OPEN AT LAST BAR" tone="success" />
          </Grid>
        </CardBody>
      </Card>

      <Callout tone="warning" title="Last 29 days were in the old parameter pick">
        Known 30d 50% 7.5dd on analyst&gt;2 · proj&gt;20% falls +37.2% → +29.7% and
        +$14,446 → +$10,690 once those 12 recent signals (and 5 of 10 open lots)
        are out. The tight freeze holds: +63.1% → +66.0% on 18 names.
      </Callout>

      <H2>Known 30d 50% 7.5dd — before vs after cutoff</H2>
      <Text tone="secondary" size="small">
        Before: prices through 2026-09-18, all 189 signals. After: quotes through
        2026-09-21, signals after 2026-08-23 dropped.
      </Text>
      <Table
        headers={["Buy", "n", "On invested", "was", "Stock P&L", "was", "Open"]}
        columnAlign={["left", "right", "right", "right", "right", "right", "left"]}
        rows={KNOWN_THEN_NOW.map((r) => [
          r.buy,
          `${r.nNow} (was ${r.nWas})`,
          pct(r.roiNow),
          pct(r.roiWas),
          money(r.pnlNow),
          money(r.pnlWas),
          `${r.openNow}o, was ${r.openWas}o`,
        ])}
        rowTone={["danger", "success"]}
      />

      <H2>Top closed-window cells (n≥10)</H2>
      <Table
        headers={["Sell", "Buy", "n", "On invested", "Stock P&L", "Win", "Trades"]}
        columnAlign={["left", "left", "right", "right", "right", "right", "right"]}
        rows={TOP.map((r) => [
          r.sell,
          r.buy,
          String(r.n),
          pct(r.roi),
          money(r.pnl),
          r.win,
          r.trades,
        ])}
        rowTone={TOP.map((r) =>
          r.winCombo ? "success" : r.scale ? "info" : r.known ? "warning" : undefined,
        )}
        striped
        stickyHeader
      />

      <H2>Hold clock on 25% target + 7.5% dd</H2>
      <Text tone="secondary" size="small">
        Buy frozen analyst&gt;3 · proj&gt;30% (18). X: hold length (trading days). Y:
        return on invested (%) or stock P&amp;L ($). 25d through 60d and no-hold
        overlay because target/dd already exited.
      </Text>
      <Row gap={8}>
        <Pill
          tone={isRoi ? "success" : "neutral"}
          active={isRoi}
          onClick={() => setMetric("roi")}
        >
          Return on invested
        </Pill>
        <Pill
          tone={!isRoi ? "success" : "neutral"}
          active={!isRoi}
          onClick={() => setMetric("pnl")}
        >
          Stock P&L
        </Pill>
      </Row>
      <H3>
        {isRoi
          ? "Return on avg invested by hold (analyst>3 · proj>30%, 25% · 7.5dd)"
          : "Stock P&L by hold (analyst>3 · proj>30%, 25% · 7.5dd)"}
      </H3>
      <BarChart
        categories={HOLD_CATS}
        series={[
          {
            name: isRoi ? "On invested (%)" : "Stock P&L ($)",
            data: isRoi ? HOLD_ROI : HOLD_PNL,
            tone: "success",
          },
        ]}
        height={220}
        valueSuffix={isRoi ? "%" : undefined}
        valuePrefix={isRoi ? undefined : "$"}
        showValues
      />
      <Text tone="secondary" size="small">
        Source: VectorBT/optimize.py closed · 2026-09-21 23:54 UTC+3 · 18 lots.
      </Text>

      <H2>10d 25% 7.5dd across buys</H2>
      <Text tone="secondary" size="small">
        Same sell, every buy with n≥10. analyst&gt;4 · proj&gt;30% (n=8, +128.9%) omitted as noise.
      </Text>
      <H3>Return on avg invested — 10d 25% 7.5dd by buy filter</H3>
      <BarChart
        categories={BUY_10D.map((r) => r.buy)}
        series={[
          { name: "On invested (%)", data: BUY_10D.map((r) => r.roi), tone: "info" },
        ]}
        height={240}
        valueSuffix="%"
        showValues
        horizontal
      />
      <Text tone="secondary" size="small">
        Source: VectorBT/optimize.py closed · 2026-09-21 23:54 UTC+3. Scale pick is
        analyst&gt;2 · proj&gt;30% (35, +115.3%, +$9,214).
      </Text>

      <H3>Five locked iterations</H3>
      <Table
        headers={["Iter", "New cells", "Lock"]}
        columnAlign={["left", "right", "left"]}
        rows={ITERS.map((r) => [r.i, String(r.n), r.lock])}
      />

      <Callout tone="success" title="Stay with 10d or 25% or 7.5% dd">
        Rate winner is analyst&gt;3 · proj&gt;30% on that sell (+126.7%, all 18 closed).
        For more lots keep analyst&gt;2 · proj&gt;30% (+115.3% / +$9,214 / 35). 15d is
        the dollar twin on the tight freeze (+$6,427). Do not go back to 30d 50%
        7.5dd on the strength of the old open lots.
      </Callout>
    </Stack>
  );
}
