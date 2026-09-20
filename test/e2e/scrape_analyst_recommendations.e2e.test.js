import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getFortune500Symbols } from "../../src/analyst-recommendation/dyi_javascript/scrape_analyst_recommendations.js";
import config from "../../src/common/config.js";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const resultFile = join(repoRoot, "data/analyst_recomendation/google/all_symbols.json");
const yahooResultFile = join(repoRoot, "data/analyst_recomendation/yahoo/all_symbols.json");
const baselineFile = join(repoRoot, "test/e2e/__baseline__/all_symbols.json");
const cachedHtmlFile = join(repoRoot, "data/analyst_recomendation/google/MMM.html");

const modifiedAt = (fileName) => (existsSync(fileName) ? statSync(fileName).mtimeMs : null);

test(
  "make scrape_analyst_recommendations reuses cache and reproduces recorded result",
  () => {
    const cachedBefore = modifiedAt(cachedHtmlFile);
    execSync("make scrape_analyst_recommendations", { cwd: repoRoot, stdio: "inherit" });

    if (cachedBefore !== null && Date.now() - cachedBefore < config.cache.ttl) {
      expect(modifiedAt(cachedHtmlFile)).toBe(cachedBefore);
    }

    const limitedSymbols = getFortune500Symbols().slice(
      0,
      config.analyst_recommendations.limit,
    );
    const result = JSON.parse(readFileSync(resultFile, "utf8")).filter((row) =>
      limitedSymbols.includes(row.ticker),
    );
    const tickers = [...new Set(result.map((row) => row.ticker))];
    expect(tickers).toHaveLength(limitedSymbols.length);
    expect(tickers).toEqual(expect.arrayContaining(limitedSymbols));

    if (!existsSync(baselineFile)) {
      mkdirSync(dirname(baselineFile), { recursive: true });
      writeFileSync(baselineFile, `${JSON.stringify(result, null, 2)}\n`);
    }

    expect(result).toEqual(JSON.parse(readFileSync(baselineFile, "utf8")));
    expect(existsSync(yahooResultFile)).toBe(true);
    expect(
      existsSync(
        join(
          repoRoot,
          "data/analyst_recomendation/yahoo/all_symbols_per_date_and_symbol.csv",
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(
          repoRoot,
          "data/analyst_recomendation/yahoo/all_symbols_per_date_and_symbol_7d_aggregation_window.csv",
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(repoRoot, "data/analyst_recomendation/all_symbols_per_date_and_symbol.csv"),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(
          repoRoot,
          "data/analyst_recomendation/all_symbols_per_date_and_symbol_7d_aggregation_window.csv",
        ),
      ),
    ).toBe(true);
  },
  config.http.timeout * 2,
);
