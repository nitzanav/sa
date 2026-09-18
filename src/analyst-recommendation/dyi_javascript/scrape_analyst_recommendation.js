import { log, logger } from "../../common/logger.js";

export function analystRecommendationDir(source) {
  return `data/analyst_recomendation/${source.name}`;
}

export function sourceForUrl(url, sources) {
  const source = sources.find((candidate) => candidate.matchesUrl(url));
  if (!source) throw new Error(`No analyst recommendation source for ${url}`);
  return source;
}

export const scrapeAnalystRecommendation = log(async function scrapeAnalystRecommendation(
  source,
  url,
  retryConfig,
  cacheConfig,
) {
  logger.addContext({ source: source.name, symbol: source.quoteFromUrl(url) });
  const html = await source.fetch(url, retryConfig, cacheConfig);
  return source.parse(html, source.quoteFromUrl(url));
});

export async function scrapeAnalystRecommendationFromUrl(
  url,
  sources,
  retryConfig,
  cacheConfig,
) {
  const source = sourceForUrl(url, sources);
  const quote = source.quoteFromUrl(url);
  return scrapeAnalystRecommendation(
    source,
    url,
    retryConfig ?? { operationName: quote },
    cacheConfig ?? { fileName: `${analystRecommendationDir(source)}/${quote}.html` },
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { googleAnalystRecommendationSource } = await import(
    "./google_analyst_recommendation.js"
  );
  const { yahooAnalystRecommendationSource } = await import(
    "./yahoo_analyst_recommendation.js"
  );
  const listings = await scrapeAnalystRecommendationFromUrl(process.argv[2], [
    googleAnalystRecommendationSource,
    yahooAnalystRecommendationSource,
  ]);
  process.stdout.write(JSON.stringify(listings, null, 2) + "\n");
}
