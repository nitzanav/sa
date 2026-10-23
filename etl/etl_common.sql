-- Combined signals. Percentile is ranked within each signal_name.
CREATE OR REPLACE VIEW signals AS
SELECT
  u.*,
  PERCENT_RANK() OVER (
    PARTITION BY signal_name
    ORDER BY signal_score ASC NULLS FIRST
  ) AS signal_percentile
FROM (
  SELECT source || '-daily' AS signal_name,
         date, ticker, average_projected, analyst_projections_count,
         MAD, signal_score, analyst_percent_list
  FROM signal_score_daily
  WHERE analyst_projections_count > 2 AND average_projected > 10
  UNION ALL
  SELECT source || '-7d-window' AS signal_name,
         date, ticker, average_projected, analyst_projections_count,
         MAD, signal_score, analyst_percent_list
  FROM signal_score_7d_window
  WHERE analyst_projections_count > 2 AND average_projected > 10
) u;
