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
  "2026-01-28 → 2026-09-18 · 232 days (162 trading) · $5k lots · ranked on invested $";

const BUY_CATS = [
  "a>2 · >20%",
  "a>2 · >25%",
  "a>2 · >30%",
  "a>3 · >20%",
  "a>3 · >25%",
  "a>3 · >30%",
];

type Metric = "roi" | "pnl";

const ROI: Record<string, string[]> = {
  "a>2 · >20%": ["+37.2%", "+26.5%", "+29.3%", "+15.1%"],
  "a>2 · >25%": ["+46.2%", "+34.7%", "+37.5%", "+22.6%"],
  "a>2 · >30%": ["+52.9%", "+41.5%", "+47.5%", "+33.6%"],
  "a>3 · >20%": ["+36.4%", "+30.5%", "+32.4%", "+21.9%"],
  "a>3 · >25%": ["+51.4%", "+43.8%", "+47.2%", "+34.2%"],
  "a>3 · >30%": ["+63.1%", "+50.6%", "+61.7%", "+43.3%"],
};

const PNL: Record<string, string[]> = {
  "a>2 · >20%": ["+$14,446", "+$11,101", "+$12,120", "+$6,930"],
  "a>2 · >25%": ["+$13,321", "+$10,647", "+$11,572", "+$7,602"],
  "a>2 · >30%": ["+$9,569", "+$7,932", "+$8,973", "+$6,824"],
  "a>3 · >20%": ["+$7,433", "+$6,532", "+$6,855", "+$5,080"],
  "a>3 · >25%": ["+$7,674", "+$6,820", "+$7,248", "+$5,692"],
  "a>3 · >30%": ["+$6,346", "+$5,360", "+$6,326", "+$4,828"],
};

export default function Focused64Sweep() {
  const [metric, setMetric] = useCanvasState<Metric>("metric", "roi");

  return (
    <Stack gap={24}>
      <Stack gap={8}>
        <Text tone="secondary" size="small">
          Focused 6×4 buy/sell sweep · {PERIOD}. Source: data/signals.csv ·
          VectorBT/optimize.py focus · run 2026-09-21 20:41 UTC+3.
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
        <H2>30D 50% 7.5DD — ALL 6 BUYS</H2>
        <Text tone="secondary" size="small">
          Return on avg invested and stock P&L for the winning sell. Source:
          VectorBT focus run · 2026-01-28 to 2026-09-18.
        </Text>
        <Table
          headers={["Buy", "n", "On invested", "Stock P&L"]}
          columnAlign={["left", "right", "right", "right"]}
          rows={[
            ["analyst>2 · proj>20%", "84", "+37.2%", "+$14,446"],
            ["analyst>2 · proj>25%", "63", "+46.2%", "+$13,321"],
            ["analyst>2 · proj>30%", "42", "+52.9%", "+$9,569"],
            ["analyst>3 · proj>20% (old freeze)", "42", "+36.4%", "+$7,433"],
            ["analyst>3 · proj>25%", "31", "+51.4%", "+$7,674"],
            ["ANALYST>3 · PROJ>30%", "22", "+63.1%", "+$6,346"],
          ]}
          rowTone={[
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            "success",
          ]}
          striped
        />
      </Stack>

      <Grid columns={4} gap={16}>
        <Stat value="+63.1%" label="Best ROI · a>3 · >30% · full sell" tone="success" />
        <Stat value="+$14,446" label="Best stock P&L · a>2 · >20% · full sell" />
        <Stat value="+47.9%" label="Mean ROI of 30d+50%+7.5dd across 6 buys" tone="success" />
        <Stat value="+28.5%" label="Mean ROI of 7.5dd alone (worst sell)" tone="warning" />
      </Grid>

      <Callout tone="info" title="Full sell wins every cell">
        30d or 50% of projection or 7.5% trailing drawdown is strictly best on
        all 6 buys for both return on invested and stock P&L. Dropping 30d costs
        ~5pp; dropping the 50% target costs ~10pp; 7.5% dd alone is last
        everywhere and leaves about twice as many lots open.
      </Callout>

      <Stack gap={8}>
        <H2>Sell ablation — mean return on avg invested</H2>
        <Text tone="secondary" size="small">
          Average of the 6 buy filters. Source: VectorBT focus run · 2026-01-28 to
          2026-09-18.
        </Text>
        <BarChart
          horizontal
          height={200}
          beginAtZero
          valueSuffix="%"
          categories={[
            "30d 50% 7.5dd",
            "50% 7.5dd",
            "30d 7.5dd",
            "7.5dd only",
          ]}
          series={[
            {
              name: "Mean return on avg invested",
              data: [47.9, 42.6, 37.9, 28.5],
              tone: "success",
            },
          ]}
        />
      </Stack>

      <Stack gap={8}>
        <H2>Return on avg invested by buy filter</H2>
        <Text tone="secondary" size="small">
          Grouped bars: four sell rules on each buy. Axis is return on avg
          invested (%). Source: VectorBT focus run · 2026-01-28 to 2026-09-18.
        </Text>
        <BarChart
          height={280}
          beginAtZero
          valueSuffix="%"
          categories={BUY_CATS}
          series={[
            { name: "30d 50% 7.5dd", data: [37.2, 46.2, 52.9, 36.4, 51.4, 63.1] },
            { name: "50% 7.5dd", data: [29.3, 37.5, 47.5, 32.4, 47.2, 61.7] },
            { name: "30d 7.5dd", data: [26.5, 34.7, 41.5, 30.5, 43.8, 50.6] },
            { name: "7.5dd only", data: [15.1, 22.6, 33.6, 21.9, 34.2, 43.3] },
          ]}
        />
      </Stack>

      <Divider />

      <Stack gap={8}>
        <H2>6×4 matrix</H2>
        <Text tone="secondary" size="small">
          Signal counts: a&gt;2 84 / 63 / 42 · a&gt;3 42 / 31 / 22. Old freeze is
          a&gt;3 · &gt;20% (42 names).
        </Text>
        <Row gap={8} wrap>
          <Pill active={metric === "roi"} onClick={() => setMetric("roi")}>
            Return on invested
          </Pill>
          <Pill active={metric === "pnl"} onClick={() => setMetric("pnl")}>
            Stock P&L
          </Pill>
        </Row>
        <Table
          headers={["Buy", "30d 50% 7.5dd", "30d 7.5dd", "50% 7.5dd", "7.5dd"]}
          columnAlign={["left", "right", "right", "right", "right"]}
          rows={BUY_CATS.map((buy) => [
            buy,
            ...((metric === "roi" ? ROI : PNL)[buy] ?? []),
          ])}
          rowTone={[
            undefined,
            undefined,
            undefined,
            undefined,
            "success",
            "success",
          ]}
          striped
        />
      </Stack>

      <Stack gap={8}>
        <H3>Top combos by return on invested</H3>
        <Table
          headers={["Rank", "Sell", "Buy", "n", "On invested", "Stock P&L", "Win rate"]}
          columnAlign={["right", "left", "left", "right", "right", "right", "right"]}
          rows={[
            ["1", "30d 50% 7.5dd", "analyst>3 · >30%", "22", "+63.1%", "+$6,346", "68.2%"],
            ["2", "50% 7.5dd", "analyst>3 · >30%", "22", "+61.7%", "+$6,326", "68.2%"],
            ["3", "30d 50% 7.5dd", "analyst>2 · >30%", "42", "+52.9%", "+$9,569", "61.9%"],
            ["4", "30d 50% 7.5dd", "analyst>3 · >25%", "31", "+51.4%", "+$7,674", "61.3%"],
            ["5", "30d 7.5dd", "analyst>3 · >30%", "22", "+50.6%", "+$5,360", "68.2%"],
            ["6", "30d 50% 7.5dd", "analyst>2 · >25%", "63", "+46.2%", "+$13,321", "57.1%"],
          ]}
          rowTone={["success", undefined, undefined, "success", undefined, undefined]}
          striped
        />
      </Stack>

      <Callout tone="warning" title="What to freeze next">
        Sell stays 30d or 50% target or 7.5% dd — 7.5% dd alone is not a strategy.
        Buy: analyst&gt;3 · proj&gt;25–30% for rate (31 or 22 names). analyst&gt;2 ·
        proj&gt;25% if you want more lots (63 names, +46.2% / +$13,321). Win rate
        is almost entirely a buy effect; sells change hold length, not who won.
      </Callout>
    </Stack>
  );
}
