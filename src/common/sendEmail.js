import { spawnSync } from "node:child_process";

export function sendEmail({
  to = process.env.ALERT_EMAIL || "nitzanav@gmail.com",
  subject,
  html,
}) {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "",
    html,
  ].join("\n");
  const sent = spawnSync("/usr/sbin/sendmail", ["-t", "-oi"], { input: message, encoding: "utf8" });
  if (sent.status !== 0) throw new Error((sent.stderr || "sendmail failed").trim());
}
