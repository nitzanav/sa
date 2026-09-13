import { jest } from "@jest/globals";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("iterates first analyst_recommendations.limit symbols and writes outputs", async () => {
  const html = readFileSync(
    new URL("./__fixtures__/analyst.html", import.meta.url),
    "utf8",
  );
  const cwd = mkdtempSync(join(tmpdir(), "plural-"));
  mkdirSync(join(cwd, "data/fortune_500"), { recursive: true });
  writeFileSync(
    join(cwd, "data/fortune_500/symbols.csv"),
    "Symbol,Name\nAAA,Alpha\nBBB,Beta\nCCC,Gamma\nDDD,Delta\n",
  );
  writeFileSync(
    join(cwd, "data/symbols_exchange.csv"),
    "ticker,exchange\nAAA,NYSE\nBBB,NASDAQ\nCCC,NYSE\nDDD,NYSE\n",
  );
  const originalCwd = process.cwd();
  process.chdir(cwd);
  const fetchSpy = jest.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => html,
  });
  try {
    await import(`./scrape_analyst_recommendations.js?t=${Date.now()}`);
    const all = JSON.parse(
      readFileSync(
        join(cwd, "data/google_analyst_recomendation/all_symbols.json"),
        "utf8",
      ),
    );
    expect(Object.keys(all)).toEqual(["AAA", "BBB", "CCC"]);
    expect(all.AAA).toHaveLength(2);
    expect(
      readFileSync(join(cwd, "data/google_analyst_recomendation/AAA.html"), "utf8"),
    ).toBe(html);
    expect(
      JSON.parse(
        readFileSync(
          join(cwd, "data/google_analyst_recomendation/AAA.json"),
          "utf8",
        ),
      ),
    ).toHaveLength(2);
  } finally {
    fetchSpy.mockRestore();
    process.chdir(originalCwd);
  }
});
