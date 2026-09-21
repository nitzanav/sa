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

const BUYS = [
  "a>2 · >20%",
  "a>2 · >25%",
  "a>2 · >30%",
  "a>3 · >20%",
  "a>3 · >25%",
  "a>3 · >30%",
  "pct > 0.80",
  "pct > 0.60",
  "pct > 0.40",
  "pct > 0.20",
  "pct > 0.00",
  "F500 · 30d 7.5dd",
  "F500 · 7.5dd",
];

const ROI = [
  37.2, 46.2, 52.9, 36.4, 51.4, 63.1, 32.7, 22.7, 22.7, 18.2, 12.8, 4.9, -1.0,
];
const PNL = [
  14446, 13321, 9569, 7433, 7674, 6346, 5857, 8460, 11435, 12722, 10962, 13852,
  -3655,
];

const TABLE_ROWS = [
  ["analyst>2 · proj>20%", "84", "+37.2%", "+$14,446"],
  ["analyst>2 · proj>25%", "63", "+46.2%", "+$13,321"],
  ["analyst>2 · proj>30%", "42", "+52.9%", "+$9,569"],
  ["analyst>3 · proj>20% (old freeze)", "42", "+36.4%", "+$7,433"],
  ["analyst>3 · proj>25%", "31", "+51.4%", "+$7,674"],
  ["ANALYST>3 · PROJ>30%", "22", "+63.1%", "+$6,346"],
  ["signal_percentile > 0.80", "38", "+32.7%", "+$5,857"],
  ["signal_percentile > 0.60", "76", "+22.7%", "+$8,460"],
  ["signal_percentile > 0.40", "113", "+22.7%", "+$11,435"],
  ["signal_percentile > 0.20", "151", "+18.2%", "+$12,722"],
  ["signal_percentile > 0.00", "188", "+12.8%", "+$10,962"],
  ["Fortune 500 at start · 30d 7.5dd", "501", "+4.9%", "+$13,852"],
  ["Fortune 500 at start · 7.5dd", "501", "−1.0%", "−$3,655"],
];

const TABLE_TONE = [
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  "success",
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  "warning",
  "danger",
] as const;

export default function Conclusion30d5075() {
  const [metric, setMetric] = useCanvasState<Metric>("metric", "roi");
  const isRoi = metric === "roi";

  return (
    <Stack gap={24}>
      <Stack gap={8}>
        <Text tone="secondary" size="small">
          30d 50% 7.5dd buy comparison · {PERIOD}. Source: data/signals.csv ·
          data/fortune_500/symbols.csv · VectorBT/optimize.py conclusion · run
          2026-09-21 21:43 UTC+3.
        </Text>
        <H1>WINNING COMBINATION</H1>
        <H2>SELL: 30D OR 50% TARGET OR 7.5% DD</H2>
        <H2>BUY: ANALYST&gt;3 · PROJ&gt;30%</H2>
      </Stack>

      <Card size="lg">
        <CardHeader trailing="22 SIGNALS · 68.2% WIN RATE">
          WINNING COMBINATION
        </CardHeader>
        <CardBody>
          <Grid columns={3} gap={16}>
            <Stat value="+63.1%" label="ON INVESTED" tone="success" />
            <Stat value="+$6,346" label="STOCK P&L" />
            <Stat value="22" label="SIGNALS" />
          </Grid>
        </CardBody>
      </Card>

      <Stack gap={8}>
        <H2>30D 50% 7.5DD — ALL BUYS</H2>
        <Text tone="secondary" size="small">
          Signal rows use 30d or 50% target or 7.5% dd. Fortune 500 has no
          projection, so those rows are 30d or 7.5% dd, and 7.5% dd alone.
          Source: VectorBT conclusion run · 2026-01-28 to 2026-09-18.
        </Text>
        <Table
          headers={["Buy", "n", "On invested", "Stock P&L"]}
          columnAlign={["left", "right", "right", "right"]}
          rows={TABLE_ROWS}
          rowTone={[...TABLE_TONE]}
          striped
        />
      </Stack>

      <Grid columns={4} gap={16}>
        <Stat
          value="+63.1%"
          label="Best ROI · a>3 · >30%"
          tone="success"
        />
        <Stat value="+$14,446" label="Best stock P&L · a>2 · >20%" />
        <Stat
          value="+4.9%"
          label="F500 · 30d 7.5dd"
          tone="warning"
        />
        <Stat value="−1.0%" label="F500 · 7.5dd only" tone="danger" />
      </Grid>

      <Callout tone="warning" title="Percentile loses to analyst/proj">
        Every analyst-count + projected-% cut beats every signal_percentile cut
        on invested return. The weakest of the six (analyst&gt;3 · proj&gt;20%,
        +36.4%) still beats the tightest percentile (&gt;0.80, +32.7%, 38
        names). Tighter percentile is better on rate; loosening adds dollars
        until &gt;0.00, which is worse dollars than &gt;0.20.
      </Callout>

      <Stack gap={8}>
        <H2>Return on avg invested vs stock P&L</H2>
        <Text tone="secondary" size="small">
          Horizontal bars, same 13 buys. Axis is return on avg invested (%) or
          stock P&L ($). Source: VectorBT conclusion run · 2026-01-28 to
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
          height={460}
          beginAtZero
          showValues
          valueSuffix={isRoi ? "%" : ""}
          valuePrefix={isRoi ? "" : "$"}
          categories={BUYS}
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
        <H2>Detail</H2>
        <Text tone="secondary" size="small">
          Win rate, trade counts, book vs SPY, average invested. Source:
          VectorBT conclusion run · 2026-01-28 to 2026-09-18.
        </Text>
        <Table
          headers={[
            "Buy",
            "n",
            "On invested",
            "Stock P&L",
            "Win rate",
            "Trades",
            "vs SPY",
          ]}
          columnAlign={[
            "left",
            "right",
            "right",
            "right",
            "right",
            "right",
            "right",
          ]}
          rows={[
            ["analyst>2 · proj>20%", "84", "+37.2%", "+$14,446", "56.0%", "84 (74c/10o)", "+2.09%"],
            ["analyst>2 · proj>25%", "63", "+46.2%", "+$13,321", "57.1%", "63 (57c/6o)", "+2.81%"],
            ["analyst>2 · proj>30%", "42", "+52.9%", "+$9,569", "61.9%", "42 (39c/3o)", "+3.09%"],
            ["analyst>3 · proj>20%", "42", "+36.4%", "+$7,433", "57.1%", "42 (35c/7o)", "+2.45%"],
            ["analyst>3 · proj>25%", "31", "+51.4%", "+$7,674", "61.3%", "31 (27c/4o)", "+3.65%"],
            ["analyst>3 · proj>30%", "22", "+63.1%", "+$6,346", "68.2%", "22 (21c/1o)", "+4.34%"],
            ["signal_percentile > 0.80", "38", "+32.7%", "+$5,857", "60.5%", "38 (32c/6o)", "+2.23%"],
            ["signal_percentile > 0.60", "76", "+22.7%", "+$8,460", "53.9%", "76 (63c/13o)", "+1.19%"],
            ["signal_percentile > 0.40", "113", "+22.7%", "+$11,435", "50.4%", "113 (99c/14o)", "+0.77%"],
            ["signal_percentile > 0.20", "151", "+18.2%", "+$12,722", "49.0%", "151 (136c/15o)", "+0.34%"],
            ["signal_percentile > 0.00", "188", "+12.8%", "+$10,962", "47.3%", "188 (170c/18o)", "−0.29%"],
            ["Fortune 500 at start · 30d 7.5dd", "501", "+4.9%", "+$13,852", "48.1%", "501 (501c/0o)", "+3.40%"],
            ["Fortune 500 at start · 7.5dd", "501", "−1.0%", "−$3,655", "44.3%", "501 (501c/0o)", "+1.60%"],
          ]}
          rowTone={[...TABLE_TONE]}
          striped
        />
      </Stack>

      <Callout tone="info" title="Fortune 500 is the floor, not a peer">
        Bought all 501 names with a first-day print on 2026-01-28 (FDXF and
        HONA skipped). No analyst target, so the 50% rule never fires. 30d or
        7.5% dd: +4.9% / +$13,852. 7.5% dd alone: −1.0% / −$3,655 — the
        trailing stop from the start-of-period peak stopped out the entire
        universe (501c/0o). The 30d clock is what made the first F500 row
        slightly profitable; leaving names on a 7.5% trailing stop lost money.
      </Callout>

      <Callout tone="success" title="What to freeze">
        Sell stays 30d or 50% of projection or 7.5% trailing drawdown. Buy
        stays analyst&gt;3 · proj&gt;30% for rate (22 names, +63.1%). Use
        analyst&gt;2 · proj&gt;20% or &gt;25% if you want more dollars in play.
        Do not switch the buy filter to signal_percentile or to the Fortune 500
        universe.
      </Callout>
    </Stack>
  );
}
