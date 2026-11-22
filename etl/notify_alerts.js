import { join } from "node:path";
import { query } from "../src/common/db.js";
import { renderFile } from "../src/common/renderFile.js";
import { sendEmail } from "../src/common/sendEmail.js";
import { writeJsonFile } from "../src/common/write_json.js";

async function writeAlerts(alertAt, alerts, positions) {
  const data = { alerted_at: alertAt, alerts, positions };
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const out = join("data/alerts", `${stamp}.json`);
  await writeJsonFile(out, data);
  return { data, out };
}

const alertAt = process.env.ALERT_AT;
if (!alertAt) throw new Error("ALERT_AT is not set");

const alerts = await query(
  "SELECT * FROM alerts WHERE alerted_at = $1::timestamptz ORDER BY type, symbol",
  [alertAt],
);
const positions = await query(
  "SELECT * FROM positions WHERE buy_date = $1::timestamptz OR sell_date = $1::timestamptz ORDER BY symbol",
  [alertAt],
);

const { data, out } = await writeAlerts(alertAt, alerts, positions);
sendEmail({
  subject: `alert bot ${alertAt}`,
  html: await renderFile(import.meta.url, "notify_alert.html.ejs", data),
});
console.log(`${out} (${alerts.length} alerts, ${positions.length} positions)`);
