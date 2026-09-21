import {
  BarChart,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Divider,
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
} from "cursor/canvas";

const PERIOD =
  "2026-01-28 → 2026-09-18 · 232 days (162 trading) · $5k lots · buy frozen analyst>2 · proj>20% (84 signals)";

type Metric = "roi" | "pnl";

const RANKED = [
  { short: "30d 50% 7.5dd", roi: 37.2, pnl: 14446, win: "56.0%", exits: "12 30d / 17 tgt / 46 dd / 10 open", known: true },
  { short: "7.5dd→5%→5dd", roi: 20.8, pnl: 7532, win: "60.7%", exits: "21 wide / 53 tight / 10 open", known: false },
  { short: "7.5dd→25%proj→5dd", roi: 17.9, pnl: 6758, win: "57.1%", exits: "30 wide / 42 tight / 12 open", known: false },
  { short: "10dd→5%→5dd", roi: 15.8, pnl: 6194, win: "61.9%", exits: "19 wide / 54 tight / 11 open", known: false },
  { short: "7.5dd→7.5%→7.5dd", roi: 15.1, pnl: 6930, win: "52.4%", exits: "30 wide / 34 tight / 20 open", known: false },
  { short: "7.5dd→25%proj→7.5dd", roi: 15.1, pnl: 6930, win: "52.4%", exits: "30 wide / 34 tight / 20 open", known: false },
  { short: "10dd→25%proj→5dd", roi: 14.2, pnl: 5946, win: "59.5%", exits: "26 wide / 43 tight / 15 open", known: false },
  { short: "10dd→25%proj→7.5dd", roi: 11.8, pnl: 5945, win: "54.8%", exits: "26 wide / 35 tight / 23 open", known: false },
  { short: "15dd→5%→5dd", roi: 11.1, pnl: 5584, win: "64.3%", exits: "10 wide / 57 tight / 17 open", known: false },
  { short: "7.5dd→10%→10dd", roi: 10.1, pnl: 5016, win: "48.8%", exits: "39 wide / 23 tight / 22 open", known: false },
  { short: "10dd→7.5%→7.5dd", roi: 10.0, pnl: 4972, win: "54.8%", exits: "26 wide / 35 tight / 23 open", known: false },
  { short: "15dd→25%proj→5dd", roi: 6.7, pnl: 3825, win: "60.7%", exits: "14 wide / 44 tight / 26 open", known: false },
  { short: "15dd→25%proj→7.5dd", roi: 5.6, pnl: 3656, win: "56.0%", exits: "14 wide / 36 tight / 34 open", known: false },
  { short: "10dd→10%→10dd", roi: 5.4, pnl: 3054, win: "48.8%", exits: "32 wide / 25 tight / 27 open", known: false },
  { short: "15dd→7.5%→7.5dd", roi: 4.6, pnl: 3001, win: "56.0%", exits: "13 wide / 36 tight / 35 open", known: false },
  { short: "15dd→10%→10dd", roi: 0.4, pnl: 277, win: "52.4%", exits: "17 wide / 26 tight / 41 open", known: false },
];

const LOCKS = ["+5% → 5dd", "+7.5% → 7.5dd", "+10% → 10dd", "25% proj → 5dd", "25% proj → 7.5dd"];
const WIDE_15 = [11.1, 4.6, 0.4, 6.7, 5.6];
const WIDE_10 = [15.8, 10.0, 5.4, 14.2, 11.8];
const WIDE_75 = [20.8, 15.1, 10.1, 17.9, 15.1];

function money(n: number) {
  const abs = Math.abs(n).toLocaleString("en-US");
  return n >= 0 ? `+$${abs}` : `−$${abs}`;
}

function pct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export default function StagedTrailSells() {
  const [metric, setMetric] = useCanvasState<Metric>("metric", "roi");
  const isRoi = metric === "roi";

  return (
    <Stack gap={24}>
      <Stack gap={8}>
        <Text tone="secondary" size="small">
          Two-stage trailing sells · {PERIOD}. Source: data/signals.csv ·
          VectorBT/optimize.py staged · run 2026-09-21 23:28 UTC+3.
        </Text>
        <H1>WINNING COMBINATION</H1>
        <H2>SELL: 30D OR 50% TARGET OR 7.5% DD</H2>
        <H2>BUY: ANALYST&gt;2 · PROJ&gt;20%</H2>
      </Stack>

      <Card size="lg">
        <CardHeader trailing="84 SIGNALS · 56.0% WIN RATE">
          WINNING COMBINATION — KNOWN SELL
        </CardHeader>
        <CardBody>
          <Grid columns={3} gap={16}>
            <Stat value="+37.2%" label="ON INVESTED" tone="success" />
            <Stat value="+$14,446" label="STOCK P&L" tone="success" />
            <Stat value="0 / 15" label="TWO-STAGE BEATS" />
          </Grid>
        </CardBody>
      </Card>

      <Grid columns={4} gap={16}>
        <Stat value="+20.8%" label="Best two-stage · 7.5dd→5%→5dd" />
        <Stat value="+$7,532" label="Best two-stage P&L" />
        <Stat value="+15.1%" label="Constant 7.5% trail" />
        <Stat value="+0.4%" label="Worst · 15dd→10%→10dd" tone="danger" />
      </Grid>

      <Callout tone="success" title="Keep 30d 50% 7.5dd">
        None of the 15 two-stage trails beat the known sell on rate or
        dollars. Best two-stage is 7.5% dd until +5%, then 5% dd (+20.8% /
        +$7,532) — still 16pp and $6.9k behind. The 30d clock and 50%
        target are the extra +22pp / +$7.5k versus a constant 7.5% trail.
      </Callout>

      <Stack gap={8}>
        <H2>All 16 sells — analyst&gt;2 · proj&gt;20%</H2>
        <Text tone="secondary" size="small">
          Ranked by return on avg invested. Two-stage sells have no 30d and
          no target. Peak is since entry. Source: VectorBT staged run ·
          2026-01-28 to 2026-09-18.
        </Text>
        <Table
          headers={["Sell", "On invested", "Stock P&L", "Win rate", "Exits"]}
          columnAlign={["left", "right", "right", "right", "left"]}
          rows={RANKED.map((r) => [
            r.known ? `${r.short} (known)` : r.short,
            pct(r.roi),
            money(r.pnl),
            r.win,
            r.exits,
          ])}
          rowTone={RANKED.map((r, i) =>
            r.known ? "success" : i === RANKED.length - 1 ? "danger" : undefined,
          )}
          striped
        />
      </Stack>

      <Stack gap={8}>
        <H2>Return on avg invested vs stock P&L</H2>
        <Text tone="secondary" size="small">
          Horizontal bars, all 16 sells. Axis is return on avg invested (%)
          or stock P&L ($). Source: VectorBT staged run · 2026-01-28 to
          2026-09-18.
        </Text>
        <Row gap={8} wrap>
          <Pill active={isRoi} onClick={() => setMetric("roi")}>
            Return on invested
          </Pill>
          <Pill active={!isRoi} onClick={() => setMetric("pnl")}>
            Stock P&L
          </Pill>
        </Row>
        <BarChart
          horizontal
          height={520}
          beginAtZero
          showValues
          valueSuffix={isRoi ? "%" : ""}
          valuePrefix={isRoi ? "" : "$"}
          categories={RANKED.map((r) => r.short)}
          series={[
            {
              name: isRoi ? "Return on avg invested" : "Stock P&L",
              data: RANKED.map((r) => (isRoi ? r.roi : r.pnl)),
              tone: "info",
            },
          ]}
        />
      </Stack>

      <Divider />

      <Stack gap={8}>
        <H2>Lock pattern × initial (wide) dd</H2>
        <Text tone="secondary" size="small">
          Grouped bars. Same five lock patterns at 15%, 10%, and 7.5% wide
          dd. Axis is return on avg invested (%). Known 30d 50% 7.5dd is
          the +37.2% reference. Source: VectorBT staged run · 2026-01-28 to
          2026-09-18.
        </Text>
        <BarChart
          height={280}
          beginAtZero
          showValues
          valueSuffix="%"
          categories={LOCKS}
          yMax={40}
          referenceLines={[{ value: 37.2, label: "known 30d 50% 7.5dd", tone: "success" }]}
          series={[
            { name: "15% wide", data: WIDE_15, tone: "danger" },
            { name: "10% wide", data: WIDE_10, tone: "warning" },
            { name: "7.5% wide", data: WIDE_75, tone: "info" },
          ]}
        />
        <Table
          headers={["Lock", "15% wide", "10% wide", "7.5% wide"]}
          columnAlign={["left", "right", "right", "right"]}
          rows={[
            ["+5% → 5dd", "+11.1%", "+15.8%", "+20.8%"],
            ["+7.5% → 7.5dd", "+4.6%", "+10.0%", "+15.1%"],
            ["+10% → 10dd", "+0.4%", "+5.4%", "+10.1%"],
            ["25% proj → 5dd", "+6.7%", "+14.2%", "+17.9%"],
            ["25% proj → 7.5dd", "+5.6%", "+11.8%", "+15.1%"],
          ]}
          rowTone={["success", undefined, "danger", undefined, undefined]}
          striped
        />
      </Stack>

      <Callout tone="warning" title="Wider initial dd is strictly worse">
        Mean invested return: 15% wide +5.7%, 10% wide +11.4%, 7.5% wide
        +15.8%. Giving the loser 15% of room before the lock just holds
        drawdowns longer. Locking later (+7.5% or +10%) then widening the
        trail is worse than locking at +5% and tightening to 5% dd.
      </Callout>

      <Callout tone="info" title="+5% lock then 5% dd is the best two-stage">
        At every initial dd, +5% then 5% dd beats 25% of projection then
        5% dd (+20.8 vs +17.9 at 7.5% wide). 7.5dd→25%proj→7.5dd equals
        constant 7.5% trail — the lock never changes the stop. Do not
        replace 30d 50% 7.5dd with any of these on this buy.
      </Callout>
    </Stack>
  );
}
