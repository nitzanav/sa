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
  "2026-01-28 → 2026-09-18 · 232 days (162 trading) · $5k lots · sell frozen 30d or 50% target or 7.5% dd";

type Metric = "roi" | "pnl";

const CUTS = ["> 0.80", "> 0.60", "> 0.40", "> 0.20", "> 0.00"];
const ROI = [39.4, 36.6, 27.1, 20.8, 12.0];
const PNL = [7371, 12658, 14346, 13833, 10347];
const ROI_WAS = [41.6, 37.3, 26.8, 20.3, 12.0];

export default function Percentile30d5075() {
  const [metric, setMetric] = useCanvasState<Metric>("metric", "roi");
  const isRoi = metric === "roi";

  return (
    <Stack gap={24}>
      <Stack gap={8}>
        <Text tone="secondary" size="small">
          signal_percentile re-run · {PERIOD}. Source: data/signals.csv
          (rewritten) · VectorBT/optimize.py percentile · run 2026-09-21 23:12
          UTC+3.
        </Text>
        <H1>WINNING PERCENTILE CUT</H1>
        <H2>SELL: 30D OR 50% TARGET OR 7.5% DD</H2>
        <H2>BUY: SIGNAL_PERCENTILE &gt; 0.80</H2>
      </Stack>

      <Card size="lg">
        <CardHeader trailing="38 SIGNALS · 63.2% WIN RATE">
          WINNING PERCENTILE CUT
        </CardHeader>
        <CardBody>
          <Grid columns={3} gap={16}>
            <Stat value="+39.4%" label="ON INVESTED" tone="success" />
            <Stat value="+$7,371" label="STOCK P&L" />
            <Stat value="38" label="SIGNALS" />
          </Grid>
        </CardBody>
      </Card>

      <Grid columns={3} gap={16}>
        <Stat
          value="+39.4%"
          label="Best ROI · pct > 0.80"
          tone="success"
        />
        <Stat value="+$14,346" label="Best stock P&L · pct > 0.40" />
        <Stat value="−2.2pp" label=">0.80 vs 22:32 run" tone="warning" />
      </Grid>

      <Stack gap={8}>
        <H2>30D 50% 7.5DD — SIGNAL_PERCENTILE BUYS</H2>
        <Text tone="secondary" size="small">
          Five cuts on the rewritten signals.csv. Ranked by return on avg
          invested. Source: VectorBT percentile run · 2026-01-28 to 2026-09-18.
        </Text>
        <Table
          headers={["Buy", "n", "On invested", "Stock P&L", "Win rate", "Trades"]}
          columnAlign={["left", "right", "right", "right", "right", "right"]}
          rows={[
            ["signal_percentile > 0.80", "38", "+39.4%", "+$7,371", "63.2%", "38 (34c/4o)"],
            ["signal_percentile > 0.60", "76", "+36.6%", "+$12,658", "53.9%", "76 (66c/10o)"],
            ["signal_percentile > 0.40", "113", "+27.1%", "+$14,346", "54.0%", "113 (98c/15o)"],
            ["signal_percentile > 0.20", "151", "+20.8%", "+$13,833", "50.3%", "151 (134c/17o)"],
            ["signal_percentile > 0.00", "188", "+12.0%", "+$10,347", "46.8%", "188 (170c/18o)"],
          ]}
          rowTone={["success", undefined, "info", undefined, undefined]}
          striped
        />
      </Stack>

      <Stack gap={8}>
        <H2>Return on avg invested vs stock P&L</H2>
        <Text tone="secondary" size="small">
          Horizontal bars, five percentile cuts. Axis is return on avg invested
          (%) or stock P&L ($). Source: VectorBT percentile run · 2026-01-28 to
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
          height={280}
          beginAtZero
          showValues
          valueSuffix={isRoi ? "%" : ""}
          valuePrefix={isRoi ? "" : "$"}
          categories={CUTS}
          series={[
            {
              name: isRoi ? "Return on avg invested" : "Stock P&L",
              data: isRoi ? ROI : PNL,
              tone: isRoi ? "success" : "info",
            },
          ]}
        />
      </Stack>

      <Divider />

      <Stack gap={8}>
        <H2>Vs previous percentile run (22:32)</H2>
        <Text tone="secondary" size="small">
          Same n at every cut. Percentile ranks rewritten again. This run 23:12
          vs 22:32. Source: data/signals.csv + VectorBT percentile.
        </Text>
        <BarChart
          horizontal
          height={280}
          beginAtZero
          showValues
          valueSuffix="%"
          categories={CUTS}
          series={[
            { name: "This run (23:12)", data: ROI, tone: "success" },
            { name: "Previous (22:32)", data: ROI_WAS, tone: "neutral" },
          ]}
        />
        <Table
          headers={["Buy", "ROI now", "ROI was", "P&L now", "P&L was"]}
          columnAlign={["left", "right", "right", "right", "right"]}
          rows={[
            ["> 0.80", "+39.4%", "+41.6%", "+$7,371", "+$7,504"],
            ["> 0.60", "+36.6%", "+37.3%", "+$12,658", "+$13,195"],
            ["> 0.40", "+27.1%", "+26.8%", "+$14,346", "+$13,751"],
            ["> 0.20", "+20.8%", "+20.3%", "+$13,833", "+$13,740"],
            ["> 0.00", "+12.0%", "+12.0%", "+$10,347", "+$10,347"],
          ]}
          rowTone={["warning", "warning", "success", "info", undefined]}
          striped
        />
      </Stack>

      <Callout tone="info" title="Tighter is still better on rate">
        Monotonic: +39.4% → +36.6% → +27.1% → +20.8% → +12.0%. Dollars peak at
        &gt;0.40 (+$14,346). All-in (&gt;0.00) is worse on both rate and
        dollars, and unchanged vs 22:32.
      </Callout>

      <Callout tone="warning" title="Still beats the old freeze, still not the winner">
        &gt;0.80 (+39.4%) still beats analyst&gt;3 · proj&gt;20% (+36.4%).
        &gt;0.60 (+36.6%) is a hair above that freeze. analyst&gt;3 · proj&gt;30%
        (+63.1%, 22 names) remains the rate winner.
      </Callout>
    </Stack>
  );
}
