TRUNCATE TABLE yahoo_all_symbols;
TRUNCATE TABLE google_all_symbols;

\copy yahoo_all_symbols (date, ticker, analyst, percent) FROM 'data/analyst_recomendation/yahoo/all_symbols.csv' CSV HEADER
\copy google_all_symbols (date, ticker, analyst, percent) FROM 'data/analyst_recomendation/google/all_symbols.csv' CSV HEADER
