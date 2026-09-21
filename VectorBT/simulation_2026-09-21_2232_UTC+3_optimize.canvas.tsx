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
const ROI = [41.6, 37.3, 26.8, 20.3, 12.0];
const PNL = [7504, 13195, 13751, 13740, 10347];
const ROI_WAS = [32.7, 22.7, 22.7, 18.2, 12.8];

export default function Percentile30d5075() {
  const [metric, setMetric] = useCanvasState<Metric>("metric", "roi");
  const isRoi = metric === "roi";

  return (
    <Stack gap={24}>
      <Stack gap={8}>
        <Text tone="secondary" size="small">
          signal_percentile re-run · {PERIOD}. Source: data/signals.csv
          (rewritten) · VectorBT/optimize.py percentile · run 2026-09-21 22:32
          UTC+3.
        </Text>
        <H1>WINNING PERCENTILE CUT</H1>
        <H2>SELL: 30D OR 50% TARGET OR 7.5% DD</H2>
        <H2>BUY: SIGNAL_PERCENTILE &gt; 0.80</H2>
      </Stack>

      <Card size="lg">
        <CardHeader trailing="38 SIGNALS · 60.5% WIN RATE">
          WINNING PERCENTILE CUT
        </CardHeader>
        <CardBody>
          <Grid columns={3} gap={16}>
            <Stat value="+41.6%" label="ON INVESTED" tone="success" />
            <Stat value="+$7,504" label="STOCK P&L" />
            <Stat value="38" label="SIGNALS" />
          </Grid>
        </CardBody>
      </Card>

      <Grid columns={3} gap={16}>
        <Stat
          value="+41.6%"
          label="Best ROI · pct > 0.80"
          tone="success"
        />
        <Stat value="+$13,751" label="Best stock P&L · pct > 0.40" />
        <Stat
          value="+9.0pp"
          label=">0.80 vs previous run"
          tone="info"
        />
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
            ["signal_percentile > 0.80", "38", "+41.6%", "+$7,504", "60.5%", "38 (33c/5o)"],
            ["signal_percentile > 0.60", "76", "+37.3%", "+$13,195", "55.3%", "76 (64c/12o)"],
            ["signal_percentile > 0.40", "113", "+26.8%", "+$13,751", "53.1%", "113 (99c/14o)"],
            ["signal_percentile > 0.20", "151", "+20.3%", "+$13,740", "50.3%", "151 (133c/18o)"],
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
        <H2>Vs previous percentile run (21:43)</H2>
        <Text tone="secondary" size="small">
          Same n at every cut. All 189 signal rows were rewritten, so bucket
          membership moved. This run 22:32 vs 21:43. Source: data/signals.csv
          + VectorBT percentile / conclusion.
        </Text>
        <BarChart
          horizontal
          height={280}
          beginAtZero
          showValues
          valueSuffix="%"
          categories={CUTS}
          series={[
            { name: "This run (22:32)", data: ROI, tone: "success" },
            { name: "Previous (21:43)", data: ROI_WAS, tone: "neutral" },
          ]}
        />
        <Table
          headers={["Buy", "ROI now", "ROI was", "P&L now", "P&L was"]}
          columnAlign={["left", "right", "right", "right", "right"]}
          rows={[
            ["> 0.80", "+41.6%", "+32.7%", "+$7,504", "+$5,857"],
            ["> 0.60", "+37.3%", "+22.7%", "+$13,195", "+$8,460"],
            ["> 0.40", "+26.8%", "+22.7%", "+$13,751", "+$11,435"],
            ["> 0.20", "+20.3%", "+18.2%", "+$13,740", "+$12,722"],
            ["> 0.00", "+12.0%", "+12.8%", "+$10,347", "+$10,962"],
          ]}
          rowTone={["success", "success", "info", "info", "warning"]}
          striped
        />
      </Stack>

      <Callout tone="info" title="Tighter is still better on rate">
        Monotonic: +41.6% → +37.3% → +26.8% → +20.3% → +12.0%. Dollars peak at
        &gt;0.40 (+$13,751) and are essentially tied with &gt;0.20 (+$13,740).
        All-in (&gt;0.00) is worse on both rate and dollars.
      </Callout>

      <Callout tone="warning" title="Percentile now beats the old freeze">
        After the rewrite, &gt;0.80 (+41.6%) and &gt;0.60 (+37.3%) both beat
        analyst&gt;3 · proj&gt;20% (+36.4%). &gt;0.80 also beats analyst&gt;2 ·
        proj&gt;20% (+37.2%) on rate. analyst&gt;3 · proj&gt;30% (+63.1%, 22
        names) is still the rate winner — do not replace it. Percentile &gt;0.80
        is a credible second, with more names (38 vs 22).
      </Callout>
    </Stack>
  );
}
