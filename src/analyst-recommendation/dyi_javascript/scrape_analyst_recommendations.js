import config from "../../common/config.js";
import { readCsv } from "../../common/csv.js";
import { logger } from "../../common/logger.js";
import { writeJsonFile } from "../../common/write_json.js";
import { readSymbolsExchange } from "../../symbols-exchange/fetch_symbols_exchange.js";
import { scrapeAnalystRecommendation } from "./scrape_analyst_recommendation.js";

const dir = "data/google_analyst_recomendation";
const symbols = readCsv("data/fortune_500/symbols.csv").map((row) => row.Symbol);
const exchanges = readSymbolsExchange();
const all = {};
for (const symbol of symbols.slice(0, config.analyst_recommendations.limit)) {
  logger.addContext({ symbol });
  const listings = await scrapeAnalystRecommendation(
    `https://www.google.com/finance/beta/quote/${symbol}:${exchanges[symbol]}?window=YTD&tab=analysis&hl=en`,
    { operationName: symbol },
    { fileName: `${dir}/${symbol}.html` },
  );
  await writeJsonFile(`${dir}/${symbol}.json`, listings);
  all[symbol] = listings;
}
await writeJsonFile(`${dir}/all_symbols.json`, all);
